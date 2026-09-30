import { describe, expect, it } from 'vitest'
import { chartSeries, compactMoney, filterPeriod, money, weeklyRhythm } from './reporting'

const trade = (day, pnl) => ({ date: new Date(2026, 8, day, 12).toISOString(), pnl })
describe('dashboard periods', () => {
    const now = new Date(2026, 8, 14, 15)
    it('includes all seven local calendar days and excludes future dates', () => {
        expect(filterPeriod([trade(7, 1), trade(8, 2), trade(14, 3), trade(15, 4)], '7', now).map(t => t.pnl)).toEqual([2, 3])
    })
    it('includes all time without truncating historical data', () => {
        const rows = [trade(1, 1), trade(14, 2)]
        expect(filterPeriod(rows, 'all', now)).toEqual(rows)
    })
    it('filters the current month including its first day', () => {
        expect(filterPeriod([trade(0, 1), trade(1, 2), trade(14, 3)], 'month', now).map(t => t.pnl)).toEqual([2, 3])
    })
})
describe('chart grouping', () => {
    const rows = [trade(14, 12.5), trade(8, -5), trade(8, 7.25), trade(15, null)]
    it('orders completed trades and accumulates exact P&L', () => {
        expect(chartSeries(rows).map(p => p.pnl)).toEqual([-5, 2.25, 14.75])
    })
    it('combines trades on the same local day', () => {
        expect(chartSeries(rows, 'daily').map(p => p.pnl)).toEqual([2.25, 12.5])
    })
    it('groups weeks from Monday and months from the first', () => {
        expect(chartSeries(rows, 'weekly').map(p => p.pnl)).toEqual([2.25, 12.5])
        expect(chartSeries(rows, 'monthly').map(p => p.pnl)).toEqual([14.75])
    })
    it('does not invent a curve for open trades', () => {
        expect(chartSeries([trade(15, null)])).toEqual([])
    })
})
describe('weekly rhythm', () => {
    it('returns seven days with zeroes for missing days and excludes other weeks', () => {
        const result = weeklyRhythm([trade(13, 90), trade(14, 10), trade(14, -4), trade(16, null)], false, new Date(2026, 8, 16))
        expect(result).toHaveLength(7)
        expect(result[0]).toMatchObject({ day: 'Mon', pnl: 6, count: 2 })
        expect(result.slice(1).every(d => d.pnl === 0 && d.count === 0)).toBe(true)
    })
    it('can compare the preceding calendar week', () => {
        expect(weeklyRhythm([trade(13, 90), trade(14, 10)], true, new Date(2026, 8, 16)).at(-1).pnl).toBe(90)
    })
})
describe('money in the account currency', () => {
    it('signs P&L and places known symbols in front', () => {
        expect(money(1234.5, 'USD')).toBe('+$1,234.50')
        expect(money(-80, 'EUR')).toBe('−€80.00')
        expect(money(0, 'USD')).toBe('$0.00')
    })
    it('uses Indian digit grouping for rupees', () => {
        expect(money(123456.7, 'INR')).toBe('+₹1,23,456.70')
    })
    it('puts codes without a symbol after the amount', () => {
        expect(money(-250.5, 'USDT')).toBe('−250.50 USDT')
    })
    it('can drop the plus sign for balances', () => {
        expect(money(10000, 'INR', { signed: false, digits: 0 })).toBe('₹10,000')
        expect(money(-5, 'INR', { signed: false })).toBe('−₹5.00')
    })
    it('abbreviates chart labels', () => {
        expect(compactMoney(1250, 'INR')).toBe('+₹1.3k')
        expect(compactMoney(-350, 'USDT')).toBe('−350 USDT')
    })
})
