import { supabase } from '../../platform/supabase/client'
import { DEMO, demoDb, demoCommit, demoId, demoDelay } from '../../platform/demo/store'

export async function getCustomMistakes(userId) {
    if (DEMO) {
        await demoDelay()
        return demoDb().customMistakes
    }
    const { data, error } = await supabase
        .from('custom_mistakes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
    if (error) throw error
    return data ?? []
}

export async function addCustomMistake(userId, label) {
    if (DEMO) {
        await demoDelay()
        const row = { id: demoId(), user_id: userId, label, created_at: new Date().toISOString() }
        demoDb().customMistakes.push(row)
        demoCommit()
        return row
    }
    const { data, error } = await supabase
        .from('custom_mistakes')
        .insert([{ user_id: userId, label }])
        .select()
        .single()
    if (error) throw error
    return data
}

