import EditTradeModal from './EditTradeModal'
import { useState, useEffect, useMemo, Fragment } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../auth/useAuth'
import { getTrades, deleteTrade } from './repository'
import { useProfile } from '../settings/useProfile'
import { SETUP_TYPES, ASSET_CLASSES, ASSET_CLASS_LABELS } from '../../domain/trades/vocabulary'
import { formatSymbol, symbolsInTrades } from '../../domain/trades/symbols'
import { isPlanned } from '../../domain/trades/record'
import { money } from '../../domain/journal/reporting'
import Select from '../../shared/ui/Select'
import './trades.css'

const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'
const fmt = (n) => n == null ? '—' : Number(n).toFixed(2)

const TH = { padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', background: 'var(--bg-elevated)' }
const TD = { padding: '11px 12px', fontSize: 13, borderBottom: '1px solid var(--border-subtle)', whiteSpace: 'nowrap' }
const Bone = ({ w = '100%', h = 16, style = {} }) => <div style={{ width: w, height: h, borderRadius: 4, ...style }} className="skeleton" />

function Skeleton() {
    return <div className="journal-loading" role="status" aria-label="Loading trades" style={{ padding: '1rem 0' }}>{[...Array(5)].map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 12, opacity: 1 - i * 0.15 }}>
            {[80, 55, 80, 80, 65, 65, 55, 55, 75, 110, 55, 60, 120, 70].map((w, j) => <Bone key={j} w={w} h={16} />)}
        </div>
    ))}</div>
}

// ── Edit Modal ──────────────────────────────────────────────────────────────
// ── Main ────────────────────────────────────────────────────────────────────
export default function TradeLog() {
    const { user } = useAuth()
    const { currency } = useProfile()
    const [trades, setTrades] = useState([])
    const [loading, setLoading] = useState(true)
    const [expanded, setExpanded] = useState(() => new URLSearchParams(window.location.search).get('trade'))
    const [editTrade, setEditTrade] = useState(null)
    const blankFilters = { result: 'All', direction: 'All', symbol: '', setup: '', assetClass: '', plan: '', from: '', to: '' }
    const [filters, setFilters] = useState(blankFilters)
    const [filtersOpen, setFiltersOpen] = useState(false)
    const activeFilters = Object.entries(filters).filter(([key, value]) => key === 'result' || key === 'direction' ? value !== 'All' : Boolean(value)).length
    const setF = (k, v) => setFilters(f => ({ ...f, [k]: v }))

    useEffect(() => {
        if (!user) return
        getTrades(user.id).then(d => { setTrades(d); setLoading(false) }).catch(err => { toast.error(err.message); setLoading(false) })
    }, [user])

    const assets = useMemo(() => symbolsInTrades(trades), [trades])

    const filtered = useMemo(() => trades.filter(t => {
        if (filters.result !== 'All' && t.result !== filters.result) return false
        if (filters.direction !== 'All' && t.direction !== filters.direction) return false
        if (filters.symbol && t.symbol !== filters.symbol) return false
        if (filters.setup && t.setup_type !== filters.setup) return false
        if (filters.assetClass && t.asset_class !== filters.assetClass) return false
        if (filters.plan && (filters.plan === 'planned') !== isPlanned(t)) return false
        if (filters.from && new Date(t.date) < new Date(filters.from)) return false
        if (filters.to && new Date(t.date) > new Date(filters.to + 'T23:59:59')) return false
        return true
    }), [trades, filters])

    const stats = useMemo(() => {
        const wins = filtered.filter(t => t.result === 'WIN').length
        const pnl = filtered.reduce((s, t) => s + (t.pnl ?? 0), 0)
        const rrs = filtered.filter(t => t.rr != null); const avgRR = rrs.length ? rrs.reduce((s, t) => s + t.rr, 0) / rrs.length : null
        return { wins, winRate: filtered.length ? +(wins / filtered.length * 100).toFixed(1) : null, pnl: +pnl.toFixed(2), avgRR: avgRR ? +avgRR.toFixed(2) : null }
    }, [filtered])

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this trade?')) return
        try { await deleteTrade(id); setTrades(p => p.filter(t => t.id !== id)); toast.success('Trade deleted.') }
        catch (err) { toast.error(err.message) }
    }

    const exportCSV = () => {
        const cols = ['date', 'symbol', 'asset_class', 'direction', 'entry', 'exit_price', 'sl', 'tp', 'units', 'fees', 'rr', 'pnl', 'result', 'setup_type', 'mistakes', 'planned', 'emotional_notes']
        const value = (t, c) => c === 'planned' ? (isPlanned(t) ? 'yes' : 'no') : t[c]
        const rows = filtered.map(t => cols.map(c => { const v = value(t, c); if (v == null) return ''; if (Array.isArray(v)) return `"${v.join('; ')}"`; const s = String(v); return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s }).join(','))
        const blob = new Blob([[cols.join(','), ...rows].join('\n')], { type: 'text/csv' })
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'apexlog-trades.csv'; a.click()
    }

    const filterPillStyle = (active, color = 'var(--accent)') => ({
        padding: '5px 12px', borderRadius: 6, border: `1px solid ${active ? color : 'var(--border)'}`,
        background: active ? `color-mix(in srgb, ${color} 12%, transparent)` : 'transparent',
        color: active ? color : 'var(--text-secondary)',
        fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'color 150ms, background-color 150ms, border-color 150ms',
    })

    return (
        <div className="feature-page tradelog-page" style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '1.5rem 1.25rem' }}>
            <div style={{ maxWidth: 1280, margin: '0 auto' }}>
                <div className="journal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <div><div className="eyebrow">EVERY TRADE TELLS A STORY</div><h1 style={{ marginTop: 8 }}>Trade journal<span className="heading-dot">.</span></h1><p className="page-subtitle" style={{ marginBottom: 0 }}>Your decisions, documented. Your progress, in perspective.</p></div>
                    <button onClick={exportCSV} className="btn-secondary" style={{ fontSize: 12, padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>↓ Export CSV</button>
                </div>

                {/* Filter bar */}
                <div className="journal-filters" role="group" aria-label="Journal filters">
                    <div className="journal-filter-heading"><strong>Refine journal</strong><span>{activeFilters ? `${activeFilters} active ${activeFilters === 1 ? 'filter' : 'filters'} · ` : ''}Showing {filtered.length} of {trades.length}</span></div>
                    <div className="journal-filter-choices" role="group" aria-label="Result">
                    <span className="journal-filter-label">Result</span>
                    {['All', 'WIN', 'LOSS', 'BE'].map(r => (
                        <button key={r} aria-pressed={filters.result === r} aria-label={`Result: ${r}`} onClick={() => setF('result', r)} style={filterPillStyle(filters.result === r, r === 'WIN' ? 'var(--green)' : r === 'LOSS' ? 'var(--red)' : r === 'BE' ? 'var(--yellow)' : 'var(--accent)')}>{r}</button>
                    ))}
                    </div>
                    <button className="journal-more-toggle btn-secondary" aria-expanded={filtersOpen} aria-controls="journal-more-filters" onClick={() => setFiltersOpen(open => !open)}>{filtersOpen ? 'Hide more filters' : 'More filters'} {activeFilters > 0 ? `· ${activeFilters} active` : ''}</button>
                    <div id="journal-more-filters" className="journal-filter-more" data-open={filtersOpen}>
                    <div className="journal-filter-choices" role="group" aria-label="Direction">
                    <span className="journal-filter-label">Direction</span>
                    {['All', 'LONG', 'SHORT'].map(d => (
                        <button key={d} aria-pressed={filters.direction === d} aria-label={`Direction: ${d}`} onClick={() => setF('direction', d)} style={filterPillStyle(filters.direction === d, d === 'LONG' ? 'var(--green)' : d === 'SHORT' ? 'var(--red)' : 'var(--accent)')}>{d}</button>
                    ))}
                    </div>
                    <div className="journal-filter-selects" role="group" aria-label="Trade attributes">
                    <Select aria-label="Filter by asset" value={filters.symbol} onValueChange={value => setF('symbol', value)} style={{ padding: '5px 10px', fontSize: 12, cursor: 'pointer', borderRadius: 6 }}>
                        <option value="">All Assets</option>
                        {assets.map(({ symbol, count }) => (
                            <option key={symbol} value={symbol}>{formatSymbol(symbol)} ({count})</option>
                        ))}
                    </Select>
                    <Select aria-label="Filter by setup" value={filters.setup} onValueChange={value => setF('setup', value)} style={{ padding: '5px 10px', fontSize: 12, cursor: 'pointer', borderRadius: 6 }}>
                        <option value="">All Setups</option>
                        {SETUP_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                    </Select>
                    <Select aria-label="Filter by asset class" value={filters.assetClass} onValueChange={value => setF('assetClass', value)} style={{ padding: '5px 10px', fontSize: 12, cursor: 'pointer', borderRadius: 6 }}>
                        <option value="">All classes</option>
                        {ASSET_CLASSES.map(a => <option key={a} value={a}>{ASSET_CLASS_LABELS[a]}</option>)}
                    </Select>
                    <Select aria-label="Filter by plan" value={filters.plan} onValueChange={value => setF('plan', value)} style={{ padding: '5px 10px', fontSize: 12, cursor: 'pointer', borderRadius: 6 }}>
                        <option value="">Planned + unplanned</option>
                        <option value="planned">Planned only</option>
                        <option value="unplanned">Unplanned only</option>
                    </Select>
                    </div>
                    <div className="journal-filter-date-row">
                        <span className="journal-filter-label">Date range</span>
                        <label>From<input type="date" value={filters.from} onChange={e => setF('from', e.target.value)} /></label>
                        <label>To<input type="date" value={filters.to} onChange={e => setF('to', e.target.value)} /></label>
                        <button onClick={() => setFilters(blankFilters)} className="btn-secondary">Clear filters</button>
                    </div>
                    </div>
                </div>

                {/* Stats summary */}
                {filtered.length > 0 && (
                    <div className="journal-summary" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                        {[
                            { label: 'Total P&L', val: money(stats.pnl, currency), color: stats.pnl >= 0 ? 'var(--green)' : 'var(--red)' },
                            { label: 'Journal win rate', val: stats.winRate ? `${stats.winRate}%` : '—', color: 'var(--text-primary)' },
                            { label: 'Trades', val: filtered.length, color: 'var(--text-primary)' },
                            { label: 'Avg planned R:R', val: stats.avgRR ? `1:${stats.avgRR}` : '—', color: 'var(--text-primary)' },
                        ].map(({ label, val, color }) => (
                            <div key={label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 16px' }}>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 2 }}>{label}</div>
                                <div style={{ fontSize: 16, fontWeight: 700, color }}>{val}</div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Table */}
                {loading ? <Skeleton /> : filtered.length === 0 ? (
                    <div className="empty-state" role="status" style={{ textAlign: 'center', padding: '5rem 1rem' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📊</div>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '1.25rem', fontSize: 14 }}>
                            {trades.length === 0 ? 'No trades yet. Start logging your first trade.' : 'No trades match the current filters.'}
                        </p>
                        {trades.length === 0 && <Link to="/new-trade" className="btn-primary" style={{ textDecoration: 'none' }}>+ Log First Trade</Link>}
                    </div>
                ) : (
                    <div className="journal-table-panel">
                        <div className="journal-table-scroll" role="region" aria-label="Trade journal table" tabIndex={0}>
                            <table aria-label="Recorded trades" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>{['Date', 'Asset', `P&L (${currency})`, 'Result', 'Dir', 'Entry', 'Exit', 'SL', 'TP', 'Units', 'Planned R:R', 'Setup', 'Plan', 'Mistakes', 'Actions'].map(h => <th key={h} style={TH}>{h}</th>)}</tr>
                                </thead>
                                <tbody>
                                    {filtered.map(t => {
                                        const exp = expanded === t.id
                                        return (
                                            <Fragment key={t.id}>
                                                <tr className="trow" onClick={() => setExpanded(exp ? null : t.id)}
                                                    style={{ cursor: 'pointer', background: exp ? 'var(--bg-hover)' : 'transparent', transition: 'background 0.12s' }}>
                                                    <td style={TD}><button className="journal-expand" aria-expanded={exp} aria-controls={`trade-details-${t.id}`} aria-label={`${exp ? 'Collapse' : 'Expand'} ${t.symbol || 'trade'} ${fmtDate(t.date)}`} onClick={e => { e.stopPropagation(); setExpanded(exp ? null : t.id) }}><span aria-hidden="true" className="journal-disclosure">{exp ? '▾' : '▸'}</span>{fmtDate(t.date)}</button></td>
                                                    <td style={{ ...TD, whiteSpace: 'nowrap' }}>{t.symbol ? formatSymbol(t.symbol) : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                                                    <td style={{ ...TD, fontWeight: 600, color: t.pnl == null ? 'var(--text-muted)' : t.pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                                                        {t.pnl != null ? money(t.pnl, currency) : 'Open'}
                                                    </td>
                                                    <td style={TD}>{t.result ? <span className={t.result === 'WIN' ? 'badge-win' : t.result === 'LOSS' ? 'badge-loss' : 'badge-be'}>{t.result}</span> : '—'}</td>
                                                    <td style={TD}><span className={t.direction === 'LONG' ? 'badge-long' : 'badge-short'}>{t.direction}</span></td>
                                                    <td style={TD}>{fmt(t.entry)}</td>
                                                    <td style={{ ...TD, color: 'var(--text-secondary)' }}>{t.exit_price != null ? fmt(t.exit_price) : '—'}</td>
                                                    <td style={{ ...TD, color: 'var(--text-secondary)' }}>{t.sl != null ? fmt(t.sl) : '—'}</td>
                                                    <td style={{ ...TD, color: 'var(--text-secondary)' }}>{t.tp != null ? fmt(t.tp) : '—'}</td>
                                                    <td style={{ ...TD, color: 'var(--text-secondary)' }}>{t.units != null ? Number(t.units).toLocaleString('en-US', { maximumFractionDigits: 6 }) : '—'}</td>
                                                    <td style={TD}>{t.rr != null ? `1:${fmt(t.rr)}` : '—'}</td>
                                                    <td style={{ ...TD, color: 'var(--text-muted)', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.setup_type || '—'}</td>
                                                    <td style={TD}>{isPlanned(t) ? <span className="trade-plan-badge is-planned">{t.checklist.checked.length}/{t.checklist.items.length}</span> : <span className="trade-plan-badge">Unplanned</span>}</td>
                                                    <td style={TD}>
                                                        {t.mistakes?.length
                                                            ? <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap' }}>
                                                                {t.mistakes.slice(0, 2).map(m => <span key={m} style={{ padding: '2px 6px', borderRadius: 4, fontSize: 11, background: 'rgba(217,125,125,0.12)', color: 'var(--red)', border: '1px solid rgba(217,125,125,0.2)', whiteSpace: 'nowrap' }}>{m}</span>)}
                                                                {t.mistakes.length > 2 && <span style={{ fontSize: 11, color: 'var(--text-muted)', alignSelf: 'center' }}>+{t.mistakes.length - 2}</span>}
                                                            </div>
                                                            : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
                                                    </td>
                                                    <td style={TD} onClick={e => e.stopPropagation()}>
                                                        <div style={{ display: 'flex', gap: 5 }}>
                                                            <button onClick={() => setEditTrade(t)} className="btn-secondary journal-row-action" aria-label="Edit trade" title="Edit">✎</button>
                                                            <button onClick={() => handleDelete(t.id)} className="btn-danger journal-row-action" aria-label="Delete trade" title="Delete">✕</button>
                                                        </div>
                                                    </td>
                                                </tr>
                                                {exp && (
                                                    <tr id={`trade-details-${t.id}`} style={{ background: 'var(--bg-elevated)' }}>
                                                        <td colSpan={15} style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', borderLeft: '3px solid var(--accent)' }}>
                                                            <div className="form-columns journal-details" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                                                <div>
                                                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 8 }}>All Mistakes</div>
                                                                    {t.mistakes?.length
                                                                        ? <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>{t.mistakes.map(m => <span key={m} style={{ padding: '3px 9px', borderRadius: 6, fontSize: 12, background: 'rgba(217,125,125,0.12)', color: 'var(--red)', border: '1px solid rgba(217,125,125,0.2)' }}>{m}</span>)}</div>
                                                                        : <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>No mistakes logged.</span>}
                                                                </div>
                                                                <div>
                                                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 8 }}>Per-trade checklist{t.fees != null ? ` · fees ${money(t.fees, currency, { signed: false })}` : ''}</div>
                                                                    {isPlanned(t)
                                                                        ? <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 12px', display: 'grid', gap: 4 }}>{t.checklist.items.map(item => <li key={item} style={{ fontSize: 12.5, color: t.checklist.checked.includes(item) ? 'var(--text-primary)' : 'var(--text-muted)' }}>{t.checklist.checked.includes(item) ? '✓' : '○'} {item}</li>)}</ul>
                                                                        : <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 12 }}>Unplanned: no checklist was run. You can fill it in from Edit.</p>}
                                                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 8 }}>Emotional Notes</div>
                                                                    <p style={{ color: 'var(--text-primary)', fontSize: 13, lineHeight: 1.6 }}>{t.emotional_notes || <span style={{ color: 'var(--text-muted)' }}>No notes.</span>}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </Fragment>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
            {editTrade && <EditTradeModal trade={editTrade} onClose={() => setEditTrade(null)} onSave={u => { setTrades(p => p.map(t => t.id === u.id ? u : t)); setEditTrade(null) }} />}
        </div>
    )
}
