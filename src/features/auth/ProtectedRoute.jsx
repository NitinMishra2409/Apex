import { Navigate } from 'react-router-dom'
import { useAuth } from './useAuth'

const Spinner = () => (
    <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-primary)',
    }}>
        <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid var(--border)',
            borderTopColor: 'var(--accent)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
)

export default function ProtectedRoute({ children }) {
    const { session, loading } = useAuth()

    if (loading) return <Spinner />
    if (!session) return <Navigate to="/login" replace />
    return children
}
