import { afterEach, expect, it, vi } from 'vitest'
vi.mock('../../platform/supabase/client', () => ({ supabase: { auth: { getSession: vi.fn() } } }))
vi.mock('../../platform/demo/store', () => ({ DEMO: true, demoDb: () => ({ trades: [{ date: '2026-09-14', pnl: 20, emotional_notes: 'Excluded note', user_id: 'private-id' }] }) }))
import { supabase } from '../../platform/supabase/client'
import { chat, transcribe, speech } from './client'
afterEach(() => vi.unstubAllGlobals())
it('preserves speech HTTP rate-limit status for the fallback decision', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"error":"Speech quota reached","code":"SPEECH_UNAVAILABLE"}', { status: 429 })))
    await expect(speech('Hello')).rejects.toMatchObject({ status: 429, code: 'SPEECH_UNAVAILABLE' })
})
it('sends demo chat and journal context without requiring a Supabase session', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('data: {"type":"token","text":"Hello"}\n\ndata: {"type":"done","history":"encrypted"}\n\n'))
    vi.stubGlobal('fetch', fetcher)
    const events = []; await chat({ message: 'Review demo', includeNotes: false }, undefined, event => events.push(event))
    expect(supabase.auth.getSession).not.toHaveBeenCalled()
    const [, options] = fetcher.mock.calls[0]
    expect(options.headers.Authorization).toBe('Bearer demo-access-token')
    expect(options.headers['X-Apex-Demo-Session']).toBeTruthy()
    expect(JSON.parse(options.body).demoTrades).toHaveLength(1)
    expect(options.body).not.toMatch(/Excluded note|private-id/)
    expect(events.at(-1).type).toBe('done')
})
it('uses the same demo identity for transcription and speech', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response('{"text":"Hello"}')).mockResolvedValueOnce(new Response(new Blob(['audio'])))
    vi.stubGlobal('fetch', fetcher)
    expect(await transcribe(new Blob(['wav']))).toBe('Hello')
    await speech('Hello from the demo')
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer demo-access-token')
    expect(fetcher.mock.calls[1][1].headers['X-Apex-Demo-Session']).toBe(fetcher.mock.calls[0][1].headers['X-Apex-Demo-Session'])
})
