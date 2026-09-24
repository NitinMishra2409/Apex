import { useState, useEffect, useMemo } from 'react'
import { Crown, Search, Trash2, ShieldCheck, ShieldOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../auth/useAuth'
import { getAllUsers, makeAdmin, removeAdmin, deleteUser, getAppStats } from './repository'

const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'
const Bone = ({ w = '100%', h = 16 }) => <div style={{ width: w, height: h, borderRadius: 4 }} className="skeleton" />

const LABEL = { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 8 }

function StatCard({ label, value, loading, accent }) {
    return (
        <div className="card" style={{ flex: 1, minWidth: 150 }}>
            <div style={LABEL}>{label}</div>
            {loading ? <Bone h={32} /> : <div style={{ fontSize: 28, fontWeight: 800, color: accent || 'var(--text-primary)', lineHeight: 1 }}>{value}</div>}
        </div>
    )
}

export default function Admin() {
    const { user } = useAuth()
    const [users, setUsers] = useState([])
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [busy, setBusy] = useState({}) // { [userId]: true } when action in flight

    useEffect(() => {
        Promise.all([getAllUsers(), getAppStats()])
            .then(([u, s]) => { setUsers(u); setStats(s); setLoading(false) })
            .catch(err => { toast.error(err.message || 'Failed to load admin data.'); setLoading(false) })
    }, [])

    const filtered = useMemo(() =>
        users.filter(u => u.email?.toLowerCase().includes(search.toLowerCase()))
        , [users, search])

    const setBusyFor = (id, val) => setBusy(b => ({ ...b, [id]: val }))

    const handleMakeAdmin = async (id) => {
        setBusyFor(id, true)
        try {
            await makeAdmin(id)
            setUsers(u => u.map(r => r.id === id ? { ...r, is_admin: true } : r))
            toast.success('User is now an admin.')
        } catch (err) { toast.error(err.message) }
        finally { setBusyFor(id, false) }
    }

    const handleRemoveAdmin = async (id) => {
        setBusyFor(id, true)
        try {
            await removeAdmin(id)
            setUsers(u => u.map(r => r.id === id ? { ...r, is_admin: false } : r))
            toast.success('Admin removed.')
        } catch (err) { toast.error(err.message) }
        finally { setBusyFor(id, false) }
    }

    const handleDelete = async (id, email) => {
        if (!window.confirm(`Permanently delete ${email}? This cannot be undone.`)) return
        setBusyFor(id, true)
        try {
            await deleteUser(id)
            setUsers(u => u.filter(r => r.id !== id))
            toast.success('User deleted.')
        } catch (err) { toast.error(err.message) }
        finally { setBusyFor(id, false) }
    }

    const TH = { padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)', whiteSpace: 'nowrap' }
    const TD = { padding: '12px 14px', fontSize: 13, borderBottom: '1px solid var(--border-subtle)', verticalAlign: 'middle' }

    return (
        <div className="feature-page admin-page" style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '1.5rem 1.25rem' }}>
            <div style={{ maxWidth: 1280, margin: '0 auto' }}>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(241,182,87,0.15)', border: '1px solid rgba(241,182,87,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Crown size={18} color="var(--accent)" />
                        </div>
                        <div>
                            <h1 style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}>Admin Panel</h1>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Logged in as <span style={{ color: 'var(--accent)', fontWeight: 500 }}>{user?.email}</span></div>
                        </div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'rgba(241,182,87,0.08)', border: '1px solid rgba(241,182,87,0.2)', borderRadius: 6, padding: '5px 12px' }}>
                        👑 Admin access
                    </div>
                </div>

                {/* Stats row */}
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                    <StatCard label="Total Users" value={stats?.totalUsers ?? '—'} loading={loading} accent="var(--accent)" />
                    <StatCard label="Total Trades" value={stats?.totalTrades ?? '—'} loading={loading} />
                    <StatCard label="Signed Up Today" value={stats?.todaySignups ?? '—'} loading={loading} accent="var(--green)" />
                    <StatCard label="Trades Today" value={stats?.todayTrades ?? '—'} loading={loading} />
                </div>

                {/* Users table card */}
                <div className="card" style={{ padding: 0 }}>
                    {/* Table header */}
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                        <div>
                            <div style={LABEL}>Users</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                {loading ? '…' : `${filtered.length} of ${users.length} users`}
                            </div>
                        </div>
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search by email…"
                                style={{ paddingLeft: 30, paddingRight: 12, paddingTop: 8, paddingBottom: 8, fontSize: 13, width: 240, borderRadius: 'var(--radius-sm)' }}
                            />
                        </div>
                    </div>

                    {/* Table */}
                    {loading ? (
                        <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {[...Array(4)].map((_, i) => <Bone key={i} h={18} style={{ opacity: 1 - i * 0.2 }} />)}
                        </div>
                    ) : filtered.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>👤</div>
                            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{search ? 'No users match your search.' : 'No users found.'}</p>
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        {['Email', 'Role', 'Joined', 'Trades', 'Actions'].map(h => (
                                            <th key={h} style={TH}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(u => {
                                        const isMe = u.id === user?.id
                                        const isBusy = !!busy[u.id]
                                        return (
                                            <tr key={u.id} style={{ transition: 'background 0.12s' }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                                <td style={TD}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>
                                                            {u.email?.[0]?.toUpperCase() ?? '?'}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{u.email}</div>
                                                            {isMe && <div style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600 }}>You</div>}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td style={TD}>
                                                    {u.is_admin
                                                        ? <span style={{ padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'rgba(241,182,87,0.15)', color: 'var(--accent)', border: '1px solid rgba(241,182,87,0.3)' }}>👑 Admin</span>
                                                        : <span style={{ padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>User</span>}
                                                </td>
                                                <td style={{ ...TD, color: 'var(--text-secondary)' }}>{fmtDate(u.created_at)}</td>
                                                <td style={{ ...TD, color: 'var(--text-secondary)', textAlign: 'center' }}>{u.trade_count}</td>
                                                <td style={TD}>
                                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap' }}>
                                                        {/* Make Admin */}
                                                        {!u.is_admin && (
                                                            <button
                                                                onClick={() => handleMakeAdmin(u.id)}
                                                                disabled={isBusy}
                                                                title="Grant admin"
                                                                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, border: '1px solid rgba(241,182,87,0.4)', background: 'rgba(241,182,87,0.1)', color: 'var(--accent)', fontSize: 11, fontWeight: 600, cursor: isBusy ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', opacity: isBusy ? 0.5 : 1 }}>
                                                                <ShieldCheck size={12} /> Make Admin
                                                            </button>
                                                        )}

                                                        {/* Remove Admin */}
                                                        {u.is_admin && (
                                                            <button
                                                                onClick={() => handleRemoveAdmin(u.id)}
                                                                disabled={isBusy || isMe}
                                                                title={isMe ? "Can't remove yourself" : "Remove admin"}
                                                                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, border: '1px solid rgba(217,125,125,0.35)', background: 'transparent', color: 'var(--red)', fontSize: 11, fontWeight: 600, cursor: (isBusy || isMe) ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', opacity: (isBusy || isMe) ? 0.4 : 1 }}>
                                                                <ShieldOff size={12} /> Remove Admin
                                                            </button>
                                                        )}

                                                        {/* Delete User */}
                                                        <button
                                                            onClick={() => handleDelete(u.id, u.email)}
                                                            disabled={isBusy || isMe}
                                                            title={isMe ? "Can't delete yourself" : "Delete user"}
                                                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, border: '1px solid rgba(217,125,125,0.35)', background: 'rgba(217,125,125,0.08)', color: 'var(--red)', fontSize: 11, fontWeight: 600, cursor: (isBusy || isMe) ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', opacity: (isBusy || isMe) ? 0.4 : 1 }}>
                                                            <Trash2 size={12} /> Delete
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

            </div>
        </div>
    )
}
