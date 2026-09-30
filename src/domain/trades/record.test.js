import { describe, expect, it } from 'vitest'
import { checklistCompletion, isPlanned, prepareChecklist, prepareTrade } from './record'

const form = { date: '2026-09-01T12:00:00Z', symbol: 'btc/usdt', asset_class: 'crypto', direction: 'LONG', entry: '100', exit_price: '110', sl: '95', tp: '115', units: '10', fees: '2', setup_type: 'Breakout', emotional_notes: 'Followed the plan.' }

describe('reviewed trade writes', () => {
    it('normalizes a new trade and derives planned risk, realized P&L and result', () => {
        expect(prepareTrade(form, ['FOMO Entry'])).toEqual({
            date: '2026-09-01T12:00:00.000Z', symbol: 'BTCUSDT', asset_class: 'crypto', direction: 'LONG',
            entry: 100, exit_price: 110, sl: 95, tp: 115, units: 10, fees: 2,
            rr: 3, pnl: 98, result: 'WIN', setup_type: 'Breakout',
            mistakes: ['FOMO Entry'], emotional_notes: 'Followed the plan.',
        })
    })
    it('preserves the stored symbol and checklist when the edit form omits them', () => {
        const edit = { ...form }
        delete edit.symbol
        const update = prepareTrade(edit)
        expect(update).not.toHaveProperty('symbol')
        expect(update).not.toHaveProperty('checklist')
        expect({ symbol: 'ETHUSDT', ...update }.symbol).toBe('ETHUSDT')
    })
    it('leaves an incomplete trade open and clears optional empty values', () => {
        expect(prepareTrade({ ...form, symbol: '', asset_class: '', exit_price: '', sl: '', tp: '', units: '', fees: '', setup_type: '', emotional_notes: '' })).toMatchObject({
            symbol: null, asset_class: null, exit_price: null, sl: null, tp: null, units: null, fees: null,
            rr: null, pnl: null, result: null, setup_type: null, emotional_notes: null, mistakes: null,
        })
    })
    it('uses the same conversion for shorts and does not retain mutable form selections', () => {
        const mistakes = ['FOMO Entry']
        const result = prepareTrade({ ...form, direction: 'SHORT', sl: '105', tp: '85', fees: '' }, mistakes)
        mistakes.push('Moved SL')
        expect(result).toMatchObject({ pnl: -100, result: 'LOSS', rr: 3, mistakes: ['FOMO Entry'] })
    })
    it('rejects asset classes outside the vocabulary', () => {
        expect(prepareTrade({ ...form, asset_class: 'bonds' }).asset_class).toBeNull()
    })
})

describe('per-trade checklist', () => {
    it('stores the playbook items and only the ticked ones that belong to it', () => {
        const trade = prepareTrade({ ...form, checklist: { items: ['Stop placed', 'Size correct', 'Stop placed'], checked: ['Size correct', 'Not an item'] } })
        expect(trade.checklist).toEqual({ items: ['Stop placed', 'Size correct'], checked: ['Size correct'] })
        expect(isPlanned(trade)).toBe(true)
        expect(checklistCompletion(trade)).toBe(0.5)
    })
    it('marks a trade Unplanned when the checklist was skipped', () => {
        const trade = prepareTrade({ ...form, checklist: null })
        expect(trade.checklist).toBeNull()
        expect(isPlanned(trade)).toBe(false)
        expect(checklistCompletion(trade)).toBeNull()
        expect(prepareChecklist({ items: [], checked: [] })).toBeNull()
    })
})
