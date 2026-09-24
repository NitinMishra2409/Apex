// Microphone capture + WAV encoding.
//
// NVIDIA's ASR endpoint accepts WAV, OPUS or FLAC. MediaRecorder gives us a
// WebM/Ogg container instead, so we decode what it produced and re-encode to
// 16 kHz mono 16-bit WAV — the format Whisper expects, and ~32 KB/s on the wire.

export const TARGET_SAMPLE_RATE = 16000
export const MAX_RECORDING_MS = 120000 // 2 minutes is plenty to describe a trade

export function recordingSupported() {
    return typeof window !== 'undefined'
        && typeof window.MediaRecorder !== 'undefined'
        && !!navigator?.mediaDevices?.getUserMedia
}

function pickMimeType() {
    const candidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
    ]
    return candidates.find(t => {
        try { return MediaRecorder.isTypeSupported(t) } catch { return false }
    }) ?? ''
}

/**
 * Begin recording. Resolves to a handle with stop() -> Promise<Blob(wav)> and cancel().
 * Throws if the user denies microphone permission.
 */
export async function startRecording({ onSilence, onLevel, onNoSpeech } = {}) {
    const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    })

    const releaseTracks = () => { for (const track of stream.getTracks()) track.stop() }
    const mimeType = pickMimeType()
    let recorder
    try { recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined) }
    catch (err) { releaseTracks(); throw err }
    const chunks = []
    recorder.ondataavailable = e => { if (e.data?.size) chunks.push(e.data) }
    try { recorder.start() } catch (err) { releaseTracks(); throw err }
    let audioContext, monitor, ended = false
    const releaseMic = () => {
        ended = true
        clearInterval(monitor)
        audioContext?.close().catch(() => {})
        releaseTracks()
    }
    if (onSilence) {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext
            audioContext = new AudioCtx()
            await audioContext.resume()
            const analyser = audioContext.createAnalyser()
            analyser.fftSize = 2048
            audioContext.createMediaStreamSource(stream).connect(analyser)
            const samples = new Float32Array(analyser.fftSize)
            const began = Date.now()
            let voicedFrames = 0, lastVoice = 0
            monitor = setInterval(() => {
                if (ended) return
                analyser.getFloatTimeDomainData(samples)
                const rms = Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length)
                onLevel?.(Math.min(1, rms * 9))
                if (rms > .018) { voicedFrames++; lastVoice = Date.now() }
                if (voicedFrames >= 4 && Date.now() - lastVoice > 1250) { clearInterval(monitor); onSilence() }
                else if (voicedFrames < 4 && Date.now() - began > 30000) { clearInterval(monitor); onNoSpeech?.() }
            }, 100)
        } catch (err) { releaseMic(); try { recorder.stop() } catch { /* inactive */ } throw err }
    }

    return {
        get state() { return recorder.state },

        stop() {
            return new Promise((resolve, reject) => {
                recorder.onerror = e => {
                    releaseMic()
                    reject(e.error ?? new Error('Recording failed.'))
                }
                recorder.onstop = async () => {
                    releaseMic()
                    try {
                        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
                        if (!blob.size) throw new Error('No audio was captured.')
                        resolve(await blobToWav(blob))
                    } catch (err) {
                        reject(err)
                    }
                }
                if (recorder.state === 'inactive') recorder.onstop()
                else recorder.stop()
            })
        },

        cancel() {
            try { if (recorder.state !== 'inactive') { recorder.onstop = null; recorder.stop() } }
            catch { /* already stopped */ }
            releaseMic()
        },
    }
}

/** Decode any browser-recorded blob and re-encode it as 16 kHz mono WAV. */
export async function blobToWav(blob) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) throw new Error('Web Audio is not available in this browser.')

    const bytes = await blob.arrayBuffer()
    const ctx = new AudioCtx()
    let decoded
    try {
        decoded = await ctx.decodeAudioData(bytes)
    } catch {
        throw new Error('Could not decode the recorded audio.')
    } finally {
        ctx.close()
    }

    const mono = await resampleToMono(decoded, TARGET_SAMPLE_RATE)
    return encodeWav(mono, TARGET_SAMPLE_RATE)
}

/** Downmix to one channel and resample, using the browser's own resampler. */
async function resampleToMono(buffer, sampleRate) {
    const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext
    const frames = Math.max(1, Math.ceil(buffer.duration * sampleRate))

    // Rendering into a 1-channel destination downmixes multi-channel input.
    const offline = new OfflineCtx(1, frames, sampleRate)
    const source = offline.createBufferSource()
    source.buffer = buffer
    source.connect(offline.destination)
    source.start()

    const rendered = await offline.startRendering()
    return rendered.getChannelData(0)
}

/** Float32 samples in [-1,1] -> 16-bit PCM WAV blob. */
export function encodeWav(samples, sampleRate) {
    const dataBytes = samples.length * 2
    const view = new DataView(new ArrayBuffer(44 + dataBytes))

    const writeAscii = (offset, text) => {
        for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
    }

    writeAscii(0, 'RIFF')
    view.setUint32(4, 36 + dataBytes, true)
    writeAscii(8, 'WAVE')
    writeAscii(12, 'fmt ')
    view.setUint32(16, 16, true)          // PCM header size
    view.setUint16(20, 1, true)           // format = PCM
    view.setUint16(22, 1, true)           // mono
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * 2, true) // byte rate
    view.setUint16(32, 2, true)           // block align
    view.setUint16(34, 16, true)          // bits per sample
    writeAscii(36, 'data')
    view.setUint32(40, dataBytes, true)

    let offset = 44
    for (let i = 0; i < samples.length; i++, offset += 2) {
        const s = Math.max(-1, Math.min(1, samples[i]))
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    }

    return new Blob([view.buffer], { type: 'audio/wav' })
}
