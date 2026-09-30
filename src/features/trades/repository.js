import { computeTradeStats } from '../../domain/journal/statistics'
import { supabase } from '../../platform/supabase/client'
import { DEMO, demoDb, demoCommit, demoId, demoDelay } from '../../platform/demo/store'

export async function addTrade(userId, tradeData) {
    if (DEMO) {
        await demoDelay()
        const row = { id: demoId(), user_id: userId, created_at: new Date().toISOString(), ...tradeData }
        demoDb().trades.push(row)
        demoCommit()
        return row
    }
    const { data, error } = await supabase
        .from('trades')
        .insert([{ user_id: userId, ...tradeData }])
        .select()
        .single()
    if (error) throw error
    return data
}

export async function getTrades(userId) {
    if (DEMO) {
        await demoDelay()
        return [...demoDb().trades].sort((a, b) => new Date(b.date) - new Date(a.date))
    }
    const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
    if (error) throw error
    return data ?? []
}

export async function updateTrade(tradeId, updates) {
    if (DEMO) {
        await demoDelay()
        const rows = demoDb().trades
        const i = rows.findIndex(t => t.id === tradeId)
        if (i === -1) throw new Error('Trade not found.')
        rows[i] = { ...rows[i], ...updates }
        demoCommit()
        return rows[i]
    }
    const { data, error } = await supabase
        .from('trades')
        .update(updates)
        .eq('id', tradeId)
        .select()
        .single()
    if (error) throw error
    return data
}

export async function deleteTrade(tradeId) {
    if (DEMO) {
        await demoDelay()
        const store = demoDb()
        store.trades = store.trades.filter(t => t.id !== tradeId)
        demoCommit()
        return
    }
    const { error } = await supabase
        .from('trades')
        .delete()
        .eq('id', tradeId)
    if (error) throw error
}

/**
 * Fetch a user's trades and derive their stats in one round trip.
 * Prefer this over calling getTrades() and getTradeStats() separately -- doing
 * both fetched the whole table twice on every Dashboard and Analytics load.
 */
export async function getTradesAndStats(userId) {
    const trades = await getTrades(userId)
    return { trades, stats: computeTradeStats(trades) }
}
