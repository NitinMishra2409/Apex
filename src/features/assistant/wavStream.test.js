import { afterEach, describe, expect, it, vi } from 'vitest'
import { createWavPlayer, parseWavHeader, pcm16ToChannels } from './wavStream'

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers() })

function bufferedPlayback() {
    const elements = [], blobs = []
    class AudioElement {
        constructor() { elements.push(this); this.src = ''; this.paused = true; this.plays = [] }
        play() { this.plays.push(this.src); this.paused = false; this.onplaying?.(); return Promise.resolve() }
        pause() { this.paused = true }
        removeAttribute() { this.src = '' }
        load() {}
    }
    vi.stubGlobal('Audio', AudioElement)
    vi.spyOn(URL, 'createObjectURL').mockImplementation(blob => { blobs.push(blob); return `blob:audio-${blobs.length}` })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    return { elements, blobs }
}

function wavBody() {
    const bytes = new Uint8Array(streamingHeader().length + 4800)
    bytes.set(streamingHeader())
    return bytes
}

function webAudio({ state = 'running', resume = async () => {} } = {}) {
    const sources = []
    const context = {
        state, currentTime: 0, destination: {}, resume,
        createBuffer: (channels, frames, rate) => ({ duration: frames / rate, copyToChannel() {} }),
        createBufferSource() {
            const source = { connect() {}, disconnect() {}, start(at) { this.at = at }, stop() { this.stopped = true } }
            sources.push(source)
            return source
        },
    }
    vi.stubGlobal('window', { AudioContext: class { constructor() { return context } } })
    return { context, sources }
}

describe('WAV player', () => {
    it('stops scheduled audio and clears delayed speaking events when the stream fails', async () => {
        const { sources } = webAudio(), states = []
        let stream
        const body = new ReadableStream({ start(controller) { stream = controller } })
        const player = createWavPlayer()
        const playing = player.play(body, new AbortController().signal, state => states.push(state))
        const result = expect(playing).rejects.toThrow('Speech playback')
        stream.enqueue(new Uint8Array([...streamingHeader(), ...new Uint8Array(7200)]))
        await vi.waitFor(() => expect(sources).toHaveLength(1), { interval: 1 })
        stream.error(new Error('connection lost'))
        await result
        expect(sources.every(source => source.stopped)).toBe(true)
        await player.drain()
        await new Promise(resolve => setTimeout(resolve, 70))
        expect(states).toEqual([])
    })

    it('cancels scheduled playback even after the response finished downloading', async () => {
        const { sources } = webAudio(), controller = new AbortController(), player = createWavPlayer()
        await player.play(new Response(wavBody()).body, controller.signal)
        expect(sources).toHaveLength(1)
        controller.abort()
        expect(sources[0].stopped).toBe(true)
        await expect(player.drain(controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
    })

    it('keeps scheduled audio when the stream ends on a partial sample', async () => {
        const { sources } = webAudio(), player = createWavPlayer()
        await player.play(new Response(new Uint8Array([...wavBody(), 0x12])).body, new AbortController().signal)
        expect(sources).toHaveLength(1)
        expect(sources[0].stopped).toBeUndefined()
    })

    it('does not let a phrase stopped during context resume cancel the next phrase', async () => {
        const pending = [], resumed = () => pending.forEach(resolve => resolve())
        const { context, sources } = webAudio({ state: 'suspended', resume: () => new Promise(resolve => pending.push(resolve)) })
        const player = createWavPlayer()
        const stale = player.play(new Response(wavBody()).body, new AbortController().signal)
        stale.catch(() => {})
        player.stop()
        const next = player.play(new Response(wavBody()).body, new AbortController().signal)
        context.state = 'running'; resumed()
        await expect(stale).rejects.toMatchObject({ name: 'AbortError' })
        await next
        expect(sources).toHaveLength(1)
        expect(sources[0].stopped).toBeUndefined()
    })

    it('never reports speaking after the last scheduled audio has ended', async () => {
        vi.useFakeTimers()
        const { sources } = webAudio(), states = [], player = createWavPlayer()
        await player.play(new Response(wavBody()).body, new AbortController().signal, state => states.push(state))
        // A throttled background-tab timer can fire after playback already finished.
        sources[0].onended()
        await player.drain()
        vi.runAllTimers()
        expect(states).toEqual([])
    })

    it('cancels a stalled response when stopped without waiting for another chunk', async () => {
        webAudio()
        const cancel = vi.fn(), player = createWavPlayer()
        const playing = player.play(new ReadableStream({ cancel }), new AbortController().signal)
        const result = expect(playing).rejects.toMatchObject({ name: 'AbortError' })
        await new Promise(resolve => setTimeout(resolve, 0))
        player.stop()
        await result
        expect(cancel).toHaveBeenCalled()
    })
    it.each(['rejected resume', 'suspended after resume', 'non-PCM', '24-bit PCM'])('buffers the same response for %s', async reason => {
        const { sources } = webAudio({ state: reason.includes('resume') ? 'suspended' : 'running', resume: reason === 'rejected resume' ? async () => { throw new Error('blocked') } : async () => {} })
        const { elements, blobs } = bufferedPlayback(), bytes = wavBody()
        if (reason === 'non-PCM') new DataView(bytes.buffer).setUint16(20, 3, true)
        if (reason === '24-bit PCM') new DataView(bytes.buffer).setUint16(34, 24, true)
        const player = createWavPlayer()
        const playing = player.play(new Response(bytes).body, new AbortController().signal)
        playing.catch(() => {})
        await vi.waitFor(() => expect(blobs).toHaveLength(1))
        expect(blobs[0].size).toBe(bytes.length)
        expect(sources).toHaveLength(0)
        elements[0].onended()
        await playing
    })
    it('primes the audio element inside the gesture and reuses it for buffered playback', async () => {
        vi.stubGlobal('window', {})
        const { elements } = bufferedPlayback(), player = createWavPlayer()
        player.unlock()
        expect(elements).toHaveLength(1)
        expect(elements[0].plays).toHaveLength(1)
        const playing = player.play(new Response(wavBody()).body, new AbortController().signal)
        await vi.waitFor(() => expect(elements[0].plays).toHaveLength(2))
        expect(elements).toHaveLength(1)
        elements[0].onended()
        await playing
    })
    it('plays the complete response through an audio element when Web Audio is unavailable', async () => {
        vi.stubGlobal('window', {})
        const { elements, blobs } = bufferedPlayback(), states = []
        const player = createWavPlayer(), bytes = wavBody()
        const playing = player.play(new Response(bytes).body, new AbortController().signal, state => states.push(state))
        await vi.waitFor(() => expect(blobs).toHaveLength(1))
        expect(blobs[0].size).toBe(bytes.length)
        // Native decoders need real lengths in place of the streaming 0xFFFFFFFF placeholders.
        const sent = new DataView(await blobs[0].arrayBuffer()), dataAt = streamingHeader().length - 8
        expect(sent.getUint32(4, true)).toBe(bytes.length - 8)
        expect(sent.getUint32(dataAt + 4, true)).toBe(bytes.length - dataAt - 8)
        expect(states).toEqual(['speaking'])
        elements[0].onended()
        await playing
        await player.drain()
        expect(elements[0].paused).toBe(true)
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:audio-1')
    })
})

// Groq's streaming WAV: RIFF size 0xFFFFFFFF, a LIST chunk before the data chunk.
function streamingHeader({ channels = 1, sampleRate = 24000 } = {}) {
    const list = new Uint8Array(26)
    const bytes = new Uint8Array(12 + 24 + 8 + list.length + 8)
    const view = new DataView(bytes.buffer)
    const ascii = (at, text) => [...text].forEach((ch, i) => { bytes[at + i] = ch.charCodeAt(0) })
    ascii(0, 'RIFF'); view.setUint32(4, 0xFFFFFFFF, true); ascii(8, 'WAVE')
    ascii(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true)
    view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2 * channels, true); view.setUint16(32, 2 * channels, true); view.setUint16(34, 16, true)
    ascii(36, 'LIST'); view.setUint32(40, list.length, true)
    const data = 44 + list.length
    ascii(data, 'data'); view.setUint32(data + 4, 0xFFFFFFFF, true)
    return bytes
}

describe('streaming WAV header', () => {
    it('waits until the data chunk has arrived, then reports the format', () => {
        const header = streamingHeader()
        expect(parseWavHeader(header.subarray(0, 30))).toBeNull()
        expect(parseWavHeader(header)).toEqual({ channels: 1, sampleRate: 24000, bits: 16, dataOffset: header.length })
    })
    it('rejects anything that is not WAV', () => {
        expect(() => parseWavHeader(new TextEncoder().encode('<html>not audio</html>'))).toThrow('invalid audio')
    })
})

describe('PCM conversion', () => {
    it('converts whole frames and leaves a split sample for the next chunk', () => {
        const bytes = new Uint8Array([0x00, 0x80, 0xff, 0x7f, 0x00])
        const { channels, usedBytes } = pcm16ToChannels(bytes, 1)
        expect(usedBytes).toBe(4)
        expect(channels[0][0]).toBe(-1)
        expect(channels[0][1]).toBeCloseTo(1, 3)
    })
    it('de-interleaves stereo', () => {
        const bytes = new Uint8Array(new Int16Array([1000, -1000, 2000, -2000]).buffer)
        const { channels } = pcm16ToChannels(bytes, 2)
        expect([...channels[0]].map(v => Math.round(v * 0x8000))).toEqual([1000, 2000])
        expect([...channels[1]].map(v => Math.round(v * 0x8000))).toEqual([-1000, -2000])
    })
})
