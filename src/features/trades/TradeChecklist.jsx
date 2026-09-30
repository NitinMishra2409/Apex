import { Check, CircleDashed } from 'lucide-react'

/**
 * The per-trade checklist inside the trade form. Items are numbered so they can be
 * ticked by voice ("checklist one, three"). Nothing ticked = an Unplanned trade.
 */
export default function TradeChecklist({ items, checked, onToggle, highlight = [] }) {
    const done = items.filter(i => checked.includes(i)).length
    const planned = done > 0
    return (
        <div className="trade-checklist">
            <div className="trade-checklist-head">
                <span className={planned ? 'trade-plan-badge is-planned' : 'trade-plan-badge'}>
                    {planned ? <Check size={12} strokeWidth={3} /> : <CircleDashed size={12} />}
                    {planned ? `Planned · ${done}/${items.length}` : 'Unplanned'}
                </span>
                <span className="trade-checklist-hint">{planned ? 'Tick every check you actually did.' : 'Tick the checks you did before entering. Leave all unticked to log it as Unplanned.'}</span>
            </div>
            {highlight.length > 0 && (
                <p className="trade-checklist-review" role="status">
                    Please check these before saving: {highlight.map(item => `${items.indexOf(item) + 1}. ${item}`).join('; ')}.
                </p>
            )}
            {items.length === 0
                ? <p className="trade-checklist-hint">Your per-trade checklist is empty. Add checks in Playbooks.</p>
                : <ol className="trade-checklist-items">
                    {items.map((item, index) => {
                        const on = checked.includes(item)
                        return (
                            <li key={item}>
                                <button type="button" role="checkbox" aria-checked={on} onClick={() => onToggle(item)} className={`trade-check ${on ? 'is-on' : ''} ${highlight.includes(item) ? 'needs-review' : ''}`}>
                                    <span className="trade-check-number">{index + 1}</span>
                                    <span className="trade-check-box">{on && <Check size={11} strokeWidth={3} />}</span>
                                    <span>{item}</span>
                                </button>
                            </li>
                        )
                    })}
                </ol>}
        </div>
    )
}
