/** Checklist types: matches the CHECK constraint on checklists.type. */
export const CHECKLIST_TYPES = ['premarket', 'trade', 'postmarket']
/** The once-a-day checklists; their progress resets at the trader's local midnight. */
export const DAILY_CHECKLIST_TYPES = ['premarket', 'postmarket']

export const CHECKLIST_LABELS = {
    premarket: 'Pre-market checklist',
    trade: 'Per-trade checklist',
    postmarket: 'Post-market checklist',
}

export const CHECKLIST_DEFAULTS = {
    premarket: [
        'Check the economic calendar',
        'Mark key levels on my watchlist',
        'Set my max daily loss',
        "Review yesterday's trades",
        'Decide how many trades I will take',
    ],
    trade: [
        'Setup matches my playbook',
        'Stop loss placed',
        'Position size within my risk limit',
        'Reward is at least 2R',
        'Not revenge trading',
    ],
    postmarket: [
        'Log every trade',
        'Review what went well',
        'Tag my mistakes',
        'Update journal notes',
    ],
}
