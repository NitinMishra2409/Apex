import { supabase } from '../../platform/supabase/client'
import { DEMO, demoDb, demoCommit, demoDelay } from '../../platform/demo/store'
import { CHECKLIST_TYPES } from '../../domain/checklists/vocabulary'

const todayISO = () => new Date().toISOString().split('T')[0]

export async function getChecklist(userId, type) {
    if (DEMO) {
        await demoDelay()
        return demoDb().checklists[type] ?? []
    }
    // Try to fetch existing
    const { data, error } = await supabase
        .from('checklists')
        .select('items')
        .eq('user_id', userId)
        .eq('type', type)
        .maybeSingle()

    if (error) throw error
    if (data) return data.items ?? []

    // Upsert default empty checklist
    const { data: created, error: upsertErr } = await supabase
        .from('checklists')
        .upsert({ user_id: userId, type, items: [] }, { onConflict: 'user_id,type' })
        .select('items')
        .single()

    if (upsertErr) throw upsertErr
    return created.items ?? []
}

export async function saveChecklistItems(userId, type, items) {
    if (DEMO) {
        await demoDelay()
        const store = demoDb()
        store.checklists[type] = items
        demoCommit()
        return { user_id: userId, type, items }
    }
    const { data, error } = await supabase
        .from('checklists')
        .upsert(
            { user_id: userId, type, items, updated_at: new Date().toISOString() },
            { onConflict: 'user_id,type' }
        )
        .select()
        .single()
    if (error) throw error
    return data
}

export async function getDailyProgress(userId, type) {
    if (DEMO) {
        await demoDelay()
        return demoDb().dailyProgress[`${todayISO()}|${type}`] ?? []
    }
    const { data, error } = await supabase
        .from('daily_progress')
        .select('checked_items')
        .eq('user_id', userId)
        .eq('date', todayISO())
        .eq('type', type)
        .maybeSingle()
    if (error) throw error
    return data?.checked_items ?? []
}

export async function saveDailyProgress(userId, type, checkedItems) {
    if (DEMO) {
        await demoDelay()
        const store = demoDb()
        store.dailyProgress[`${todayISO()}|${type}`] = checkedItems
        demoCommit()
        return { user_id: userId, type, date: todayISO(), checked_items: checkedItems }
    }
    const { data, error } = await supabase
        .from('daily_progress')
        .upsert(
            { user_id: userId, type, date: todayISO(), checked_items: checkedItems },
            { onConflict: 'user_id,date,type' }
        )
        .select()
        .single()
    if (error) throw error
    return data
}

/**
 * Every checklist and today's progress for a user, in ONE round trip per table.
 *
 * The Dashboard previously called getChecklist() + getDailyProgress() for each
 * of the three types -- six sequential requests just to draw three progress
 * bars. This replaces them with two queries.
 *
 * @returns {Promise<{[type:string]: {items: string[], checked: string[]}}>}
 */
export async function getChecklistSummary(userId) {
    const blank = () => Object.fromEntries(CHECKLIST_TYPES.map(t => [t, { items: [], checked: [] }]))

    if (DEMO) {
        await demoDelay()
        const store = demoDb()
        const today = todayISO()
        const out = blank()
        for (const type of CHECKLIST_TYPES) {
            out[type] = {
                items: store.checklists[type] ?? [],
                checked: store.dailyProgress[`${today}|${type}`] ?? [],
            }
        }
        return out
    }

    const [listsRes, progressRes] = await Promise.all([
        supabase.from('checklists').select('type, items').eq('user_id', userId),
        supabase.from('daily_progress').select('type, checked_items').eq('user_id', userId).eq('date', todayISO()),
    ])
    if (listsRes.error) throw listsRes.error
    if (progressRes.error) throw progressRes.error

    const out = blank()
    for (const row of listsRes.data ?? []) {
        if (out[row.type]) out[row.type].items = row.items ?? []
    }
    for (const row of progressRes.data ?? []) {
        if (out[row.type]) out[row.type].checked = row.checked_items ?? []
    }
    return out
}
