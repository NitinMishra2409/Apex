// Asset symbol handling for every asset class.
//
// The same asset arrives in wildly different shapes: "BTC/USDT" typed by hand,
// "BTC USDT" or plain "bitcoin" from voice, "eur-usd" pasted from a broker.
// Everything is normalised to one canonical form before it is stored, so
// grouping and filtering actually work.
//
// Stored:    BTCUSDT, EURUSD, NIFTY, AAPL
// Displayed: BTC/USDT, EUR/USD, NIFTY, AAPL

/** Quote currencies, longest first so USDT is matched before USD. */
const QUOTES = ['USDT', 'USDC', 'BUSD', 'FDUSD', 'TUSD', 'USD', 'EUR', 'GBP', 'BTC', 'ETH']

/** Default quote when someone just says "bitcoin". Only crypto bases get one. */
export const DEFAULT_QUOTE = 'USDT'

/** Crypto bases that take the default quote when none is given. */
const CRYPTO_BASES = new Set(['BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'DOGE', 'ADA', 'AVAX', 'LINK', 'MATIC', 'DOT', 'LTC', 'ARB', 'OP', 'SUI', 'APT', 'TIA', 'INJ', 'NEAR', 'ATOM', 'SHIB', 'TRX', 'TON', 'PEPE', 'WIF'])
const FIAT = ['EUR', 'USD', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD', 'INR']

/**
 * Spoken and written names to ticker. Whisper transcribes spoken assets as
 * words ("bitcoin", "apple", "nifty"), never as tickers.
 */
const ALIASES = {
    NIFTY50: 'NIFTY', NIFTYFIFTY: 'NIFTY',
    APPLE: 'AAPL', TESLA: 'TSLA', NVIDIA: 'NVDA', MICROSOFT: 'MSFT', AMAZON: 'AMZN', GOOGLE: 'GOOGL',
    INFOSYS: 'INFY', GOLD: 'XAUUSD', SILVER: 'XAGUSD',
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
    'NIFTY', 'BANKNIFTY', 'FINNIFTY', 'SENSEX', 'RELIANCE', 'HDFCBANK', 'TCS', 'INFY',
    'AAPL', 'TSLA', 'NVDA', 'MSFT', 'SPY', 'QQQ',
    'EURUSD', 'GBPUSD', 'USDJPY', 'USDINR', 'XAUUSD',
]

const clean = (raw) => String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')

/**
 * Canonical storage form, or null when nothing usable was given.
 *
 *   'BTC USDT'  -> 'BTCUSDT'
 *   'btc/usdt'  -> 'BTCUSDT'
 *   'bitcoin'   -> 'BTCUSDT'
 *   'ETH'       -> 'ETHUSDT'
 *   'eur/usd'   -> 'EURUSD'
 *   'nifty'     -> 'NIFTY'     (no crypto quote is invented for other assets)
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
    if (!base) return null
    return CRYPTO_BASES.has(base) ? base + DEFAULT_QUOTE : base
}

function resolveBase(raw) {
    const base = ALIASES[raw] ?? raw
    // Tickers are 2-10 alphanumerics; anything longer is a mis-transcription.
    return /^[A-Z0-9]{2,10}$/.test(base) ? base : null
}

/**
 * Best-guess asset class for a stored symbol, used to pre-fill the form.
 * Returns null when the symbol alone can't tell (most stocks, indices, F&O).
 */
export function guessAssetClass(symbol) {
    const text = clean(symbol)
    if (!text) return null
    if (FIAT.some(a => text.startsWith(a)) && FIAT.some(b => text.length === 6 && text.endsWith(b))) return 'forex'
    for (const quote of QUOTES) {
        if (text.length > quote.length && text.endsWith(quote) && CRYPTO_BASES.has(text.slice(0, -quote.length))) return 'crypto'
    }
    return CRYPTO_BASES.has(text) ? 'crypto' : null
}

/** Display form: 'BTCUSDT' -> 'BTC/USDT'. Unknown shapes pass through. */
export function formatSymbol(symbol) {
    if (!symbol) return ''
    const text = clean(symbol)
    if (!guessAssetClass(text) && !/^X(AU|AG)USD$/.test(text)) return text
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
