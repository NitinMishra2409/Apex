// Gapless streaming playback of 16-bit PCM WAV responses.
//
// /api/speak streams Orpheus audio while Groq is still generating it. Instead of
// waiting for the whole file (as <audio> with a Blob would), we parse the WAV header,
// convert PCM as it arrives, and schedule short buffers back to back on one
// AudioContext timeline. Consecutive phrases join that timeline without gaps.

import { abortError, createBufferedAudio, playbackError } from './bufferedAudio'

const MIN_BATCH_SECONDS = 0.12
const START_DELAY_SECONDS = 0.05
const RESUME_TIMEOUT_MS = 1000
const READ_STALL_MS = 15000
const MAX_PHRASE_BYTES = 4 * 1024 * 1024
const MAX_CHANNELS = 32

async function runningContext(ctx) {
    if (!ctx) return null
    let timeout
    try {
        if (ctx.state !== 'running') await Promise.race([
            ctx.resume(),
            new Promise(resolve => { timeout = setTimeout(resolve, RESUME_TIMEOUT_MS) }),
        ])
        return ctx.state === 'running' ? ctx : null
    } catch { return null }
    finally { clearTimeout(timeout) }
}

/**
 * Parse a WAV header from the start of a stream.
 * @returns {null | {sampleRate, channels, bits, dataOffset}} null until the 'data' chunk header has arrived
 */
export function parseWavHeader(bytes) {
    if (bytes.length < 12) return null
    const text = (at, n) => String.fromCharCode(...bytes.subarray(at, at + n))
    if (text(0, 4) !== 'RIFF' || text(8, 4) !== 'WAVE') throw new Error('The speech service returned invalid audio.')
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    let offset = 12, format = null
    while (offset + 8 <= bytes.length) {
        const id = text(offset, 4), size = view.getUint32(offset + 4, true)
        if (id === 'fmt ') {
            if (size < 16) throw new Error('The speech service returned invalid audio.')
            if (offset + 24 > bytes.length) return null
            format = { encoding: view.getUint16(offset + 8, true), channels: view.getUint16(offset + 10, true), sampleRate: view.getUint32(offset + 12, true), bits: view.getUint16(offset + 22, true) }
        }
        // Streaming WAVs declare a placeholder data size; the data runs to the end of the stream.
        if (id === 'data') {
            if (!format || !format.channels || format.channels > MAX_CHANNELS || !format.sampleRate) throw new Error('The speech service returned invalid audio.')
            if (format.bits !== 16 || format.encoding !== 1) throw Object.assign(new Error('Unsupported speech audio format.'), { code: 'UNSUPPORTED_WAV' })
            const { channels, sampleRate, bits } = format
            return { channels, sampleRate, bits, dataOffset: offset + 8 }
        }
        offset += 8 + size + (size % 2)
    }
    return null
}

/** Interleaved little-endian 16-bit PCM to one Float32Array per channel. Whole frames only. */
export function pcm16ToChannels(bytes, channels) {
    const frames = Math.floor(bytes.length / (2 * channels))
    const view = new DataView(bytes.buffer, bytes.byteOffset, frames * 2 * channels)
    const out = Array.from({ length: channels }, () => new Float32Array(frames))
    for (let f = 0; f < frames; f++) for (let c = 0; c < channels; c++) out[c][f] = view.getInt16((f * channels + c) * 2, true) / 0x8000
    return { channels: out, usedBytes: frames * 2 * channels }
}

const concat = (a, b) => { const out = new Uint8Array(a.length + b.length); out.set(a); out.set(b, a.length); return out }

/** One player per conversation. Call unlock() directly from a user gesture. */
export function createWavPlayer() {
    const buffered = createBufferedAudio()
    let context = null, nextTime = 0
    const sources = new Set(), jobs = new Set(), stateTimers = new Set()
    let idleWaiters = []

    const settleIdle = error => {
        if (sources.size) return
        // Nothing is audible, so a delayed 'speaking' (e.g. a throttled background-tab timer) would be stale.
        for (const timer of stateTimers) clearTimeout(timer)
        stateTimers.clear()
        const waiters = idleWaiters; idleWaiters = []
        for (const waiter of waiters) waiter(error)
    }
    const stopAll = (error = abortError()) => {
        for (const source of sources) {
            source.onended = null
            try { source.stop() } catch { /* already ended */ }
            source.disconnect()
        }
        sources.clear(); nextTime = 0
        for (const job of jobs) {
            job.error = error
            job.reader.cancel().catch(() => {})
            job.cleanup()
        }
        jobs.clear()
        buffered.stop()
        settleIdle(error)
    }
    const ensure = () => {
        const Ctx = window.AudioContext || window.webkitAudioContext
        if (!Ctx) return null
        try {
            if (!context || context.state === 'closed') {
                context = new Ctx()
                context.onstatechange = () => {
                    if (context.state !== 'running' && sources.size) stopAll(playbackError())
                }
            }
        } catch { return null }
        return context
    }
    const drain = signal => {
        if (signal?.aborted) return Promise.reject(abortError())
        if (!sources.size) return Promise.resolve()
        return new Promise((resolve, reject) => {
            const onAbort = () => stopAll(abortError())
            signal?.addEventListener('abort', onAbort, { once: true })
            idleWaiters.push(error => {
                signal?.removeEventListener('abort', onAbort)
                error ? reject(error) : resolve()
            })
        })
    }
    const schedule = (ctx, format, channelData, job, onFirst) => {
        if (ctx.state !== 'running') throw playbackError()
        const buffer = ctx.createBuffer(format.channels, channelData[0].length, format.sampleRate)
        channelData.forEach((data, c) => buffer.copyToChannel(data, c))
        const source = ctx.createBufferSource()
        source.buffer = buffer
        source.connect(ctx.destination)
        const at = Math.max(nextTime, ctx.currentTime + START_DELAY_SECONDS)
        source.onended = () => {
            sources.delete(source); source.disconnect()
            job.remaining--
            if (!job.reading && !job.remaining) { job.cleanup(); jobs.delete(job) }
            settleIdle()
        }
        sources.add(source); job.remaining++
        source.start(at)
        nextTime = at + buffer.duration
        onFirst?.(at - ctx.currentTime)
    }
    return {
        /** Never rejects; a phrase that still cannot play reports its own readable error. */
        async unlock() {
            buffered.prime()
            await runningContext(ensure())
        },
        /** Resolves once streaming audio is scheduled, or buffered audio has finished. */
        async play(body, signal, onState = () => {}) {
            const reader = body.getReader()
            const abort = () => stopAll(abortError())
            const job = { reader, reading: true, remaining: 0, error: null, cleanup: () => signal.removeEventListener('abort', abort) }
            jobs.add(job)
            if (signal.aborted) { abort(); reader.releaseLock(); throw abortError() }
            signal.addEventListener('abort', abort, { once: true })
            let pending = new Uint8Array(0), format = null, batch = [], batchFrames = 0, announced = false
            let totalBytes = 0, totalFrames = 0, readTimeout
            const ctx = await runningContext(ensure())
            let useBuffered = !ctx
            const flush = () => {
                if (!batchFrames) return
                const merged = Array.from({ length: format.channels }, (_, c) => {
                    const out = new Float32Array(batchFrames)
                    let at = 0
                    for (const part of batch) { out.set(part[c], at); at += part[c].length }
                    return out
                })
                schedule(ctx, format, merged, job, announced ? null : delay => {
                    announced = true
                    const timer = setTimeout(() => {
                        stateTimers.delete(timer)
                        if (!signal.aborted && !job.error) onState('speaking')
                    }, Math.max(0, delay * 1000))
                    stateTimers.add(timer)
                })
                batch = []; batchFrames = 0
            }
            try {
                while (true) {
                    if (job.error) throw job.error
                    readTimeout = setTimeout(() => stopAll(playbackError()), READ_STALL_MS)
                    const { done, value } = await reader.read()
                    clearTimeout(readTimeout)
                    if (job.error) throw job.error
                    if (done) break
                    totalBytes += value.length
                    if (totalBytes > MAX_PHRASE_BYTES) throw playbackError()
                    pending = concat(pending, value)
                    if (useBuffered) continue
                    if (!format) {
                        let header
                        try { header = parseWavHeader(pending) }
                        catch (error) {
                            if (error.code !== 'UNSUPPORTED_WAV') throw error
                            useBuffered = true
                            continue
                        }
                        if (!header) continue
                        format = header
                        pending = pending.subarray(header.dataOffset)
                    }
                    const { channels, usedBytes } = pcm16ToChannels(pending, format.channels)
                    pending = pending.slice(usedBytes)
                    if (channels[0].length) {
                        batch.push(channels); batchFrames += channels[0].length; totalFrames += channels[0].length
                    }
                    if (batchFrames >= format.sampleRate * MIN_BATCH_SECONDS) flush()
                }
                if (useBuffered) {
                    await drain(signal)
                    if (job.error) throw job.error
                    await buffered.play(pending, signal, onState)
                } else {
                    // A trailing partial sample is dropped rather than discarding the audio already scheduled.
                    if (!format || !totalFrames) throw playbackError()
                    flush()
                }
            } catch (error) {
                if (job.error) throw job.error // already stopped; stopping again could cancel a newer phrase
                const failure = error.name === 'AbortError' ? error : playbackError()
                stopAll(failure)
                throw failure
            } finally {
                clearTimeout(readTimeout)
                reader.releaseLock()
                job.reading = false
                if (!job.remaining) { job.cleanup(); jobs.delete(job) }
            }
        },
        drain,
        stop: () => stopAll(),
        dispose() {
            stopAll()
            if (context) {
                context.onstatechange = null
                context.close().catch(() => {})
                context = null
            }
        },
    }
}
