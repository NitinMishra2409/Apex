import { useState, useEffect, useCallback } from 'react'
import { Sun, Crosshair, Moon } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../auth/useAuth'
import { getChecklist, saveChecklistItems, getDailyProgress, saveDailyProgress } from './repository'
import { CHECKLIST_TYPES, CHECKLIST_LABELS, DAILY_CHECKLIST_TYPES } from '../../domain/checklists/vocabulary'
import { useLocalDay } from '../../shared/hooks/useLocalDay'
import './checklists.css'

const ICONS = { premarket: Sun, trade: Crosshair, postmarket: Moon }

const Bone = ({ w = '100%', h = 16 }) => <div style={{ width: w, height: h, borderRadius: 4 }} className="skeleton" />

function ChecklistSection({ type, userId, day }) {
    const daily = DAILY_CHECKLIST_TYPES.includes(type)
    const [items, setItems] = useState([])
    const [checked, setChecked] = useState([])
    const [open, setOpen] = useState(true)
    const [newItem, setNewItem] = useState('')
    const [saving, setSaving] = useState(false)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!userId) return
        Promise.all([getChecklist(userId, type), daily ? getDailyProgress(userId, type, day) : []])
            .then(([its, prog]) => { setItems(its ?? []); setChecked(prog ?? []); setLoading(false) })
            .catch(() => setLoading(false))
    }, [userId, type, daily, day])

    const saveProgress = useCallback(async (next) => {
        setSaving(true)
        try { await saveDailyProgress(userId, type, next, day) }
        catch (err) { toast.error(err.message) }
        finally { setSaving(false) }
    }, [userId, type, day])

    const toggle = (label) => {
        const next = checked.includes(label) ? checked.filter(c => c !== label) : [...checked, label]
        setChecked(next); saveProgress(next)
    }

    const addItem = async () => {
        const label = newItem.trim()
        if (!label) return
        if (items.includes(label)) { toast.error('Item already exists.'); return }
        const next = [...items, label]; setItems(next); setNewItem('')
        try { await saveChecklistItems(userId, type, next) }
        catch (err) { toast.error(err.message); setItems(items) }
    }

    const deleteItem = async (label) => {
        const ni = items.filter(i => i !== label), nc = checked.filter(c => c !== label)
        setItems(ni); setChecked(nc)
        try { await saveChecklistItems(userId, type, ni); if (daily) await saveDailyProgress(userId, type, nc, day) }
        catch (err) { toast.error(err.message) }
    }

    const Icon = ICONS[type]
    const done = items.filter(i => checked.includes(i)).length
    const total = items.length
    const pct = total > 0 ? Math.round(done / total * 100) : 0
    const barColor = pct === 100 ? 'var(--green)' : pct >= 50 ? 'var(--yellow)' : 'var(--red)'

    return (
        <section className={`playbook-section ${daily ? 'playbook-daily' : 'playbook-template'}`}>
            {/* Header */}
            <h2 className="playbook-title"><button className="playbook-header" aria-expanded={open} aria-controls={`playbook-${type}`} onClick={() => setOpen(o => !o)}>
                <Icon size={20} color="var(--accent)" aria-hidden="true" />
                <span className="playbook-name" style={{ flex: 1, minWidth: 120 }}>{CHECKLIST_LABELS[type]}<small>{daily ? 'Today’s progress' : loading ? 'Loading checks…' : `${total} checks · ticked on each trade`}</small></span>
                {daily ? <>
                    <span style={{ fontSize: 12, fontWeight: 700, color: barColor, minWidth: 30 }}>{loading ? '…' : `${done}/${total}`}</span>
                    <span aria-hidden="true" style={{ width: 72, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', flexShrink: 0 }}>
                        <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 2 }} />
                    </span>
                </> : null}
                <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 4 }}>{open ? '▲' : '▼'}</span>
            </button></h2>

            {open && (
                <div id={`playbook-${type}`} style={{ padding: '0.25rem 1.25rem 1rem' }}>
                    {!daily && <p style={{ color: 'var(--text-muted)', fontSize: 12.5, lineHeight: 1.5, padding: '0.75rem 0 0.25rem' }}>Run this before every trade. You tick it on <strong>Log trade</strong>, by tapping or by saying “checklist one, three” while dictating. A trade logged with nothing ticked is marked <strong>Unplanned</strong>.</p>}
                    {loading
                        ? <div style={{ padding: '0.75rem 0' }}>{[...Array(3)].map((_, i) => <Bone key={i} h={18} style={{ marginBottom: 12, opacity: 1 - i * 0.25 }} />)}</div>
                        : items.length === 0
                            ? <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: '0.75rem 0' }}>No items yet.</p>
                            : items.map(label => {
                                const isChecked = checked.includes(label)
                                return (
                                    <div key={label} className="playbook-item">
                                        {daily ? <label className="playbook-check"><input type="checkbox" checked={isChecked} onChange={() => toggle(label)} disabled={saving} /><span>{label}</span></label>
                                            : <><span style={{ color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>{items.indexOf(label) + 1}</span><span style={{ flex: 1 }}>{label}</span></>}
                                        <button className="playbook-delete" aria-label={`Delete ${label}`} onClick={() => deleteItem(label)}>×</button>
                                    </div>
                                )
                            })
                    }
                    <div style={{ display: 'flex', gap: 8, marginTop: '0.9rem' }}>
                        <input aria-label={`Add ${CHECKLIST_LABELS[type]} item`} value={newItem} onChange={e => setNewItem(e.target.value)} onKeyDown={e => e.key === 'Enter' && addItem()} placeholder="Add checklist item…" style={{ flex: 1, padding: '8px 12px', fontSize: 13 }} />
                        <button aria-label={`Add ${CHECKLIST_LABELS[type]} item`} onClick={addItem} className="btn-primary" style={{ padding: '8px 14px', fontSize: 14 }}>+</button>
                    </div>
                </div>
            )}
        </section>
    )
}

export default function Checklists() {
    const { user } = useAuth()
    const day = useLocalDay()
    const today = new Date(`${day}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
    return (
        <div className="feature-page checklists-page" style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '1.5rem 1.25rem' }}>
            <div style={{ maxWidth: 900, margin: '0 auto' }}>
                <div style={{ marginBottom: '1.5rem' }}>
                    <div className="eyebrow">CONSISTENCY IS A PRACTICE</div><h1 style={{ marginTop: 8, marginBottom: 8 }}>Your daily routine<span className="heading-dot">.</span></h1><p className="page-subtitle" style={{ marginBottom: 8 }}>Prepare with intention. Trade with discipline. Reflect with honesty.</p>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{today}</p>
                </div>
                {CHECKLIST_TYPES.map(type => (
                    <ChecklistSection key={type} type={type} userId={user?.id} day={day} />
                ))}
                <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: '1rem' }}>
                    Pre-market and post-market progress resets at midnight in your time zone ({zone}). Checklist items are saved to your account.
                </p>
            </div>
        </div>
    )
}
