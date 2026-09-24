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

/** Convenience wrapper: fetch, then derive. */
export async function getTradeStats(userId) {
    return computeTradeStats(await getTrades(userId))
}

/**
 * Just today's P&L and trade count, for the navbar badge.
 *
 * The navbar previously downloaded every trade the user had ever made and
 * filtered client-side to show one number. This filters server-side and selects
 * only the two columns it needs, so the payload stays constant as the journal
 * grows instead of scaling with it.
 */
export async function getTodaySummary(userId) {
    const today = new Date().toISOString().split('T')[0]

    if (DEMO) {
        await demoDelay()
        const todays = demoDb().trades.filter(t => t.date?.startsWith(today))
        const pnl = todays.reduce((s, t) => s + (t.pnl ?? 0), 0)
        return { count: todays.length, pnl: todays.length ? +pnl.toFixed(2) : null }
    }

    const { data, error } = await supabase
        .from('trades')
        .select('pnl')
        .eq('user_id', userId)
        .gte('date', today)
    if (error) throw error

    const rows = data ?? []
    const pnl = rows.reduce((s, t) => s + (t.pnl ?? 0), 0)
    return { count: rows.length, pnl: rows.length ? +pnl.toFixed(2) : null }
}
