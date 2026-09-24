import { afterEach, describe, expect, it, vi } from 'vitest'
import { Readable } from 'node:stream'
import { EventEmitter } from 'node:events'
import { openHistory, sealHistory, authenticate, readJson, allowLocalDemo } from '../../server/assistant/runtime.js'
import { summarizeJournal, loadJournal, loadDemoJournal } from '../../server/assistant/journal.js'
import { streamCompletion, chatHandler } from '../../api/chat.js'
import { speakHandler } from '../../api/speak.js'
import { listenHandler } from '../../api/listen.js'
afterEach(() => vi.unstubAllGlobals())
const demoRequest = (overrides = {}) => ({ socket: { remoteAddress: '127.0.0.1' }, headers: { host: 'localhost:5173', origin: 'http://localhost:5173', authorization: 'Bearer demo-access-token', 'x-apex-demo-session': 'test-demo-session-0001' }, ...overrides })
describe('local demo access', () => {
    it('allows a local Vite demo session without contacting Supabase', async () => {
        const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
        const req = demoRequest(); allowLocalDemo(req, { VITE_DEMO_MODE: 'true' })
        expect(await authenticate(req, {})).toEqual({ userId: 'local-demo:test-demo-session-0001', demo: true })
        expect(fetcher).not.toHaveBeenCalled()
    })
    it.each([
        { env: {} },
        { env: { VITE_DEMO_MODE: 'true' }, remoteAddress: '192.168.1.2' },
        { env: { VITE_DEMO_MODE: 'true' }, headers: { origin: 'https://external.example' } },
        { env: { VITE_DEMO_MODE: 'true' }, headers: { host: 'external.example' } },
        { env: { VITE_DEMO_MODE: 'true' }, headers: { 'x-forwarded-for': '192.168.1.2' } },
    ])('rejects demo access outside local development conditions', async ({ env, remoteAddress, headers }) => {
        const req = demoRequest(); Object.assign(req.headers, headers); if (remoteAddress) req.socket.remoteAddress = remoteAddress
        allowLocalDemo(req, env)
        await expect(authenticate(req, env)).rejects.toMatchObject({ status: 401 })
    })
    it('does not enable deployed handlers merely by setting the demo environment flag', async () => {
        await expect(authenticate(demoRequest(), { VITE_DEMO_MODE: 'true' })).rejects.toMatchObject({ status: 401 })
    })
    it('filters demo dates and excludes private fields and unselected notes', () => {
        const context = loadDemoJournal({ demoTrades: [{ date: '2026-09-14', pnl: 20, email: 'private@example.com', user_id: 'private-id', emotional_notes: 'Private note' }, { date: '2026-08-01', pnl: 100 }] }, { from: '2026-09-01', includeNotes: false })
        expect(context).toMatchObject({ tradeCount: 1, netPnl: 20, notesIncluded: false })
        expect(JSON.stringify(context)).not.toMatch(/private@example|private-id|Private note/)
        expect(() => loadDemoJournal({ demoTrades: [null] }, {})).toThrow()
    })
})
describe('conversation isolation', () => {
    const messages = [{ role: 'assistant', content: 'Visible answer', reasoning_content: 'Internal provider context' }]
    it('round-trips full provider history without exposing it as readable text', () => { const token = sealHistory(messages, 'alice', 'test-key', 100); expect(token).not.toContain('Internal'); expect(openHistory(token, 'alice', 'test-key', 200)).toEqual(messages) })
    it('rejects another user, tampering, key changes and expired history', () => {
        const token = sealHistory(messages, 'alice', 'test-key', 100)
        expect(() => openHistory(token, 'bob', 'test-key', 200)).toThrow()
        expect(() => openHistory('AAAA' + token.slice(4), 'alice', 'test-key', 200)).toThrow()
        expect(() => openHistory(token, 'alice', 'new-key', 200)).toThrow()
        expect(() => openHistory(token, 'alice', 'test-key', 3600101)).toThrow()
    })
    it('does not contact providers for missing or demo sessions', async () => {
        const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
        await expect(authenticate({ headers: {} }, {})).rejects.toMatchObject({ status: 401 })
        await expect(authenticate({ headers: { authorization: 'Bearer demo-access-token' } }, {})).rejects.toMatchObject({ status: 401 })
        expect(fetcher).not.toHaveBeenCalled()
    })
})
describe('journal grounding', () => {
    const trades = [{ date: '2026-09-14', symbol: 'BTCUSDT', pnl: 100, setup_type: 'Breakout', mistakes: ['FOMO'], emotional_notes: 'Private note' }, { date: '2026-09-13', symbol: 'BTCUSDT', pnl: -25 }, { date: '2026-09-12', pnl: 0 }, { date: '2026-09-11', pnl: null }]
    it('separates open and breakeven trades and computes authoritative aggregates', () => { expect(summarizeJournal(trades)).toMatchObject({ tradeCount: 4, completedCount: 3, openCount: 1, netPnl: 75, wins: 1, losses: 1, breakeven: 1, winRate: 33.33, profitFactor: 4 }) })
    it('excludes notes by default and bounds included detail', () => { expect(JSON.stringify(summarizeJournal(trades))).not.toContain('Private note'); expect(summarizeJournal(trades, { includeNotes: true }).recentTrades[0].notes).toBe('Private note'); expect(summarizeJournal(Array(60).fill(trades[0])).recentTrades).toHaveLength(40) })
    it('treats malicious object-key names as inert journal labels', () => { expect(summarizeJournal([{ pnl: 1, setup_type: '__proto__', mistakes: ['constructor'] }]).bySetup.__proto__.pnl).toBe(1); expect({}.pnl).toBeUndefined() })
    it('queries only the verified owner using their RLS credentials', async () => {
        const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(trades))); vi.stubGlobal('fetch', fetcher)
        await loadJournal({ userId: 'verified-user', url: 'https://db.example', headers: { Authorization: 'Bearer user-token', apikey: 'anon-key' } }, { includeNotes: false, from: '2026-09-01' })
        const [url, options] = fetcher.mock.calls[0]
        expect(new URL(url).searchParams.get('user_id')).toBe('eq.verified-user'); expect(url).not.toContain('emotional_notes'); expect(options.headers.Authorization).toBe('Bearer user-token')
    })
})
describe('provider streaming and audio', () => {
    it('does not send the NVIDIA voice key to Groq when its key is missing', async () => {
        const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
        await expect(streamCompletion([], { NVIDIA_API_KEY: 'voice-only-key' }, undefined, () => {})).rejects.toMatchObject({ status: 503, code: 'NO_KEY' })
        expect(fetcher).not.toHaveBeenCalled()
    })
    it.each([401, 429, 403])('reports Groq access and quota failures without exposing provider details (%s)', async status => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('sensitive provider details', { status })))
        await expect(streamCompletion([], { GROQ_API_KEY: 'test-key' }, undefined, () => {})).rejects.toMatchObject({ status: status === 429 ? 429 : 502, code: 'MODEL_UNAVAILABLE', message: expect.stringContaining('Groq') })
    })
    it('streams Groq text and excludes provider-specific reasoning from messages', async () => {
        const frames = [{ choices: [] }, { choices: [{ delta: { reasoning_content: 'internal' } }] }, { choices: [{ delta: { content: 'Hello.' }, finish_reason: 'stop' }] }]
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(frames.map(v => `data: ${JSON.stringify(v)}\n\n`).join('') + 'data: [DONE]\n\n')))
        const onToken = vi.fn()
        const reply = await streamCompletion([{ role: 'assistant', content: 'Earlier reply', reasoning_content: 'Old provider reasoning' }], { GROQ_API_KEY: 'test' }, undefined, onToken)
        expect(onToken.mock.calls).toEqual([['Hello.']]); expect(reply).not.toHaveProperty('reasoning_content')
        const payload = JSON.parse(fetch.mock.calls[0][1].body)
        expect(payload.model).toBe('llama-3.3-70b-versatile')
        expect(payload).not.toHaveProperty('chat_template_kwargs')
        expect(payload.messages).toEqual([{ role: 'assistant', content: 'Earlier reply' }])
        expect(fetch.mock.calls[0][0]).toBe('https://api.groq.com/openai/v1/chat/completions')
        expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer test')
        expect(payload).not.toHaveProperty('reasoning_effort')
    })
    it('rejects a disconnected stream even after partial text', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('data: {"choices":[{"delta":{"content":"Partial"}}]}\n\n')))
        await expect(streamCompletion([{ role: 'assistant', content: 'Earlier reply', reasoning_content: 'Old provider reasoning' }], { GROQ_API_KEY: 'test' }, undefined, () => {})).rejects.toMatchObject({ code: 'INCOMPLETE_RESPONSE' })
    })
})
describe('API access control', () => {
    it('supports parsed Vercel bodies and still enforces request size limits', async () => {
        expect(await readJson({ body: { message: 'hello' } })).toEqual({ message: 'hello' })
        expect(await readJson({ body: Buffer.from('{"message":"hello"}') })).toEqual({ message: 'hello' })
        await expect(readJson({ body: { message: 'x'.repeat(100) } }, 20)).rejects.toMatchObject({ status: 413 })
        await expect(readJson({ body: 'invalid JSON' })).rejects.toMatchObject({ status: 400 })
    })
    const request = body => { const req = Readable.from([Buffer.from(JSON.stringify(body))]); req.method = 'POST'; req.headers = { authorization: 'Bearer actual-user-token' }; return req }
    const response = () => { const res = new EventEmitter(); res.output = ''; res.setHeader = vi.fn(); res.write = value => { res.output += value }; res.end = value => { res.output += value || '' }; return res }
    const env = { VITE_SUPABASE_URL: 'https://db.example', VITE_SUPABASE_ANON_KEY: 'anon', GROQ_API_KEY: 'private-key' }
    it('streams a demo answer using the supplied sample journal without a real account', async () => {
        const fetcher = vi.fn().mockResolvedValue(new Response('data: {"choices":[{"delta":{"content":"Your demo P&L is 20 USDT."},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n'))
        vi.stubGlobal('fetch', fetcher)
        const req = request({ message: 'Review this demo', demoTrades: [{ date: '2026-09-14', pnl: 20 }] })
        Object.assign(req, demoRequest())
        allowLocalDemo(req, { VITE_DEMO_MODE: 'true' })
        const res = response(); await chatHandler(req, res, env)
        expect(res.statusCode).toBe(200); expect(res.output).toContain('"demo":true'); expect(res.output).toContain('Your demo P&L is 20 USDT.')
        expect(fetcher).toHaveBeenCalledTimes(1); expect(fetcher.mock.calls[0][0]).toContain('api.groq.com')
        expect(JSON.parse(fetcher.mock.calls[0][1].body).messages[0].content).toContain('local demo journal')
    })
    it('completes a grounded chat without emitting reasoning or provider credentials', async () => {
        const fetcher = vi.fn().mockResolvedValueOnce(new Response('{"id":"alice"}')).mockResolvedValueOnce(new Response('[{"date":"2026-09-14","pnl":12,"symbol":"BTCUSDT"}]')).mockResolvedValueOnce(new Response('data: {"choices":[{"delta":{"reasoning_content":"hidden provider context"}}]}\n\ndata: {"choices":[{"delta":{"content":"Your recorded P&L is 12 USDT."},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n'))
        vi.stubGlobal('fetch', fetcher)
        const res = response()
        await chatHandler(request({ message: 'Review my performance', userId: 'someone-else' }), res, env)
        expect(res.statusCode).toBe(200); expect(res.output).toContain('Your recorded P&L'); expect(res.output).not.toContain('hidden provider context'); expect(res.output).not.toContain('private-key')
        const frames = res.output.trim().split('\n\n').map(line => JSON.parse(line.slice(6)))
        expect(frames[0]).toMatchObject({ type: 'context', tradeCount: 1 })
        const retained = openHistory(frames.at(-1).history, 'alice', 'private-key')
        expect(retained.at(-1)).toEqual({ role: 'assistant', content: 'Your recorded P&L is 12 USDT.' })
        expect(new URL(fetcher.mock.calls[1][0]).searchParams.get('user_id')).toBe('eq.alice')
    })
    it.each([null, { message: '' }, { message: 'x'.repeat(4001) }, { message: 'hello', from: 'invalid' }])('rejects invalid chat input before reading the journal', async body => {
        const fetcher = vi.fn().mockResolvedValue(new Response('{"id":"alice"}')); vi.stubGlobal('fetch', fetcher)
        const res = response(); await chatHandler(request(body), res, env)
        expect(res.statusCode).toBe(400); expect(fetcher).toHaveBeenCalledTimes(1)
    })
    it.each([chatHandler, speakHandler, listenHandler])('rejects unauthenticated requests before reading content or calling providers', async handler => {
        const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
        const req = Readable.from([Buffer.from('{}')]); req.method = 'POST'; req.headers = {}
        const res = new EventEmitter(); res.setHeader = vi.fn(); res.end = vi.fn()
        await handler(req, res, {})
        expect(res.statusCode).toBe(401); expect(fetcher).not.toHaveBeenCalled()
    })
})
