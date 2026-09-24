import { describe, expect, it } from 'vitest'
import { prepareTrade } from './record'

const form = { date: '2026-09-01T12:00:00Z', symbol: 'btc/usdt', direction: 'LONG', entry: '100', exit_price: '110', sl: '95', tp: '115', size: '1000', setup_type: 'Breakout', emotional_notes: 'Followed the plan.' }

describe('reviewed trade writes', () => {
    it('normalizes a new trade and derives planned risk, realized P&L and result', () => {
        expect(prepareTrade(form, ['FOMO Entry'])).toEqual({
            date: '2026-09-01T12:00:00.000Z', symbol: 'BTCUSDT', direction: 'LONG',
            entry: 100, exit_price: 110, sl: 95, tp: 115, size: 1000,
            rr: 3, pnl: 100, result: 'WIN', setup_type: 'Breakout',
            mistakes: ['FOMO Entry'], emotional_notes: 'Followed the plan.',
        })
    })
    it('preserves the stored symbol when the edit form omits it', () => {
        const edit = { ...form }
        delete edit.symbol
        const update = prepareTrade(edit)
        expect(update).not.toHaveProperty('symbol')
        expect({ symbol: 'ETHUSDT', ...update }.symbol).toBe('ETHUSDT')
    })
    it('leaves an incomplete trade open and clears optional empty values', () => {
        expect(prepareTrade({ ...form, symbol: '', exit_price: '', sl: '', tp: '', size: '', setup_type: '', emotional_notes: '' })).toMatchObject({
            symbol: null, exit_price: null, sl: null, tp: null, size: null,
            rr: null, pnl: null, result: null, setup_type: null, emotional_notes: null, mistakes: null,
        })
    })
    it('uses the same conversion for shorts and does not retain mutable form selections', () => {
        const mistakes = ['FOMO Entry']
        const result = prepareTrade({ ...form, direction: 'SHORT', sl: '105', tp: '85' }, mistakes)
        mistakes.push('Moved SL')
        expect(result).toMatchObject({ pnl: -100, result: 'LOSS', rr: 3, mistakes: ['FOMO Entry'] })
    })
})
