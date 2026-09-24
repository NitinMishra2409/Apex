import { describe, it, expect } from 'vitest'
import { parseTradeSpeech, wordsToNumbers } from './voiceParse'

// The two REAL transcripts below came back verbatim from NVIDIA Whisper during
// development. Keep them: synthetic test strings written without punctuation all
// passed while real ASR output failed, because real output ends sentences with
// periods and the number regex rejected "3100." -- a bug only real data exposed.

describe('wordsToNumbers', () => {
    it('folds spelled-out integers', () => {
        expect(wordsToNumbers('sixty eight thousand')).toBe('68000')
        expect(wordsToNumbers('two thousand five hundred')).toBe('2500')
        expect(wordsToNumbers('twelve')).toBe('12')
    })

    it('handles "and" inside a number without swallowing it elsewhere', () => {
        expect(wordsToNumbers('three hundred and fifty')).toBe('350')
    })

    it('reads "point" as a decimal', () => {
        expect(wordsToNumbers('one point five')).toBe('1.5')
    })

    it('leaves ordinary prose alone', () => {
        expect(wordsToNumbers('felt calm the whole way')).toBe('felt calm the whole way')
    })
})

describe('parseTradeSpeech - real Whisper output', () => {
    it('parses a full long trade', () => {
        const { fields } = parseTradeSpeech(
            'Long Bitcoin at 68,400, Stop 67,200, Target 71,500, Size 5000, Breakout Setup, I chased the entry.')
        expect(fields).toMatchObject({
            direction: 'LONG', entry: 68400, sl: 67200, tp: 71500,
            size: 5000, setup_type: 'Breakout', mistakes: ['Chased Entry'],
        })
    })

    it('parses a short trade written as prose, including "was$2500"', () => {
        const { fields } = parseTradeSpeech(
            'I shorted Ethereum at 3250 with a stop loss at 3310 and a take profit of 3100. ' +
            'Position size was$2500. It was a range play, and honestly I moved my stop.')
        expect(fields).toMatchObject({
            direction: 'SHORT', entry: 3250, sl: 3310, tp: 3100,
            size: 2500, setup_type: 'Range Play', mistakes: ['Moved SL'],
        })
    })
})

describe('parseTradeSpeech - number formats', () => {
    const cases = [
        ['k shorthand', 'went long at 68k stop 67k target 71k size 4500',
            { direction: 'LONG', entry: 68000, sl: 67000, tp: 71000, size: 4500 }],
        ['spelled out', 'short at sixty eight thousand five hundred, stop loss sixty nine thousand, take profit sixty six thousand',
            { direction: 'SHORT', entry: 68500, sl: 69000, tp: 66000 }],
        ['sub-dollar decimals', 'long entry 0.5234 stop 0.5100 target 0.5600 size 1200 range play',
            { direction: 'LONG', entry: 0.5234, sl: 0.51, tp: 0.56, size: 1200, setup_type: 'Range Play' }],
        ['trailing periods', 'Long at 68400. Stop 67200. Target 71500. Size 5000.',
            { direction: 'LONG', entry: 68400, sl: 67200, tp: 71500, size: 5000 }],
        ['other sentence punctuation', 'Long at 500! Stop 480? Target 560.',
            { direction: 'LONG', entry: 500, sl: 480, tp: 560 }],
        ['decimals survive punctuation stripping', 'long at 0.5234. stop 0.51. target 0.56.',
            { direction: 'LONG', entry: 0.5234, sl: 0.51, tp: 0.56 }],
    ]
    it.each(cases)('%s', (_name, said, expected) => {
        expect(parseTradeSpeech(said).fields).toMatchObject(expected)
    })
})

describe('parseTradeSpeech - field disambiguation', () => {
    it('does not let the weak word "at" steal a pending label', () => {
        // "stop at 3300" must fill sl, not entry.
        const { fields } = parseTradeSpeech(
            'shorted ethereum at 3200 with a stop at 3300 and a target at 3000, position size 2000 usdt')
        expect(fields).toMatchObject({ entry: 3200, sl: 3300, tp: 3000, size: 2000 })
    })

    it('treats a bare number after the direction as the entry', () => {
        const { fields } = parseTradeSpeech('lvn break short 88000 stop 89000 target 85000 size 7000 no real setup')
        expect(fields).toMatchObject({
            direction: 'SHORT', entry: 88000, sl: 89000, tp: 85000,
            size: 7000, setup_type: 'LVN Break', mistakes: ['No Setup'],
        })
    })

    it('captures a separate exit price', () => {
        const { fields } = parseTradeSpeech(
            'bought at 71000, exited at 72500, stop was 70000, size 3000, wyckoff accumulation setup')
        expect(fields).toMatchObject({
            direction: 'LONG', entry: 71000, exit_price: 72500, sl: 70000,
            size: 3000, setup_type: 'Wyckoff Accumulation',
        })
    })

    it('collects multiple mistakes', () => {
        const { fields } = parseTradeSpeech(
            'this was a breakout trade, long at 95000, stop 93500, target 99000, position size 8000, I chased the entry and it was oversized')
        expect(fields.mistakes).toEqual(expect.arrayContaining(['Chased Entry', 'Oversized Position']))
    })

    it('matches user-defined custom mistakes by exact substring', () => {
        const { fields } = parseTradeSpeech('long at 100 stop 90, that was an overtraded session', ['Overtraded session'])
        expect(fields.mistakes).toContain('Overtraded session')
    })

    it('does not match a custom mistake when words are interleaved', () => {
        // Known limitation: custom labels match by exact substring, so
        // "overtraded THE session" does not match "Overtraded session".
        // Built-in mistakes use regexes and are more forgiving.
        const { fields } = parseTradeSpeech('long at 100 stop 90, I overtraded the session', ['Overtraded session'])
        expect(fields.mistakes).toBeUndefined()
    })
})

describe('parseTradeSpeech - refuses to invent data', () => {
    it('returns nothing for speech with no trade content', () => {
        const { fields, matched } = parseTradeSpeech('I just felt bad about the session.')
        expect(matched).toHaveLength(0)
        for (const key of ['entry', 'sl', 'tp', 'size', 'exit_price']) {
            expect(fields[key]).toBeUndefined()
        }
    })

    it('fills only what was actually said', () => {
        const { fields } = parseTradeSpeech('long at 68000')
        expect(fields).toMatchObject({ direction: 'LONG', entry: 68000 })
        expect(fields.sl).toBeUndefined()
        expect(fields.tp).toBeUndefined()
        expect(fields.size).toBeUndefined()
    })

    it('survives empty and nullish input', () => {
        expect(parseTradeSpeech('').matched).toHaveLength(0)
        expect(parseTradeSpeech(null).matched).toHaveLength(0)
        expect(parseTradeSpeech(undefined).matched).toHaveLength(0)
    })

    it('reports which required fields are still missing', () => {
        expect(parseTradeSpeech('long at 68000').missing).toEqual(['sl', 'tp', 'size'])
    })
})

describe('parseTradeSpeech - asset detection', () => {
    it('hears an explicit pair', () => {
        expect(parseTradeSpeech('BTC USDT long at 68400 stop 67200').fields.symbol).toBe('BTCUSDT')
        expect(parseTradeSpeech('shorted ETH/USDT at 3250').fields.symbol).toBe('ETHUSDT')
    })

    it('hears a spoken asset name', () => {
        expect(parseTradeSpeech('Long Bitcoin at 68,400, Stop 67,200.').fields.symbol).toBe('BTCUSDT')
        expect(parseTradeSpeech('I shorted Ethereum at 3250').fields.symbol).toBe('ETHUSDT')
        expect(parseTradeSpeech('long solana at 180 stop 172').fields.symbol).toBe('SOLUSDT')
    })

    it('hears a bare ticker', () => {
        expect(parseTradeSpeech('long btc at 68400').fields.symbol).toBe('BTCUSDT')
        expect(parseTradeSpeech('short doge at 0.38').fields.symbol).toBe('DOGEUSDT')
    })

    it('does not fire on words that merely contain a ticker', () => {
        // Without word boundaries "sol" matches inside "console" and "eth"
        // inside "whether" -- this is why BARE_TICKER_RE is anchored.
        expect(parseTradeSpeech('I was not sure whether to take it').fields.symbol).toBeUndefined()
        expect(parseTradeSpeech('watched it on the console for a while').fields.symbol).toBeUndefined()
        expect(parseTradeSpeech('the setup was solid but I passed').fields.symbol).toBeUndefined()
    })

    it('ignores tickers that are ordinary English words unless a quote follows', () => {
        // "near", "op", "link", "dot" and "atom" are real tickers but far more
        // often just words, so they need an explicit quote currency.
        expect(parseTradeSpeech('entered near the top and it failed').fields.symbol).toBeUndefined()
        expect(parseTradeSpeech('there was a link between the two moves').fields.symbol).toBeUndefined()
        expect(parseTradeSpeech('long near usdt at 5.2').fields.symbol).toBe('NEARUSDT')
    })

    it('leaves symbol unset when no asset is mentioned', () => {
        expect(parseTradeSpeech('long at 68000 stop 67000').fields.symbol).toBeUndefined()
    })

    it('does not disturb the other fields', () => {
        const { fields } = parseTradeSpeech(
            'BTC USDT long at 68400, stop 67200, target 71500, size 5000, breakout, I chased the entry')
        expect(fields).toMatchObject({
            symbol: 'BTCUSDT', direction: 'LONG', entry: 68400, sl: 67200,
            tp: 71500, size: 5000, setup_type: 'Breakout', mistakes: ['Chased Entry'],
        })
    })
})
