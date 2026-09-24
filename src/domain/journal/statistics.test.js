import { describe, expect, it } from 'vitest'
import { computeTradeStats } from './statistics'

describe('journal statistics', () => {
    it('handles an empty journal', () => {
        expect(computeTradeStats()).toMatchObject({ totalTrades: 0, totalPnl: 0, winRate: 0, bestTrade: null, equityCurve: [], setupPerformance: {} })
    })
    it('keeps dashboard and per-setup denominators explicit for open and breakeven trades', () => {
        const trades = [
            { date: '2026-09-04', pnl: null, result: null, setup_type: 'Breakout', rr: 2 },
            { date: '2026-09-03', pnl: 0, result: 'BE', setup_type: 'Breakout' },
            { date: '2026-09-02', pnl: -50, result: 'LOSS', setup_type: 'Breakout', mistakes: ['FOMO Entry'] },
            { date: '2026-09-01', pnl: 100, result: 'WIN', setup_type: 'Breakout', mistakes: ['FOMO Entry'] },
        ]
        const original = structuredClone(trades)
        expect(computeTradeStats(trades)).toMatchObject({
            totalTrades: 4, wins: 1, losses: 1, winRate: 25, totalPnl: 50,
            profitFactor: '2.00', avgRR: 2, mistakeFrequency: { 'FOMO Entry': 2 },
            setupPerformance: { Breakout: { winRate: 50, totalPnl: 50, avgRR: 2 } },
            equityCurve: [
                { date: '2026-09-01', pnl: 100 }, { date: '2026-09-02', pnl: 50 },
                { date: '2026-09-03', pnl: 50 }, { date: '2026-09-04', pnl: 50 },
            ],
        })
        expect(trades).toEqual(original)
    })
})
