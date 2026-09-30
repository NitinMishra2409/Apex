/** Local calendar dates keep the dashboard's filters aligned with the user's day. */
export function dayKey(value) {
    const d = new Date(value)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export function periodBounds(period, now = new Date()) {
    const end = new Date(now); end.setHours(23, 59, 59, 999)
    const start = new Date(now); start.setHours(0, 0, 0, 0)
    if (period === '7' || period === '30' || period === '90') start.setDate(start.getDate() - Number(period) + 1)
    else if (period === 'month') start.setDate(1)
    else return null
    return { start, end }
}
export function filterPeriod(trades, period, now = new Date()) {
    const bounds = periodBounds(period, now)
    if (!bounds) return trades
    return trades.filter(t => new Date(t.date) >= bounds.start && new Date(t.date) <= bounds.end)
}
// Account currencies are display-only. Known symbols go in front; others (USDT) follow the amount.
const CURRENCY_SYMBOLS = { INR: '₹', USD: '$', EUR: '€', GBP: '£', JPY: '¥', AUD: 'A$', CAD: 'C$', SGD: 'S$' }
const wrapCurrency = (amount, currency) => CURRENCY_SYMBOLS[currency] ? `${CURRENCY_SYMBOLS[currency]}${amount}` : `${amount} ${currency}`
const sign = (value, signed) => value < 0 ? '−' : signed && value > 0 ? '+' : ''
/** "+₹1,23,456.00", "−250.50 USDT". Rupees use Indian digit grouping. */
export function money(value, currency = 'USD', { signed = true, digits = 2 } = {}) {
    const amount = Math.abs(value).toLocaleString(currency === 'INR' ? 'en-IN' : 'en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
    return `${sign(value, signed)}${wrapCurrency(amount, currency)}`
}
/** Chart-axis form: "+₹1.2k", "−350 USDT". */
export function compactMoney(value, currency = 'USD') {
    const abs = Math.abs(value)
    return `${sign(value, true)}${wrapCurrency(abs >= 1000 ? `${(abs / 1000).toFixed(1)}k` : abs.toFixed(0), currency)}`
}
export const currencySymbol = currency => CURRENCY_SYMBOLS[currency] ?? currency
/** "62% (45–78%)": a win rate with its 95% range so small samples don't overclaim. */
export const rateWithRange = interval => interval ? `${interval.rate}% (${interval.low}–${interval.high}%)` : '—'
export const shortDate = value => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

export function chartSeries(trades, mode = 'cumulative') {
    const sorted = trades.filter(t => t.pnl != null).slice().sort((a, b) => new Date(a.date) - new Date(b.date))
    if (mode === 'cumulative') {
        let total = 0
        return sorted.map((t, index) => ({ date: t.date, label: shortDate(t.date), pnl: +(total += t.pnl).toFixed(2), index }))
    }
    const grouped = new Map()
    for (const t of sorted) {
        const date = new Date(t.date); date.setHours(0, 0, 0, 0)
        if (mode === 'weekly') date.setDate(date.getDate() - (date.getDay() + 6) % 7)
        if (mode === 'monthly') date.setDate(1)
        const key = dayKey(date)
        const previous = grouped.get(key)
        grouped.set(key, { date: date.toISOString(), label: mode === 'monthly' ? date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) : shortDate(date), pnl: +((previous?.pnl ?? 0) + t.pnl).toFixed(2) })
    }
    return [...grouped.values()].map((point, index) => ({ ...point, index }))
}
export function weeklyRhythm(trades, previous = false, now = new Date()) {
    const monday = new Date(now); monday.setHours(0, 0, 0, 0)
    monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7 - (previous ? 7 : 0))
    return Array.from({ length: 7 }, (_, i) => {
        const date = new Date(monday); date.setDate(date.getDate() + i)
        const rows = trades.filter(t => t.pnl != null && dayKey(t.date) === dayKey(date))
        return { day: date.toLocaleDateString('en-US', { weekday: 'short' }), date: dayKey(date), count: rows.length, pnl: +rows.reduce((sum, t) => sum + t.pnl, 0).toFixed(2) }
    })
}
