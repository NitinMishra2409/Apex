import { calcPnl, calcRR, getResult } from '../../domain/trades/math'
import { dayKey } from '../../domain/journal/reporting'
// Demo mode — lets the whole app be browsed with realistic fake data and no
// Supabase project. Toggle with VITE_DEMO_MODE in .env.
//
// Everything lives behind the DEMO flag, so the real Supabase code paths in
// feature repositories are untouched. Flip the flag off and the app behaves exactly
// as it did before this file existed.

import { SETUP_TYPES as SETUPS } from '../../domain/trades/vocabulary'
import { CHECKLIST_DEFAULTS } from '../../domain/checklists/vocabulary'

// The demo account is a crypto trader in USDT. Weighted so BTC dominates, with
// each pair priced from its own realistic level.
const DEMO_SYMBOLS = [
    'BTCUSDT', 'BTCUSDT', 'BTCUSDT', 'BTCUSDT', 'BTCUSDT',
    'ETHUSDT', 'ETHUSDT', 'ETHUSDT',
    'SOLUSDT', 'SOLUSDT',
    'XRPUSDT', 'DOGEUSDT',
]
const BASE_PRICE = { BTCUSDT: 58500, ETHUSDT: 2650, SOLUSDT: 142, XRPUSDT: 0.58, DOGEUSDT: 0.118 }
const DECIMALS = { BTCUSDT: 1, ETHUSDT: 2, SOLUSDT: 3, XRPUSDT: 4, DOGEUSDT: 5 }
const FEE_RATE = 0.0005 // per side, on notional
// Edge parameters tuned so demo-mode analytics land in believable ranges (see
// src/platform/demo/store.test.js): planned trades get a real edge bump, unplanned
// (and revenge) trades a real penalty, so the story holds up under Tilt, Monte Carlo
// and drawdown, not just the headline win rate.
const EDGE_LIFT = 0.01
const PLANNED_BONUS = 0.08
const UNPLANNED_PENALTY = -0.2
const REVENGE_PENALTY = 0.12
const EDGE_MIN = 0.12
const EDGE_MAX = 0.92

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
    'Wyckoff Accumulation': 0.62, 'Wyckoff Distribution': 0.55, 'HVN Bounce': 0.5,
    'Breakout': 0.45, 'Range Play': 0.42, 'Breakdown': 0.38, 'LVN Break': 0.34, 'Other': 0.3,
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

export function seedTrades() {
    const rnd = mulberry32(20240908)
    const pick = (arr) => arr[Math.floor(rnd() * arr.length)]
    const between = (a, b) => a + rnd() * (b - a)

    const trades = []
    let drift = 1
    const N = 90

    for (let i = N - 1; i >= 0; i--) {
        const jitter = rnd() < 0.5 ? 0 : 1
        // Keep the two most recent trades on today so the dashboard's
        // "Today's Performance" panel always has something to show.
        const daysAgo = i <= 1 ? 0 : Math.floor(i * 1.3) + jitter
        const d = new Date()
        d.setDate(d.getDate() - daysAgo)
        d.setHours(7 + Math.floor(rnd() * 13), Math.floor(rnd() * 60), 0, 0)
        // Sometimes the trader jumps straight back in after a loss: a revenge trade,
        // entered 15-50 minutes later, usually unplanned and usually worse.
        const previous = trades.at(-1)
        const revenge = previous?.pnl < 0 && i > 1 && rnd() < 0.4
        if (revenge) d.setTime(new Date(previous.date).getTime() + (15 + Math.floor(rnd() * 35)) * 60000)

        // One shared market drift so the pairs move together like a real crypto tape.
        drift = Math.min(1.9, Math.max(0.85, drift * (1 + between(-0.021, 0.026))))

        const symbol = pick(DEMO_SYMBOLS)
        const fix = value => +value.toFixed(DECIMALS[symbol])
        const direction = rnd() < 0.57 ? 'LONG' : 'SHORT'
        const setup_type = pick(SETUPS)
        const entry = fix(BASE_PRICE[symbol] * drift * between(0.97, 1.03))
        const slDist = entry * between(0.006, 0.02)
        const rrTarget = between(1.0, 2.2)

        const sl = fix(direction === 'LONG' ? entry - slDist : entry + slDist)
        const tp = fix(direction === 'LONG' ? entry + slDist * rrTarget : entry - slDist * rrTarget)
        const notional = Math.round(between(800, 15000) / 100) * 100
        const units = +(notional / entry).toPrecision(4)

        // Planned trades (checklist used) carry more edge than unplanned ones.
        const planned = rnd() < (revenge ? 0.25 : 0.72)
        const edge = Math.min(EDGE_MAX, Math.max(EDGE_MIN, EDGE[setup_type] + (planned ? PLANNED_BONUS : UNPLANNED_PENALTY) + EDGE_LIFT - (revenge ? REVENGE_PENALTY : 0)))

        // Resolve the outcome against that edge.
        const roll = rnd()
        let exit_price
        if (roll < edge * 0.93) {
            const captured = rnd() < 0.7 ? 1 : between(0.45, 0.95)   // full target or partial
            exit_price = direction === 'LONG' ? entry + slDist * rrTarget * captured : entry - slDist * rrTarget * captured
        } else if (roll < 0.93) {
            const given = rnd() < 0.8 ? 1 : between(0.4, 0.95)       // full stop or cut early
            exit_price = direction === 'LONG' ? entry - slDist * given : entry + slDist * given
        } else {
            exit_price = entry                                        // scratched at breakeven
        }
        exit_price = fix(exit_price)
        const fees = +((entry + exit_price) * units * FEE_RATE).toFixed(2)

        // Same formulas the New Trade form uses, so the numbers reconcile.
        const rr = calcRR(direction, entry, sl, tp)
        const pnl = calcPnl(direction, entry, exit_price, units, fees)
        const result = getResult(pnl)

        const items = CHECKLIST_DEFAULTS.trade
        const checklist = planned ? { items, checked: items.filter(() => rnd() < 0.85) } : null

        // Mistakes cluster on losses and unplanned trades, but leak into a few wins too.
        let mistakes = null
        const wantMistake = revenge || (result === 'LOSS' ? rnd() < (planned ? 0.6 : 0.9) : rnd() < 0.11)
        if (wantMistake) {
            const first = revenge ? 'Revenge Trade' : pick(MISTAKE_POOL)
            const second = rnd() < 0.28 ? pick(MISTAKE_POOL) : null
            mistakes = second && second !== first ? [first, second] : [first]
        }

        const notes = result === 'WIN' ? WIN_NOTES : result === 'LOSS' ? LOSS_NOTES : BE_NOTES
        const emotional_notes = rnd() < 0.72 ? pick(notes) : null

        trades.push({
            id: 'demo-trade-' + String(i).padStart(3, '0'),
            user_id: DEMO_USER.id,
            date: d.toISOString(),
            symbol, asset_class: 'crypto',
            direction, entry, exit_price, sl, tp, units, fees,
            rr, pnl, result, setup_type, mistakes, emotional_notes, checklist,
            created_at: d.toISOString(),
        })
    }
    return trades
}

function blank() {
    return {
        trades: seedTrades(),
        profile: { currency: 'USDT', starting_balance: 10000 },
        checklists: { ...CHECKLIST_DEFAULTS },
        dailyProgress: {
            [`${dayKey(new Date())}|premarket`]: CHECKLIST_DEFAULTS.premarket.slice(0, 3),
        },
        customMistakes: [
            { id: 'demo-cm-1', user_id: DEMO_USER.id, label: 'Overtraded session', created_at: new Date().toISOString() },
            { id: 'demo-cm-2', user_id: DEMO_USER.id, label: 'Traded through news', created_at: new Date().toISOString() },
        ],
    }
}

// ── Store ───────────────────────────────────────────────────────────────────
// Backed by localStorage so trades you add or delete survive a page refresh.
// v3 added units, fees, asset class, per-trade checklists and the profile; v4 a more realistic seed;
// v5 retuned that seed so the discipline story (planned vs unplanned, Tilt, Monte Carlo, drawdown,
// SQN, fee drag) lands in believable ranges instead of the too-rosy v4 numbers. Changing this key
// discards stale demo data whose shape predates the change, instead of leaving the user with blank
// columns and no idea why.
const DB_KEY = 'apexlog-demo-db-v5'
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
