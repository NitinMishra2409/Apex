import { describe, it, expect } from 'vitest'
import { normaliseSymbol, formatSymbol, baseAsset, symbolsInTrades } from './symbols'

describe('normaliseSymbol', () => {
    it('collapses every written form of the same pair', () => {
        for (const input of ['BTCUSDT', 'BTC USDT', 'btc/usdt', 'BTC-USDT', 'btc_usdt', ' BtC / UsDt ']) {
            expect(normaliseSymbol(input)).toBe('BTCUSDT')
        }
    })

    it('maps spoken asset names to tickers', () => {
        // Whisper transcribes speech as words, never as tickers.
        expect(normaliseSymbol('bitcoin')).toBe('BTCUSDT')
        expect(normaliseSymbol('Ethereum')).toBe('ETHUSDT')
        expect(normaliseSymbol('solana')).toBe('SOLUSDT')
        expect(normaliseSymbol('dogecoin')).toBe('DOGEUSDT')
    })

    it('handles a spoken name with a spoken quote', () => {
        expect(normaliseSymbol('bitcoin usdt')).toBe('BTCUSDT')
        expect(normaliseSymbol('ethereum usd')).toBe('ETHUSD')
    })

    it('defaults the quote when only a base is given', () => {
        expect(normaliseSymbol('ETH')).toBe('ETHUSDT')
        expect(normaliseSymbol('sol')).toBe('SOLUSDT')
    })

    it('keeps a non-USDT quote when one is stated', () => {
        expect(normaliseSymbol('ETHBTC')).toBe('ETHBTC')
        expect(normaliseSymbol('BTC USDC')).toBe('BTCUSDC')
    })

    it('accepts tickers it has never seen', () => {
        expect(normaliseSymbol('WIFUSDT')).toBe('WIFUSDT')
        expect(normaliseSymbol('PEPE')).toBe('PEPEUSDT')
    })

    it('rejects junk rather than inventing a symbol', () => {
        expect(normaliseSymbol('')).toBeNull()
        expect(normaliseSymbol(null)).toBeNull()
        expect(normaliseSymbol(undefined)).toBeNull()
        expect(normaliseSymbol('a')).toBeNull()
        expect(normaliseSymbol('!!!')).toBeNull()
        expect(normaliseSymbol('this is not a ticker at all')).toBeNull()
    })
})

describe('formatSymbol', () => {
    it('splits the quote off for display', () => {
        expect(formatSymbol('BTCUSDT')).toBe('BTC/USDT')
        expect(formatSymbol('ETHBTC')).toBe('ETH/BTC')
    })
    it('is empty for nothing', () => {
        expect(formatSymbol(null)).toBe('')
        expect(formatSymbol('')).toBe('')
    })
})

describe('baseAsset', () => {
    it('returns just the base', () => {
        expect(baseAsset('BTCUSDT')).toBe('BTC')
        expect(baseAsset('SOLUSDT')).toBe('SOL')
    })
})

describe('symbolsInTrades', () => {
    it('counts distinct symbols, most traded first', () => {
        const trades = [
            { symbol: 'BTCUSDT' }, { symbol: 'ETHUSDT' }, { symbol: 'BTCUSDT' },
            { symbol: null }, { symbol: 'BTCUSDT' }, { symbol: 'ETHUSDT' },
        ]
        expect(symbolsInTrades(trades)).toEqual([
            { symbol: 'BTCUSDT', count: 3 },
            { symbol: 'ETHUSDT', count: 2 },
        ])
    })
    it('ignores trades with no symbol', () => {
        expect(symbolsInTrades([{ symbol: null }, {}])).toEqual([])
        expect(symbolsInTrades()).toEqual([])
    })
})
