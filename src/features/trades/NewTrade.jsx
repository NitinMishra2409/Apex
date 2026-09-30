import { prepareTrade } from '../../domain/trades/record'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../auth/useAuth'
import { addTrade } from './repository'
import { getCustomMistakes, addCustomMistake } from './mistakes'
import VoiceTradeInput from '../voice/VoiceTradeInput'
import TradeChecklist from './TradeChecklist'
import { getChecklist } from '../checklists/repository'
import { useProfile } from '../settings/useProfile'
import { SETUP_TYPES, DEFAULT_MISTAKES, ASSET_CLASSES, ASSET_CLASS_LABELS } from '../../domain/trades/vocabulary'
import { calcRR, calcPnl, calcRisk, getResult } from '../../domain/trades/math'
import './trades.css'
import { COMMON_SYMBOLS, normaliseSymbol, formatSymbol, guessAssetClass } from '../../domain/trades/symbols'
import { money } from '../../domain/journal/reporting'
import Select from '../../shared/ui/Select'


const toLocal = () => { const n = new Date(); n.setMinutes(n.getMinutes() - n.getTimezoneOffset()); return n.toISOString().slice(0, 16) }

const Spinner = () => <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite', verticalAlign: 'middle' }} />

const SL = { // shared label style
    label: { display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 },
    input: { width: '100%', padding: '10px 13px', boxSizing: 'border-box' },
}

export default function NewTrade() {
    const { user } = useAuth()
    const navigate = useNavigate()
    const { currency } = useProfile()
    const [form, setForm] = useState({ date: toLocal(), symbol: '', asset_class: '', direction: 'LONG', entry: '', exit_price: '', sl: '', tp: '', units: '', fees: '', setup_type: '', emotional_notes: '' })
    const [mistakes, setMistakes] = useState([])
    const [checklistItems, setChecklistItems] = useState([])
    const [checked, setChecked] = useState([])
    const [reviewItems, setReviewItems] = useState([]) // checks the dictation wasn't sure about
    const [allMistakes, setAllMistakes] = useState(DEFAULT_MISTAKES)
    const [customInput, setCustomInput] = useState('')
    const [showCustom, setShowCustom] = useState(false)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!user) return
        getCustomMistakes(user.id).then(rows => setAllMistakes([...DEFAULT_MISTAKES, ...rows.map(r => r.label)])).catch(() => { })
        getChecklist(user.id, 'trade').then(setChecklistItems).catch(() => { })
    }, [user])
    const toggleCheck = item => {
        setChecked(p => p.includes(item) ? p.filter(x => x !== item) : [...p, item])
        setReviewItems(p => p.filter(x => x !== item))
    }

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

    // Voice dictation fills whatever it recognised; the user reviews before saving.
    const applyVoice = ({ fields, checklist }) => {
        const { mistakes: spokenMistakes, ...rest } = fields
        setForm(f => {
            const next = { ...f }
            for (const [key, value] of Object.entries(rest)) {
                next[key] = value === null || value === undefined ? next[key] : String(value)
            }
            if (rest.symbol && !next.asset_class) next.asset_class = guessAssetClass(rest.symbol) ?? ''
            return next
        })
        if (spokenMistakes?.length) {
            setAllMistakes(p => [...new Set([...p, ...spokenMistakes])])
            setMistakes(p => [...new Set([...p, ...spokenMistakes])])
        }
        // No checklist words leaves manual ticks alone; ticks are only ever added.
        if (checklist?.ticked.length) setChecked(p => [...new Set([...p, ...checklist.ticked])])
        if (checklist) setReviewItems(p => [...new Set([...p, ...checklist.unsure])].filter(x => !checklist.ticked.includes(x)))
    }
    const rr = calcRR(form.direction, form.entry, form.sl, form.tp)
    const pnl = calcPnl(form.direction, form.entry, form.exit_price, form.units, form.fees)
    const risk = calcRisk(form.direction, form.entry, form.sl, form.units)
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
            await addTrade(user.id, prepareTrade({ ...form, checklist: checked.length ? { items: checklistItems, checked } : null }, mistakes))
            toast.success('Trade logged!')
            navigate('/log')
        } catch (err) { toast.error(err.message || 'Failed to save.') }
        finally { setLoading(false) }
    }

    return (
        <div className="feature-page newtrade-page" style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '1.5rem 1.25rem', display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '100%', maxWidth: 800 }}>
                <div className="eyebrow">CAPTURE THE DECISION</div><h1 style={{ marginTop: 8 }}>Log a trade<span className="heading-dot">.</span></h1><p className="page-subtitle">The numbers tell one part of the story. Your notes tell the rest.</p>
                <VoiceTradeInput onParsed={applyVoice} extraMistakes={allMistakes} checklistItems={checklistItems} />
                <div className="card">
                    <form onSubmit={handleSubmit}><div className="form-section-title"><span>01</span><div><h2>Trade details</h2><p>Start with the instrument and your execution.</p></div></div>
                        {/* Asset */}
                        <div style={{ marginBottom: '1rem' }}>
                            <label htmlFor="trade-symbol" style={SL.label}>Asset</label>
                            <input id="trade-symbol"
                                name="symbol" autoComplete="off" list="apexlog-symbols"
                                value={form.symbol}
                                onChange={e => set('symbol', e.target.value)}
                                onBlur={e => { const n = normaliseSymbol(e.target.value); if (n) { set('symbol', n); if (!form.asset_class) set('asset_class', guessAssetClass(n) ?? '') } }}
                                placeholder="NIFTY, AAPL, EURUSD, BTCUSDT"
                                style={SL.input}
                            />
                            <datalist id="apexlog-symbols">
                                {COMMON_SYMBOLS.map(sym => <option key={sym} value={sym}>{formatSymbol(sym)}</option>)}
                            </datalist>
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                            <label htmlFor="trade-asset-class" style={SL.label}>Asset class</label>
                            <Select id="trade-asset-class" name="asset-class" autoComplete="off" value={form.asset_class} onValueChange={value => set('asset_class', value)} style={{ ...SL.input, cursor: 'pointer' }}>
                                <option value="">— Select —</option>
                                {ASSET_CLASSES.map(a => <option key={a} value={a}>{ASSET_CLASS_LABELS[a]}</option>)}
                            </Select>
                        </div>

                        {/* Date */}
                        <div style={{ marginBottom: '1rem' }}>
                            <label htmlFor="trade-date" style={SL.label}>Date & Time</label>
                            <input id="trade-date" name="date" autoComplete="off" type="datetime-local" value={form.date} onChange={e => set('date', e.target.value)} style={SL.input} />
                        </div>

                        {/* Direction */}
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={SL.label}>Direction</label>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {['LONG', 'SHORT'].map(dir => (
                                    <button key={dir} aria-pressed={form.direction === dir} type="button" onClick={() => set('direction', dir)} style={{
                                        flex: 1, padding: '11px 0', borderRadius: 'var(--radius-sm)', border: '2px solid', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', transition: 'color 150ms, background-color 150ms, border-color 150ms',
                                        borderColor: form.direction === dir ? (dir === 'LONG' ? 'var(--green)' : 'var(--red)') : 'var(--border)',
                                        background: form.direction === dir ? (dir === 'LONG' ? 'rgba(108,178,132,0.1)' : 'rgba(217,125,125,0.1)') : 'transparent',
                                        color: form.direction === dir ? (dir === 'LONG' ? 'var(--green)' : 'var(--red)') : 'var(--text-muted)',
                                    }}>{dir === 'LONG' ? '▲ LONG' : '▼ SHORT'}</button>
                                ))}
                            </div>
                        </div>

                        {/* Entry / Exit */}
                        <div className="form-columns" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                            <div><label htmlFor="trade-entry" style={SL.label}>Entry Price</label><input id="trade-entry" name="entry" autoComplete="off" type="number" step="any" value={form.entry} onChange={e => set('entry', e.target.value)} placeholder="0.00" style={SL.input} /></div>
                            <div><label htmlFor="trade-exit_price" style={SL.label}>Exit Price</label><input id="trade-exit_price" name="exit_price" autoComplete="off" type="number" step="any" value={form.exit_price} onChange={e => set('exit_price', e.target.value)} placeholder="0.00" style={SL.input} /></div>
                        </div>

                        <div className="form-section-title"><span>02</span><div><h2>Risk & position</h2><p>Record the plan behind your trade.</p></div></div>{/* SL / TP */}
                        <div className="form-columns" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                            <div><label htmlFor="trade-sl" style={SL.label}>Stop Loss</label><input id="trade-sl" name="sl" autoComplete="off" type="number" step="any" value={form.sl} onChange={e => set('sl', e.target.value)} placeholder="0.00" style={SL.input} /></div>
                            <div><label htmlFor="trade-tp" style={SL.label}>Take Profit</label><input id="trade-tp" name="tp" autoComplete="off" type="number" step="any" value={form.tp} onChange={e => set('tp', e.target.value)} placeholder="0.00" style={SL.input} /></div>
                        </div>

                        {/* Units / fees */}
                        <div className="form-columns" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.4rem' }}>
                            <div><label htmlFor="trade-units" style={SL.label}>Units</label><input id="trade-units" name="units" autoComplete="off" type="number" step="any" min="0" value={form.units} onChange={e => set('units', e.target.value)} placeholder="50" style={SL.input} /></div>
                            <div><label htmlFor="trade-fees" style={SL.label}>Fees ({currency})</label><input id="trade-fees" name="fees" autoComplete="off" type="number" step="any" min="0" value={form.fees} onChange={e => set('fees', e.target.value)} placeholder="0" style={SL.input} /></div>
                        </div>
                        <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: '1rem' }}>Units = total quantity: shares, coins, or lots × lot size (2 lots of 75 = 150). Prices and fees are in your account currency, {currency}.</p>

                        {/* Live calc */}
                        <div style={{ background: 'var(--bg-elevated)', borderLeft: '3px solid var(--accent)', borderRadius: 'var(--radius-sm)', padding: '0.9rem 1.1rem', marginBottom: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: '0.75rem' }}>
                            {[
                                { label: 'Planned R:R', val: rr ? `1:${rr}` : '—', color: rr && rr > 0 ? 'var(--green)' : 'var(--text-secondary)' },
                                { label: 'At risk', val: risk === null ? '—' : money(risk, currency, { signed: false }), color: 'var(--text-secondary)' },
                                { label: 'P&L', val: pnl === null ? '—' : money(pnl, currency), color: pnl === null ? 'var(--text-secondary)' : pnl >= 0 ? 'var(--green)' : 'var(--red)' },
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

                        <div className="form-section-title"><span>03</span><div><h2>Per-trade checklist</h2><p>Did you run your checks before this entry?</p></div></div>
                        <TradeChecklist items={checklistItems} checked={checked} onToggle={toggleCheck} highlight={reviewItems} />

                        <div className="form-section-title"><span>04</span><div><h2>Context & reflection</h2><p>Capture the setup and what you learned.</p></div></div>{/* Setup */}
                        <div style={{ marginBottom: '1rem' }}>
                            <label htmlFor="trade-setup" style={SL.label}>Setup Type</label>
                            <Select id="trade-setup" name="setup" autoComplete="off" value={form.setup_type} onValueChange={value => set('setup_type', value)} style={{ ...SL.input, cursor: 'pointer' }}>
                                <option value="">— Select Setup —</option>
                                {SETUP_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                            </Select>
                        </div>

                        {/* Mistakes chips */}
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={SL.label}>Mistakes</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: '0.6rem' }}>
                                {allMistakes.map(m => {
                                    const active = mistakes.includes(m)
                                    return (
                                        <button key={m} aria-pressed={active} type="button" onClick={() => setMistakes(p => active ? p.filter(x => x !== m) : [...p, m])} style={{ padding: '4px 11px', borderRadius: 6, border: `1px solid ${active ? 'var(--red)' : 'var(--border)'}`, background: active ? 'rgba(217,125,125,0.12)' : 'transparent', color: active ? 'var(--red)' : 'var(--text-muted)', fontSize: 12, fontWeight: active ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit', transition: 'color 150ms, background-color 150ms, border-color 150ms' }}>{m}</button>
                                    )
                                })}
                                <button type="button" onClick={() => setShowCustom(v => !v)} style={{ padding: '4px 11px', borderRadius: 6, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>+ Custom</button>
                            </div>
                            {showCustom && (
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <input aria-label="Custom mistake" name="custom-mistake" value={customInput} onChange={e => setCustomInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddCustom())} placeholder="e.g. Overtraded session" style={{ flex: 1, padding: '8px 12px' }} />
                                    <button type="button" onClick={handleAddCustom} className="btn-primary" style={{ padding: '8px 14px', fontSize: 13 }}>Add</button>
                                </div>
                            )}
                        </div>

                        {/* Notes */}
                        <div style={{ marginBottom: '1.25rem' }}>
                            <label htmlFor="trade-notes" style={SL.label}>Emotional Notes</label>
                            <textarea id="trade-notes" name="notes" autoComplete="off" value={form.emotional_notes} onChange={e => set('emotional_notes', e.target.value)} placeholder="How were you feeling? What did you do well or poorly?" style={{ ...SL.input, resize: 'vertical', minHeight: 80 }} />
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
