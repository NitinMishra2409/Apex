import Brand from '../../shared/ui/Brand'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from './useAuth'

const HexLogo = () => <Brand compact />

const GoogleIcon = () => (
    <svg width="16" height="16" viewBox="0 0 18 18">
        <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
        <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853" />
        <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05" />
        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" fill="#EA4335" />
    </svg>
)

const Spinner = ({ dark } = {}) => (
    <span style={{ display: 'inline-block', width: 15, height: 15, borderRadius: '50%', border: `2px solid ${dark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.25)'}`, borderTopColor: dark ? '#000' : '#fff', animation: 'spin 0.7s linear infinite', verticalAlign: 'middle' }} />
)

const getStrength = (pw) => {
    if (!pw.length) return null
    const hasUpper = /[A-Z]/.test(pw), hasSpecial = /[^a-zA-Z0-9]/.test(pw), hasNum = /[0-9]/.test(pw)
    if (pw.length >= 12 && (hasUpper || hasSpecial)) return { score: 3, label: 'Strong', color: 'var(--green)' }
    if (pw.length >= 8 && (hasNum || hasSpecial)) return { score: 2, label: 'Medium', color: 'var(--yellow)' }
    return { score: 1, label: 'Weak', color: 'var(--red)' }
}

const I = {
    page: { minHeight: 'calc(100dvh - 80px)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(ellipse at center, #1a212c 0%, #101314 70%)', padding: '1rem' },
    card: { width: '100%', maxWidth: 440, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '2.5rem 2rem', boxShadow: '0 0 60px rgba(241,182,87,0.08)' },
    header: { textAlign: 'center', marginBottom: '2rem' },
    label: { display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 },
    input: { width: '100%', padding: '11px 13px', boxSizing: 'border-box' },
    field: { marginBottom: '1rem' },
    divider: { display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '1.25rem 0', color: 'var(--text-muted)', fontSize: 11 },
    divLine: { flex: 1, height: 1, background: 'var(--border)' },
    footer: { textAlign: 'center', marginTop: '1.5rem', fontSize: 13, color: 'var(--text-secondary)' },
    link: { color: 'var(--accent)', fontWeight: 600 },
    googleBtn: { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '11px', background: '#fff', color: '#111', border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 0.15s', marginBottom: '0.75rem' },
}

export default function Signup() {
    const { signUp, signInWithGoogle } = useAuth()
    const navigate = useNavigate()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [loading, setLoading] = useState(false)
    const [gLoading, setGLoading] = useState(false)
    const strength = getStrength(password)
    const disabled = loading || gLoading

    const handleSignUp = async (e) => {
        e.preventDefault()
        if (!email || !password || !confirm) return toast.error('Fill in all fields.')
        if (password !== confirm) return toast.error('Passwords do not match.')
        if (password.length < 6) return toast.error('Password must be at least 6 characters.')
        setLoading(true)
        try { await signUp(email, password); navigate('/login') }
        catch (err) { toast.error(err.message || 'Sign up failed.') }
        finally { setLoading(false) }
    }

    const handleGoogle = async () => {
        setGLoading(true)
        try { await signInWithGoogle() }
        catch (err) { toast.error(err.message); setGLoading(false) }
    }

    return (
        <div style={I.page}>
            <div style={I.card}>
                <div style={I.header}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><HexLogo /></div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Create your account</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Trade smarter. Learn faster.</div>
                </div>

                <button onClick={handleGoogle} disabled={disabled} style={{ ...I.googleBtn, opacity: disabled ? 0.7 : 1 }}>
                    {gLoading ? <Spinner dark /> : <GoogleIcon />} Continue with Google
                </button>

                <div style={I.divider}><div style={I.divLine} />or<div style={I.divLine} /></div>

                <form onSubmit={handleSignUp}>
                    <div style={I.field}>
                        <label style={I.label}>Email</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" style={I.input} />
                    </div>
                    <div style={I.field}>
                        <label style={I.label}>Password</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={I.input} />
                        {strength && (
                            <div style={{ marginTop: 6 }}>
                                <div style={{ display: 'flex', gap: 3, marginBottom: 3 }}>
                                    {[1, 2, 3].map(i => <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= strength.score ? strength.color : 'var(--border)', transition: 'background 0.3s' }} />)}
                                </div>
                                <span style={{ fontSize: 11, color: strength.color, fontWeight: 600 }}>{strength.label}</span>
                            </div>
                        )}
                    </div>
                    <div style={I.field}>
                        <label style={I.label}>Confirm Password</label>
                        <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••"
                            style={{ ...I.input, borderColor: confirm && confirm !== password ? 'var(--red)' : undefined }} />
                        {confirm && confirm !== password && <span style={{ fontSize: 11, color: 'var(--red)', marginTop: 4, display: 'block' }}>Passwords don't match</span>}
                    </div>
                    <button type="submit" disabled={disabled} className="btn-primary"
                        style={{ width: '100%', justifyContent: 'center', opacity: disabled ? 0.7 : 1 }}>
                        {loading ? <Spinner /> : null} Create Account
                    </button>
                </form>

                <div style={I.footer}>
                    Already have an account? <Link to="/login" style={I.link}>Sign in</Link>
                </div>
            </div>
        </div>
    )
}
