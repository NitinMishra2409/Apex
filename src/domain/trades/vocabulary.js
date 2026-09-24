// Shared domain vocabulary.
//
// These lists were previously duplicated in NewTrade.jsx, TradeLog.jsx and
// voiceParse.js, so adding a setup type meant remembering three files. They now
// live here only.
//
// The string values are persisted in Postgres (trades.setup_type is TEXT and
// trades.mistakes is TEXT[]), so renaming an entry orphans existing rows.
// Add freely; rename only with a migration.

export const SETUP_TYPES = [
    'Wyckoff Accumulation',
    'Wyckoff Distribution',
    'HVN Bounce',
    'LVN Break',
    'Breakout',
    'Breakdown',
    'Range Play',
    'Other',
]

export const DEFAULT_MISTAKES = [
    'FOMO Entry',
    'Moved SL',
    'Oversized Position',
    'Chased Entry',
    'Ignored SL',
    'Early Exit',
    'No Setup',
    'Revenge Trade',
]

/** Matches the CHECK constraints on trades.direction and trades.result. */
export const DIRECTIONS = ['LONG', 'SHORT']
export const RESULTS = ['WIN', 'LOSS', 'BE']

