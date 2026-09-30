import { describe, expect, it } from 'vitest'
import { drawdown, expectancy, feeDrag, monteCarlo, planningSplit, tilt, timeHeatmap, winRateInterval } from './journalAnalytics.js'

const at = (day, hour = 10, minute = 0) => new Date(2026, 8, day, hour, minute).toISOString()
const trade = (day, pnl, extra = {}) => ({ date: at(day, extra.hour, extra.minute), pnl, ...extra })
const checklist = (checked, total = 4) => ({ items: ['a', 'b', 'c', 'd'].slice(0, total), checked: ['a', 'b', 'c', 'd'].slice(0, checked) })

describe('win-rate honesty', () => {
    it('gives a wide range for a small sample and a narrow one for a large sample', () => {
        const small = winRateInterval(6, 10), large = winRateInterval(600, 1000)
        expect(small.rate).toBe(60)
        expect(small.high - small.low).toBeGreaterThan(40)
        expect(large.high - large.low).toBeLessThan(7)
        expect(winRateInterval(0, 0)).toBeNull()
    })
})

describe('planning split', () => {
    it('separates planned from unplanned trades and buckets checklist completion', () => {
        const rows = [trade(1, 100, { checklist: checklist(4) }), trade(2, 50, { checklist: checklist(2) }), trade(3, -80), trade(4, -20), trade(5, null)]
        const split = planningSplit(rows)
        expect(split.planned).toMatchObject({ trades: 2, closed: 2, wins: 2, net: 150 })
        expect(split.unplanned).toMatchObject({ trades: 3, closed: 2, wins: 0, net: -100 })
        expect(split.byCompletion.complete.trades).toBe(1)
        expect(split.byCompletion.mostly.trades).toBe(1)
    })
})

describe('drawdown', () => {
    const rows = [trade(1, 100), trade(2, -30), trade(3, -50), trade(4, 60), trade(5, 40)]
    it('measures the deepest fall from a peak and when it happened', () => {
        const dd = drawdown(rows)
        expect(dd.max).toBe(80)
        expect(dd.maxAt).toBe(rows[2].date)
        expect(dd.current).toBe(0)
        expect(dd.maxPct).toBeNull()
    })
    it('adds percentages when a starting balance is known', () => {
        const dd = drawdown(rows, 1000)
        expect(dd.maxPct).toBeCloseTo(80 / 1100 * 100, 1)
        expect(drawdown([trade(1, 100), trade(2, -110)], 1000).currentPct).toBeCloseTo(10, 1)
    })
    it('counts the longest stretch spent below a peak', () => {
        expect(drawdown(rows).longestUnderwaterTrades).toBe(3)
    })
})

describe('expectancy in R', () => {
    it('averages realised R and ignores trades without a stop', () => {
        const rows = [
            trade(1, 200, { direction: 'LONG', entry: 100, sl: 90, units: 10 }),  // +2R
            trade(2, -100, { direction: 'LONG', entry: 100, sl: 90, units: 10 }), // −1R
            trade(3, 50, { direction: 'LONG', entry: 100, sl: null, units: 10 }),
        ]
        const e = expectancy(rows)
        expect(e.n).toBe(2)
        expect(e.averageR).toBe(0.5)
        expect(e.histogram.find(b => b.label === '1 to 2R').count).toBe(1)
        expect(e.histogram.find(b => b.label === '−2 to −1R').count).toBe(1)
    })
})

describe('tilt', () => {
    it('flags trades entered soon after a loss and after a losing streak', () => {
        const rows = [
            trade(1, -50, { hour: 10 }), trade(1, -40, { hour: 10, minute: 30 }), // quick re-entry after a loss
            trade(1, -60, { hour: 13 }),                                         // after two losses
            trade(2, 80, { hour: 10 }), trade(3, 90, { hour: 10 }),
        ]
        const t = tilt(rows)
        expect(t.afterLoss).toMatchObject({ trades: 1, net: -40 })
        expect(t.afterTwoLosses).toMatchObject({ trades: 2, net: 20 })
        expect(t.baseline.trades).toBe(2)
    })
})

describe('time and fees', () => {
    it('places each trade in its weekday and hour', () => {
        const cells = timeHeatmap([trade(28, 40, { hour: 9 }), trade(28, -10, { hour: 9 })]) // Mon 28 Sep 2026
        expect(cells[0][9]).toEqual({ pnl: 30, count: 2 })
    })
    it('reports fees as a share of profit before fees', () => {
        expect(feeDrag([trade(1, 90, { fees: 10 }), trade(2, -20, { fees: 10 })])).toEqual({ fees: 20, grossProfitBeforeFees: 100, share: 20 })
    })
})

describe('Monte Carlo', () => {
    const history = Array.from({ length: 40 }, (_, i) => trade(1 + (i % 28), i % 3 === 0 ? -100 : 80))
    it('needs enough history before simulating', () => {
        expect(monteCarlo(history.slice(0, 5))).toEqual({ enough: false, sample: 5 })
    })
    it('is repeatable for a seed and orders its percentile bands', () => {
        const a = monteCarlo(history, { runs: 400, horizon: 50, startingBalance: 5000 })
        const b = monteCarlo(history, { runs: 400, horizon: 50, startingBalance: 5000 })
        expect(a.medianFinal).toBe(b.medianFinal)
        expect(a.bands).toHaveLength(51)
        const last = a.bands.at(-1)
        expect(last.p5).toBeLessThanOrEqual(last.p50)
        expect(last.p50).toBeLessThanOrEqual(last.p95)
        expect(a.bands[0].p50).toBe(5000)
    })
    it('reports risk figures only when a balance makes them meaningful', () => {
        const withBalance = monteCarlo(history, { runs: 300, horizon: 60, startingBalance: 600, ruinPct: 50 })
        expect(withBalance.riskOfRuin).toBeGreaterThan(0)
        expect(monteCarlo(history, { runs: 300 }).riskOfRuin).toBeNull()
    })
})
