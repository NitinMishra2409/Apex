// Turn a spoken trade description into New Trade form fields.
//
// Example: "long bitcoin at 68,000 with a stop at 67k, target 71500,
//           size 5000, I FOMO'd the entry"
//   -> { direction:'LONG', entry:68000, sl:67000, tp:71500, size:5000,
//        mistakes:['FOMO Entry'] }
//
// Deliberately conservative: a field is only filled when a recognised keyword
// points at a number. Anything uncertain is left blank for the user to type.


import { normaliseSymbol } from '../../domain/trades/symbols'

// ── Spoken numbers ──────────────────────────────────────────────────────────
const SMALL = {
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
    nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
    sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30,
    forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
}
const SCALE = { hundred: 100, thousand: 1000, k: 1000, million: 1e6, m: 1e6 }

/** Collapse a run of spelled number words into a single value. */
function foldNumberWords(words) {
    // "zero point five two" -> 0.52
    const pointAt = words.indexOf('point')
    if (pointAt !== -1) {
        const whole = pointAt === 0 ? 0 : foldNumberWords(words.slice(0, pointAt))
        const after = words.slice(pointAt + 1)
        if (whole === null || !after.length) return null
        let digits = ''
        for (const w of after) {
            if (!(w in SMALL) || SMALL[w] > 9) return null // "point twenty" isn't meaningful
            digits += String(SMALL[w])
        }
        return Number(`${whole}.${digits}`)
    }

    let total = 0, current = 0, seen = false
    for (const w of words) {
        if (w in SMALL) { current += SMALL[w]; seen = true; continue }
        if (w in SCALE) {
            const scale = SCALE[w]
            if (scale === 100) current = (current || 1) * 100
            else { total += (current || 1) * scale; current = 0 }
            seen = true
            continue
        }
        if (w === 'and' && seen) continue
        return null
    }
    return seen ? total + current : null
}

const NUMBER_WORDS = new Set([...Object.keys(SMALL), ...Object.keys(SCALE), 'and', 'point'])

/** Replace spelled-out numbers ("sixty eight thousand") with digits. */
export function wordsToNumbers(text) {
    const tokens = text.split(/\s+/).filter(Boolean)
    const out = []
    let run = []

    const flush = () => {
        if (!run.length) return
        // Trailing connectors belong to the sentence, not to the number.
        const suffix = []
        while (run.length && (run[run.length - 1].word === 'and' || run[run.length - 1].word === 'point')) {
            suffix.unshift(run.pop().raw)
        }
        if (run.length) {
            const value = foldNumberWords(run.map(r => r.word))
            if (value === null) out.push(...run.map(r => r.raw))
            else out.push(String(value))
        }
        out.push(...suffix)
        run = []
    }

    for (const tok of tokens) {
        const word = tok.toLowerCase().replace(/[^a-z]/g, '')
        if (word && NUMBER_WORDS.has(word)) run.push({ word, raw: tok })
        else { flush(); out.push(tok) }
    }
    flush()
    return out.join(' ').replace(/\s+/g, ' ').trim()
}

// ── Field keywords ──────────────────────────────────────────────────────────
// Longer phrases first so "stop loss" wins over "stop".
const LABELS = [
    ['sl', ['stop loss', 'stoploss', 'stop-loss', 'stop out', 'stopped out', 'stop', 'sl']],
    ['tp', ['take profit', 'takeprofit', 'take-profit', 'target price', 'target', 'tp']],
    ['size', ['position size', 'size of', 'size', 'position', 'notional']],
    ['exit_price', ['exit price', 'exited at', 'exited', 'exit at', 'exit', 'closed at', 'close at', 'got out at', 'out at']],
    ['entry', ['entry price', 'entered at', 'entered', 'entry', 'enter at', 'bought at', 'sold at', 'got in at', 'filled at']],
]

// Words that point at a number without naming a field. They keep whatever label
// is already pending ("stop at 67000"), and only mean "entry" on their own.
const WEAK = new Set(['at', 'around', 'near', 'about', 'from', 'of', 'for', 'with', '@', '$'])
const SKIP = new Set(['a', 'an', 'the', 'and', 'my', 'i', 'was', 'is', 'to', 'usdt', 'usd', 'dollars', 'bucks', 'please', 'then'])

const NUM_RE = /^-?\d+(?:\.\d+)?$/
const DIRECTION_WORD = /^(?:long|longed|longing|bought|buy|buying|short|shorted|shorting|sold|sell|selling)$/

function normalise(text) {
    return wordsToNumbers(
        text.toLowerCase()
            .replace(/[""'']/g, "'")
            .replace(/(\d),(?=\d{3}\b)/g, '$1')     // 68,000 -> 68000
            .replace(/(\d),(?=\d{3}\b)/g, '$1')     // again for 1,234,567
            .replace(/\b(\d+(?:\.\d+)?)\s*k\b/g, (_, n) => String(Number(n) * 1000))
            .replace(/\b(\d+(?:\.\d+)?)\s*m\b/g, (_, n) => String(Number(n) * 1e6))
            .replace(/[,;]/g, ' ')
            // Drop sentence-ending punctuation ("3100." -> "3100") while keeping
            // decimal points, which are always followed by a digit.
            .replace(/[.!?](?=\s|$)/g, ' ')
            .replace(/\$/g, ' $ ')
    )
}

function detectDirection(text) {
    const long = text.search(/\b(long(?:ed|ing)?|bought|buy|buying|bullish)\b/)
    const short = text.search(/\b(short(?:ed|ing)?|sold|sell|selling|bearish)\b/)
    if (long === -1 && short === -1) return null
    if (long === -1) return 'SHORT'
    if (short === -1) return 'LONG'
    return long < short ? 'LONG' : 'SHORT'
}

// ── Asset detection ─────────────────────────────────────────────────────────
// Tried most-explicit first. Bare tickers are restricted to ones that are not
// also ordinary English words: "link", "dot", "op", "near" and "atom" are all
// real tickers but would fire constantly on normal speech, so they are only
// recognised when a quote currency follows them ("link usdt").
const PAIR_RE = /\b([a-z0-9]{2,10})\s*(?:\/|-|vs|against)?\s*(usdt|usdc|busd|fdusd|tusd|usd)\b/
const ASSET_WORD_RE = /\b(bitcoin|ethereum|ether|solana|ripple|cardano|dogecoin|binance\s*coin|binance|polygon|avalanche|chainlink|polkadot|litecoin|arbitrum|optimism|aptos|celestia|injective|cosmos)\b/
const BARE_TICKER_RE = /\b(btc|xbt|eth|sol|xrp|bnb|doge|ada|avax|matic|ltc|arb|sui|apt|tia|inj)\b/

function detectSymbol(text) {
    const pair = text.match(PAIR_RE)
    if (pair) {
        const found = normaliseSymbol(`${pair[1]}${pair[2]}`)
        if (found) return found
    }
    const word = text.match(ASSET_WORD_RE)
    if (word) {
        const found = normaliseSymbol(word[1].replace(/\s+/g, ''))
        if (found) return found
    }
    const bare = text.match(BARE_TICKER_RE)
    if (bare) return normaliseSymbol(bare[1])
    return null
}

const SETUP_PATTERNS = [
    ['Wyckoff Accumulation', /\bwyckoff\s+accumulation\b|\baccumulation\s+(?:schematic|setup)\b/],
    ['Wyckoff Distribution', /\bwyckoff\s+distribution\b|\bdistribution\s+(?:schematic|setup)\b/],
    ['HVN Bounce', /\bh\.?\s?v\.?\s?n\.?\b|\bhigh\s+volume\s+node\b/],
    ['LVN Break', /\bl\.?\s?v\.?\s?n\.?\b|\blow\s+volume\s+node\b/],
    ['Breakout', /\bbreak\s?out\b|\bbroke\s+out\b/],
    ['Breakdown', /\bbreak\s?down\b|\bbroke\s+down\b/],
    ['Range Play', /\brange\s+(?:play|trade)\b|\branging\b|\bin\s+the\s+range\b/],
    ['Wyckoff Accumulation', /\bwyckoff\b/], // bare "wyckoff" -> accumulation
]

const MISTAKE_PATTERNS = [
    ['FOMO Entry', /\bfomo'?(?:d|ed)?\b|\bfear\s+of\s+missing\s+out\b/],
    ['Moved SL', /\bmoved\s+(?:my\s+|the\s+)?(?:stop|sl)\b|\bwidened\s+(?:my\s+|the\s+)?stop\b|\bmoved\s+it\s+down\b/],
    ['Oversized Position', /\boversized?\b|\btoo\s+(?:big|large)\b|\bover\s?leveraged?\b|\bsize\s+was\s+too\s+big\b/],
    ['Chased Entry', /\bchas(?:ed|ing)\b/],
    ['Ignored SL', /\bignored\s+(?:my\s+|the\s+)?(?:stop|sl)\b|\bno\s+stop\s+loss\b|\bwithout\s+a\s+stop\b/],
    ['Early Exit', /\b(?:exited|closed|got\s+out|took\s+profit|cut\s+it?)\s+(?:too\s+)?early\b|\bearly\s+exit\b|\bpanic\s+(?:sold|closed)\b/],
    ['No Setup', /\bno\s+(?:real\s+)?set\s?up\b|\bwasn'?t\s+a\s+set\s?up\b|\bforced\s+(?:the\s+)?trade\b/],
    ['Revenge Trade', /\brevenge\b/],
]

/**
 * Parse a transcript into trade fields.
 * @returns {{fields:Object, matched:string[], missing:string[], direction:string|null, transcript:string, normalised:string}}
 */
export function parseTradeSpeech(transcript, extraMistakes = []) {
    const text = normalise(transcript || '')
    const fields = {}

    // Walk the words, remembering which field the last keyword referred to.
    const words = text.split(/\s+/).filter(Boolean)
    let pending = null
    let distance = 0

    const labelAt = (i) => {
        for (const [field, phrases] of LABELS) {
            for (const phrase of phrases) {
                const parts = phrase.split(' ')
                if (parts.every((p, k) => words[i + k] === p)) return { field, length: parts.length }
            }
        }
        return null
    }

    for (let i = 0; i < words.length; i++) {
        const word = words[i]

        if (NUM_RE.test(word)) {
            // Only accept a number that closely follows its keyword.
            if (pending && distance <= 4 && fields[pending] === undefined) {
                fields[pending] = Number(word)
                pending = null
            }
            distance++
            continue
        }

        const hit = labelAt(i)
        if (hit) {
            pending = hit.field
            distance = 0
            i += hit.length - 1
            continue
        }

        if (WEAK.has(word)) {
            if (!pending) { pending = 'entry'; distance = 0 }
            continue // weak words don't age the pending label
        }

        // "long 88000 ..." — a direction word with no "at" still implies the entry.
        if (DIRECTION_WORD.test(word)) {
            if (fields.entry === undefined) { pending = 'entry'; distance = 0 }
            continue
        }

        if (SKIP.has(word)) continue

        distance++
        if (distance > 4) pending = null
    }

    const direction = detectDirection(text)
    if (direction) fields.direction = direction

    const symbol = detectSymbol(text)
    if (symbol) fields.symbol = symbol

    for (const [setup, re] of SETUP_PATTERNS) {
        if (re.test(text)) { fields.setup_type = setup; break }
    }

    const mistakes = []
    for (const [label, re] of MISTAKE_PATTERNS) {
        if (re.test(text) && !mistakes.includes(label)) mistakes.push(label)
    }
    for (const label of extraMistakes) {
        const needle = String(label).toLowerCase().trim()
        if (needle && text.includes(needle) && !mistakes.includes(label)) mistakes.push(label)
    }
    if (mistakes.length) fields.mistakes = mistakes

    const ORDER = ['symbol', 'direction', 'entry', 'exit_price', 'sl', 'tp', 'size', 'setup_type', 'mistakes']
    const matched = ORDER.filter(k => fields[k] !== undefined)
    const missing = ['entry', 'sl', 'tp', 'size'].filter(k => fields[k] === undefined)

    return { fields, matched, missing, direction, transcript: transcript ?? '', normalised: text }
}

/** Human-readable label for a parsed field, used in the review panel. */
export const FIELD_LABELS = {
    symbol: 'Asset', direction: 'Direction', entry: 'Entry', exit_price: 'Exit', sl: 'Stop Loss',
    tp: 'Take Profit', size: 'Size', setup_type: 'Setup', mistakes: 'Mistakes',
}
