import adminSupabase from './adminClient'
import { DEMO, demoDb, demoCommit, demoDelay } from '../../platform/demo/store'

/**
 * Returns all users joined with their profile and trade count.
 */
export async function getAllUsers() {
    if (DEMO) {
        await demoDelay()
        const store = demoDb()
        // trade_count of null means "count this one live from the demo trades".
        return store.users.map(u => ({
            ...u,
            trade_count: u.trade_count ?? store.trades.length,
        }))
    }
    // List all auth users via admin API
    const { data: authData, error: authErr } = await adminSupabase.auth.admin.listUsers({ perPage: 1000 })
    if (authErr) throw authErr

    const users = authData.users

    // Fetch all profiles
    const { data: profiles, error: profileErr } = await adminSupabase
        .from('user_profiles')
        .select('user_id, is_admin, created_at')
    if (profileErr) throw profileErr

    // Fetch trade counts grouped by user
    const { data: tradeCounts, error: tradeErr } = await adminSupabase
        .from('trades')
        .select('user_id')
    if (tradeErr) throw tradeErr

    // Build lookup maps
    const profileMap = {}
    for (const p of (profiles ?? [])) profileMap[p.user_id] = p

    const tradeCountMap = {}
    for (const t of (tradeCounts ?? [])) {
        tradeCountMap[t.user_id] = (tradeCountMap[t.user_id] ?? 0) + 1
    }

    return users.map(u => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        is_admin: profileMap[u.id]?.is_admin ?? false,
        trade_count: tradeCountMap[u.id] ?? 0,
    }))
}

/**
 * Sets is_admin = true for a user.
 */
export async function makeAdmin(userId) {
    if (DEMO) {
        await demoDelay()
        const u = demoDb().users.find(x => x.id === userId)
        if (u) { u.is_admin = true; demoCommit() }
        return
    }
    const { error } = await adminSupabase
        .from('user_profiles')
        .upsert({ user_id: userId, is_admin: true }, { onConflict: 'user_id' })
    if (error) throw error
}

/**
 * Sets is_admin = false for a user.
 */
export async function removeAdmin(userId) {
    if (DEMO) {
        await demoDelay()
        const u = demoDb().users.find(x => x.id === userId)
        if (u) { u.is_admin = false; demoCommit() }
        return
    }
    const { error } = await adminSupabase
        .from('user_profiles')
        .update({ is_admin: false })
        .eq('user_id', userId)
    if (error) throw error
}

/**
 * Permanently deletes a user from auth (cascades to all tables).
 */
export async function deleteUser(userId) {
    if (DEMO) {
        await demoDelay()
        const store = demoDb()
        store.users = store.users.filter(x => x.id !== userId)
        demoCommit()
        return
    }
    const { error } = await adminSupabase.auth.admin.deleteUser(userId)
    if (error) throw error
}

/**
 * Returns aggregate app statistics.
 */
export async function getAppStats() {
    if (DEMO) {
        await demoDelay()
        const store = demoDb()
        const today = new Date().toISOString().split('T')[0]
        const totalTrades = store.users.reduce((n, u) => n + (u.trade_count ?? store.trades.length), 0)
        return {
            totalUsers: store.users.length,
            totalTrades,
            todaySignups: store.users.filter(u => u.created_at?.startsWith(today)).length,
            todayTrades: store.trades.filter(t => t.date?.startsWith(today)).length,
        }
    }
    const today = new Date().toISOString().split('T')[0]

    const [
        { data: authData },
        { count: totalTrades },
        { count: todayTrades },
    ] = await Promise.all([
        adminSupabase.auth.admin.listUsers({ perPage: 1000 }),
        adminSupabase.from('trades').select('*', { count: 'exact', head: true }),
        adminSupabase.from('trades').select('*', { count: 'exact', head: true }).gte('date', today),
    ])

    const users = authData?.users ?? []
    const totalUsers = users.length
    const todaySignups = users.filter(u => u.created_at?.startsWith(today)).length

    return { totalUsers, totalTrades: totalTrades ?? 0, todaySignups, todayTrades: todayTrades ?? 0 }
}
