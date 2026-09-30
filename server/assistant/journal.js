import { AssistantError } from './runtime.js'
import { DEMO_TRADE_LIMIT, demoJournalRows } from '../../shared/demoJournal.js'
import { drawdown, expectancy, feeDrag, planningSplit, tilt, winRateInterval } from '../../shared/journalAnalytics.js'

// The snapshot is the Coach's only view of the journal. It is kept compact because
// every token counts against Groq's free-tier limit of 8K tokens per minute:
// a 74-trade journal was ~3.9K tokens as verbose JSON and is ~1K in this shape.
export const RECENT_LIMIT = 12
const RECENT_COLUMNS = ['date', 'symbol', 'side', 'entry', 'exit', 'stop', 'units', 'fees', 'pnl', 'setup', 'checklist', 'mistakes']
const CURRENCY_RE = /^[A-Z]{3,5}$/

export function loadDemoJournal(body, options) {
    if (!Array.isArray(body.demoTrades) || body.demoTrades.length > DEMO_TRADE_LIMIT || body.demoTrades.some(t => !t || typeof t !== 'object' || Array.isArray(t) || typeof t.date !== 'string' || !Number.isFinite(Date.parse(t.date)))) {
        throw new AssistantError(400, 'BAD_DEMO_JOURNAL', 'The demo journal could not be read. Refresh the page and try again.')
    }
    const { demoTrades } = demoJournalRows(body.demoTrades, options)
    const currency = CURRENCY_RE.test(body.currency) ? body.currency : 'USDT'
    const balance = typeof body.startingBalance === 'number' && body.startingBalance > 0 ? body.startingBalance : null
    return { source: 'local demo journal; sample data for testing', ...summarizeJournal(demoTrades, { ...options, currency, startingBalance: balance, truncated: body.demoTruncated === true }) }
}

const round = n => Math.round(n * 100) / 100
const compactGroup = g => ({ trades: g.trades, closed: g.closed, wins: g.wins, net: g.net, winRate: g.winRate?.rate ?? null })
// Own-property buckets so labels such as "__proto__" stay inert data.
function tally(target, key, values) {
    if (!Object.hasOwn(target, key)) Object.defineProperty(target, key, { value: values.map(() => 0), enumerable: true, writable: true })
    target[key] = target[key].map((v, i) => round(v + values[i]))
}
const top = (buckets, limit, sortIndex = 0) => Object.fromEntries(Object.entries(buckets).sort((a, b) => Math.abs(b[1][sortIndex]) - Math.abs(a[1][sortIndex])).slice(0, limit).map(([k, v]) => [k, v]))

export function summarizeJournal(trades, { includeNotes = false, truncated = false, period = 'all', currency = 'INR', startingBalance = null } = {}) {
    const done = trades.filter(t => typeof t.pnl === 'number' && Number.isFinite(t.pnl))
    const wins = done.filter(t => t.pnl > 0).length, losses = done.filter(t => t.pnl < 0).length
    const grossProfit = done.filter(t => t.pnl > 0).reduce((s, t) => s + t.pnl, 0)
    const grossLoss = Math.abs(done.filter(t => t.pnl < 0).reduce((s, t) => s + t.pnl, 0))
    const range = winRateInterval(wins, done.length)
    const bySetup = {}, bySymbol = {}, byAssetClass = {}, byMonth = {}, mistakes = {}
    for (const t of trades) {
        const pnl = typeof t.pnl === 'number' ? t.pnl : 0
        const win = typeof t.pnl === 'number' && t.pnl > 0 ? 1 : 0
        tally(bySetup, t.setup_type || 'Untagged', [1, win, pnl])
        tally(bySymbol, t.symbol || 'Unspecified', [1, win, pnl])
        tally(byAssetClass, t.asset_class || 'unspecified', [1, win, pnl])
        tally(byMonth, t.date?.slice(0, 7) || 'Unknown', [1, win, pnl])
        for (const m of t.mistakes || []) tally(mistakes, m, [1, pnl])
    }
    const split = planningSplit(trades), dd = drawdown(trades, startingBalance), e = expectancy(trades), tl = tilt(trades), fees = feeDrag(trades)
    const recentColumns = includeNotes ? [...RECENT_COLUMNS, 'notes'] : RECENT_COLUMNS
    return {
        period, currency, monthGroupingTimeZone: 'UTC',
        tradeCount: trades.length, completedCount: done.length, openCount: trades.length - done.length,
        netPnl: round(done.reduce((s, t) => s + t.pnl, 0)), wins, losses, breakeven: done.length - wins - losses,
        winRate: range?.rate ?? null, winRateRange95: range ? [range.low, range.high] : null,
        profitFactor: grossLoss ? round(grossProfit / grossLoss) : grossProfit ? 'No losing trades' : null,
        fees: fees.fees, feesPctOfProfit: fees.share,
        startingBalance, planned: compactGroup(split.planned), unplanned: compactGroup(split.unplanned),
        drawdown: { max: dd.max, maxPct: dd.maxPct, current: dd.current, currentPct: dd.currentPct },
        expectancyR: { tradesWithStop: e.n, averageR: e.averageR, sqn: e.sqn },
        tilt: { enteredWithin60mOfLoss: compactGroup(tl.afterLoss), afterTwoLossesInARow: compactGroup(tl.afterTwoLosses), otherTrades: compactGroup(tl.baseline) },
        bucketColumns: ['trades', 'wins', 'net'],
        bySetup: top(bySetup, 8), bySymbol: top(bySymbol, 6), byAssetClass, byMonth: Object.fromEntries(Object.entries(byMonth).sort().slice(-6)),
        mistakeColumns: ['count', 'net'], mistakes: top(mistakes, 8),
        recentColumns,
        recentTrades: trades.slice(0, RECENT_LIMIT).map(t => {
            const row = [t.date?.slice(0, 16), t.symbol ?? null, t.direction ?? null, t.entry ?? null, t.exit_price ?? null, t.sl ?? null, t.units ?? null, t.fees ?? null, t.pnl ?? null, t.setup_type ?? null,
                t.checklist?.items?.length ? `${t.checklist.checked.length}/${t.checklist.items.length}` : 'unplanned', t.mistakes?.length ? t.mistakes.join('; ') : null]
            if (includeNotes) row.push(t.emotional_notes?.slice(0, 300) ?? null)
            return row
        }),
        detailLimit: RECENT_LIMIT, notesIncluded: includeNotes, truncated,
    }
}

async function loadCurrency(identity, signal) {
    const query = new URLSearchParams({ select: 'currency,starting_balance', user_id: `eq.${identity.userId}` })
    const response = await fetch(`${identity.url}/rest/v1/user_profiles?${query}`, { headers: identity.headers, signal })
    const rows = response.ok ? await response.json().catch(() => []) : []
    const row = Array.isArray(rows) ? rows[0] : null
    return { currency: CURRENCY_RE.test(row?.currency) ? row.currency : 'INR', startingBalance: Number(row?.starting_balance) > 0 ? Number(row.starting_balance) : null }
}

export async function loadJournal(identity, options, signal) {
    const fields = 'date,symbol,asset_class,direction,entry,exit_price,sl,tp,units,fees,pnl,rr,setup_type,mistakes,checklist' + (options.includeNotes ? ',emotional_notes' : '')
    const profile = loadCurrency(identity, signal)
    const trades = []
    for (let offset = 0; offset < 5000; offset += 500) {
        const query = new URLSearchParams({ select: fields, user_id: `eq.${identity.userId}`, order: 'date.desc,id.desc', limit: '500', offset: String(offset) })
        if (options.from) query.set('date', `gte.${options.from}`)
        if (options.to) query.append('date', `lte.${options.to}`)
        const response = await fetch(`${identity.url}/rest/v1/trades?${query}`, { headers: identity.headers, signal })
        if (!response.ok) throw new AssistantError(502, 'JOURNAL_UNAVAILABLE', 'Your journal could not be loaded. Please try again.')
        const page = await response.json()
        if (!Array.isArray(page)) throw new AssistantError(502, 'JOURNAL_UNAVAILABLE', 'Unexpected journal response.')
        trades.push(...page)
        if (page.length < 500) break
    }
    return summarizeJournal(trades, { ...options, ...await profile, truncated: trades.length === 5000 })
}
