import { supabase } from '../../platform/supabase/client'
import { DEMO, demoDb, demoCommit, demoDelay } from '../../platform/demo/store'
import { CHECKLIST_DEFAULTS, CHECKLIST_TYPES, DAILY_CHECKLIST_TYPES } from '../../domain/checklists/vocabulary'
import { dayKey } from '../../domain/journal/reporting'

// Daily progress is keyed by the trader's LOCAL date, so it resets at their midnight.
const today = () => dayKey(new Date())
const assertDaily = type => { if (!DAILY_CHECKLIST_TYPES.includes(type)) throw new Error(`${type} checklists are ticked per trade, not per day.`) }

/** The playbook items for one checklist type. Falls back to the defaults until the trader edits them. */
export async function getChecklist(userId, type) {
    if (DEMO) {
        await demoDelay()
        return demoDb().checklists[type] ?? CHECKLIST_DEFAULTS[type]
    }
    const { data, error } = await supabase.from('checklists').select('items').eq('user_id', userId).eq('type', type).maybeSingle()
    if (error) throw error
    return data ? data.items ?? [] : CHECKLIST_DEFAULTS[type]
}

export async function saveChecklistItems(userId, type, items) {
    if (DEMO) {
        await demoDelay()
        demoDb().checklists[type] = items
        demoCommit()
        return { user_id: userId, type, items }
    }
    const { data, error } = await supabase
        .from('checklists')
        .upsert({ user_id: userId, type, items, updated_at: new Date().toISOString() }, { onConflict: 'user_id,type' })
        .select()
        .single()
    if (error) throw error
    return data
}

export async function getDailyProgress(userId, type, date = today()) {
    assertDaily(type)
    if (DEMO) {
        await demoDelay()
        return demoDb().dailyProgress[`${date}|${type}`] ?? []
    }
    const { data, error } = await supabase
        .from('daily_progress').select('checked_items')
        .eq('user_id', userId).eq('date', date).eq('type', type)
        .maybeSingle()
    if (error) throw error
    return data?.checked_items ?? []
}

export async function saveDailyProgress(userId, type, checkedItems, date = today()) {
    assertDaily(type)
    if (DEMO) {
        await demoDelay()
        demoDb().dailyProgress[`${date}|${type}`] = checkedItems
        demoCommit()
        return { user_id: userId, type, date, checked_items: checkedItems }
    }
    const { data, error } = await supabase
        .from('daily_progress')
        .upsert({ user_id: userId, type, date, checked_items: checkedItems }, { onConflict: 'user_id,date,type' })
        .select()
        .single()
    if (error) throw error
    return data
}

/**
 * Every playbook plus today's progress for the daily ones, in one round trip per table.
 * @returns {Promise<{[type:string]: {items: string[], checked: string[]}}>} per-trade entries have no daily progress
 */
export async function getChecklistSummary(userId, date = today()) {
    const out = Object.fromEntries(CHECKLIST_TYPES.map(t => [t, { items: CHECKLIST_DEFAULTS[t], checked: [] }]))
    if (DEMO) {
        await demoDelay()
        const store = demoDb()
        for (const type of CHECKLIST_TYPES) {
            out[type] = { items: store.checklists[type] ?? CHECKLIST_DEFAULTS[type], checked: DAILY_CHECKLIST_TYPES.includes(type) ? store.dailyProgress[`${date}|${type}`] ?? [] : [] }
        }
        return out
    }
    const [listsRes, progressRes] = await Promise.all([
        supabase.from('checklists').select('type, items').eq('user_id', userId),
        supabase.from('daily_progress').select('type, checked_items').eq('user_id', userId).eq('date', date),
    ])
    if (listsRes.error) throw listsRes.error
    if (progressRes.error) throw progressRes.error
    for (const row of listsRes.data ?? []) if (out[row.type]) out[row.type].items = row.items ?? []
    for (const row of progressRes.data ?? []) if (out[row.type]) out[row.type].checked = row.checked_items ?? []
    return out
}
