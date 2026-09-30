import { afterEach, describe, expect, it, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import { transcribeHandler } from '../../api/transcribe.js'
import { allowLocalDemo } from '../../server/assistant/runtime.js'
import { audioExtension, transcribeAudio } from '../../server/speech/transcription.js'

afterEach(() => vi.unstubAllGlobals())
function request({ headers = {}, body = Buffer.from('opus'), url = '/api/transcribe', local = false } = {}) {
    const req = new EventEmitter()
    Object.assign(req, { method: 'POST', url, body, socket: { remoteAddress: local ? '127.0.0.1' : '203.0.113.9' }, headers: { host: 'localhost:5173', 'content-type': 'audio/webm;codecs=opus', ...headers } })
    return req
}
function response() {
    const res = new EventEmitter()
    Object.assign(res, { setHeader: vi.fn(), end: vi.fn() })
    return res
}
const env = { GROQ_API_KEY: 'groq-key', SUPABASE_URL: 'https://project.supabase.co', SUPABASE_ANON_KEY: 'anon' }

describe('POST /api/transcribe', () => {
    it('rejects anonymous callers before reading audio or calling Groq', async () => {
        const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
        const res = response()
        await transcribeHandler(request(), res, env)
        expect(res.statusCode).toBe(401)
        expect(fetcher).not.toHaveBeenCalled()
    })
    it('rejects the demo token from anywhere but a local demo request', async () => {
        const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
        const res = response()
        await transcribeHandler(request({ headers: { authorization: 'Bearer demo-access-token', 'x-apex-demo-session': 'transcribe-demo-0001' } }), res, env)
        expect(res.statusCode).toBe(401)
        expect(fetcher).not.toHaveBeenCalled()
    })
    it('verifies the session, then sends the recording to Groq Whisper untouched', async () => {
        const fetcher = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'user-1' })))
            .mockResolvedValueOnce(new Response(JSON.stringify({ text: ' Long NIFTY at 22400. ' })))
        vi.stubGlobal('fetch', fetcher)
        const res = response()
        await transcribeHandler(request({ headers: { authorization: 'Bearer user-token' }, url: '/api/transcribe?language=hi' }), res, env)
        expect(fetcher.mock.calls[0][0]).toBe('https://project.supabase.co/auth/v1/user')
        const [url, init] = fetcher.mock.calls[1]
        expect(url).toBe('https://api.groq.com/openai/v1/audio/transcriptions')
        expect(init.headers.Authorization).toBe('Bearer groq-key')
        expect(init.body.get('model')).toBe('whisper-large-v3-turbo')
        expect(init.body.get('language')).toBe('hi')
        const file = init.body.get('file')
        expect(file.name).toBe('speech.webm'); expect(await file.text()).toBe('opus')
        expect(res.statusCode).toBe(200)
        expect(JSON.parse(res.end.mock.calls[0][0])).toEqual({ text: 'Long NIFTY at 22400.' })
        const timing = res.setHeader.mock.calls.find(([name]) => name === 'Server-Timing')?.[1]
        expect(timing).toMatch(/auth;dur=\d+\.\d, provider;dur=\d+\.\d/)
        expect(timing).not.toMatch(/user-token|groq-key|NIFTY|user-1/)
    })
    it('serves local demo dictation without Supabase', async () => {
        const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ text: 'Short BTC.' })))
        vi.stubGlobal('fetch', fetcher)
        const req = request({ local: true, headers: { authorization: 'Bearer demo-access-token', 'x-apex-demo-session': 'transcribe-demo-0001' } })
        allowLocalDemo(req, { VITE_DEMO_MODE: 'true' })
        const res = response()
        await transcribeHandler(req, res, env)
        expect(fetcher).toHaveBeenCalledTimes(1)
        expect(JSON.parse(res.end.mock.calls[0][0])).toEqual({ text: 'Short BTC.' })
    })
    it('rejects other methods before consuming audio', async () => {
        const res = response()
        await transcribeHandler({ method: 'GET' }, res, env)
        expect(res.statusCode).toBe(405)
        expect(res.setHeader).toHaveBeenCalledWith('Allow', 'POST')
    })
})

describe('Groq transcription', () => {
    it.each([['audio/webm;codecs=opus', 'webm'], ['audio/ogg', 'ogg'], ['audio/mp4', 'm4a'], ['audio/wav', 'wav'], ['text/html', null]])('maps %s to .%s', (type, ext) => {
        expect(audioExtension(type)).toBe(ext)
    })
    it('refuses unsupported formats and missing keys without calling Groq', async () => {
        const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
        await expect(transcribeAudio(Buffer.from('x'), 'text/html', 'en', env)).rejects.toMatchObject({ status: 415 })
        await expect(transcribeAudio(Buffer.from('x'), 'audio/webm', 'en', {})).rejects.toMatchObject({ code: 'NO_KEY' })
        expect(fetcher).not.toHaveBeenCalled()
    })
    it('reports rate limits without leaking provider details', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('private provider details', { status: 429 })))
        await expect(transcribeAudio(Buffer.from('x'), 'audio/webm', 'en', env)).rejects.toMatchObject({ status: 429, code: 'RATE_LIMITED', message: 'Transcription is busy right now. Try again in a few seconds.' })
    })
})
