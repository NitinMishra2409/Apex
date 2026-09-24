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
export const money = (value, digits = 2) => `${value < 0 ? '−' : '+'}$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
export const compactMoney = value => `${value < 0 ? '−' : value > 0 ? '+' : ''}${Math.abs(value) >= 1000 ? `${(Math.abs(value) / 1000).toFixed(1)}k` : Math.abs(value).toFixed(0)}`
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
