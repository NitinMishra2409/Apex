// Asset symbol handling.
//
// The same asset arrives in wildly different shapes: "BTC/USDT" typed by hand,
// "BTC USDT" or plain "bitcoin" from voice, "btc-usdt" pasted from an exchange.
// Everything is normalised to one canonical form (BTCUSDT) before it is stored,
// so grouping and filtering actually work.
//
// Stored:    BTCUSDT
// Displayed: BTC/USDT

/** Quote currencies, longest first so USDT is matched before USD. */
const QUOTES = ['USDT', 'USDC', 'BUSD', 'FDUSD', 'TUSD', 'USD', 'EUR', 'GBP', 'BTC', 'ETH']

/** Default quote when someone just says "bitcoin". */
export const DEFAULT_QUOTE = 'USDT'

/**
 * Spoken and written names to ticker. Whisper transcribes spoken assets as
 * words ("bitcoin", "solana"), never as tickers.
 */
const ALIASES = {
    BITCOIN: 'BTC', XBT: 'BTC',
    ETHEREUM: 'ETH', ETHER: 'ETH',
    SOLANA: 'SOL',
    RIPPLE: 'XRP',
    CARDANO: 'ADA',
    DOGECOIN: 'DOGE',
    BINANCECOIN: 'BNB', BINANCE: 'BNB',
    POLYGON: 'MATIC',
    AVALANCHE: 'AVAX',
    CHAINLINK: 'LINK',
    POLKADOT: 'DOT',
    LITECOIN: 'LTC',
    ARBITRUM: 'ARB',
    OPTIMISM: 'OP',
    APTOS: 'APT',
    CELESTIA: 'TIA',
    INJECTIVE: 'INJ',
    COSMOS: 'ATOM',
    TETHER: 'USDT',
}

/** Offered in the New Trade dropdown. Users can still type anything. */
export const COMMON_SYMBOLS = [
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'BNBUSDT', 'DOGEUSDT',
    'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'MATICUSDT', 'DOTUSDT', 'LTCUSDT',
    'ARBUSDT', 'OPUSDT', 'SUIUSDT', 'APTUSDT', 'TIAUSDT', 'INJUSDT',
    'NEARUSDT', 'ATOMUSDT',
]

const clean = (raw) => String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')

/**
 * Canonical storage form, or null when nothing usable was given.
 *
 *   'BTC USDT'  -> 'BTCUSDT'
 *   'btc/usdt'  -> 'BTCUSDT'
 *   'bitcoin'   -> 'BTCUSDT'
 *   'ETH'       -> 'ETHUSDT'
 */
export function normaliseSymbol(input) {
    const text = clean(input)
    if (!text || text.length < 2 || text.length > 20) return null

    // Split a trailing quote currency off, when there is one.
    for (const quote of QUOTES) {
        if (text.length > quote.length && text.endsWith(quote)) {
            const base = resolveBase(text.slice(0, -quote.length))
            if (base) return base + quote
        }
    }

    const base = resolveBase(text)
    return base ? base + DEFAULT_QUOTE : null
}

function resolveBase(raw) {
    const base = ALIASES[raw] ?? raw
    // Tickers are 2-10 alphanumerics; anything longer is a mis-transcription.
    return /^[A-Z0-9]{2,10}$/.test(base) ? base : null
}

/** Display form: 'BTCUSDT' -> 'BTC/USDT'. Unknown shapes pass through. */
export function formatSymbol(symbol) {
    if (!symbol) return ''
    const text = clean(symbol)
    for (const quote of QUOTES) {
        if (text.length > quote.length && text.endsWith(quote)) {
            return `${text.slice(0, -quote.length)}/${quote}`
        }
    }
    return text
}

/** Base asset only: 'BTCUSDT' -> 'BTC'. Used for compact labels. */
export function baseAsset(symbol) {
    const formatted = formatSymbol(symbol)
    return formatted.includes('/') ? formatted.split('/')[0] : formatted
}

/**
 * Distinct symbols across a trade list, most-traded first.
 * @returns {Array<{symbol: string, count: number}>}
 */
export function symbolsInTrades(trades = []) {
    const counts = new Map()
    for (const t of trades) {
        if (!t.symbol) continue
        counts.set(t.symbol, (counts.get(t.symbol) ?? 0) + 1)
    }
    return [...counts.entries()]
        .map(([symbol, count]) => ({ symbol, count }))
        .sort((a, b) => b.count - a.count)
}
