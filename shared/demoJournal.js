export const DEMO_TRADE_LIMIT = 500
const strings = list => Array.isArray(list) ? list.filter(i => typeof i === 'string').slice(0, 20).map(i => i.slice(0, 80)) : []
function checklistOf(value) {
    const items = strings(value?.items)
    return items.length ? { items, checked: strings(value.checked).filter(i => items.includes(i)) } : null
}
/** Carry only journal fields, never local user profiles or unrelated storage. */
export function demoJournalRows(trades, { from, to, includeNotes = false } = {}) {
    const selected = trades.filter(t => {
        const date = Date.parse(t.date)
        return Number.isFinite(date) && (!from || date >= Date.parse(from)) && (!to || date <= Date.parse(to))
    }).sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    const text = (value, limit = 120) => typeof value === 'string' ? value.slice(0, limit) : null
    return {
        demoTruncated: selected.length > DEMO_TRADE_LIMIT,
        demoTrades: selected.slice(0, DEMO_TRADE_LIMIT).map(t => ({
            date: new Date(t.date).toISOString(), symbol: text(t.symbol, 30), asset_class: text(t.asset_class, 12), direction: text(t.direction, 5), setup_type: text(t.setup_type),
            ...Object.fromEntries(['entry', 'exit_price', 'sl', 'tp', 'units', 'fees', 'pnl', 'rr'].map(key => [key, typeof t[key] === 'number' && Number.isFinite(t[key]) ? t[key] : null])),
            mistakes: Array.isArray(t.mistakes) ? t.mistakes.filter(m => typeof m === 'string').slice(0, 10).map(m => m.slice(0, 80)) : [],
            checklist: checklistOf(t.checklist),
            ...(includeNotes ? { emotional_notes: text(t.emotional_notes, 600) } : {}),
        })),
    }
}
