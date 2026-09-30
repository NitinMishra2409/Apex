import { money } from '../../domain/journal/reporting'

export const Bone = ({ w = '100%', h = 16 }) => <div style={{ width: w, height: h, borderRadius: 4 }} className="skeleton" />

export const Section = ({ title, subtitle, children, style = {} }) => (
    <section className="card" style={{ padding: 24, marginBottom: '1.1rem', ...style }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-primary)', marginBottom: subtitle ? 4 : 20 }}>{title}</h2>
        {subtitle && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18, lineHeight: 1.5 }}>{subtitle}</p>}
        {children}
    </section>
)

/** Chart tooltip that formats P&L in the account currency and counts as plain numbers. */
export const MoneyTip = ({ active, payload, label, currency, labelFormatter = v => v }) => {
    if (!active || !payload?.length) return null
    return (
        <div className="analytics-chart-tooltip" style={{ background: 'var(--ui-popover)', border: '1px solid var(--ui-line)', borderRadius: 8, padding: '8px 12px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{labelFormatter(label)}</div>
            {payload.map(p => (
                <div key={p.name} style={{ fontSize: 13, fontWeight: 700, color: typeof p.value === 'number' && p.value < 0 ? 'var(--red)' : 'var(--text-primary)' }}>
                    {p.name}: {p.name === 'count' ? p.value : Array.isArray(p.value) ? `${money(p.value[0], currency)} to ${money(p.value[1], currency)}` : money(Number(p.value), currency)}
                </div>
            ))}
        </div>
    )
}

export const Stat = ({ label, value, tone, hint }) => (
    <div className="analytics-stat" style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', minWidth: 0 }}>
        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 17, fontWeight: 700, color: tone === 'good' ? 'var(--green)' : tone === 'bad' ? 'var(--red)' : 'var(--text-primary)' }}>{value}</div>
        {hint && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{hint}</div>}
    </div>
)

export const StatGrid = ({ children }) => <div className="analytics-stat-grid" style={{ display: 'grid', gap: 10, marginBottom: 16 }}>{children}</div>
