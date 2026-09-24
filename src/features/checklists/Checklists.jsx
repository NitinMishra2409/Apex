import { useState, useEffect, useCallback } from 'react'
import { Sun, Sunset, Moon } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../auth/useAuth'
import { getChecklist, saveChecklistItems, getDailyProgress, saveDailyProgress } from './repository'
import { CHECKLIST_TYPES, CHECKLIST_LABELS, CHECKLIST_DEFAULTS as DEFAULTS } from '../../domain/checklists/vocabulary'

const ICONS = { premarket: Sun, during: Sunset, posttrade: Moon }

const Bone = ({ w = '100%', h = 16 }) => <div style={{ width: w, height: h, borderRadius: 4 }} className="skeleton" />

function ChecklistSection({ type, userId }) {
    const [items, setItems] = useState([])
    const [checked, setChecked] = useState([])
    const [open, setOpen] = useState(true)
    const [newItem, setNewItem] = useState('')
    const [saving, setSaving] = useState(false)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!userId) return
        Promise.all([getChecklist(userId, type), getDailyProgress(userId, type)])
            .then(([its, prog]) => {
                const base = its?.length ? its : DEFAULTS[type]
                if (!its?.length) saveChecklistItems(userId, type, base).catch(() => { })
                setItems(base); setChecked(prog ?? []); setLoading(false)
            }).catch(() => setLoading(false))
    }, [userId, type])

    const saveProgress = useCallback(async (next) => {
        setSaving(true)
        try { await saveDailyProgress(userId, type, next) }
        catch (err) { toast.error(err.message) }
        finally { setSaving(false) }
    }, [userId, type])

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
        try { await saveChecklistItems(userId, type, ni); await saveDailyProgress(userId, type, nc) }
        catch (err) { toast.error(err.message) }
    }

    const Icon = ICONS[type]
    const done = items.filter(i => checked.includes(i)).length
    const total = items.length
    const pct = total > 0 ? Math.round(done / total * 100) : 0
    const barColor = pct === 100 ? 'var(--green)' : pct >= 50 ? 'var(--yellow)' : 'var(--red)'

    return (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: '0.9rem', overflow: 'hidden', transition: 'border-color 0.15s' }}>
            {/* Header */}
            <button aria-expanded={open} onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem 1.25rem', background: 'none', border: 'none', cursor: 'pointer', borderBottom: open ? '1px solid var(--border)' : 'none', transition: 'background 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)' }} onMouseLeave={e => { e.currentTarget.style.background = 'none' }}>
                <Icon size={19} color="var(--accent)" />
                <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'left' }}>{CHECKLIST_LABELS[type]}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: barColor, minWidth: 30 }}>{loading ? '…' : `${done}/${total}`}</span>
                <div style={{ width: 72, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', flexShrink: 0 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 2, transition: 'width 0.4s ease' }} />
                </div>
                <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 4 }}>{open ? '▲' : '▼'}</span>
            </button>

            {open && (
                <div style={{ padding: '0.25rem 1.25rem 1rem' }}>
                    {loading
                        ? <div style={{ padding: '0.75rem 0' }}>{[...Array(3)].map((_, i) => <Bone key={i} h={18} style={{ marginBottom: 12, opacity: 1 - i * 0.25 }} />)}</div>
                        : items.length === 0
                            ? <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: '0.75rem 0' }}>No items yet.</p>
                            : items.map(label => {
                                const isChecked = checked.includes(label)
                                return (
                                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '0.7rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
                                        <button role="checkbox" aria-checked={isChecked} aria-label={label} onClick={() => toggle(label)} disabled={saving} style={{
                                            flexShrink: 0, width: 20, height: 20, borderRadius: 5,
                                            border: `2px solid ${isChecked ? 'var(--accent)' : 'var(--border)'}`,
                                            background: isChecked ? 'var(--accent)' : 'transparent',
                                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            padding: 0, transition: 'all 0.18s',
                                        }}>
                                            {isChecked && <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 5.5l2.5 2.5 4.5-4.5" stroke="#0d0d12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                                        </button>
                                        <span style={{ flex: 1, fontSize: 13, color: isChecked ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: isChecked ? 'line-through' : 'none', transition: 'all 0.2s' }}>{label}</span>
                                        <button aria-label={`Delete ${label}`} onClick={() => deleteItem(label)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, padding: '2px 5px', borderRadius: 4, lineHeight: 1, transition: 'color 0.12s' }}
                                            onMouseEnter={e => { e.target.style.color = 'var(--red)' }} onMouseLeave={e => { e.target.style.color = 'var(--text-muted)' }}>✕</button>
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
        </div>
    )
}

export default function Checklists() {
    const { user } = useAuth()
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    return (
        <div className="feature-page checklists-page" style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '1.5rem 1.25rem' }}>
            <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
            <div style={{ maxWidth: 900, margin: '0 auto' }}>
                <div style={{ marginBottom: '1.5rem' }}>
                    <div className="eyebrow">CONSISTENCY IS A PRACTICE</div><h1 style={{ marginTop: 8, marginBottom: 8 }}>Your daily routine<span className="heading-dot">.</span></h1><p className="page-subtitle" style={{ marginBottom: 8 }}>Prepare with intention. Trade with discipline. Reflect with honesty.</p>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{today}</p>
                </div>
                {CHECKLIST_TYPES.map(type => (
                    <ChecklistSection key={type} type={type} userId={user?.id} />
                ))}
                <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: '1rem' }}>
                    Progress resets daily. Items are saved to your account permanently.
                </p>
            </div>
        </div>
    )
}
