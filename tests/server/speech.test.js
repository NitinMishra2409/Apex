import { afterEach, describe, expect, it, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import { synthesize } from '../../server/speech/synthesis.js'
import { speakHandler } from '../../api/speak.js'
import { allowLocalDemo } from '../../server/assistant/runtime.js'

afterEach(() => vi.unstubAllGlobals())
function wavFixture() {
    const wav = Buffer.alloc(48)
    wav.write('RIFF'); wav.writeUInt32LE(40, 4); wav.write('WAVEfmt ', 8)
    wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22)
    wav.writeUInt32LE(24000, 24); wav.writeUInt32LE(48000, 28)
    wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(4, 40)
    return wav
}
describe('Orpheus speech', () => {
    it('uses Autumn with the Groq key and returns provider WAV bytes unchanged', async () => {
        const wav = wavFixture(), controller = new AbortController()
        const fetcher = vi.fn().mockResolvedValue(new Response(wav)); vi.stubGlobal('fetch', fetcher)
        expect(await synthesize('Hello from Apex.', { GROQ_API_KEY: 'speech-key', NVIDIA_API_KEY: 'never-send-this' }, controller.signal)).toEqual(wav)
        const [url, request] = fetcher.mock.calls[0]
        expect(url).toBe('https://api.groq.com/openai/v1/audio/speech')
        expect(request.headers.Authorization).toBe('Bearer speech-key'); expect(request.signal).toBe(controller.signal)
        expect(JSON.parse(request.body)).toEqual({ model: 'canopylabs/orpheus-v1-english', voice: 'autumn', response_format: 'wav', input: 'Hello from Apex.' })
    })
    it.each(['', ' '.repeat(5), 'x'.repeat(201)])('rejects invalid text before sending it to Groq', async text => {
        const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
        await expect(synthesize(text, { GROQ_API_KEY: 'key' })).rejects.toMatchObject({ code: 'BAD_TEXT' })
        expect(fetcher).not.toHaveBeenCalled()
    })
    it('requires a Groq key even when a NVIDIA key is available', async () => {
        const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
        await expect(synthesize('Hello.', { NVIDIA_API_KEY: 'voice-key' })).rejects.toMatchObject({ code: 'NO_KEY' })
        expect(fetcher).not.toHaveBeenCalled()
    })
    it('does not generate cancelled speech', async () => {
        const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
        const controller = new AbortController(); controller.abort()
        await expect(synthesize('Hello.', { GROQ_API_KEY: 'key' }, controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
        expect(fetcher).not.toHaveBeenCalled()
    })
    it('rejects non-WAV and oversized responses before browser playback', async () => {
        const fetcher = vi.fn().mockResolvedValueOnce(new Response('not audio')).mockResolvedValueOnce(new Response(new Uint8Array(4 * 1024 * 1024 + 1)))
        vi.stubGlobal('fetch', fetcher)
        await expect(synthesize('Hello.', { GROQ_API_KEY: 'key' })).rejects.toMatchObject({ code: 'BAD_SPEECH' })
        await expect(synthesize('Hello.', { GROQ_API_KEY: 'key' })).rejects.toMatchObject({ code: 'SPEECH_TOO_LARGE' })
    })
    it('reports rate limits without leaking provider details', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('private provider details', { status: 429 })))
        await expect(synthesize('Hello.', { GROQ_API_KEY: 'key' })).rejects.toMatchObject({ status: 429, code: 'SPEECH_UNAVAILABLE', message: 'Groq speech quota was reached. Try again shortly.' })
    })
    const demoSpeechRequest = () => {
        const req = new EventEmitter()
        Object.assign(req, { method: 'POST', body: { text: 'Hello from your coach.' }, socket: { remoteAddress: '127.0.0.1' }, headers: { host: 'localhost:5173', authorization: 'Bearer demo-access-token', 'x-apex-demo-session': 'speech-demo-session-001' } })
        allowLocalDemo(req, { VITE_DEMO_MODE: 'true' })
        return req
    }
    const streamingResponse = () => { const res = new EventEmitter(); res.setHeader = vi.fn(); res.write = vi.fn(); res.end = vi.fn(); return res }
    it('streams local demo speech through as it arrives, with no Supabase request', async () => {
        const wav = wavFixture()
        // Deliver the WAV in pieces, the way Groq streams it.
        const body = new ReadableStream({ start(c) { c.enqueue(wav.subarray(0, 8)); c.enqueue(wav.subarray(8, 30)); c.enqueue(wav.subarray(30)); c.close() } })
        const fetcher = vi.fn().mockResolvedValue(new Response(body)); vi.stubGlobal('fetch', fetcher)
        const res = streamingResponse()
        await speakHandler(demoSpeechRequest(), res, { GROQ_API_KEY: 'key' })
        expect(res.statusCode).toBe(200); expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'audio/wav')
        expect(res.setHeader.mock.calls.find(([name]) => name === 'Server-Timing')?.[1]).toMatch(/auth;dur=\d+\.\d, provider;dur=\d+\.\d/)
        expect(Buffer.concat(res.write.mock.calls.map(c => c[0]))).toEqual(wav)
        expect(res.write.mock.calls.length).toBeGreaterThan(1)
        expect(res.end).toHaveBeenCalled(); expect(fetcher).toHaveBeenCalledTimes(1)
    })
    it('answers with a JSON error, not audio headers, when the provider sends something that is not WAV', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>oops</html>')))
        const res = streamingResponse()
        await speakHandler(demoSpeechRequest(), res, { GROQ_API_KEY: 'key' })
        expect(res.statusCode).toBe(502); expect(res.write).not.toHaveBeenCalled()
        expect(JSON.parse(res.end.mock.calls[0][0])).toMatchObject({ code: 'BAD_SPEECH' })
    })
    it('reports the first speech request timing when Groq is rate limited', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('busy', { status: 429 })))
        const res = streamingResponse()
        await speakHandler(demoSpeechRequest(), res, { GROQ_API_KEY: 'key' })
        expect(res.statusCode).toBe(429)
        expect(res.setHeader.mock.calls.find(([name]) => name === 'Server-Timing')?.[1]).toMatch(/auth;dur=\d+\.\d, provider;dur=\d+\.\d/)
    })
})
