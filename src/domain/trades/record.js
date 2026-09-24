import { calcPnl, calcRR, getResult, num } from './math'
import { normaliseSymbol } from './symbols'

/** Convert reviewed form values into a trade write. Omitted symbol stays untouched on edit. */
export function prepareTrade(form, mistakes = []) {
    const pnl = calcPnl(form.direction, form.entry, form.exit_price, form.size)
    return {
        date: new Date(form.date).toISOString(),
        ...(Object.hasOwn(form, 'symbol') ? { symbol: normaliseSymbol(form.symbol) } : {}),
        direction: form.direction,
        entry: num(form.entry),
        exit_price: num(form.exit_price),
        sl: num(form.sl),
        tp: num(form.tp),
        size: num(form.size),
        rr: calcRR(form.direction, form.entry, form.sl, form.tp),
        pnl,
        result: getResult(pnl),
        setup_type: form.setup_type || null,
        mistakes: mistakes.length ? [...mistakes] : null,
        emotional_notes: form.emotional_notes || null,
    }
}
