/**
 * Derive every statistic the app displays from an already-fetched trade list.
 * Pure and synchronous, so it is directly unit-testable.
 *
 * @param {Array} trades  newest-first, as returned by getTrades()
 */
export function computeTradeStats(trades = []) {

    const totalTrades = trades.length
    const wins = trades.filter(t => t.result === 'WIN').length
    const losses = trades.filter(t => t.result === 'LOSS').length
    const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : 0

    const totalPnl = trades.reduce((sum, t) => sum + (t.pnl ?? 0), 0)

    const avgRR = (() => {
        const withRR = trades.filter(t => t.rr != null)
        if (!withRR.length) return 0
        return (withRR.reduce((s, t) => s + t.rr, 0) / withRR.length).toFixed(2)
    })()

    const grossProfit = trades.filter(t => (t.pnl ?? 0) > 0).reduce((s, t) => s + t.pnl, 0)
    const grossLoss = Math.abs(trades.filter(t => (t.pnl ?? 0) < 0).reduce((s, t) => s + t.pnl, 0))
    const profitFactor = grossLoss === 0 ? grossProfit > 0 ? '∞' : 0 : (grossProfit / grossLoss).toFixed(2)

    // Current streak
    let currentStreak = 0
    if (trades.length > 0) {
        const firstResult = trades[0].result
        for (const t of trades) {
            if (t.result === firstResult) currentStreak++
            else break
        }
        if (firstResult === 'LOSS') currentStreak = -currentStreak
    }

    const bestTrade = trades.length > 0 ? trades.reduce((best, t) => ((t.pnl ?? -Infinity) > (best.pnl ?? -Infinity) ? t : best), trades[0]) : null
    const worstTrade = trades.length > 1 ? trades.reduce((worst, t) => ((t.pnl ?? Infinity) < (worst.pnl ?? Infinity) ? t : worst), trades[0]) : null

    // Equity curve — cumulative PnL sorted by date ascending
    const sorted = [...trades].sort((a, b) => new Date(a.date) - new Date(b.date))
    let cum = 0
    const equityCurve = sorted.map(t => {
        cum += t.pnl ?? 0
        return { date: t.date, pnl: +cum.toFixed(2) }
    })

    // Mistake frequency
    const mistakeFrequency = {}
    for (const t of trades) {
        for (const m of (t.mistakes ?? [])) {
            mistakeFrequency[m] = (mistakeFrequency[m] ?? 0) + 1
        }
    }

    // Setup performance
    const setupPerformance = {}
    for (const t of trades) {
        if (!t.setup_type) continue
        if (!setupPerformance[t.setup_type]) {
            setupPerformance[t.setup_type] = { wins: 0, losses: 0, totalPnl: 0, rrSum: 0, rrCount: 0 }
        }
        const s = setupPerformance[t.setup_type]
        if (t.result === 'WIN') s.wins++
        if (t.result === 'LOSS') s.losses++
        s.totalPnl += t.pnl ?? 0
        if (t.rr != null) { s.rrSum += t.rr; s.rrCount++ }
    }
    for (const key of Object.keys(setupPerformance)) {
        const s = setupPerformance[key]
        const total = s.wins + s.losses
        s.winRate = total > 0 ? +((s.wins / total) * 100).toFixed(1) : 0
        s.avgRR = s.rrCount > 0 ? +(s.rrSum / s.rrCount).toFixed(2) : 0
        s.totalPnl = +s.totalPnl.toFixed(2)
        delete s.rrSum; delete s.rrCount
    }

    // PnL by day of week
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const pnlByDayOfWeek = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 }
    for (const t of trades) {
        const day = dayNames[new Date(t.date).getDay()]
        pnlByDayOfWeek[day] = +(((pnlByDayOfWeek[day] ?? 0) + (t.pnl ?? 0)).toFixed(2))
    }

    return {
        totalTrades, wins, losses,
        winRate: +winRate,
        totalPnl: +totalPnl.toFixed(2),
        avgRR: +avgRR,
        profitFactor,
        currentStreak,
        bestTrade,
        worstTrade,
        equityCurve,
        mistakeFrequency,
        setupPerformance,
        pnlByDayOfWeek,
    }
}

