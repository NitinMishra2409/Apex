import { describe, it, expect } from 'vitest'
import { num, calcRR, calcPnl, calcRisk, realisedR, getResult } from './math'

describe('num', () => {
    it('treats empty and nullish as "not provided"', () => {
        expect(num('')).toBeNull()
        expect(num(null)).toBeNull()
        expect(num(undefined)).toBeNull()
    })
    it('parses numeric strings', () => {
        expect(num('68400')).toBe(68400)
        expect(num('0.5234')).toBe(0.5234)
    })
})

describe('calcRR', () => {
    it('computes reward over risk for a long', () => {
        // risk 1200, reward 3100 -> 2.58
        expect(calcRR('LONG', 68400, 67200, 71500)).toBe(2.58)
    })
    it('computes reward over risk for a short', () => {
        // risk 60, reward 150 -> 2.5
        expect(calcRR('SHORT', 3250, 3310, 3100)).toBe(2.5)
    })
    it('returns null when a leg is missing', () => {
        expect(calcRR('LONG', 68400, null, 71500)).toBeNull()
        expect(calcRR('LONG', '', 67200, 71500)).toBeNull()
    })
    it('returns null when the stop is on the wrong side', () => {
        // A long with the stop above entry is not a valid risk.
        expect(calcRR('LONG', 68400, 69000, 71500)).toBeNull()
        expect(calcRR('SHORT', 3250, 3100, 3000)).toBeNull()
    })
})

describe('calcPnl', () => {
    it('multiplies the price move by units', () => {
        // 50 shares from 100 to 110
        expect(calcPnl('LONG', 100, 110, 50)).toBe(500)
        // short 0.5 BTC from 68000 to 66000
        expect(calcPnl('SHORT', 68000, 66000, 0.5)).toBe(1000)
    })
    it('is negative when the trade went the wrong way', () => {
        expect(calcPnl('LONG', 100, 90, 50)).toBe(-500)
        expect(calcPnl('SHORT', 100, 110, 50)).toBe(-500)
    })
    it('subtracts fees, which can turn a scratch into a loss', () => {
        expect(calcPnl('LONG', 100, 110, 50, 20)).toBe(480)
        expect(calcPnl('LONG', 100, 100, 50, '12.5')).toBe(-12.5)
        expect(calcPnl('LONG', 100, 110, 50, '')).toBe(500)
    })
    it('handles lot-based units, e.g. 2 lots of 75', () => {
        expect(calcPnl('LONG', 22400, 22450, 150, 40)).toBe(7460)
    })
    it('returns null until entry, exit and units are all present', () => {
        expect(calcPnl('LONG', 100, 110, null)).toBeNull()
        expect(calcPnl('LONG', 100, null, 50)).toBeNull()
    })
})

describe('calcRisk and realisedR', () => {
    it('measures the amount at risk from the stop', () => {
        expect(calcRisk('LONG', 100, 95, 50)).toBe(250)
        expect(calcRisk('SHORT', 100, 104, 10)).toBe(40)
    })
    it('has no risk without a valid stop', () => {
        expect(calcRisk('LONG', 100, null, 50)).toBeNull()
        expect(calcRisk('LONG', 100, 105, 50)).toBeNull()
    })
    it('expresses P&L in multiples of the risk', () => {
        expect(realisedR({ direction: 'LONG', entry: 100, sl: 95, units: 50, pnl: 500 })).toBe(2)
        expect(realisedR({ direction: 'LONG', entry: 100, sl: 95, units: 50, pnl: -250 })).toBe(-1)
        expect(realisedR({ direction: 'LONG', entry: 100, sl: null, units: 50, pnl: 500 })).toBeNull()
        expect(realisedR({ direction: 'LONG', entry: 100, sl: 95, units: 50, pnl: null })).toBeNull()
    })
})

describe('getResult', () => {
    it('maps P&L sign to a result', () => {
        expect(getResult(12.5)).toBe('WIN')
        expect(getResult(-12.5)).toBe('LOSS')
        expect(getResult(0)).toBe('BE')
    })
    it('returns null for an unclosed trade', () => {
        expect(getResult(null)).toBeNull()
        expect(getResult(undefined)).toBeNull()
    })
})
