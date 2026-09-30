// Journal analytics shared by the Analytics screen and the Coach snapshot.
// Pure functions over trade rows ({ date, pnl, result, direction, entry, sl, units, fees, checklist }).
// Nothing here predicts markets: Monte Carlo resamples the trader's own history.
import { realisedR } from '../src/domain/trades/math.js'

const round = (n, places = 2) => Number.isFinite(n) ? +n.toFixed(places) : null
const closed = trades => trades.filter(t => typeof t.pnl === 'number' && Number.isFinite(t.pnl))
const chronological = trades => [...trades].sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
export const isPlannedTrade = t => Boolean(t.checklist?.items?.length)

/** Wilson 95% interval for a win rate, in percent. Honest ranges for small samples. */
export function winRateInterval(wins, n) {
    if (!n) return null
    const z = 1.96, p = wins / n
    const centre = (p + z * z / (2 * n)) / (1 + z * z / n)
    const margin = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / (1 + z * z / n)
    return { rate: round(p * 100, 1), low: round(Math.max(0, centre - margin) * 100, 1), high: round(Math.min(1, centre + margin) * 100, 1), n }
}

function group(trades) {
    const done = closed(trades)
    const wins = done.filter(t => t.pnl > 0).length
    return { trades: trades.length, closed: done.length, wins, net: round(done.reduce((s, t) => s + t.pnl, 0)), winRate: winRateInterval(wins, done.length) }
}

/** Planned (checklist used) vs Unplanned, plus results by checklist completion. */
export function planningSplit(trades) {
    const planned = trades.filter(isPlannedTrade)
    const bucket = t => { const c = t.checklist.checked.length / t.checklist.items.length; return c >= 1 ? 'complete' : c >= 0.5 ? 'mostly' : 'partial' }
    const byCompletion = { complete: [], mostly: [], partial: [] }
    for (const t of planned) byCompletion[bucket(t)].push(t)
    return {
        planned: group(planned),
        unplanned: group(trades.filter(t => !isPlannedTrade(t))),
        byCompletion: Object.fromEntries(Object.entries(byCompletion).map(([k, v]) => [k, group(v)])),
    }
}

/** Drawdown on the closed-trade equity curve. Percentages need a starting balance. */
export function drawdown(trades, startingBalance = null) {
    const rows = chronological(closed(trades))
    const base = startingBalance > 0 ? startingBalance : 0
    let equity = base, peak = base, peakIndex = -1, max = 0, maxPct = 0, maxAt = null, longest = 0
    const underwater = []
    rows.forEach((t, i) => {
        equity += t.pnl
        if (equity >= peak) { longest = Math.max(longest, i - peakIndex - 1); peak = equity; peakIndex = i }
        const dd = peak - equity
        const ddPct = base && peak > 0 ? dd / peak * 100 : null
        if (dd > max) { max = dd; maxAt = t.date }
        if (ddPct !== null && ddPct > maxPct) maxPct = ddPct
        underwater.push({ date: t.date, drawdown: round(-dd), drawdownPct: ddPct === null ? null : round(-ddPct) })
    })
    const current = peak - equity
    return {
        max: round(max), maxPct: base ? round(maxPct) : null, maxAt,
        current: round(current), currentPct: base && peak > 0 ? round(current / peak * 100) : null,
        longestUnderwaterTrades: Math.max(longest, rows.length - peakIndex - 1),
        underwater,
    }
}

/** Expectancy in R, the R distribution and a System Quality Number. Needs a stop and units. */
export function expectancy(trades) {
    const rs = closed(trades).map(realisedR).filter(r => r !== null)
    if (!rs.length) return { n: 0, averageR: null, sqn: null, histogram: [] }
    const mean = rs.reduce((s, r) => s + r, 0) / rs.length
    const sd = Math.sqrt(rs.reduce((s, r) => s + (r - mean) ** 2, 0) / Math.max(1, rs.length - 1))
    const edges = [-Infinity, -2, -1, -0.5, 0, 0.5, 1, 2, 3, Infinity]
    const labels = ['≤ −2R', '−2 to −1R', '−1 to −0.5R', '−0.5 to 0R', '0 to 0.5R', '0.5 to 1R', '1 to 2R', '2 to 3R', '≥ 3R']
    const histogram = labels.map((label, i) => ({ label, count: rs.filter(r => r > edges[i] && r <= edges[i + 1]).length, positive: edges[i] >= 0 }))
    return { n: rs.length, averageR: round(mean), sqn: rs.length > 1 && sd > 0 ? round(Math.sqrt(Math.min(rs.length, 100)) * mean / sd) : null, histogram }
}

/** Tilt: results of trades entered within an hour of a loss, and after two or more losses in a row. */
export function tilt(trades, windowMinutes = 60) {
    const rows = chronological(closed(trades))
    const afterLoss = [], afterStreak = [], other = []
    let streak = 0
    rows.forEach((t, i) => {
        const prev = rows[i - 1]
        const quick = prev && prev.pnl < 0 && Date.parse(t.date) - Date.parse(prev.date) <= windowMinutes * 60000
        if (quick) afterLoss.push(t)
        if (streak >= 2) afterStreak.push(t)
        if (!quick && streak < 2) other.push(t)
        streak = t.pnl < 0 ? streak + 1 : 0
    })
    return { windowMinutes, afterLoss: group(afterLoss), afterTwoLosses: group(afterStreak), baseline: group(other) }
}

/** P&L and count by weekday (Mon..Sun) × hour of entry, in the viewer's local time. */
export function timeHeatmap(trades) {
    const cells = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => ({ pnl: 0, count: 0 })))
    for (const t of closed(trades)) {
        const d = new Date(t.date)
        const cell = cells[(d.getDay() + 6) % 7][d.getHours()]
        cell.pnl = round(cell.pnl + t.pnl); cell.count++
    }
    return cells
}

/** How much of the gross profit went to fees. */
export function feeDrag(trades) {
    const done = closed(trades)
    const fees = round(done.reduce((s, t) => s + (Number(t.fees) || 0), 0))
    const grossProfit = done.reduce((s, t) => s + Math.max(0, t.pnl + (Number(t.fees) || 0)), 0)
    return { fees, grossProfitBeforeFees: round(grossProfit), share: grossProfit > 0 ? round(fees / grossProfit * 100, 1) : null }
}

function mulberry32(seed) {
    return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

/**
 * Bootstrap simulation: draw `horizon` trades at random (with replacement) from the
 * trader's own closed trades, `runs` times. Returns percentile bands per step and risk figures.
 * A simulation of the past, not a forecast.
 */
export function monteCarlo(trades, { runs = 1000, horizon = 100, startingBalance = null, ruinPct = 50, drawdownPct = 20, seed = 7 } = {}) {
    const outcomes = closed(trades).map(t => t.pnl)
    if (outcomes.length < 10) return { enough: false, sample: outcomes.length }
    const start = startingBalance > 0 ? startingBalance : 0
    const rand = mulberry32(seed)
    const paths = Array.from({ length: horizon + 1 }, () => new Float64Array(runs))
    let ruined = 0, deepDrawdown = 0
    const finals = new Float64Array(runs), maxDds = new Float64Array(runs)
    for (let r = 0; r < runs; r++) {
        let equity = start, peak = start, worst = 0, worstPct = 0, hitRuin = false
        paths[0][r] = equity
        for (let step = 1; step <= horizon; step++) {
            equity += outcomes[Math.floor(rand() * outcomes.length)]
            peak = Math.max(peak, equity)
            worst = Math.max(worst, peak - equity)
            if (start && peak > 0) worstPct = Math.max(worstPct, (peak - equity) / peak * 100)
            if (start && equity <= start * (1 - ruinPct / 100)) hitRuin = true
            paths[step][r] = equity
        }
        finals[r] = equity; maxDds[r] = worst
        if (hitRuin) ruined++
        if (worstPct >= drawdownPct) deepDrawdown++
    }
    const pct = (arr, p) => { const s = Float64Array.from(arr).sort(); return s[Math.min(s.length - 1, Math.floor(p / 100 * s.length))] }
    const bands = paths.map((values, step) => ({ step, p5: round(pct(values, 5)), p25: round(pct(values, 25)), p50: round(pct(values, 50)), p75: round(pct(values, 75)), p95: round(pct(values, 95)) }))
    return {
        enough: true, sample: outcomes.length, runs, horizon, start,
        bands,
        medianFinal: round(pct(finals, 50)), p5Final: round(pct(finals, 5)), p95Final: round(pct(finals, 95)),
        probabilityOfLoss: round(finals.filter(v => v < start).length / runs * 100, 1),
        medianMaxDrawdown: round(pct(maxDds, 50)),
        riskOfRuin: start ? round(ruined / runs * 100, 1) : null, ruinPct,
        probabilityOfDrawdown: start ? round(deepDrawdown / runs * 100, 1) : null, drawdownPct,
    }
}
