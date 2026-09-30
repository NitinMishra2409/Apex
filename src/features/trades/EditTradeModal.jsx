import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { updateTrade } from './repository'
import TradeChecklist from './TradeChecklist'
import { getChecklist } from '../checklists/repository'
import { useProfile } from '../settings/useProfile'
import { SETUP_TYPES, DEFAULT_MISTAKES, ASSET_CLASSES, ASSET_CLASS_LABELS } from '../../domain/trades/vocabulary'
import { calcRR, calcPnl, getResult } from '../../domain/trades/math'
import './trades.css'
import { prepareTrade } from '../../domain/trades/record'
import { money } from '../../domain/journal/reporting'
import Select from '../../shared/ui/Select'

const toLocal = (iso) => { if (!iso) return ''; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16) }
const SL = { label: { display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }, input: { width: '100%', padding: '9px 12px', boxSizing: 'border-box' } }

export default function EditTradeModal({ trade, onClose, onSave }) {
    const dialog = useRef(null)
    useEffect(() => {
        const element = dialog.current
        const previousFocus = document.activeElement
        const previousOverflow = document.body.style.overflow
        element.showModal()
        document.body.style.overflow = 'hidden'
        return () => {
            element.close()
            document.body.style.overflow = previousOverflow
            if (previousFocus?.isConnected) previousFocus.focus()
        }
    }, [])
    const { currency } = useProfile()
    const [f, setF] = useState({ date: toLocal(trade.date), asset_class: trade.asset_class ?? '', direction: trade.direction, entry: trade.entry ?? '', exit_price: trade.exit_price ?? '', sl: trade.sl ?? '', tp: trade.tp ?? '', units: trade.units ?? '', fees: trade.fees ?? '', setup_type: trade.setup_type ?? '', emotional_notes: trade.emotional_notes ?? '' })
    const [sel, setSel] = useState(trade.mistakes ?? [])
    // A planned trade keeps the checklist it was logged with; an unplanned one can be filled in from today's playbook.
    const [items, setItems] = useState(trade.checklist?.items ?? [])
    const [checked, setChecked] = useState(trade.checklist?.checked ?? [])
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    useEffect(() => {
        if (trade.checklist?.items?.length) return
        getChecklist(trade.user_id, 'trade').then(setItems).catch(() => { })
    }, [trade])
    const set = (k, v) => setF(p => ({ ...p, [k]: v }))
    const rr = calcRR(f.direction, f.entry, f.sl, f.tp)
    const pnl = calcPnl(f.direction, f.entry, f.exit_price, f.units, f.fees)
    const res = getResult(pnl)
    const toggle = item => setChecked(p => p.includes(item) ? p.filter(x => x !== item) : [...p, item])

    const save = async () => {
        setError('')
        setSaving(true)
        try {
            const u = await updateTrade(trade.id, prepareTrade({ ...f, checklist: checked.length ? { items, checked } : null }, sel))
            toast.success('Trade updated!'); onSave(u)
        } catch (err) { setError(err.message || 'Update failed. Please try again.') }
        finally { setSaving(false) }
    }

    return (
        <dialog ref={dialog} className="trade-edit-dialog" aria-label="Edit trade" onCancel={e => { e.preventDefault(); onClose() }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <h2 style={{ fontSize: 16, fontWeight: 700 }}>Edit Trade</h2>
                    <button className="icon-button" aria-label="Close edit trade" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.4rem', cursor: 'pointer', lineHeight: 1 }}>×</button>
                </div>

                <div style={{ display: 'flex', gap: 8, marginBottom: '0.9rem' }}>
                    {['LONG', 'SHORT'].map(dir => (
                        <button key={dir} type="button" aria-pressed={f.direction === dir} onClick={() => set('direction', dir)} style={{ flex: 1, padding: '10px', borderRadius: 'var(--radius-sm)', border: '2px solid', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', transition: 'color 150ms, background-color 150ms, border-color 150ms', borderColor: f.direction === dir ? (dir === 'LONG' ? 'var(--green)' : 'var(--red)') : 'var(--border)', background: f.direction === dir ? (dir === 'LONG' ? 'rgba(108,178,132,0.1)' : 'rgba(217,125,125,0.1)') : 'transparent', color: f.direction === dir ? (dir === 'LONG' ? 'var(--green)' : 'var(--red)') : 'var(--text-muted)' }}>{dir === 'LONG' ? '▲ LONG' : '▼ SHORT'}</button>
                    ))}
                </div>
                <div className="form-columns" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.9rem' }}>
                    <div><label htmlFor="edit-date" style={SL.label}>Date & Time</label><input type="datetime-local" id="edit-date" name="date" autoComplete="off" value={f.date} onChange={e => set('date', e.target.value)} style={SL.input} /></div>
                    <div><label htmlFor="edit-asset_class" style={SL.label}>Asset class</label><Select id="edit-asset_class" name="asset_class" autoComplete="off" value={f.asset_class} onValueChange={value => set('asset_class', value)} style={{ ...SL.input, cursor: 'pointer' }}><option value="">— Select —</option>{ASSET_CLASSES.map(a => <option key={a} value={a}>{ASSET_CLASS_LABELS[a]}</option>)}</Select></div>
                </div>
                <div className="form-columns" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.9rem' }}>
                    <div><label htmlFor="edit-entry" style={SL.label}>Entry</label><input type="number" step="any" id="edit-entry" name="entry" autoComplete="off" value={f.entry} onChange={e => set('entry', e.target.value)} style={SL.input} /></div>
                    <div><label htmlFor="edit-exit_price" style={SL.label}>Exit</label><input type="number" step="any" id="edit-exit_price" name="exit_price" autoComplete="off" value={f.exit_price} onChange={e => set('exit_price', e.target.value)} style={SL.input} /></div>
                </div>
                <div className="form-columns" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.9rem' }}>
                    <div><label htmlFor="edit-sl" style={SL.label}>Stop Loss</label><input type="number" step="any" id="edit-sl" name="sl" autoComplete="off" value={f.sl} onChange={e => set('sl', e.target.value)} style={SL.input} /></div>
                    <div><label htmlFor="edit-tp" style={SL.label}>Take Profit</label><input type="number" step="any" id="edit-tp" name="tp" autoComplete="off" value={f.tp} onChange={e => set('tp', e.target.value)} style={SL.input} /></div>
                </div>
                <div className="form-columns" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.9rem' }}>
                    <div><label htmlFor="edit-units" style={SL.label}>Units</label><input type="number" step="any" min="0" id="edit-units" name="units" autoComplete="off" value={f.units} onChange={e => set('units', e.target.value)} style={SL.input} /></div>
                    <div><label htmlFor="edit-fees" style={SL.label}>Fees ({currency})</label><input type="number" step="any" min="0" id="edit-fees" name="fees" autoComplete="off" value={f.fees} onChange={e => set('fees', e.target.value)} style={SL.input} /></div>
                </div>

                <div className="edit-preview" style={{ display: 'flex', gap: 16, background: 'var(--bg-elevated)', borderLeft: '3px solid var(--accent)', borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem', marginBottom: '0.9rem' }}>
                    <div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Planned R:R</div><div style={{ fontWeight: 700, color: rr && rr > 0 ? 'var(--green)' : 'var(--text-secondary)', fontSize: 13 }}>{rr ? `1:${rr}` : '—'}</div></div>
                    <div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>P&L</div><div style={{ fontWeight: 700, color: pnl === null ? 'var(--text-secondary)' : pnl >= 0 ? 'var(--green)' : 'var(--red)', fontSize: 13 }}>{pnl === null ? '—' : money(pnl, currency)}</div></div>
                    {res && <div style={{ alignSelf: 'center' }}><span className={res === 'WIN' ? 'badge-win' : res === 'LOSS' ? 'badge-loss' : 'badge-be'}>{res}</span></div>}
                </div>

                <div style={{ marginBottom: '0.4rem' }}><label style={SL.label}>Per-trade checklist</label></div>
                <TradeChecklist items={items} checked={checked} onToggle={toggle} />

                <div style={{ marginBottom: '0.9rem' }}><label htmlFor="edit-setup_type" style={SL.label}>Setup Type</label><Select id="edit-setup_type" name="setup_type" autoComplete="off" value={f.setup_type} onValueChange={value => set('setup_type', value)} style={{ ...SL.input, cursor: 'pointer' }}><option value="">— Select —</option>{SETUP_TYPES.map(s => <option key={s} value={s}>{s}</option>)}</Select></div>
                <div style={{ marginBottom: '0.9rem' }}>
                    <label style={SL.label}>Mistakes</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {[...new Set([...DEFAULT_MISTAKES, ...sel])].map(m => { const a = sel.includes(m); return (<button key={m} type="button" aria-pressed={a} onClick={() => setSel(p => a ? p.filter(x => x !== m) : [...p, m])} style={{ padding: '3px 10px', borderRadius: 6, border: `1px solid ${a ? 'var(--red)' : 'var(--border)'}`, background: a ? 'rgba(217,125,125,0.12)' : 'transparent', color: a ? 'var(--red)' : 'var(--text-muted)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>{m}</button>) })}
                    </div>
                </div>
                <div style={{ marginBottom: '1rem' }}><label htmlFor="edit-emotional_notes" style={SL.label}>Emotional Notes</label><textarea id="edit-emotional_notes" name="emotional_notes" autoComplete="off" value={f.emotional_notes} onChange={e => set('emotional_notes', e.target.value)} style={{ ...SL.input, resize: 'vertical', minHeight: 65 }} /></div>

                {error && <p className="error-banner" role="alert">Could not save this trade. Check the fields and try again. {error}</p>}
                <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={onClose} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                    <button onClick={save} disabled={saving} className="btn-primary" style={{ flex: 2, justifyContent: 'center', opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving…' : 'Save Changes'}</button>
                </div>
        </dialog>
    )
}
