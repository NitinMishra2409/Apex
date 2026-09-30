import { supabase } from '../../platform/supabase/client'
import { DEMO, demoDb, demoCommit, demoDelay } from '../../platform/demo/store'
import { CURRENCIES, DEFAULT_CURRENCY } from '../../domain/trades/vocabulary'

const clean = row => ({
    currency: CURRENCIES.includes(row?.currency) ? row.currency : DEFAULT_CURRENCY,
    startingBalance: typeof row?.starting_balance === 'number' ? row.starting_balance : row?.starting_balance ? Number(row.starting_balance) : null,
})

/** The trader's display currency and optional starting balance. */
export async function getProfile(userId) {
    if (DEMO) {
        await demoDelay()
        return clean(demoDb().profile)
    }
    const { data, error } = await supabase.from('user_profiles').select('currency, starting_balance').eq('user_id', userId).maybeSingle()
    if (error) throw error
    return clean(data)
}

export async function saveProfile(userId, { currency, startingBalance }) {
    if (!CURRENCIES.includes(currency)) throw new Error('Choose a supported currency.')
    if (startingBalance !== null && !(startingBalance > 0)) throw new Error('Starting balance must be greater than zero.')
    const row = { currency, starting_balance: startingBalance }
    if (DEMO) {
        await demoDelay()
        demoDb().profile = row
        demoCommit()
        return clean(row)
    }
    const { data, error } = await supabase.from('user_profiles')
        .upsert({ user_id: userId, ...row, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
        .select('currency, starting_balance').single()
    if (error) throw error
    return clean(data)
}
