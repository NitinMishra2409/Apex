import { Navigate } from 'react-router-dom'
import { useAuth } from './useAuth'

export default function AdminRoute({ children }) {
    const { loading, isAdmin } = useAuth()
    if (loading) return null
    if (!isAdmin) return <Navigate to="/dashboard" replace />
    return children
}
