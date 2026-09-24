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
    it('serves local demo speech with no NVIDIA key or Supabase request', async () => {
        const req = new EventEmitter()
        Object.assign(req, { method: 'POST', body: { text: 'Hello from your coach.' }, socket: { remoteAddress: '127.0.0.1' }, headers: { host: 'localhost:5173', authorization: 'Bearer demo-access-token', 'x-apex-demo-session': 'speech-demo-session-001' } })
        allowLocalDemo(req, { VITE_DEMO_MODE: 'true' })
        const res = new EventEmitter(); res.setHeader = vi.fn(); res.end = vi.fn()
        const wav = wavFixture(), fetcher = vi.fn().mockResolvedValue(new Response(wav)); vi.stubGlobal('fetch', fetcher)
        await speakHandler(req, res, { GROQ_API_KEY: 'key' })
        expect(res.statusCode).toBe(200); expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'audio/wav')
        expect(res.end).toHaveBeenCalledWith(wav); expect(fetcher).toHaveBeenCalledTimes(1)
    })
})
