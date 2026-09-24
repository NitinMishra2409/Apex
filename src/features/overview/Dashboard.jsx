import { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { ArrowRight, ArrowUpRight, Info, Sun, Check, BookOpen, ChartNoAxesCombined, ChevronDown, Phone } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../auth/useAuth'
import { getTradesAndStats } from '../trades/repository'
import { computeTradeStats } from '../../domain/journal/statistics'
import { getChecklistSummary, saveDailyProgress } from '../checklists/repository'
import { formatSymbol } from '../../domain/trades/symbols'
import { chartSeries, filterPeriod, money, shortDate, weeklyRhythm, compactMoney } from '../../domain/journal/reporting'
import useReducedMotion from '../../shared/hooks/useReducedMotion'

const Bone = ({ height = 24 }) => <div className="skeleton" style={{ height }} />
const MODES = ['cumulative', 'daily', 'weekly', 'monthly']
function ChartTooltip({ active, payload }) {
    if (!active || !payload?.length) return null
    const point = payload[0].payload
    return <div className="studio-chart-tooltip"><small>{point.label || point.day}</small><strong className={point.pnl >= 0 ? 'positive' : 'negative'}>{money(point.pnl)}</strong></div>
}
function Sparkline({ points }) {
    if (points.length < 2) return null
    const values = points.map(p => p.pnl)
    const lo = Math.min(...values), span = Math.max(...values) - lo || 1
    const line = values.map((v, i) => `${i / (values.length - 1) * 180},${36 - (v - lo) / span * 30}`).join(' ')
    return <svg className="stat-sparkline" viewBox="0 0 180 40" aria-hidden="true"><polyline points={line} fill="none" stroke="var(--green)" strokeWidth="1" /></svg>
}
function TinyBars({ data }) {
    const max = Math.max(1, ...data.map(d => Math.abs(d.pnl)))
    return <div className="tiny-bars" aria-hidden="true">{data.map((d, i) => <i key={i} style={{ height: `${Math.max(12, Math.abs(d.pnl) / max * 100)}%` }} />)}</div>
}
function Metric({ label, value, detail, children, featured = false, positive, loading }) {
    return <div className={`studio-metric ${featured ? 'featured-metric' : ''}`}>
        <div className="studio-metric-label">{label}<Info size={13} /></div>
        <div className="studio-metric-body">{loading ? <Bone height={36} /> : <strong key={String(value)} className={`metric-number ${positive === undefined ? '' : positive ? 'positive' : 'negative'}`}>{value}</strong>}{detail && <span className="studio-metric-detail">{detail}</span>}{children}</div>
    </div>
}
function Instrument({ symbol }) {
    const asset = symbol || 'BTCUSDT'
    const ticker = asset.replace(/USDT$|USD$|USDC$/, '')
    return <span className="studio-instrument"><span className={`asset-icon asset-${ticker.toLowerCase()}`}>{ticker === 'BTC' ? '₿' : ticker === 'ETH' ? 'Ξ' : ticker === 'SOL' ? '≋' : ticker[0]}</span>{formatSymbol(asset)}</span>
}

export default function Dashboard() {
    const { user } = useAuth()
    const [params] = useSearchParams()
    const period = params.get('period') || 'all'
    const [trades, setTrades] = useState([])
    const [checklists, setChecklists] = useState({})
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [mode, setMode] = useState('cumulative')
    const [week, setWeek] = useState('current')
    const [focus, setFocus] = useState('premarket')
    const [saving, setSaving] = useState(false)
    const [reload, setReload] = useState(0)
    const reducedMotion = useReducedMotion()
    useEffect(() => {
        if (!user) return
        let alive = true
        setLoading(true); setError('')
        Promise.all([getTradesAndStats(user.id), getChecklistSummary(user.id)]).then(([data, lists]) => {
            if (alive) { setTrades(data.trades); setChecklists(lists) }
        }).catch(() => { if (alive) setError('Your workspace could not be loaded. Please try again.') }).finally(() => { if (alive) setLoading(false) })
        return () => { alive = false }
    }, [user, reload])
    const filtered = useMemo(() => filterPeriod(trades, period), [trades, period])
    const stats = useMemo(() => computeTradeStats(filtered), [filtered])
    const series = useMemo(() => chartSeries(filtered, mode), [filtered, mode])
    const equity = useMemo(() => chartSeries(filtered), [filtered])
    const rhythm = useMemo(() => weeklyRhythm(trades, week === 'previous'), [trades, week])
    const daily = useMemo(() => chartSeries(filtered, 'daily').slice(-7), [filtered])
    const bestSetup = Object.entries(stats.setupPerformance).sort((a, b) => b[1].totalPnl - a[1].totalPnl)[0]
    const strongestDay = rhythm.filter(d => d.count).sort((a, b) => b.pnl - a.pnl)[0]
    const focusList = checklists[focus] || { items: [], checked: [] }
    const done = focusList.items.filter(item => focusList.checked.includes(item)).length
    const firstDate = equity[0]?.date, lastDate = equity.at(-1)?.date
    const dateRange = firstDate ? `${shortDate(firstDate)}, ${new Date(firstDate).getFullYear()} – ${shortDate(lastDate)}, ${new Date(lastDate).getFullYear()}` : 'Your recorded trades'
    const hour = new Date().getHours()
    // The zero crossing separates positive and negative portions without inventing data.
    const min = Math.min(0, ...series.map(p => p.pnl)), max = Math.max(0, ...series.map(p => p.pnl))
    const zeroOffset = max === min ? 1 : max / (max - min)
    const toggleFocus = async item => {
        if (saving) return
        const previous = focusList.checked
        const next = previous.includes(item) ? previous.filter(v => v !== item) : [...previous, item]
        setSaving(true)
        setChecklists(lists => ({ ...lists, [focus]: { ...lists[focus], checked: next } }))
        try { await saveDailyProgress(user.id, focus, next) }
        catch { setChecklists(lists => ({ ...lists, [focus]: { ...lists[focus], checked: previous } })); toast.error('Checklist could not be saved. Please try again.') }
        finally { setSaving(false) }
    }
    return <div className="studio-dashboard">
        <section className="studio-hero">
            <div className="studio-greeting"><Sun size={20} /><span>Good {hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'}</span></div>
            <h1>Your trading, at a glance.</h1>
            <p>Journal. Learn. Improve. A more disciplined you.</p>
            <blockquote>“Better decisions<br />today. A stronger<br />tomorrow.”<cite><span />Apex Log</cite></blockquote>
        </section>
        {error && <div className="error-banner" role="alert">{error}<button className="btn-secondary" onClick={() => setReload(v => v + 1)}>Try again</button></div>}
        <section className="studio-stats" aria-label="Performance summary">
            <Metric featured label="Net P&L" value={money(stats.totalPnl)} positive={stats.totalPnl >= 0} detail={`${stats.wins} winning · ${stats.losses} losing trades`} loading={loading}><Sparkline points={equity} /></Metric>
            <Metric label="Win rate" value={`${stats.winRate}%`} loading={loading}><span className="stat-ring" style={{ '--ring': `${stats.winRate}%` }} aria-hidden="true" /></Metric>
            <Metric label="Profit factor" value={stats.totalTrades ? stats.profitFactor : '—'} loading={loading}><TinyBars data={daily} /></Metric>
            <Metric label="Total trades" value={stats.totalTrades} loading={loading}><TinyBars data={daily} /></Metric>
            <div className="studio-stat-note">Small edges.<br />Real progress.</div>
        </section>
        <div className="studio-dashboard-grid">
            <div className="studio-main-column">
                <section className="studio-panel studio-equity">
                    <div className="studio-panel-heading"><div><h2>Equity curve <Info size={15} /></h2><p>{mode === 'cumulative' ? 'Cumulative P&L' : `${mode[0].toUpperCase()}${mode.slice(1)} P&L`} · {dateRange}</p></div>
                        <div className="studio-segments" role="group" aria-label="Chart grouping">{MODES.map(item => <button key={item} aria-pressed={mode === item} className={mode === item ? 'active' : ''} onClick={() => setMode(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}</div>
                    </div>
                    {loading ? <Bone height={285} /> : series.length === 0 ? <div className="empty-state"><ChartNoAxesCombined size={30} /><h3>Your next chapter starts here.</h3><p>Log a completed trade to see your performance.</p><Link to="/new-trade">Log a trade <ArrowRight size={14} /></Link></div> : <div className="studio-equity-chart" aria-label={`${mode} profit and loss chart`}>
                        <ResponsiveContainer width="100%" height="100%"><AreaChart data={series} margin={{ top: 24, right: 14, left: 0, bottom: 4 }}>
                            <defs><linearGradient id="studioStroke" x1="0" y1="0" x2="0" y2="1"><stop offset={zeroOffset} stopColor="var(--accent)" /><stop offset={zeroOffset} stopColor="var(--red)" /></linearGradient><linearGradient id="studioFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity={.27} /><stop offset="100%" stopColor="var(--accent)" stopOpacity={.015} /></linearGradient></defs>
                            <CartesianGrid stroke="var(--border-subtle)" vertical strokeOpacity={.75} />
                            <XAxis dataKey="index" tickFormatter={i => series[i]?.label || ''} minTickGap={40} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} tickLine={false} axisLine={false} dy={8} />
                            <YAxis tickFormatter={v => v.toLocaleString('en-US')} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} tickLine={false} axisLine={false} width={46} domain={['auto', 'auto']} />
                            <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#9dabc44d', strokeDasharray: '3 3' }} />
                            <ReferenceLine y={0} stroke="#b1b5c166" strokeDasharray="4 4" />
                            <Area key={`${mode}-${period}`} type="monotone" dataKey="pnl" stroke="url(#studioStroke)" fill="url(#studioFill)" strokeWidth={1.8} dot={series.length === 1 ? { r: 4, fill: 'var(--accent)' } : false} activeDot={{ r: 4, stroke: '#ffd894', strokeWidth: 2, fill: 'var(--accent)' }} isAnimationActive={!reducedMotion} animationDuration={550} />
                        </AreaChart></ResponsiveContainer>
                        <div className="chart-ending"><small>{shortDate(series.at(-1).date)}</small><strong>{money(series.at(-1).pnl)}</strong><span /></div>
                    </div>}
                </section>
                <section className="studio-panel studio-trades">
                    <div className="studio-panel-heading"><h2>Recent trades</h2><Link to="/log" className="text-link">View all trades <ArrowRight size={15} /></Link></div>
                    {loading ? <Bone height={230} /> : !filtered.length ? <div className="empty-state"><BookOpen size={28} /><p>No trades in this period.</p><Link to="/new-trade">Log your first trade</Link></div> : <div className="studio-table-scroll"><table className="studio-trade-table"><thead><tr>{['Date / Time', 'Symbol', 'Side', 'Entry', 'Exit', 'P&L', 'R:R', 'Setup', ''].map((h, i) => <th key={i} scope="col">{h}</th>)}</tr></thead><tbody>{filtered.slice(0, 5).map(t => <tr key={t.id}>
                        <td>{new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}<small>{new Date(t.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</small></td>
                        <td><Link to={`/log?trade=${encodeURIComponent(t.id)}`}><Instrument symbol={t.symbol} /></Link></td>
                        <td className={t.direction === 'LONG' ? 'positive' : 'negative'}>{t.direction === 'LONG' ? 'Long' : 'Short'}</td>
                        <td>{t.entry?.toLocaleString('en-US', { maximumFractionDigits: 2 }) ?? '—'}</td><td>{t.exit_price?.toLocaleString('en-US', { maximumFractionDigits: 2 }) ?? '—'}</td>
                        <td className={t.pnl == null ? '' : t.pnl >= 0 ? 'positive' : 'negative'}>{t.pnl == null ? 'Open' : money(t.pnl)}</td><td className="positive">{t.rr == null ? '—' : `1:${t.rr}`}</td><td className="studio-setup" title={t.setup_type}>{t.setup_type || '—'}</td>
                        <td><Link className="trade-open" to={`/log?trade=${encodeURIComponent(t.id)}`} aria-label={`Review ${formatSymbol(t.symbol || 'BTCUSDT')} trade from ${shortDate(t.date)}`}><ArrowUpRight size={15} /></Link></td>
                    </tr>)}</tbody></table></div>}
                </section>
            </div>
            <div className="studio-side-column">
                <section className="studio-review-card">
                    <img className="studio-prism" src="/images/studio-prism.png" alt="" aria-hidden="true" />
                    <div className="studio-review-content"><h2>Review your session</h2><p className="review-subtitle">Turn trades into insights.</p>
                        <div className="review-metrics"><div><strong>{loading ? '—' : stats.totalTrades}</strong><small>Total trades</small></div><div><strong>{loading ? '—' : `${stats.winRate}%`}</strong><small>Win rate</small></div><div><strong>{loading ? '—' : stats.profitFactor}</strong><small>Profit factor</small></div></div>
                        <p className="review-observation">{loading ? 'Loading your journal…' : bestSetup ? <><strong>{bestSetup[0]}</strong> has your highest net P&L at {money(bestSetup[1].totalPnl)}. Review the entries behind that result.</> : 'Every entry adds perspective. Log your trades to start uncovering patterns in your decisions.'}</p>
                        <Link to={`/coach?period=${encodeURIComponent(period)}`} className="btn-primary">Review session <ArrowRight size={17} /></Link>
                        <Link to={`/coach?period=${encodeURIComponent(period)}&call=expert`} className="text-link" style={{ marginTop: 14, display: 'flex', gap: 8, fontSize: 12 }}><Phone size={14} />Call an expert <span style={{ fontSize: 10, opacity: .7 }}>· AI coach</span></Link>
                    </div>
                </section>
                <section className="studio-panel studio-focus">
                    <div className="studio-panel-heading"><h2>Today’s focus</h2><span aria-live="polite">{done}/{focusList.items.length} complete</span></div>
                    <label className="focus-picker"><select aria-label="Checklist session" value={focus} disabled={saving} onChange={e => setFocus(e.target.value)}><option value="premarket">Pre-market preparation</option><option value="during">During your session</option><option value="posttrade">Post-trade reflection</option></select><ChevronDown size={12} /></label>
                    {loading ? <Bone height={100} /> : focusList.items.length ? <div className="focus-items">{focusList.items.map(item => <label className="focus-item" key={item}><input type="checkbox" checked={focusList.checked.includes(item)} disabled={saving} onChange={() => toggleFocus(item)} /><span className="focus-check"><Check size={12} strokeWidth={3} /></span><span>{item}</span></label>)}</div> : <p className="focus-empty">Start with a routine. <Link to="/checklists">Set up your playbooks <ArrowRight size={12} /></Link></p>}
                </section>
                <section className="studio-panel studio-rhythm">
                    <div className="studio-panel-heading"><div><h2>Weekly rhythm <Info size={13} /></h2><p>Net P&L by day</p></div><select aria-label="Weekly rhythm period" value={week} onChange={e => setWeek(e.target.value)}><option value="current">This week</option><option value="previous">Last week</option></select></div>
                    {loading ? <Bone height={110} /> : <div className="rhythm-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={rhythm} margin={{ top: 18, right: 8, left: 8, bottom: 0 }}><defs><linearGradient id="amberBar" x1="0" x2="1" y1="0" y2="0"><stop offset="0%" stopColor="#9c6522" /><stop offset="35%" stopColor="#f4bf6c" /><stop offset="100%" stopColor="#c18738" /></linearGradient><linearGradient id="lossBar" x1="0" x2="1"><stop stopColor="#85434d" /><stop offset="100%" stopColor="#ef8b8b" /></linearGradient></defs><XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 9 }} /><ReferenceLine y={0} stroke="#79818c66" /><Tooltip content={<ChartTooltip />} cursor={{ fill: '#ffffff04' }} /><Bar dataKey="pnl" barSize={24} radius={[3, 3, 0, 0]} isAnimationActive={!reducedMotion} animationDuration={450} label={{ position: 'top', formatter: compactMoney, fill: 'var(--text-primary)', fontSize: 9 }}>{rhythm.map(d => <Cell key={d.day} fill={d.pnl < 0 ? 'url(#lossBar)' : 'url(#amberBar)'} stroke={d.pnl < 0 ? '#df8383' : '#ffd698'} strokeWidth={.6} />)}</Bar></BarChart></ResponsiveContainer></div>}
                    <div className="rhythm-caption">{strongestDay ? <>Highest net P&L on <strong>{strongestDay.day}</strong> · {money(strongestDay.pnl)}</> : 'Your next trade starts this week’s story.'}</div>
                </section>
            </div>
        </div>
        <footer className="studio-dashboard-footer"><span>Stay disciplined. Good traders keep records.</span><span>All P&L values in USDT · Based on your journal</span></footer>
    </div>
}
