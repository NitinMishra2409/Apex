import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { useAuth } from '../auth/useAuth'
import { getTradesAndStats } from '../trades/repository'

const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'
const Bone = ({ w = '100%', h = 16 }) => <div style={{ width: w, height: h, borderRadius: 4 }} className="skeleton" />

const Section = ({ title, children, style = {} }) => (
    <div className="card" style={{ padding: 24, marginBottom: '1.1rem', ...style }}>
        <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-primary)', marginBottom: 20 }}>{title}</div>
        {children}
    </div>
)

const DarkTip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: typeof payload[0].value === 'number' && payload[0].value < 0 ? 'var(--red)' : 'var(--green)' }}>
                {payload[0].name === 'count' ? payload[0].value : `${payload[0].value >= 0 ? '+' : ''}$${Number(payload[0].value).toFixed(2)}`}
            </div>
        </div>
    )
}

function MistakesSection({ freq, pnlByDay, loading }) {
    if (loading) return <Section title="Mistakes Analysis"><Bone h={200} /></Section>
    const data = Object.entries(freq ?? {}).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
    if (!data.length) return <Section title="Mistakes Analysis"><p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No mistakes logged yet.</p></Section>
    const top = data[0]
    const worstDay = pnlByDay ? Object.entries(pnlByDay).sort((a, b) => a[1] - b[1])[0]?.[0] : null
    return (
        <Section title="Mistakes Analysis">
            <div style={{ background: 'rgba(217,125,125,0.08)', border: '1px solid rgba(217,125,125,0.2)', borderRadius: 8, padding: '0.9rem 1.1rem', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1.3rem' }}>⚠️</span>
                <div>
                    <span style={{ color: 'var(--red)', fontWeight: 700, fontSize: 14 }}>#{1} Mistake: {top.name}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 13 }}> — {top.count} times</span>
                    {worstDay && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Lowest net P&L on <strong style={{ color: 'var(--text-primary)' }}>{worstDay}</strong>.</div>}
                </div>
            </div>
            <ResponsiveContainer width="100%" height={Math.max(160, data.length * 36)}>
                <BarChart data={data} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
                    <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={150} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip content={<DarkTip />} />
                    <Bar dataKey="count" name="count" radius={[0, 4, 4, 0]}>
                        {data.map((_, i) => <Cell key={i} fill={i === 0 ? 'var(--red)' : `rgba(217,125,125,${0.7 - i * 0.08})`} />)}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </Section>
    )
}

function SetupSection({ performance, loading }) {
    if (loading) return <Section title="Setup Performance"><Bone h={140} /></Section>
    const rows = Object.entries(performance ?? {}).map(([setup, s]) => ({ setup, ...s }))
    if (!rows.length) return <Section title="Setup Performance"><p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Log trades with setup types to see breakdown.</p></Section>
    const best = rows.reduce((a, b) => b.winRate > a.winRate ? b : a)
    const worst = rows.reduce((a, b) => b.winRate < a.winRate ? b : a)
    return (
        <Section title="Setup Performance">
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                🏆 <span style={{ color: 'var(--green)', fontWeight: 600 }}>{best.setup}</span> leads with <strong style={{ color: 'var(--green)' }}>{best.winRate}%</strong> win rate
            </div>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>{['Setup', 'Trades', 'Win Rate', 'Avg RR', 'P&L'].map(h => (
                            <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}</tr>
                    </thead>
                    <tbody>
                        {rows.sort((a, b) => b.winRate - a.winRate).map(r => {
                            const isBest = r.setup === best.setup
                            const isWorst = r.setup === worst.setup && rows.length > 1
                            return (
                                <tr key={r.setup} style={{ borderLeft: `3px solid ${isBest ? 'var(--green)' : isWorst ? 'var(--red)' : 'transparent'}` }}>
                                    <td style={{ padding: '10px', fontSize: 13, borderBottom: '1px solid var(--border-subtle)', fontWeight: isBest ? 600 : 400 }}>{r.setup}</td>
                                    <td style={{ padding: '10px', fontSize: 13, borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>{r.wins + r.losses}</td>
                                    <td style={{ padding: '10px', fontSize: 13, borderBottom: '1px solid var(--border-subtle)', fontWeight: 600, color: r.winRate >= 50 ? 'var(--green)' : 'var(--red)' }}>{r.winRate}%</td>
                                    <td style={{ padding: '10px', fontSize: 13, borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>{r.avgRR ? `1:${r.avgRR}` : '—'}</td>
                                    <td style={{ padding: '10px', fontSize: 13, borderBottom: '1px solid var(--border-subtle)', fontWeight: 600, color: r.totalPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>{r.totalPnl >= 0 ? '+' : ''}${r.totalPnl.toFixed(2)}</td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </Section>
    )
}

function DaySection({ pnlByDay, loading }) {
    if (loading) return <Section title="P&L by Day of Week"><Bone h={180} /></Section>
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const data = days.map(d => ({ day: d, pnl: pnlByDay?.[d] ?? 0 }))
    const best = data.reduce((a, b) => b.pnl > a.pnl ? b : a)
    return (
        <Section title="P&L by Day of Week">
            {best.pnl !== 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>📅 Best day: <span style={{ color: 'var(--green)', fontWeight: 600 }}>{best.day}</span></div>}
            <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                    <XAxis dataKey="day" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} width={55} />
                    <Tooltip content={<DarkTip />} />
                    <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                        {data.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? 'var(--green)' : 'var(--red)'} fillOpacity={0.9} />)}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </Section>
    )
}

const PIE_COLORS = { WIN: 'var(--green)', LOSS: 'var(--red)', BE: 'var(--yellow)' }
function PieSection({ stats, loading }) {
    if (loading) return <Section title="Win / Loss Distribution"><Bone h={220} /></Section>
    const { wins = 0, losses = 0, totalTrades = 0 } = stats ?? {}
    const be = totalTrades - wins - losses
    const data = [{ name: 'WIN', value: wins }, { name: 'LOSS', value: losses }, ...(be > 0 ? [{ name: 'BE', value: be }] : [])].filter(d => d.value > 0)

    if (!data.length) return <Section title="Win / Loss Distribution"><p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No completed trades yet.</p></Section>

    return (
        <Section title="Win / Loss Distribution" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={90}
                            paddingAngle={4}
                            dataKey="value"
                            stroke="none"
                        >
                            {data.map((d, i) => <Cell key={i} fill={PIE_COLORS[d.name]} />)}
                        </Pie>
                        <Tooltip
                            formatter={(v, n) => [v, n]}
                            contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}
                        />
                        <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{ paddingTop: 20 }} formatter={(v) => <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500 }}>{v}</span>} />
                    </PieChart>
                </ResponsiveContainer>
                <div style={{ textAlign: 'center', marginTop: 15 }}>
                    <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--green)', lineHeight: 1 }}>{stats?.winRate ?? 0}%</div>
                    <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginTop: 4 }}>win rate</div>
                </div>
            </div>
        </Section>
    )
}

function TradeCard({ trade, type }) {
    const color = type === 'best' ? 'var(--green)' : 'var(--red)'
    const emoji = type === 'best' ? '🏆' : '⚠️'

    if (!trade) {
        return (
            <div className="card" style={{ flex: 1, borderLeft: `3px solid var(--border)`, padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 24, marginBottom: 8, opacity: 0.5 }}>📊</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Not enough data yet</div>
                </div>
            </div>
        )
    }

    return (
        <div className="card" style={{ flex: 1, borderLeft: `3px solid ${color}`, padding: 24 }}>
            <div style={{ fontSize: 11, color, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 16 }}>{emoji} {type === 'best' ? 'Best' : 'Worst'} Trade</div>
            <div className="form-columns" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem 1.25rem', marginBottom: 16 }}>
                {[
                    ['Date', fmtDate(trade.date)], ['Direction', trade.direction],
                    ['Entry', trade.entry?.toFixed(2)], ['Exit', trade.exit_price?.toFixed(2) ?? '—'],
                    ['RR', trade.rr ? `1:${trade.rr}` : '—'],
                    ['P&L', trade.pnl != null ? `${trade.pnl >= 0 ? '+' : ''}$${trade.pnl.toFixed(2)}` : '—'],
                ].map(([label, val]) => (
                    <div key={label}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: label === 'P&L' ? (trade.pnl >= 0 ? 'var(--green)' : 'var(--red)') : label === 'Direction' ? (trade.direction === 'LONG' ? 'var(--green)' : 'var(--red)') : 'var(--text-primary)' }}>{val}</div>
                    </div>
                ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {trade.setup_type && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Setup: <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{trade.setup_type}</span></div>}
                {trade.mistakes?.length > 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Mistakes: <span style={{ color: 'var(--red)' }}>{trade.mistakes.join(', ')}</span></div>}
                {trade.emotional_notes && <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.6, marginTop: 4, padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 8 }}>"{trade.emotional_notes}"</div>}
            </div>
        </div>
    )
}

function Heatmap({ trades, loading }) {
    if (loading) return <Section title="Monthly P&L Heatmap"><Bone h={180} /></Section>
    const now = new Date(), year = now.getFullYear(), month = now.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const firstDow = new Date(year, month, 1).getDay()
    const monthName = now.toLocaleString('default', { month: 'long', year: 'numeric' })
    const pnlMap = {}
    for (const t of trades) {
        const d = t.date?.split('T')[0]; if (!d) continue
        pnlMap[d] = (pnlMap[d] ?? 0) + (t.pnl ?? 0)
    }
    const maxAbs = Math.max(1, ...Object.values(pnlMap).map(Math.abs))
    const offset = firstDow === 0 ? 6 : firstDow - 1
    const cells = [...Array(offset).fill(null)]
    for (let d = 1; d <= daysInMonth; d++) {
        const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        cells.push({ day: d, pnl: pnlMap[key] ?? null, key })
    }
    const todayKey = new Date().toISOString().split('T')[0]
    return (
        <Section title={`Monthly P&L Heatmap — ${monthName}`}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <div key={i} style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, paddingBottom: 4 }}>{d}</div>)}
                {cells.map((cell, i) => {
                    if (!cell) return <div key={`e${i}`} />
                    const { day, pnl, key } = cell
                    const isToday = key === todayKey
                    const intensity = pnl !== null && pnl !== 0 ? Math.min(0.85, 0.2 + (Math.abs(pnl) / maxAbs) * 0.65) : 0
                    const bg = pnl !== null && pnl !== 0 ? (pnl > 0 ? `rgba(108,178,132,${intensity})` : `rgba(217,125,125,${intensity})`) : 'var(--bg-elevated)'
                    return (
                        <div key={key} title={pnl !== null ? `$${pnl.toFixed(2)}` : 'No trades'} style={{ aspectRatio: '1', borderRadius: 4, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', border: isToday ? '1px solid var(--accent)' : '1px solid transparent', cursor: 'default' }}>
                            <div style={{ fontSize: 10, fontWeight: isToday ? 700 : 400, color: pnl !== null && pnl !== 0 ? '#fff' : 'var(--text-muted)' }}>{day}</div>
                            {pnl !== null && pnl !== 0 && <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.8)', fontWeight: 600, lineHeight: 1.1 }}>{Math.abs(pnl) >= 1000 ? `${(pnl / 1000).toFixed(1)}k` : pnl.toFixed(0)}</div>}
                        </div>
                    )
                })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: 10, fontSize: 11, color: 'var(--text-muted)' }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(217,125,125,0.8)' }} /> Loss
                <div style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }} /> No trade
                <div style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(108,178,132,0.8)' }} /> Profit
            </div>
        </Section>
    )
}

export default function Analytics() {
    const { user } = useAuth()
    const [stats, setStats] = useState(null)
    const [trades, setTrades] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!user) return
        let alive = true
        // One fetch: stats are derived from the same trade list.
        getTradesAndStats(user.id)
            .then(({ trades, stats }) => {
                if (!alive) return
                setStats(stats); setTrades(trades); setLoading(false)
            })
            .catch(() => { if (alive) setLoading(false) })
        return () => { alive = false }
    }, [user])

    return (
        <div className="feature-page analytics-page" style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '1.5rem 1.25rem' }}>
            <div style={{ maxWidth: 1280, margin: '0 auto' }}>
                <div className="eyebrow">UNDERSTAND YOUR EDGE</div><h1 style={{ marginTop: 8 }}>Performance analytics<span className="heading-dot">.</span></h1><p className="page-subtitle">Explore your setups, review your mistakes, and see what drives your results.</p>
                <MistakesSection freq={stats?.mistakeFrequency} pnlByDay={stats?.pnlByDayOfWeek} loading={loading} />
                <div className="feature-columns" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '1.25rem', marginBottom: '1.25rem', alignItems: 'start' }}>
                    <SetupSection performance={stats?.setupPerformance} loading={loading} />
                    <DaySection pnlByDay={stats?.pnlByDayOfWeek} loading={loading} />
                    <PieSection stats={stats} loading={loading} />
                    <Heatmap trades={trades} loading={loading} />
                </div>
                {!loading && (stats?.bestTrade || stats?.worstTrade) && (
                    <Section title="Summary Highlights">
                        <div className="feature-flex" style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                            <TradeCard trade={stats.bestTrade} type="best" />
                            <TradeCard trade={stats.worstTrade} type="worst" />
                        </div>
                    </Section>
                )}
            </div>
        </div>
    )
}
