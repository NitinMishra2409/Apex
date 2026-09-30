import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../supabase/client', () => ({ supabase: { auth: { getSession: vi.fn() } } }))
vi.mock('../demo/store', () => ({ DEMO: true }))

const { matchChecklistRemote } = await import('./client')

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

const ITEMS = ['Stop loss placed', 'Not revenge trading']
const answer = (body, status = 200) => new Response(JSON.stringify(body), { status })

describe('matchChecklistRemote', () => {
    it('posts only the transcript and labels, and resolves to the ticked and unsure labels', async () => {
        const fetcher = vi.fn().mockResolvedValue(answer({ ticked: [ITEMS[0]], unsure: [ITEMS[1]] }))
        vi.stubGlobal('fetch', fetcher)
        await expect(matchChecklistRemote('my stop is in', ITEMS)).resolves.toEqual({ ticked: [ITEMS[0]], unsure: [ITEMS[1]] })
        const [url, init] = fetcher.mock.calls[0]
        expect(url).toBe('/api/checklist-match')
        expect(init.method).toBe('POST')
        expect(JSON.parse(init.body)).toEqual({ transcript: 'my stop is in', items: ITEMS })
        expect(init.headers.Authorization).toBe('Bearer demo-access-token')
    })

    it.each([
        ['a rate limit', () => answer({ error: 'busy', code: 'RATE_LIMITED' }, 429)],
        ['an unavailable model', () => answer({ error: 'nope', code: 'UNAVAILABLE' }, 503)],
        ['a network failure', () => Promise.reject(new TypeError('offline'))],
        ['a reply of the wrong shape', () => answer({ ticked: 'Stop loss placed' })],
    ])('resolves to null for %s, without throwing', async (_name, respond) => {
        vi.stubGlobal('fetch', vi.fn(respond))
        await expect(matchChecklistRemote('my stop is in', ITEMS)).resolves.toBeNull()
    })

    it('does not call the route when there is nothing to match or it is over the limits', async () => {
        const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
        await expect(matchChecklistRemote('my stop is in', [])).resolves.toBeNull()
        await expect(matchChecklistRemote('  ', ITEMS)).resolves.toBeNull()
        await expect(matchChecklistRemote('x'.repeat(2001), ITEMS)).resolves.toBeNull()
        await expect(matchChecklistRemote('ok', Array.from({ length: 21 }, (_, i) => `Item ${i}`))).resolves.toBeNull()
        await expect(matchChecklistRemote('ok', ['x'.repeat(121)])).resolves.toBeNull()
        expect(fetcher).not.toHaveBeenCalled()
    })

    it('gives up after the time limit', async () => {
        vi.useFakeTimers()
        vi.stubGlobal('fetch', vi.fn((_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))))
        const pending = matchChecklistRemote('my stop is in', ITEMS, undefined, 2500)
        await vi.advanceTimersByTimeAsync(2500)
        await expect(pending).resolves.toBeNull()
    })

    it('stops when the caller cancels', async () => {
        const caller = new AbortController()
        vi.stubGlobal('fetch', vi.fn((_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))))
        const pending = matchChecklistRemote('my stop is in', ITEMS, caller.signal)
        caller.abort()
        await expect(pending).resolves.toBeNull()
    })
})
