import { useMemo, useState } from 'react'
import { AreaChart, Area, BarChart, Bar, Cell, CartesianGrid, Line, ComposedChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { drawdown, expectancy, feeDrag, monteCarlo, planningSplit, tilt, timeHeatmap } from '../../../shared/journalAnalytics'
import { compactMoney, money, rateWithRange, shortDate } from '../../domain/journal/reporting'
import { Bone, MoneyTip, Section, Stat, StatGrid } from './analyticsUi'

const tone = value => value > 0 ? 'good' : value < 0 ? 'bad' : undefined

function Discipline({ trades, currency }) {
    const split = useMemo(() => planningSplit(trades), [trades])
    const { planned, unplanned, byCompletion } = split
    const gap = planned.closed && unplanned.closed ? planned.net / planned.closed - unplanned.net / unplanned.closed : null
    return (
        <Section title="Checklist discipline" subtitle="Planned trades had the per-trade checklist ticked; unplanned trades skipped it. Ranges show how sure we can be with this many trades.">
            <StatGrid>
                <Stat label="Planned" value={money(planned.net, currency)} tone={tone(planned.net)} hint={`${planned.closed} closed · win ${rateWithRange(planned.winRate)}`} />
                <Stat label="Unplanned" value={money(unplanned.net, currency)} tone={tone(unplanned.net)} hint={`${unplanned.closed} closed · win ${rateWithRange(unplanned.winRate)}`} />
                <Stat label="Per trade, planned vs unplanned" value={gap === null ? '—' : money(gap, currency)} tone={tone(gap)} hint="Average result difference" />
            </StatGrid>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {[['complete', 'All checks ticked'], ['mostly', 'Half or more'], ['partial', 'Under half']].map(([key, label]) => (
                    <div key={key} style={{ fontSize: 12, color: 'var(--text-muted)', borderLeft: '2px solid var(--border)', paddingLeft: 10 }}>
                        <div>{label}</div>
                        <strong style={{ color: byCompletion[key].net >= 0 ? 'var(--green)' : 'var(--red)', fontSize: 13 }}>{byCompletion[key].closed ? money(byCompletion[key].net, currency) : '—'}</strong>
                        <span> · {byCompletion[key].closed} trades</span>
                    </div>
                ))}
            </div>
        </Section>
    )
}

function MonteCarlo({ trades, currency, startingBalance }) {
    const [horizon, setHorizon] = useState(100)
    const sim = useMemo(() => monteCarlo(trades, { runs: 1000, horizon, startingBalance, ruinPct: 50, drawdownPct: 20 }), [trades, horizon, startingBalance])
    if (!sim.enough) return <Section title="Monte Carlo simulation"><p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Log at least 10 closed trades to simulate. You have {sim.sample}.</p></Section>
    const data = sim.bands.map(b => ({ step: b.step, outer: [b.p5, b.p95], inner: [b.p25, b.p75], median: b.p50 }))
    const base = startingBalance ? 'account value' : 'cumulative P&L'
    return (
        <Section title="Monte Carlo simulation" subtitle={`1,000 alternative futures built by reshuffling your own ${sim.sample} closed trades. A simulation of your past results, not a prediction of the market.`}>
            <div className="studio-segments" role="group" aria-label="Simulation length" style={{ marginBottom: 14 }}>
                {[50, 100, 200].map(n => <button key={n} aria-pressed={horizon === n} className={horizon === n ? 'active' : ''} onClick={() => setHorizon(n)}>Next {n} trades</button>)}
            </div>
            <StatGrid>
                <Stat label="Median outcome" value={money(sim.medianFinal - sim.start, currency)} tone={tone(sim.medianFinal - sim.start)} hint={`5–95%: ${compactMoney(sim.p5Final - sim.start, currency)} to ${compactMoney(sim.p95Final - sim.start, currency)}`} />
                <Stat label="Chance of finishing down" value={`${sim.probabilityOfLoss}%`} tone={sim.probabilityOfLoss > 30 ? 'bad' : undefined} />
                <Stat label="Typical worst drawdown" value={money(-sim.medianMaxDrawdown, currency)} tone="bad" hint="Median of each path's deepest dip" />
                {sim.riskOfRuin !== null
                    ? <Stat label={`Risk of losing ${sim.ruinPct}%`} value={`${sim.riskOfRuin}%`} tone={sim.riskOfRuin > 5 ? 'bad' : 'good'} hint={`Drawdown ≥ ${sim.drawdownPct}%: ${sim.probabilityOfDrawdown}% of paths`} />
                    : <Stat label="Risk of ruin" value="—" hint="Add a starting balance in Settings" />}
            </StatGrid>
            <p className="analytics-chart-summary">Median path ends at {money(sim.medianFinal, currency, { signed: base !== 'account value' })} {base}; the 5–95% range ends between {money(sim.p5Final, currency, { signed: base !== 'account value' })} and {money(sim.p95Final, currency, { signed: base !== 'account value' })}.</p>
            <div style={{ height: 260 }} aria-label={`Simulated ${base} over the next ${horizon} trades`}>
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
                        <XAxis dataKey="step" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} />
                        <YAxis tickFormatter={v => compactMoney(v, currency)} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} width={72} domain={['auto', 'auto']} />
                        <Tooltip content={<MoneyTip currency={currency} labelFormatter={s => `After ${s} trades`} />} />
                        <ReferenceLine y={sim.start} stroke="var(--text-muted)" strokeDasharray="4 4" />
                        <Area dataKey="outer" name="5–95%" stroke="none" fill="var(--accent)" fillOpacity={0.12} isAnimationActive={false} />
                        <Area dataKey="inner" name="25–75%" stroke="none" fill="var(--accent)" fillOpacity={0.25} isAnimationActive={false} />
                        <Line dataKey="median" name="Median" stroke="var(--accent)" strokeWidth={2} dot={false} isAnimationActive={false} />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </Section>
    )
}

function Drawdown({ trades, currency, startingBalance }) {
    const dd = useMemo(() => drawdown(trades, startingBalance), [trades, startingBalance])
    if (!dd.underwater.length) return null
    const pct = startingBalance ? v => ` (${v}%)` : () => ''
    return (
        <Section title="Drawdown" subtitle="How far your closed-trade equity fell below its previous high, trade by trade.">
            <StatGrid>
                <Stat label="Deepest drawdown" value={`${money(-dd.max, currency)}${pct(dd.maxPct)}`} tone={dd.max ? 'bad' : undefined} hint={dd.maxAt ? `Low point ${shortDate(dd.maxAt)}` : undefined} />
                <Stat label="Current drawdown" value={dd.current ? `${money(-dd.current, currency)}${pct(dd.currentPct)}` : 'At a new high'} tone={dd.current ? 'bad' : 'good'} />
                <Stat label="Longest stretch below a high" value={`${dd.longestUnderwaterTrades} trades`} />
            </StatGrid>
            <div style={{ height: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dd.underwater.map((p, i) => ({ ...p, i }))} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
                        <XAxis dataKey="i" tickFormatter={i => dd.underwater[i] ? shortDate(dd.underwater[i].date) : ''} minTickGap={40} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} />
                        <YAxis tickFormatter={v => compactMoney(v, currency)} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} width={72} />
                        <Tooltip content={<MoneyTip currency={currency} labelFormatter={i => dd.underwater[i] ? shortDate(dd.underwater[i].date) : ''} />} />
                        <Area dataKey="drawdown" name="Drawdown" stroke="var(--red)" fill="var(--red)" fillOpacity={0.2} isAnimationActive={false} />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </Section>
    )
}

function Expectancy({ trades }) {
    const e = useMemo(() => expectancy(trades), [trades])
    if (!e.n) return <Section title="Expectancy in R"><p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Add a stop loss and units to your trades to measure results in R (multiples of what you risked).</p></Section>
    const sqnLabel = e.sqn === null ? '—' : e.sqn >= 3 ? 'Excellent' : e.sqn >= 2 ? 'Good' : e.sqn >= 1 ? 'Average' : e.sqn >= 0 ? 'Weak' : 'Losing'
    return (
        <Section title="Expectancy in R" subtitle="R = your result divided by what you risked to the stop. +1R means you made what you risked.">
            <StatGrid>
                <Stat label="Average R per trade" value={`${e.averageR > 0 ? '+' : ''}${e.averageR}R`} tone={tone(e.averageR)} hint={`${e.n} trades with a stop`} />
                <Stat label="System quality (SQN)" value={e.sqn ?? '—'} hint={sqnLabel} />
            </StatGrid>
            <div style={{ height: 170 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={e.histogram} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
                        <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} tickLine={false} axisLine={false} minTickGap={12} />
                        <YAxis allowDecimals={false} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} width={28} />
                        <Tooltip cursor={{ fill: '#ffffff08' }} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                        <Bar dataKey="count" name="Trades" radius={[3, 3, 0, 0]} isAnimationActive={false}>{e.histogram.map(b => <Cell key={b.label} fill={b.positive ? 'var(--green)' : 'var(--red)'} fillOpacity={0.85} />)}</Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </Section>
    )
}

function Tilt({ trades, currency }) {
    const t = useMemo(() => tilt(trades), [trades])
    const rows = [['Entered within 60 min of a loss', t.afterLoss], ['After 2+ losses in a row', t.afterTwoLosses], ['All other trades', t.baseline]]
    const avg = g => g.closed ? g.net / g.closed : null
    const warn = [t.afterLoss, t.afterTwoLosses].some(g => g.closed >= 3 && avg(g) < (avg(t.baseline) ?? 0))
    return (
        <Section title="Tilt check" subtitle="Do you trade worse right after losing? Uses entry times; a big gap here is a revenge-trading warning.">
            {warn && <p style={{ fontSize: 12.5, color: 'var(--red)', marginBottom: 12 }}>Your trades right after losses do worse than the rest. Consider a cool-down rule in your per-trade checklist.</p>}
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead><tr>{['Situation', 'Trades', 'Win rate', 'Net', 'Per trade'].map(h => <th key={h} style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>{h}</th>)}</tr></thead>
                    <tbody>{rows.map(([label, g]) => (
                        <tr key={label}>
                            <td style={{ padding: '8px' }}>{label}</td>
                            <td style={{ padding: '8px', color: 'var(--text-muted)' }}>{g.closed}</td>
                            <td style={{ padding: '8px' }}>{rateWithRange(g.winRate)}</td>
                            <td style={{ padding: '8px', fontWeight: 600, color: g.net >= 0 ? 'var(--green)' : 'var(--red)' }}>{g.closed ? money(g.net, currency) : '—'}</td>
                            <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>{g.closed ? money(avg(g), currency) : '—'}</td>
                        </tr>
                    ))}</tbody>
                </table>
            </div>
        </Section>
    )
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
function TimeHeatmap({ trades, currency }) {
    const cells = useMemo(() => timeHeatmap(trades), [trades])
    const hours = [...new Set(cells.flatMap(row => row.map((c, h) => c.count ? h : null)).filter(h => h !== null))].sort((a, b) => a - b)
    if (!hours.length) return null
    const span = hours.length > 1 ? Array.from({ length: hours.at(-1) - hours[0] + 1 }, (_, i) => hours[0] + i) : hours
    const maxAbs = Math.max(1, ...cells.flat().map(c => Math.abs(c.pnl)))
    return (
        <Section title="When you trade best" subtitle="Net P&L by weekday and hour of entry, in your local time.">
            <div style={{ overflowX: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: `40px repeat(${span.length}, minmax(22px, 1fr))`, gap: 3, minWidth: 40 + span.length * 25 }}>
                    <div />
                    {span.map(h => <div key={h} style={{ fontSize: 9.5, color: 'var(--text-muted)', textAlign: 'center' }}>{String(h).padStart(2, '0')}</div>)}
                    {DAYS.map((day, d) => [
                        <div key={day} style={{ fontSize: 11, color: 'var(--text-muted)', alignSelf: 'center' }}>{day}</div>,
                        ...span.map(h => {
                            const c = cells[d][h]
                            const a = c.count ? Math.min(0.9, 0.2 + Math.abs(c.pnl) / maxAbs * 0.7) : 0
                            return <div key={`${day}-${h}`} title={c.count ? `${day} ${h}:00 · ${c.count} trade${c.count > 1 ? 's' : ''} · ${money(c.pnl, currency)}` : `${day} ${h}:00 · no trades`} style={{ aspectRatio: '1', borderRadius: 3, background: c.count ? (c.pnl >= 0 ? `rgba(103,223,160,${a})` : `rgba(239,139,139,${a})`) : 'var(--bg-elevated)' }} />
                        }),
                    ])}
                </div>
            </div>
        </Section>
    )
}

function Fees({ trades, currency }) {
    const f = useMemo(() => feeDrag(trades), [trades])
    if (!f.fees) return null
    return (
        <Section title="Fee drag" subtitle="What trading costs took out of your winning trades.">
            <StatGrid>
                <Stat label="Total fees" value={money(-f.fees, currency)} tone="bad" />
                <Stat label="Share of profit before fees" value={f.share === null ? '—' : `${f.share}%`} tone={f.share > 20 ? 'bad' : undefined} hint={f.share > 20 ? 'High: consider fewer, larger-quality trades' : undefined} />
            </StatGrid>
        </Section>
    )
}

/** Analytics A–H over the full journal. */
export default function AdvancedAnalytics({ trades, loading, currency, startingBalance }) {
    if (loading) return <Section title="Advanced analytics"><Bone h={260} /></Section>
    if (!trades.length) return null
    return <>
        <Discipline trades={trades} currency={currency} />
        <MonteCarlo trades={trades} currency={currency} startingBalance={startingBalance} />
        <div className="analytics-panel-grid">
            <Drawdown trades={trades} currency={currency} startingBalance={startingBalance} />
            <Expectancy trades={trades} />
            <Tilt trades={trades} currency={currency} />
            <TimeHeatmap trades={trades} currency={currency} />
        </div>
        <Fees trades={trades} currency={currency} />
    </>
}
