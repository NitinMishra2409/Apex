// The canonical risk/reward and P&L formulas.
//
// Previously duplicated verbatim in NewTrade.jsx and TradeLog.jsx, which meant a
// fix in one place could silently disagree with the other. Everything that
// derives numbers from a trade must import from here.
//
// P&L CONVENTION: `size` is notional in USDT and P&L is the percentage move
// applied to that notional -- ((exit - entry) / entry) * size for a long. It is
// NOT (exit - entry) * quantity. The seeded demo data uses these same functions,
// so the numbers reconcile if you inspect a row.

/** Form input -> number, treating '' and null as "not provided". */
export const num = (value) =>
    (value === '' || value === null || value === undefined) ? null : parseFloat(value)

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

    return +(reward / risk).toFixed(2)
}

/**
 * Realised P&L in USDT. Returns null until entry, exit and size are all present.
 */
export function calcPnl(direction, entry, exitPrice, size) {
    const en = num(entry), ex = num(exitPrice), sz = num(size)
    if (!en || !ex || !sz) return null

    const move = direction === 'LONG' ? (ex - en) / en : (en - ex) / en
    return +(move * sz).toFixed(2)
}

/** WIN / LOSS / BE from P&L. Null P&L means the trade isn't closed yet. */
export function getResult(pnl) {
    if (pnl === null || pnl === undefined) return null
    if (pnl > 0) return 'WIN'
    if (pnl < 0) return 'LOSS'
    return 'BE'
}
