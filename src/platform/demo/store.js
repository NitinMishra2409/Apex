import { calcPnl, calcRR, getResult } from '../../domain/trades/math'
// Demo mode — lets the whole app be browsed with realistic fake data and no
// Supabase project. Toggle with VITE_DEMO_MODE in .env.
//
// Everything lives behind the DEMO flag, so the real Supabase code paths in
// feature repositories are untouched. Flip the flag off and the app behaves exactly
// as it did before this file existed.

import { SETUP_TYPES as SETUPS } from '../../domain/trades/vocabulary'
import { CHECKLIST_DEFAULTS } from '../../domain/checklists/vocabulary'

// Weighted so BTC dominates the way a real crypto journal usually does, while
// still giving the per-asset filter and simulator something to work with.
const DEMO_SYMBOLS = [
    'BTCUSDT', 'BTCUSDT', 'BTCUSDT', 'BTCUSDT', 'BTCUSDT',
    'ETHUSDT', 'ETHUSDT', 'ETHUSDT',
    'SOLUSDT', 'SOLUSDT',
    'XRPUSDT', 'DOGEUSDT',
]

export const DEMO = import.meta.env.VITE_DEMO_MODE === 'true'

export const DEMO_USER = {
    id: 'demo-0000-0000-0000-000000000001',
    email: 'demo@apexlog.app',
    created_at: new Date(Date.now() - 92 * 864e5).toISOString(),
    user_metadata: { full_name: 'Demo Trader' },
}

export const DEMO_SESSION = {
    user: DEMO_USER,
    access_token: 'demo-access-token',
    token_type: 'bearer',
}

export const demoId = () => 'demo-' + Math.random().toString(36).slice(2, 11)
// A small delay so loading skeletons are actually visible in demo mode. Kept
// short deliberately: it is pure artificial latency, and it is paid on every
// service call. Set VITE_DEMO_LATENCY_MS=0 to remove it entirely.
const DEMO_LATENCY = Number(import.meta.env.VITE_DEMO_LATENCY_MS ?? 60)
export const demoDelay = (ms = DEMO_LATENCY) =>
    ms > 0 ? new Promise(r => setTimeout(r, ms)) : Promise.resolve()

const todayISO = () => new Date().toISOString().split('T')[0]

// ── Seeded PRNG ─────────────────────────────────────────────────────────────
// Deterministic so the demo account looks the same on every fresh load.
function mulberry32(seed) {
    return function () {
        seed |= 0; seed = (seed + 0x6D2B79F5) | 0
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}


// Each setup carries its own edge so the Setup Performance table has real spread.
const EDGE = {
    'Wyckoff Accumulation': 0.70, 'Wyckoff Distribution': 0.62, 'HVN Bounce': 0.58,
    'Breakout': 0.53, 'Range Play': 0.50, 'Breakdown': 0.46, 'LVN Break': 0.42, 'Other': 0.36,
}

// Weighted so one mistake clearly dominates — the Dashboard highlights the top one.
const MISTAKE_POOL = [
    'FOMO Entry', 'FOMO Entry', 'FOMO Entry', 'FOMO Entry', 'FOMO Entry',
    'Moved SL', 'Moved SL', 'Moved SL', 'Moved SL',
    'Revenge Trade', 'Revenge Trade', 'Revenge Trade',
    'Chased Entry', 'Chased Entry', 'Chased Entry',
    'Oversized Position', 'Oversized Position',
    'Early Exit', 'Early Exit',
    'Ignored SL', 'No Setup',
]

const WIN_NOTES = [
    'Waited for the retest instead of chasing. Felt calm the whole way.',
    'Plan was written before the session. Executed it without second-guessing.',
    'Scaled out at target. No greed, no hesitation.',
    'Sat on my hands for two hours before this setup appeared. Worth it.',
    'Textbook entry. Confidence is coming from the process, not the result.',
]
const LOSS_NOTES = [
    'Entered before confirmation because I was scared of missing it.',
    'Widened the stop when it went against me. Exactly what I said I would stop doing.',
    'Size was too big, so I managed the trade emotionally instead of mechanically.',
    'Was down on the day and forced this one. Classic revenge entry.',
    'No real setup here. I was bored and wanted to be in a position.',
    'Cut it early out of fear, then watched it run to target.',
]
const BE_NOTES = [
    'Scratched it when the momentum died. Fine decision, no regret.',
    'Structure invalidated before target, closed flat. Good discipline.',
]

function seedTrades() {
    const rnd = mulberry32(20240908)
    const pick = (arr) => arr[Math.floor(rnd() * arr.length)]
    const between = (a, b) => a + rnd() * (b - a)

    const trades = []
    let price = 58500
    const N = 74

    for (let i = N - 1; i >= 0; i--) {
        const jitter = rnd() < 0.5 ? 0 : 1
        // Keep the two most recent trades on today so the dashboard's
        // "Today's Performance" panel always has something to show.
        const daysAgo = i <= 1 ? 0 : Math.floor(i * 1.3) + jitter
        const d = new Date()
        d.setDate(d.getDate() - daysAgo)
        d.setHours(7 + Math.floor(rnd() * 13), Math.floor(rnd() * 60), 0, 0)

        // Random walk the price so the equity curve and heatmap look alive.
        price = Math.min(118000, Math.max(51000, price * (1 + between(-0.021, 0.026))))

        const symbol = pick(DEMO_SYMBOLS)
        const direction = rnd() < 0.57 ? 'LONG' : 'SHORT'
        const setup_type = pick(SETUPS)
        const entry = +price.toFixed(1)
        const slDist = entry * between(0.004, 0.017)
        const rrTarget = between(1.2, 3.4)

        const sl = +(direction === 'LONG' ? entry - slDist : entry + slDist).toFixed(1)
        const tp = +(direction === 'LONG' ? entry + slDist * rrTarget : entry - slDist * rrTarget).toFixed(1)
        const size = Math.round(between(1500, 12000) / 100) * 100

        // Resolve the outcome against that setup's edge.
        const roll = rnd()
        let exit_price
        if (roll < EDGE[setup_type] * 0.93) {
            const captured = rnd() < 0.7 ? 1 : between(0.45, 0.95)   // full target or partial
            exit_price = direction === 'LONG' ? entry + slDist * rrTarget * captured : entry - slDist * rrTarget * captured
        } else if (roll < 0.93) {
            const given = rnd() < 0.8 ? 1 : between(0.4, 0.95)       // full stop or cut early
            exit_price = direction === 'LONG' ? entry - slDist * given : entry + slDist * given
        } else {
            exit_price = entry                                        // scratched at breakeven
        }
        exit_price = +exit_price.toFixed(1)

        // Same formulas the New Trade form uses, so the numbers reconcile.
        const rr = calcRR(direction, entry, sl, tp)
        const pnl = calcPnl(direction, entry, exit_price, size)
        const result = getResult(pnl)

        // Mistakes cluster on losses, but leak into a few wins too.
        let mistakes = null
        const wantMistake = result === 'LOSS' ? rnd() < 0.74 : rnd() < 0.11
        if (wantMistake) {
            const first = pick(MISTAKE_POOL)
            const second = rnd() < 0.28 ? pick(MISTAKE_POOL) : null
            mistakes = second && second !== first ? [first, second] : [first]
        }

        const notes = result === 'WIN' ? WIN_NOTES : result === 'LOSS' ? LOSS_NOTES : BE_NOTES
        const emotional_notes = rnd() < 0.72 ? pick(notes) : null

        trades.push({
            id: 'demo-trade-' + String(i).padStart(3, '0'),
            user_id: DEMO_USER.id,
            date: d.toISOString(),
            symbol,
            direction, entry, exit_price, sl, tp, size,
            rr, pnl, result, setup_type, mistakes, emotional_notes,
            created_at: d.toISOString(),
        })
    }
    return trades
}

function seedUsers() {
    const rows = [
        { email: 'demo@apexlog.app', days: 92, trades: null, admin: true }, // null = counted live
        { email: 'priya.k@gmail.com', days: 61, trades: 41, admin: false },
        { email: 'marcus.trades@proton.me', days: 47, trades: 18, admin: false },
        { email: 'yuki.tanaka@outlook.com', days: 30, trades: 7, admin: false },
        { email: 'sam.oduya@gmail.com', days: 12, trades: 63, admin: true },
        { email: 'lena.vogt@web.de', days: 4, trades: 2, admin: false },
        { email: 'arjun.m@icloud.com', days: 0, trades: 0, admin: false },
    ]
    return rows.map((r, i) => ({
        id: i === 0 ? DEMO_USER.id : `demo-user-${String(i).padStart(4, '0')}`,
        email: r.email,
        created_at: new Date(Date.now() - r.days * 864e5).toISOString(),
        is_admin: r.admin,
        trade_count: r.trades,
    }))
}

function blank() {
    const t = todayISO()
    return {
        trades: seedTrades(),
        users: seedUsers(),
        checklists: { ...CHECKLIST_DEFAULTS },
        dailyProgress: {
            [`${t}|premarket`]: ['Check economic calendar', 'Identify key S/R levels', 'Check BTC dominance'],
            [`${t}|during`]: ['Follow entry rules', 'Position size correct'],
            [`${t}|posttrade`]: ['Log the trade'],
        },
        customMistakes: [
            { id: 'demo-cm-1', user_id: DEMO_USER.id, label: 'Overtraded session', created_at: new Date().toISOString() },
            { id: 'demo-cm-2', user_id: DEMO_USER.id, label: 'Traded through news', created_at: new Date().toISOString() },
        ],
    }
}

// ── Store ───────────────────────────────────────────────────────────────────
// Backed by localStorage so trades you add or delete survive a page refresh.
// Bumped to v2 when the seed gained a symbol field. Changing this key discards
// stale demo data whose shape predates the change, instead of leaving the user
// with blank columns and no idea why.
const DB_KEY = 'apexlog-demo-db-v2'
let db = null

export function demoDb() {
    if (db) return db
    try {
        const raw = localStorage.getItem(DB_KEY)
        if (raw) { db = JSON.parse(raw); return db }
    } catch { /* unreadable or unavailable — fall through to a fresh seed */ }
    db = blank()
    demoCommit()
    return db
}

export function demoCommit() {
    try { localStorage.setItem(DB_KEY, JSON.stringify(db)) }
    catch { /* demo edits just won't persist across refresh */ }
}

// Exposed on window in demo mode so you can re-seed from the browser console.
export function resetDemoData() {
    try { localStorage.removeItem(DB_KEY) } catch { /* nothing to clear */ }
    db = null
}

if (DEMO && typeof window !== 'undefined') {
    window.resetDemoData = () => { resetDemoData(); window.location.reload() }
}
