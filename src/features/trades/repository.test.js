import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prepareTrade } from '../../domain/trades/record'

// Demo operations must work without a configured Supabase client.
vi.mock('../../platform/supabase/client', () => ({ supabase: null }))
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_DEMO_MODE', 'true')
    vi.stubEnv('VITE_DEMO_LATENCY_MS', '0')
    const storage = new Map()
    vi.stubGlobal('localStorage', {
        getItem: key => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, value),
        removeItem: key => storage.delete(key),
    })
})

describe('demo trading repository', () => {
    it('creates, reloads, edits and deletes a reviewed trade through the repository interface', async () => {
        const form = { date: '2026-09-24T12:00:00Z', symbol: 'eth', direction: 'LONG', entry: '100', size: '1000' }
        const repository = await import('./repository')
        const added = await repository.addTrade('demo-user', prepareTrade(form))
        expect(added).toMatchObject({ symbol: 'ETHUSDT', pnl: null, result: null })

        // Reload module state to verify that persistence, not just an in-memory mutation, worked.
        vi.resetModules()
        const reloaded = await import('./repository')
        expect(await reloaded.getTrades('demo-user')).toContainEqual(added)
        const edit = { ...form, exit_price: '110' }
        delete edit.symbol
        expect(await reloaded.updateTrade(added.id, prepareTrade(edit))).toMatchObject({
            id: added.id, symbol: 'ETHUSDT', pnl: 100, result: 'WIN',
        })
        await reloaded.deleteTrade(added.id)
        expect((await reloaded.getTrades('demo-user')).some(trade => trade.id === added.id)).toBe(false)
    })

    it('keeps custom mistake storage available after moving it out of checklists', async () => {
        const { addCustomMistake, getCustomMistakes } = await import('./mistakes')
        const added = await addCustomMistake('demo-user', 'Skipped review')
        expect(await getCustomMistakes('demo-user')).toContainEqual(added)
    })
})
