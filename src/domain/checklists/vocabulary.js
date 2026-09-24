/** Checklist types — matches the CHECK constraint on checklists.type. */
export const CHECKLIST_TYPES = ['premarket', 'during', 'posttrade']

export const CHECKLIST_LABELS = {
    premarket: 'Pre-Market Checklist',
    during: 'During Trade Checklist',
    posttrade: 'Post-Trade Checklist',
}

export const CHECKLIST_DEFAULTS = {
    premarket: [
        'Check economic calendar',
        'Identify key S/R levels',
        'Check BTC dominance',
        "Review yesterday's trades",
        'Set daily loss limit',
    ],
    during: [
        'Follow entry rules',
        'Position size correct',
        'SL placed correctly',
        'Not revenge trading',
    ],
    posttrade: [
        'Log the trade',
        'Review what went well',
        'Identify mistakes',
        'Update journal notes',
    ],
}
