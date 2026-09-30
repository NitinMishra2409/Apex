import { describe, expect, it } from 'vitest'
import { seedTrades } from './store'
import { computeTradeStats } from '../../domain/journal/statistics'
import { dayKey } from '../../domain/journal/reporting'
import { drawdown, expectancy, feeDrag, monteCarlo, planningSplit, tilt } from '../../../shared/journalAnalytics'

const STARTING_BALANCE = 10000
const trades = seedTrades()
const newestFirst = [...trades].reverse()
const perTrade = group => group.net / group.closed

describe('demo journal seed tells the discipline story', () => {
    it('is deterministic', () => {
        expect(seedTrades().map(t => [t.pnl, t.date])).toEqual(trades.map(t => [t.pnl, t.date]))
    })

    it('has a credible profit factor and win rate', () => {
        const stats = computeTradeStats(newestFirst)
        expect(Number(stats.profitFactor)).toBeGreaterThanOrEqual(1.2)
        expect(Number(stats.profitFactor)).toBeLessThanOrEqual(1.8)
        expect(Number(stats.winRate)).toBeGreaterThanOrEqual(45)
        expect(Number(stats.winRate)).toBeLessThanOrEqual(58)
    })

    it('planned trades clearly beat unplanned ones', () => {
        const { planned, unplanned } = planningSplit(trades)
        expect(planned.net).toBeGreaterThan(0)
        expect(unplanned.closed).toBeGreaterThanOrEqual(10)
        expect(unplanned.net <= 0 || perTrade(unplanned) < perTrade(planned) / 2).toBe(true)
    })

    it('trades right after a loss do worse and trigger the Tilt warning', () => {
        const { afterLoss, baseline } = tilt(trades)
        expect(afterLoss.closed).toBeGreaterThanOrEqual(6)
        expect(perTrade(afterLoss)).toBeLessThan(perTrade(baseline))
    })

    it('Monte Carlo shows real uncertainty', () => {
        const sim = monteCarlo(trades, { startingBalance: STARTING_BALANCE })
        expect(sim.probabilityOfLoss).toBeGreaterThanOrEqual(5)
        expect(sim.probabilityOfLoss).toBeLessThanOrEqual(30)
        expect(sim.riskOfRuin).toBeLessThan(5)
    })

    it('has a believable drawdown, R expectancy and fee drag', () => {
        const { maxPct } = drawdown(trades, STARTING_BALANCE)
        expect(maxPct).toBeGreaterThanOrEqual(5)
        expect(maxPct).toBeLessThanOrEqual(20)
        const { sqn } = expectancy(trades)
        expect(sqn).toBeGreaterThanOrEqual(1)
        expect(sqn).toBeLessThanOrEqual(2.5)
        const { share } = feeDrag(trades)
        expect(share).toBeGreaterThanOrEqual(3)
        expect(share).toBeLessThanOrEqual(12)
    })

    it('keeps the two most recent trades on today for the Dashboard', () => {
        const today = dayKey(new Date())
        expect(newestFirst.slice(0, 2).map(t => dayKey(t.date))).toEqual([today, today])
    })
})
