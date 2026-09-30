import { afterEach, describe, expect, it, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import { checklistMatchHandler } from '../../api/checklist-match.js'
import { allowLocalDemo, forgetVerifiedSessions } from '../../server/assistant/runtime.js'

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); forgetVerifiedSessions() })

const ITEMS = ['Stop loss placed', 'Position sized within risk', 'Not revenge trading']
const env = { GROQ_API_KEY: 'groq-key', SUPABASE_URL: 'https://project.supabase.co', SUPABASE_ANON_KEY: 'anon' }

function request({ headers = {}, body = { transcript: 'my stop is in and I am not chasing', items: ITEMS }, method = 'POST' } = {}) {
    const req = new EventEmitter()
    Object.assign(req, { method, url: '/api/checklist-match', body, socket: { remoteAddress: '127.0.0.1' }, headers: { host: 'localhost:5173', 'content-type': 'application/json', ...headers } })
    return req
}
function demoRequest(options) {
    const req = request({ ...options, headers: { authorization: 'Bearer demo-access-token', 'x-apex-demo-session': 'checklist-demo-0001', ...options?.headers } })
    allowLocalDemo(req, { VITE_DEMO_MODE: 'true' })
    return req
}
function response() {
    const res = new EventEmitter()
    Object.assign(res, { setHeader: vi.fn(), end: vi.fn() })
    return res
}
const reply = (content, extra = {}) => new Response(JSON.stringify({ choices: [{ message: { content: typeof content === 'string' ? content : JSON.stringify(content) }, finish_reason: 'stop', ...extra }] }))
const sent = res => JSON.parse(res.end.mock.calls[0][0])

describe('POST /api/checklist-match', () => {
    it('rejects anonymous callers before calling Groq', async () => {
        const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
        const res = response()
        await checklistMatchHandler(request(), res, env)
        expect(res.statusCode).toBe(401)
        expect(fetcher).not.toHaveBeenCalled()
    })
    it('rejects the demo token from anywhere but a local demo request', async () => {
        const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
        const res = response()
        await checklistMatchHandler(request({ headers: { authorization: 'Bearer demo-access-token', 'x-apex-demo-session': 'checklist-demo-0001' } }), res, { ...env, VITE_DEMO_MODE: 'true' })
        expect(res.statusCode).toBe(401)
        expect(fetcher).not.toHaveBeenCalled()
    })
    it('rejects other methods', async () => {
        const res = response()
        await checklistMatchHandler({ method: 'GET' }, res, env)
        expect(res.statusCode).toBe(405)
        expect(res.setHeader).toHaveBeenCalledWith('Allow', 'POST')
    })

    it('verifies the session, then asks Groq with only the transcript and item labels', async () => {
        const fetcher = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'user-1' })))
            .mockResolvedValueOnce(reply({ ticked: ['Stop loss placed', 'Not revenge trading'], unsure: ['Position sized within risk'] }))
        vi.stubGlobal('fetch', fetcher)
        const res = response()
        await checklistMatchHandler(request({ headers: { authorization: 'Bearer user-token' } }), res, env)
        expect(res.statusCode).toBe(200)
        expect(sent(res)).toEqual({ ticked: ['Stop loss placed', 'Not revenge trading'], unsure: ['Position sized within risk'] })
        const [url, init] = fetcher.mock.calls[1]
        expect(url).toBe('https://api.groq.com/openai/v1/chat/completions')
        expect(init.headers.Authorization).toBe('Bearer groq-key')
        const payload = JSON.parse(init.body)
        expect(payload).toMatchObject({ model: 'openai/gpt-oss-20b', temperature: 0, reasoning_effort: 'low', response_format: { type: 'json_object' } })
        expect(payload.max_completion_tokens).toBeLessThanOrEqual(800)
        const prompt = JSON.stringify(payload.messages)
        expect(prompt).toContain('my stop is in')
        expect(prompt).toContain('Position sized within risk')
        expect(prompt).not.toMatch(/user-1|user-token|groq-key/)
    })
    it('lets the model be overridden by its own environment variable', async () => {
        const fetcher = vi.fn().mockResolvedValue(reply({ ticked: [], unsure: [] }))
        vi.stubGlobal('fetch', fetcher)
        await checklistMatchHandler(demoRequest(), response(), { ...env, GROQ_CHECKLIST_MODEL: 'qwen/qwen3.8-27b' })
        const payload = JSON.parse(fetcher.mock.calls[0][1].body)
        expect(payload.model).toBe('qwen/qwen3.8-27b')
        expect(payload.reasoning_effort).toBeUndefined()
    })
    it('serves local demo dictation without Supabase, in checklist order and de-duplicated', async () => {
        const fetcher = vi.fn().mockResolvedValue(reply({ ticked: ['not revenge trading', 'Stop loss placed', 'Stop loss placed'], unsure: ['Not revenge trading'] }))
        vi.stubGlobal('fetch', fetcher)
        const res = response()
        await checklistMatchHandler(demoRequest(), res, env)
        expect(fetcher).toHaveBeenCalledTimes(1)
        expect(sent(res)).toEqual({ ticked: ['Stop loss placed', 'Not revenge trading'], unsure: [] })
    })
    it('ticks every label that differs only in case or spacing', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({ ticked: ['Stop loss placed'] })))
        const res = response()
        await checklistMatchHandler(demoRequest({ body: { transcript: 'my stop is in', items: ['Stop loss placed', 'stop loss  placed', 'Not revenge trading'] } }), res, env)
        expect(sent(res)).toEqual({ ticked: ['Stop loss placed', 'stop loss  placed'], unsure: [] })
    })
    it('treats a missing unsure list as empty', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({ ticked: ['Stop loss placed'] })))
        const res = response()
        await checklistMatchHandler(demoRequest(), res, env)
        expect(sent(res)).toEqual({ ticked: ['Stop loss placed'], unsure: [] })
    })

    it.each([
        ['malformed JSON', reply('not json at all')],
        ['a non-object answer', reply('["Stop loss placed"]')],
        ['ticked that is not a list', reply({ ticked: 'Stop loss placed' })],
        ['a label that is not in the checklist', reply({ ticked: ['Stop loss placed', 'Bought the dip'] })],
        ['an unknown unsure label', reply({ ticked: [], unsure: ['Bought the dip'] })],
        ['a reply cut off by its token cap', reply({ ticked: [] }, { finish_reason: 'length' })],
        ['an empty choices list', new Response(JSON.stringify({ choices: [] }))],
    ])('reports unavailable for %s', async (_name, groq) => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(groq))
        const res = response()
        await checklistMatchHandler(demoRequest(), res, env)
        expect(res.statusCode).toBe(503)
        expect(sent(res)).toMatchObject({ code: 'UNAVAILABLE' })
    })
    it('reports rate limits without provider details', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('private provider details', { status: 429 })))
        const res = response()
        await checklistMatchHandler(demoRequest(), res, env)
        expect(res.statusCode).toBe(429)
        expect(sent(res)).toMatchObject({ code: 'RATE_LIMITED' })
        expect(res.end.mock.calls[0][0]).not.toContain('private provider details')
    })
    it('reports other provider failures as unavailable, and a missing key too', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('boom', { status: 500 })))
        const res = response()
        await checklistMatchHandler(demoRequest(), res, env)
        expect(res.statusCode).toBe(503)
        expect(res.end.mock.calls[0][0]).not.toContain('boom')

        const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
        const noKey = response()
        await checklistMatchHandler(demoRequest(), noKey, {})
        expect(noKey.statusCode).toBe(503)
        expect(fetcher).not.toHaveBeenCalled()
    })
    it('gives up on a slow provider', async () => {
        vi.useFakeTimers()
        vi.stubGlobal('fetch', vi.fn((_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))))
        const res = response()
        const done = checklistMatchHandler(demoRequest(), res, env)
        await vi.advanceTimersByTimeAsync(5000)
        await done
        expect(res.statusCode).toBe(503)
        expect(sent(res)).toMatchObject({ code: 'UNAVAILABLE' })
    })

    it('rejects oversized bodies with 413', async () => {
        const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
        const res = response()
        await checklistMatchHandler(demoRequest({ body: { transcript: 'x'.repeat(200000), items: ITEMS } }), res, env)
        expect(res.statusCode).toBe(413)
        expect(fetcher).not.toHaveBeenCalled()
    })
    it.each([
        ['a transcript over 2,000 characters', { transcript: 'x'.repeat(2001), items: ITEMS }, 413],
        ['more than 20 items', { transcript: 'ok', items: Array.from({ length: 21 }, (_, i) => `Item ${i}`) }, 413],
        ['an item over 120 characters', { transcript: 'ok', items: ['x'.repeat(121)] }, 413],
        ['a missing transcript', { items: ITEMS }, 400],
        ['a blank transcript', { transcript: '   ', items: ITEMS }, 400],
        ['no items', { transcript: 'ok', items: [] }, 400],
        ['items that are not strings', { transcript: 'ok', items: ['fine', 4] }, 400],
        ['a blank item', { transcript: 'ok', items: ['fine', '  '] }, 400],
        ['a body that is not an object', ['nope'], 400],
    ])('refuses %s before calling Groq', async (_name, body, status) => {
        const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
        const res = response()
        await checklistMatchHandler(demoRequest({ body }), res, env)
        expect(res.statusCode).toBe(status)
        expect(fetcher).not.toHaveBeenCalled()
    })
})
