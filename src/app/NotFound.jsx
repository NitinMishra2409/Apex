import { Link } from 'react-router-dom'

export default function NotFound() {
    return (
        <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '2rem' }}>
            <style>{`@keyframes flicker{0%,100%{opacity:1}45%{opacity:0.8}50%{opacity:0.3}55%{opacity:0.9}}`}</style>
            <div style={{ fontSize: 72, fontWeight: 900, color: 'var(--accent)', letterSpacing: '-0.04em', lineHeight: 1, animation: 'flicker 4s infinite', marginBottom: 12 }}>
                404
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Page Not Found</div>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: '2rem', maxWidth: 320 }}>
                The page you're looking for doesn't exist or has been moved.
            </p>
            <Link to="/dashboard" className="btn-primary" style={{ textDecoration: 'none' }}>
                ← Back to Dashboard
            </Link>
        </div>
    )
}
