import { describe, it, expect } from 'vitest'
import { num, calcRR, calcPnl, getResult } from './math'

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
    it('applies the percentage move to notional size', () => {
        // +10% on 1000 notional
        expect(calcPnl('LONG', 100, 110, 1000)).toBe(100)
        // short from 100 to 90 is +10%
        expect(calcPnl('SHORT', 100, 90, 1000)).toBe(100)
    })
    it('is negative when the trade went the wrong way', () => {
        expect(calcPnl('LONG', 100, 90, 1000)).toBe(-100)
        expect(calcPnl('SHORT', 100, 110, 1000)).toBe(-100)
    })
    it('returns null until entry, exit and size are all present', () => {
        expect(calcPnl('LONG', 100, 110, null)).toBeNull()
        expect(calcPnl('LONG', 100, null, 1000)).toBeNull()
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

describe('round trip', () => {
    it('agrees with the seeded demo data convention', () => {
        const entry = 68400, exit = 71500, size = 5000
        const pnl = calcPnl('LONG', entry, exit, size)
        expect(pnl).toBe(+(((exit - entry) / entry) * size).toFixed(2))
        expect(getResult(pnl)).toBe('WIN')
    })
})
