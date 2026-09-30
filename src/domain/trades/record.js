import { calcPnl, calcRR, getResult, num } from './math'
import { normaliseSymbol } from './symbols'
import { ASSET_CLASSES } from './vocabulary'

/**
 * A per-trade checklist as stored on the trade: the playbook items at the time
 * and the ones ticked. Null marks an Unplanned trade.
 */
export function prepareChecklist(checklist) {
    if (!checklist) return null
    const items = [...new Set((checklist.items ?? []).filter(i => typeof i === 'string' && i.trim()))]
    if (!items.length) return null
    return { items, checked: items.filter(item => checklist.checked?.includes(item)) }
}

/**
 * Convert reviewed form values into a trade write.
 * Omitted symbol and checklist stay untouched on edit; an explicit null checklist marks the trade Unplanned.
 */
export function prepareTrade(form, mistakes = []) {
    const pnl = calcPnl(form.direction, form.entry, form.exit_price, form.units, form.fees)
    return {
        date: new Date(form.date).toISOString(),
        ...(Object.hasOwn(form, 'symbol') ? { symbol: normaliseSymbol(form.symbol) } : {}),
        asset_class: ASSET_CLASSES.includes(form.asset_class) ? form.asset_class : null,
        direction: form.direction,
        entry: num(form.entry),
        exit_price: num(form.exit_price),
        sl: num(form.sl),
        tp: num(form.tp),
        units: num(form.units),
        fees: num(form.fees),
        rr: calcRR(form.direction, form.entry, form.sl, form.tp),
        pnl,
        result: getResult(pnl),
        setup_type: form.setup_type || null,
        mistakes: mistakes.length ? [...mistakes] : null,
        emotional_notes: form.emotional_notes || null,
        ...(Object.hasOwn(form, 'checklist') ? { checklist: prepareChecklist(form.checklist) } : {}),
    }
}

/** A trade is Planned when its per-trade checklist was used, Unplanned when it was skipped. */
export const isPlanned = trade => Boolean(trade.checklist?.items?.length)
export const checklistCompletion = trade => isPlanned(trade) ? trade.checklist.checked.length / trade.checklist.items.length : null
