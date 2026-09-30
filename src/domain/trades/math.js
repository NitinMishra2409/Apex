// The canonical risk/reward and P&L formulas. Everything that derives numbers
// from a trade imports from here, including the demo seed.
//
// P&L CONVENTION: price move × units × direction − fees, in the account currency.
// Units are the total quantity (shares, coins, or lots × lot size), so the same
// formula covers stocks, crypto, forex, futures and options premiums.

/** Form input -> number, treating '' and null as "not provided". */
export const num = (value) =>
    (value === '' || value === null || value === undefined) ? null : parseFloat(value)

const round2 = value => +value.toFixed(2)

/**
 * Planned reward-to-risk ratio from entry, stop and target.
 * Returns null when any leg is missing or the stop is on the wrong side
 * (risk <= 0), which would otherwise produce a negative or infinite ratio.
 *
 * @returns {number|null} e.g. 2.58 meaning 1:2.58
 */
export function calcRR(direction, entry, stopLoss, takeProfit) {
    const en = num(entry), sl = num(stopLoss), tp = num(takeProfit)
    if (!en || !sl || !tp) return null

    const risk = direction === 'LONG' ? en - sl : sl - en
    const reward = direction === 'LONG' ? tp - en : en - tp
    if (risk <= 0) return null

    return round2(reward / risk)
}

/**
 * Realised P&L: (exit − entry) × units for a long, reversed for a short, minus fees.
 * Returns null until entry, exit and units are all present. Blank fees count as zero.
 */
export function calcPnl(direction, entry, exitPrice, units, fees) {
    const en = num(entry), ex = num(exitPrice), qty = num(units)
    if (!en || !ex || !qty) return null
    const move = direction === 'LONG' ? ex - en : en - ex
    return round2(move * qty - (num(fees) ?? 0))
}

/** Amount at risk if the stop is hit: |entry − stop| × units. Null without a valid stop. */
export function calcRisk(direction, entry, stopLoss, units) {
    const en = num(entry), sl = num(stopLoss), qty = num(units)
    if (!en || !sl || !qty) return null
    const perUnit = direction === 'LONG' ? en - sl : sl - en
    return perUnit > 0 ? round2(perUnit * qty) : null
}

/** Realised R: P&L measured in units of the amount risked. Null without P&L or risk. */
export function realisedR(trade) {
    if (trade.pnl === null || trade.pnl === undefined) return null
    const risk = calcRisk(trade.direction, trade.entry, trade.sl, trade.units)
    return risk ? round2(trade.pnl / risk) : null
}

/** WIN / LOSS / BE from P&L. Null P&L means the trade isn't closed yet. */
export function getResult(pnl) {
    if (pnl === null || pnl === undefined) return null
    if (pnl > 0) return 'WIN'
    if (pnl < 0) return 'LOSS'
    return 'BE'
}
