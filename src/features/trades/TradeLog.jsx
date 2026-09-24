import EditTradeModal from './EditTradeModal'
import { useState, useEffect, useMemo, Fragment } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../auth/useAuth'
import { getTrades, deleteTrade } from './repository'
import { SETUP_TYPES } from '../../domain/trades/vocabulary'
import { formatSymbol, symbolsInTrades } from '../../domain/trades/symbols'

const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'
const fmt = (n) => n == null ? '—' : Number(n).toFixed(2)

const TH = { padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', background: 'var(--bg-elevated)' }
const TD = { padding: '11px 12px', fontSize: 13, borderBottom: '1px solid var(--border-subtle)', whiteSpace: 'nowrap' }
const Bone = ({ w = '100%', h = 16, style = {} }) => <div style={{ width: w, height: h, borderRadius: 4, ...style }} className="skeleton" />

function Skeleton() {
    return <div style={{ padding: '1rem 0' }}>{[...Array(5)].map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 12, opacity: 1 - i * 0.15 }}>
            {[80, 55, 80, 80, 65, 65, 55, 75, 110, 55, 120, 70].map((w, j) => <Bone key={j} w={w} h={16} />)}
        </div>
    ))}</div>
}

// ── Edit Modal ──────────────────────────────────────────────────────────────
// ── Main ────────────────────────────────────────────────────────────────────
export default function TradeLog() {
    const { user } = useAuth()
    const [trades, setTrades] = useState([])
    const [loading, setLoading] = useState(true)
    const [expanded, setExpanded] = useState(() => new URLSearchParams(window.location.search).get('trade'))
    const [editTrade, setEditTrade] = useState(null)
    const [filters, setFilters] = useState({ result: 'All', direction: 'All', symbol: '', setup: '', from: '', to: '' })
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
        const cols = ['date', 'symbol', 'direction', 'entry', 'exit_price', 'sl', 'tp', 'size', 'rr', 'pnl', 'result', 'setup_type', 'mistakes', 'emotional_notes']
        const rows = filtered.map(t => cols.map(c => { const v = t[c]; if (v == null) return ''; if (Array.isArray(v)) return `"${v.join('; ')}"`; const s = String(v); return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s }).join(','))
        const blob = new Blob([[cols.join(','), ...rows].join('\n')], { type: 'text/csv' })
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'apexlog-trades.csv'; a.click()
    }

    const filterPillStyle = (active, color = 'var(--accent)') => ({
        padding: '5px 12px', borderRadius: 6, border: `1px solid ${active ? color : 'var(--border)'}`,
        background: active ? `color-mix(in srgb, ${color} 12%, transparent)` : 'transparent',
        color: active ? color : 'var(--text-secondary)',
        fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
    })

    return (
        <div className="feature-page tradelog-page" style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '1.5rem 1.25rem' }}>
            <style>{`select option{background:var(--bg-primary)} input[type="date"]::-webkit-calendar-picker-indicator{filter:invert(0.4);cursor:pointer} .trow:hover{background:var(--bg-hover)!important}`}</style>
            <div style={{ maxWidth: 1280, margin: '0 auto' }}>
                <div className="journal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <div><div className="eyebrow">EVERY TRADE TELLS A STORY</div><h1 style={{ marginTop: 8 }}>Trade journal<span className="heading-dot">.</span></h1><p className="page-subtitle" style={{ marginBottom: 0 }}>Your decisions, documented. Your progress, in perspective.</p></div>
                    <button onClick={exportCSV} className="btn-secondary" style={{ fontSize: 12, padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>↓ Export CSV</button>
                </div>

                {/* Filter bar */}
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0.9rem 1.1rem', marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center' }}>
                    {['All', 'WIN', 'LOSS', 'BE'].map(r => (
                        <button key={r} onClick={() => setF('result', r)} style={filterPillStyle(filters.result === r, r === 'WIN' ? 'var(--green)' : r === 'LOSS' ? 'var(--red)' : r === 'BE' ? 'var(--yellow)' : 'var(--accent)')}>{r}</button>
                    ))}
                    <div style={{ width: 1, height: 18, background: 'var(--border)' }} />
                    {['All', 'LONG', 'SHORT'].map(d => (
                        <button key={d} onClick={() => setF('direction', d)} style={filterPillStyle(filters.direction === d, d === 'LONG' ? 'var(--green)' : d === 'SHORT' ? 'var(--red)' : 'var(--accent)')}>{d}</button>
                    ))}
                    <div style={{ width: 1, height: 18, background: 'var(--border)' }} />
                    <select aria-label="Filter by asset" value={filters.symbol} onChange={e => setF('symbol', e.target.value)} style={{ padding: '5px 10px', fontSize: 12, cursor: 'pointer', borderRadius: 6 }}>
                        <option value="">All Assets</option>
                        {assets.map(({ symbol, count }) => (
                            <option key={symbol} value={symbol}>{formatSymbol(symbol)} ({count})</option>
                        ))}
                    </select>
                    <select aria-label="Filter by setup" value={filters.setup} onChange={e => setF('setup', e.target.value)} style={{ padding: '5px 10px', fontSize: 12, cursor: 'pointer', borderRadius: 6 }}>
                        <option value="">All Setups</option>
                        {SETUP_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <input aria-label="From date" type="date" value={filters.from} onChange={e => setF('from', e.target.value)} style={{ padding: '5px 9px', fontSize: 12, borderRadius: 6 }} />
                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>→</span>
                    <input aria-label="To date" type="date" value={filters.to} onChange={e => setF('to', e.target.value)} style={{ padding: '5px 9px', fontSize: 12, borderRadius: 6 }} />
                    <button onClick={() => setFilters({ result: 'All', direction: 'All', symbol: '', setup: '', from: '', to: '' })} className="btn-secondary" style={{ fontSize: 12, padding: '5px 12px' }}>Clear</button>
                    <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>Showing <strong style={{ color: 'var(--text-primary)' }}>{filtered.length}</strong> of {trades.length}</span>
                </div>

                {/* Stats summary */}
                {filtered.length > 0 && (
                    <div className="journal-summary" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                        {[
                            { label: 'Total P&L', val: `${stats.pnl >= 0 ? '+' : ''}$${stats.pnl.toFixed(2)}`, color: stats.pnl >= 0 ? 'var(--green)' : 'var(--red)' },
                            { label: 'Win Rate', val: stats.winRate ? `${stats.winRate}%` : '—', color: 'var(--text-primary)' },
                            { label: 'Trades', val: filtered.length, color: 'var(--text-primary)' },
                            { label: 'Avg RR', val: stats.avgRR ? `1:${stats.avgRR}` : '—', color: 'var(--text-primary)' },
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
                    <div style={{ textAlign: 'center', padding: '5rem 1rem' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📊</div>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '1.25rem', fontSize: 14 }}>
                            {trades.length === 0 ? 'No trades yet. Start logging your first trade.' : 'No trades match the current filters.'}
                        </p>
                        {trades.length === 0 && <Link to="/new-trade" className="btn-primary" style={{ textDecoration: 'none' }}>+ Log First Trade</Link>}
                    </div>
                ) : (
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>{['Date', 'Asset', 'Dir', 'Entry', 'Exit', 'SL', 'TP', 'RR', 'P&L', 'Setup', 'Result', 'Mistakes', 'Actions'].map(h => <th key={h} style={TH}>{h}</th>)}</tr>
                                </thead>
                                <tbody>
                                    {filtered.map(t => {
                                        const exp = expanded === t.id
                                        return (
                                            <Fragment key={t.id}>
                                                <tr className="trow" onClick={() => setExpanded(exp ? null : t.id)}
                                                    style={{ cursor: 'pointer', background: exp ? 'var(--bg-hover)' : 'transparent', transition: 'background 0.12s' }}>
                                                    <td style={TD}>{fmtDate(t.date)}</td>
                                                    <td style={{ ...TD, whiteSpace: 'nowrap' }}>{t.symbol ? formatSymbol(t.symbol) : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                                                    <td style={TD}><span className={t.direction === 'LONG' ? 'badge-long' : 'badge-short'}>{t.direction}</span></td>
                                                    <td style={TD}>{fmt(t.entry)}</td>
                                                    <td style={{ ...TD, color: 'var(--text-secondary)' }}>{t.exit_price != null ? fmt(t.exit_price) : '—'}</td>
                                                    <td style={{ ...TD, color: 'var(--text-secondary)' }}>{t.sl != null ? fmt(t.sl) : '—'}</td>
                                                    <td style={{ ...TD, color: 'var(--text-secondary)' }}>{t.tp != null ? fmt(t.tp) : '—'}</td>
                                                    <td style={TD}>{t.rr != null ? `1:${fmt(t.rr)}` : '—'}</td>
                                                    <td style={{ ...TD, fontWeight: 600, color: t.pnl == null ? 'var(--text-muted)' : t.pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                                                        {t.pnl != null ? `${t.pnl >= 0 ? '+' : ''}$${fmt(t.pnl)}` : '—'}
                                                    </td>
                                                    <td style={{ ...TD, color: 'var(--text-muted)', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.setup_type || '—'}</td>
                                                    <td style={TD}>{t.result ? <span className={t.result === 'WIN' ? 'badge-win' : t.result === 'LOSS' ? 'badge-loss' : 'badge-be'}>{t.result}</span> : '—'}</td>
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
                                                            <button onClick={() => setEditTrade(t)} className="btn-secondary" style={{ padding: '4px 8px', fontSize: 12, minWidth: 'auto' }} title="Edit">✎</button>
                                                            <button onClick={() => handleDelete(t.id)} className="btn-danger" style={{ padding: '4px 8px', fontSize: 12, minWidth: 'auto', borderRadius: 'var(--radius-sm)' }} title="Delete">✕</button>
                                                        </div>
                                                    </td>
                                                </tr>
                                                {exp && (
                                                    <tr style={{ background: 'var(--bg-elevated)' }}>
                                                        <td colSpan={13} style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', borderLeft: '3px solid var(--accent)' }}>
                                                            <div className="form-columns" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                                                <div>
                                                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 8 }}>All Mistakes</div>
                                                                    {t.mistakes?.length
                                                                        ? <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>{t.mistakes.map(m => <span key={m} style={{ padding: '3px 9px', borderRadius: 6, fontSize: 12, background: 'rgba(217,125,125,0.12)', color: 'var(--red)', border: '1px solid rgba(217,125,125,0.2)' }}>{m}</span>)}</div>
                                                                        : <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>No mistakes logged.</span>}
                                                                </div>
                                                                <div>
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
