import './auth.css'
import Brand from '../../shared/ui/Brand'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from './useAuth'
import { DEMO } from '../../platform/demo/store'
import AuthRail from './AuthRail'

const HexLogo = () => <Brand compact />

const Spinner = () => (
    <span style={{ display: 'inline-block', width: 15, height: 15, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.25)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite', verticalAlign: 'middle' }} />
)

const I = {
    input: { width: '100%', padding: '11px 13px', boxSizing: 'border-box' },
    field: { marginBottom: '1rem' },
    footer: { textAlign: 'center', marginTop: '1.5rem', fontSize: 13, color: 'var(--text-secondary)' },
    link: { color: 'var(--accent)', fontWeight: 600 },
    body: { fontSize: 14, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.5 },
    error: { fontSize: 12, color: 'var(--red)', marginTop: -6, marginBottom: '1rem', display: 'block' },
}

// Time to wait for the PASSWORD_RECOVERY auth event to resolve after landing
// with a recovery link in the URL, before treating it as expired/invalid.
const RECOVERY_TIMEOUT_MS = 8000

export default function ResetPassword() {
    const { loading, passwordRecovery, updatePassword } = useAuth()
    const navigate = useNavigate()
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')
    const [hasRecoveryParams] = useState(() => typeof window !== 'undefined' &&
        (window.location.hash.includes('type=recovery') || window.location.search.includes('type=recovery')))
    const [timedOut, setTimedOut] = useState(false)

    useEffect(() => {
        if (DEMO || passwordRecovery || !hasRecoveryParams) return
        const timer = setTimeout(() => setTimedOut(true), RECOVERY_TIMEOUT_MS)
        return () => clearTimeout(timer)
    }, [passwordRecovery, hasRecoveryParams])

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        if (password.length < 8) return setError('Password must be at least 8 characters.')
        if (password !== confirm) return setError('Passwords do not match.')
        setSubmitting(true)
        try {
            await updatePassword(password)
            toast.success('Password updated!')
            navigate('/dashboard')
        } catch (err) {
            toast.error(err.message || 'Could not update password.')
        } finally {
            setSubmitting(false)
        }
    }

    if (DEMO) {
        return (
            <div className="auth-page">
                <AuthRail />
                <div className="auth-card">
                    <div className="auth-header">
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><HexLogo /></div>
                        <h1>Reset password</h1>
                    </div>
                    <p style={I.body}>Demo mode doesn't use passwords — you're already signed in as the demo trader.</p>
                    <Link to="/dashboard" className="btn-primary" style={{ display: 'block', textAlign: 'center', marginTop: '1.5rem' }}>Go to Dashboard</Link>
                </div>
            </div>
        )
    }

    const waitingOnRecovery = hasRecoveryParams && !passwordRecovery && !timedOut
    if (loading || waitingOnRecovery) {
        return (
            <div className="auth-page">
                <AuthRail />
                <div className="auth-card">
                    <div role="status" aria-label="Checking reset link" className="auth-checking" style={{ display: 'flex', justifyContent: 'center', padding: '1rem 0' }}>
                        <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                        <span>Checking reset link…</span>
                    </div>
                </div>
            </div>
        )
    }

    if (!passwordRecovery) {
        return (
            <div className="auth-page">
                <AuthRail />
                <div className="auth-card">
                    <div className="auth-header">
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><HexLogo /></div>
                        <h1>Reset link invalid or expired</h1>
                    </div>
                    <p style={I.body}>This password reset link no longer works. Request a new one from the login page.</p>
                    <div style={I.footer}>
                        <Link to="/login" style={I.link}>Request a new email</Link>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="auth-page">
            <AuthRail />
            <div className="auth-card">
                <div className="auth-header">
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><HexLogo /></div>
                    <h1>Set a new password</h1>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Choose a new password for your account.</div>
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={I.field}>
                        <label htmlFor="reset-password" className="auth-label">New password</label>
                        <input
                            id="reset-password" name="password" autoComplete="new-password"
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                            aria-invalid={!!error}
                            aria-describedby={error ? 'reset-password-error' : undefined}
                            style={I.input}
                        />
                    </div>
                    <div style={I.field}>
                        <label htmlFor="reset-password-confirm" className="auth-label">Confirm password</label>
                        <input
                            id="reset-password-confirm" name="confirm" autoComplete="new-password"
                            type="password"
                            value={confirm}
                            onChange={e => setConfirm(e.target.value)}
                            placeholder="••••••••"
                            aria-invalid={!!error}
                            aria-describedby={error ? 'reset-password-error' : undefined}
                            style={I.input}
                        />
                    </div>
                    {error && <span id="reset-password-error" role="alert" style={I.error}>{error}</span>}
                    <button type="submit" disabled={submitting} className="btn-primary" style={{ width: '100%', justifyContent: 'center', opacity: submitting ? 0.7 : 1 }}>
                        {submitting ? <Spinner /> : null} Set new password
                    </button>
                </form>
            </div>
        </div>
    )
}
