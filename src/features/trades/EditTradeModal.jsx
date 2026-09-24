import { useState } from 'react'
import toast from 'react-hot-toast'
import { updateTrade } from './repository'
import { SETUP_TYPES, DEFAULT_MISTAKES } from '../../domain/trades/vocabulary'
import { calcRR, calcPnl, getResult } from '../../domain/trades/math'
import { prepareTrade } from '../../domain/trades/record'

const toLocal = (iso) => { if (!iso) return ''; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16) }
const SL = { label: { display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }, input: { width: '100%', padding: '9px 12px', boxSizing: 'border-box' } }

export default function EditTradeModal({ trade, onClose, onSave }) {
    const [f, setF] = useState({ date: toLocal(trade.date), direction: trade.direction, entry: trade.entry ?? '', exit_price: trade.exit_price ?? '', sl: trade.sl ?? '', tp: trade.tp ?? '', size: trade.size ?? '', setup_type: trade.setup_type ?? '', emotional_notes: trade.emotional_notes ?? '' })
    const [sel, setSel] = useState(trade.mistakes ?? [])
    const [saving, setSaving] = useState(false)
    const set = (k, v) => setF(p => ({ ...p, [k]: v }))
    const rr = calcRR(f.direction, f.entry, f.sl, f.tp)
    const pnl = calcPnl(f.direction, f.entry, f.exit_price, f.size)
    const res = getResult(pnl)

    const save = async () => {
        setSaving(true)
        try {
            const u = await updateTrade(trade.id, prepareTrade(f, sel))
            toast.success('Trade updated!'); onSave(u)
        } catch (err) { toast.error(err.message || 'Update failed.') }
        finally { setSaving(false) }
    }

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
            <div style={{ width: '100%', maxWidth: 540, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <h2 style={{ fontSize: 16, fontWeight: 700 }}>Edit Trade</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.4rem', cursor: 'pointer', lineHeight: 1 }}>×</button>
                </div>

                <div style={{ display: 'flex', gap: 8, marginBottom: '0.9rem' }}>
                    {['LONG', 'SHORT'].map(dir => (
                        <button key={dir} type="button" onClick={() => set('direction', dir)} style={{ flex: 1, padding: '10px', borderRadius: 'var(--radius-sm)', border: '2px solid', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', borderColor: f.direction === dir ? (dir === 'LONG' ? 'var(--green)' : 'var(--red)') : 'var(--border)', background: f.direction === dir ? (dir === 'LONG' ? 'rgba(108,178,132,0.1)' : 'rgba(217,125,125,0.1)') : 'transparent', color: f.direction === dir ? (dir === 'LONG' ? 'var(--green)' : 'var(--red)') : 'var(--text-muted)' }}>{dir === 'LONG' ? '▲ LONG' : '▼ SHORT'}</button>
                    ))}
                </div>
                <div style={{ marginBottom: '0.9rem' }}><label style={SL.label}>Date & Time</label><input type="datetime-local" value={f.date} onChange={e => set('date', e.target.value)} style={SL.input} /></div>
                <div className="form-columns" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.9rem' }}>
                    <div><label style={SL.label}>Entry</label><input type="number" step="any" value={f.entry} onChange={e => set('entry', e.target.value)} style={SL.input} /></div>
                    <div><label style={SL.label}>Exit</label><input type="number" step="any" value={f.exit_price} onChange={e => set('exit_price', e.target.value)} style={SL.input} /></div>
                </div>
                <div className="form-columns" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.9rem' }}>
                    <div><label style={SL.label}>Stop Loss</label><input type="number" step="any" value={f.sl} onChange={e => set('sl', e.target.value)} style={SL.input} /></div>
                    <div><label style={SL.label}>Take Profit</label><input type="number" step="any" value={f.tp} onChange={e => set('tp', e.target.value)} style={SL.input} /></div>
                </div>
                <div style={{ marginBottom: '0.9rem' }}><label style={SL.label}>Position Size (USDT)</label><input type="number" step="any" value={f.size} onChange={e => set('size', e.target.value)} style={SL.input} /></div>

                <div style={{ display: 'flex', gap: 16, background: 'var(--bg-elevated)', borderLeft: '3px solid var(--accent)', borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem', marginBottom: '0.9rem' }}>
                    <div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>RR</div><div style={{ fontWeight: 700, color: rr && rr > 0 ? 'var(--green)' : 'var(--text-secondary)', fontSize: 13 }}>{rr ? `1:${rr}` : '—'}</div></div>
                    <div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>P&L</div><div style={{ fontWeight: 700, color: pnl === null ? 'var(--text-secondary)' : pnl >= 0 ? 'var(--green)' : 'var(--red)', fontSize: 13 }}>{pnl === null ? '—' : `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`}</div></div>
                    {res && <div style={{ alignSelf: 'center' }}><span className={res === 'WIN' ? 'badge-win' : res === 'LOSS' ? 'badge-loss' : 'badge-be'}>{res}</span></div>}
                </div>

                <div style={{ marginBottom: '0.9rem' }}><label style={SL.label}>Setup Type</label><select value={f.setup_type} onChange={e => set('setup_type', e.target.value)} style={{ ...SL.input, cursor: 'pointer' }}><option value="">— Select —</option>{SETUP_TYPES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                <div style={{ marginBottom: '0.9rem' }}>
                    <label style={SL.label}>Mistakes</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {DEFAULT_MISTAKES.map(m => { const a = sel.includes(m); return (<button key={m} type="button" onClick={() => setSel(p => a ? p.filter(x => x !== m) : [...p, m])} style={{ padding: '3px 10px', borderRadius: 6, border: `1px solid ${a ? 'var(--red)' : 'var(--border)'}`, background: a ? 'rgba(217,125,125,0.12)' : 'transparent', color: a ? 'var(--red)' : 'var(--text-muted)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>{m}</button>) })}
                    </div>
                </div>
                <div style={{ marginBottom: '1rem' }}><label style={SL.label}>Emotional Notes</label><textarea value={f.emotional_notes} onChange={e => set('emotional_notes', e.target.value)} style={{ ...SL.input, resize: 'vertical', minHeight: 65 }} /></div>

                <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={onClose} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                    <button onClick={save} disabled={saving} className="btn-primary" style={{ flex: 2, justifyContent: 'center', opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving…' : 'Save Changes'}</button>
                </div>
            </div>
        </div>
    )
}

