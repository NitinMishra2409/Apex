import { AssistantError } from './runtime.js'
import { DEMO_TRADE_LIMIT, demoJournalRows } from '../../shared/demoJournal.js'

export function loadDemoJournal(body, options) {
    if (!Array.isArray(body.demoTrades) || body.demoTrades.length > DEMO_TRADE_LIMIT || body.demoTrades.some(t => !t || typeof t !== 'object' || Array.isArray(t) || typeof t.date !== 'string' || !Number.isFinite(Date.parse(t.date)))) {
        throw new AssistantError(400, 'BAD_DEMO_JOURNAL', 'The demo journal could not be read. Refresh the page and try again.')
    }
    const { demoTrades } = demoJournalRows(body.demoTrades, options)
    return { ...summarizeJournal(demoTrades, { ...options, truncated: body.demoTruncated === true }), source: 'local demo journal; sample data for testing', detailLimit: 40 }
}

const round = n => Math.round(n * 100) / 100
export function summarizeJournal(trades, { includeNotes = false, truncated = false, period = 'all' } = {}) {
    const summary = { period, currency: 'USDT', positionSizeUnit: 'USDT notional', monthGroupingTimeZone: 'UTC', tradeCount: trades.length, completedCount: 0, openCount: 0, netPnl: 0, wins: 0, losses: 0, breakeven: 0, grossProfit: 0, grossLoss: 0, bySetup: {}, bySymbol: {}, byMonth: {}, mistakes: {}, truncated }
    for (const trade of trades) {
        const closed = typeof trade.pnl === 'number' && Number.isFinite(trade.pnl)
        const pnl = closed ? trade.pnl : 0
        summary[closed ? 'completedCount' : 'openCount']++
        if (closed) { summary[pnl > 0 ? 'wins' : pnl < 0 ? 'losses' : 'breakeven']++; summary.netPnl += pnl; summary[pnl >= 0 ? 'grossProfit' : 'grossLoss'] += Math.abs(pnl) }
        for (const [field, key] of [['bySetup', trade.setup_type || 'Untagged'], ['bySymbol', trade.symbol || 'BTCUSDT'], ['byMonth', trade.date?.slice(0, 7) || 'Unknown']]) {
            // Define own properties so special labels cannot invoke prototype setters.
            if (!Object.hasOwn(summary[field], key)) Object.defineProperty(summary[field], key, { value: { trades: 0, completed: 0, wins: 0, pnl: 0 }, enumerable: true })
            const bucket = summary[field][key]
            bucket.trades++; bucket.completed += +closed; bucket.wins += +(closed && pnl > 0); bucket.pnl = round(bucket.pnl + pnl)
        }
        for (const mistake of trade.mistakes || []) {
            if (!Object.hasOwn(summary.mistakes, mistake)) Object.defineProperty(summary.mistakes, mistake, { value: { count: 0, pnl: 0 }, enumerable: true })
            summary.mistakes[mistake].count++; summary.mistakes[mistake].pnl = round(summary.mistakes[mistake].pnl + pnl)
        }
    }
    summary.netPnl = round(summary.netPnl)
    summary.winRate = summary.completedCount ? round(summary.wins / summary.completedCount * 100) : null
    summary.profitFactor = summary.grossLoss ? round(summary.grossProfit / summary.grossLoss) : summary.grossProfit ? 'No losing trades' : null
    summary.grossProfit = round(summary.grossProfit); summary.grossLoss = round(summary.grossLoss)
    summary.recentTrades = trades.slice(0, 40).map(t => ({ date: t.date, symbol: t.symbol, direction: t.direction, entry: t.entry, exit: t.exit_price, stop: t.sl, target: t.tp, size: t.size, pnl: t.pnl, plannedRR: t.rr, setup: t.setup_type, mistakes: t.mistakes, ...(includeNotes ? { notes: t.emotional_notes?.slice(0, 600) } : {}) }))
    summary.notesIncluded = includeNotes
    summary.detailLimit = 40
    return summary
}
export async function loadJournal(identity, options, signal) {
    const fields = 'date,symbol,direction,entry,exit_price,sl,tp,size,pnl,rr,setup_type,mistakes' + (options.includeNotes ? ',emotional_notes' : '')
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
    return summarizeJournal(trades, { ...options, truncated: trades.length === 5000 })
}
