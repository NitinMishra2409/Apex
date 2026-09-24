import { prepareTrade } from '../../domain/trades/record'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../auth/useAuth'
import { addTrade } from './repository'
import { getCustomMistakes, addCustomMistake } from './mistakes'
import VoiceTradeInput from '../voice/VoiceTradeInput'
import { SETUP_TYPES, DEFAULT_MISTAKES } from '../../domain/trades/vocabulary'
import { calcRR, calcPnl, getResult } from '../../domain/trades/math'
import { COMMON_SYMBOLS, normaliseSymbol, formatSymbol } from '../../domain/trades/symbols'


const toLocal = () => { const n = new Date(); n.setMinutes(n.getMinutes() - n.getTimezoneOffset()); return n.toISOString().slice(0, 16) }

const Spinner = () => <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite', verticalAlign: 'middle' }} />

const SL = { // shared label style
    label: { display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 },
    input: { width: '100%', padding: '10px 13px', boxSizing: 'border-box' },
}

export default function NewTrade() {
    const { user } = useAuth()
    const navigate = useNavigate()
    const [form, setForm] = useState({ date: toLocal(), symbol: '', direction: 'LONG', entry: '', exit_price: '', sl: '', tp: '', size: '', setup_type: '', emotional_notes: '' })
    const [mistakes, setMistakes] = useState([])
    const [allMistakes, setAllMistakes] = useState(DEFAULT_MISTAKES)
    const [customInput, setCustomInput] = useState('')
    const [showCustom, setShowCustom] = useState(false)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!user) return
        getCustomMistakes(user.id).then(rows => setAllMistakes([...DEFAULT_MISTAKES, ...rows.map(r => r.label)])).catch(() => { })
    }, [user])

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

    // Voice dictation fills whatever it recognised; the user reviews before saving.
    const applyVoice = ({ fields }) => {
        const { mistakes: spokenMistakes, ...rest } = fields
        setForm(f => {
            const next = { ...f }
            for (const [key, value] of Object.entries(rest)) {
                next[key] = value === null || value === undefined ? next[key] : String(value)
            }
            return next
        })
        if (spokenMistakes?.length) {
            setAllMistakes(p => [...new Set([...p, ...spokenMistakes])])
            setMistakes(p => [...new Set([...p, ...spokenMistakes])])
        }
    }
    const rr = calcRR(form.direction, form.entry, form.sl, form.tp)
    const pnl = calcPnl(form.direction, form.entry, form.exit_price, form.size)
    const result = getResult(pnl)

    const handleAddCustom = async () => {
        const label = customInput.trim()
        if (!label) return
        try { await addCustomMistake(user.id, label); setAllMistakes(p => [...p, label]); setMistakes(p => [...p, label]); setCustomInput(''); setShowCustom(false) }
        catch (err) { toast.error(err.message) }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!form.entry) return toast.error('Entry price is required.')
        setLoading(true)
        try {
            await addTrade(user.id, prepareTrade(form, mistakes))
            toast.success('Trade logged!')
            navigate('/log')
        } catch (err) { toast.error(err.message || 'Failed to save.') }
        finally { setLoading(false) }
    }

    return (
        <div className="feature-page newtrade-page" style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '1.5rem 1.25rem', display: 'flex', justifyContent: 'center' }}>
            <style>{`select option{background:var(--bg-primary)} input[type="datetime-local"]::-webkit-calendar-picker-indicator{filter:invert(0.4);cursor:pointer}`}</style>
            <div style={{ width: '100%', maxWidth: 800 }}>
                <div className="eyebrow">CAPTURE THE DECISION</div><h1 style={{ marginTop: 8 }}>Log a trade<span className="heading-dot">.</span></h1><p className="page-subtitle">The numbers tell one part of the story. Your notes tell the rest.</p>
                <VoiceTradeInput onParsed={applyVoice} extraMistakes={allMistakes} />
                <div className="card">
                    <form onSubmit={handleSubmit}><div className="form-section-title"><span>01</span><div><h2>Trade details</h2><p>Start with the instrument and your execution.</p></div></div>
                        {/* Asset */}
                        <div style={{ marginBottom: '1rem' }}>
                            <label htmlFor="trade-symbol" style={SL.label}>Asset</label>
                            <input id="trade-symbol"
                                list="apexlog-symbols"
                                value={form.symbol}
                                onChange={e => set('symbol', e.target.value)}
                                onBlur={e => { const n = normaliseSymbol(e.target.value); if (n) set('symbol', n) }}
                                placeholder="BTCUSDT"
                                style={SL.input}
                            />
                            <datalist id="apexlog-symbols">
                                {COMMON_SYMBOLS.map(sym => <option key={sym} value={sym}>{formatSymbol(sym)}</option>)}
                            </datalist>
                        </div>

                        {/* Date */}
                        <div style={{ marginBottom: '1rem' }}>
                            <label htmlFor="trade-date" style={SL.label}>Date & Time</label>
                            <input id="trade-date" type="datetime-local" value={form.date} onChange={e => set('date', e.target.value)} style={SL.input} />
                        </div>

                        {/* Direction */}
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={SL.label}>Direction</label>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {['LONG', 'SHORT'].map(dir => (
                                    <button key={dir} aria-pressed={form.direction === dir} type="button" onClick={() => set('direction', dir)} style={{
                                        flex: 1, padding: '11px 0', borderRadius: 'var(--radius-sm)', border: '2px solid', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                                        borderColor: form.direction === dir ? (dir === 'LONG' ? 'var(--green)' : 'var(--red)') : 'var(--border)',
                                        background: form.direction === dir ? (dir === 'LONG' ? 'rgba(108,178,132,0.1)' : 'rgba(217,125,125,0.1)') : 'transparent',
                                        color: form.direction === dir ? (dir === 'LONG' ? 'var(--green)' : 'var(--red)') : 'var(--text-muted)',
                                    }}>{dir === 'LONG' ? '▲ LONG' : '▼ SHORT'}</button>
                                ))}
                            </div>
                        </div>

                        {/* Entry / Exit */}
                        <div className="form-columns" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                            <div><label htmlFor="trade-entry" style={SL.label}>Entry Price</label><input id="trade-entry" type="number" step="any" value={form.entry} onChange={e => set('entry', e.target.value)} placeholder="0.00" style={SL.input} /></div>
                            <div><label htmlFor="trade-exit_price" style={SL.label}>Exit Price</label><input id="trade-exit_price" type="number" step="any" value={form.exit_price} onChange={e => set('exit_price', e.target.value)} placeholder="0.00" style={SL.input} /></div>
                        </div>

                        <div className="form-section-title"><span>02</span><div><h2>Risk & position</h2><p>Record the plan behind your trade.</p></div></div>{/* SL / TP */}
                        <div className="form-columns" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                            <div><label htmlFor="trade-sl" style={SL.label}>Stop Loss</label><input id="trade-sl" type="number" step="any" value={form.sl} onChange={e => set('sl', e.target.value)} placeholder="0.00" style={SL.input} /></div>
                            <div><label htmlFor="trade-tp" style={SL.label}>Take Profit</label><input id="trade-tp" type="number" step="any" value={form.tp} onChange={e => set('tp', e.target.value)} placeholder="0.00" style={SL.input} /></div>
                        </div>

                        {/* Size */}
                        <div style={{ marginBottom: '1rem' }}>
                            <label htmlFor="trade-size" style={SL.label}>Position Size (USDT)</label>
                            <input id="trade-size" type="number" step="any" value={form.size} onChange={e => set('size', e.target.value)} placeholder="1000" style={SL.input} />
                        </div>

                        {/* Live calc */}
                        <div style={{ background: 'var(--bg-elevated)', borderLeft: '3px solid var(--accent)', borderRadius: 'var(--radius-sm)', padding: '0.9rem 1.1rem', marginBottom: '1rem', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.75rem' }}>
                            {[
                                { label: 'RR Ratio', val: rr ? `1:${rr}` : '—', color: rr && rr > 0 ? 'var(--green)' : 'var(--text-secondary)' },
                                { label: 'P&L (USDT)', val: pnl === null ? '—' : `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`, color: pnl === null ? 'var(--text-secondary)' : pnl >= 0 ? 'var(--green)' : 'var(--red)' },
                                { label: 'Result', val: result || '—', isResult: true },
                            ].map(({ label, val, color, isResult }) => (
                                <div key={label}>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{label}</div>
                                    {isResult && result
                                        ? <span className={result === 'WIN' ? 'badge-win' : result === 'LOSS' ? 'badge-loss' : 'badge-be'} style={{ fontSize: 12 }}>{result}</span>
                                        : <div style={{ fontSize: 15, fontWeight: 700, color: color || 'var(--text-primary)' }}>{val}</div>}
                                </div>
                            ))}
                        </div>

                        <div className="form-section-title"><span>03</span><div><h2>Context & reflection</h2><p>Capture the setup and what you learned.</p></div></div>{/* Setup */}
                        <div style={{ marginBottom: '1rem' }}>
                            <label htmlFor="trade-setup" style={SL.label}>Setup Type</label>
                            <select id="trade-setup" value={form.setup_type} onChange={e => set('setup_type', e.target.value)} style={{ ...SL.input, cursor: 'pointer' }}>
                                <option value="">— Select Setup —</option>
                                {SETUP_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>

                        {/* Mistakes chips */}
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={SL.label}>Mistakes</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: '0.6rem' }}>
                                {allMistakes.map(m => {
                                    const active = mistakes.includes(m)
                                    return (
                                        <button key={m} aria-pressed={active} type="button" onClick={() => setMistakes(p => active ? p.filter(x => x !== m) : [...p, m])} style={{ padding: '4px 11px', borderRadius: 6, border: `1px solid ${active ? 'var(--red)' : 'var(--border)'}`, background: active ? 'rgba(217,125,125,0.12)' : 'transparent', color: active ? 'var(--red)' : 'var(--text-muted)', fontSize: 12, fontWeight: active ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>{m}</button>
                                    )
                                })}
                                <button type="button" onClick={() => setShowCustom(v => !v)} style={{ padding: '4px 11px', borderRadius: 6, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>+ Custom</button>
                            </div>
                            {showCustom && (
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <input value={customInput} onChange={e => setCustomInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddCustom())} placeholder="e.g. Overtraded session" style={{ flex: 1, padding: '8px 12px' }} />
                                    <button type="button" onClick={handleAddCustom} className="btn-primary" style={{ padding: '8px 14px', fontSize: 13 }}>Add</button>
                                </div>
                            )}
                        </div>

                        {/* Notes */}
                        <div style={{ marginBottom: '1.25rem' }}>
                            <label htmlFor="trade-notes" style={SL.label}>Emotional Notes</label>
                            <textarea id="trade-notes" value={form.emotional_notes} onChange={e => set('emotional_notes', e.target.value)} placeholder="How were you feeling? What did you do well or poorly?" style={{ ...SL.input, resize: 'vertical', minHeight: 80 }} />
                        </div>

                        <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', justifyContent: 'center', opacity: loading ? 0.7 : 1, fontSize: 15, padding: '13px' }}>
                            {loading ? <><Spinner />&nbsp;Saving…</> : 'Log Trade'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}
