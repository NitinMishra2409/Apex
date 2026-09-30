import { useEffect, lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import ProtectedRoute from '../features/auth/ProtectedRoute'
import Navbar from './Navbar'
import RouteFallback from './RouteFallback'
import { useAuth } from '../features/auth/useAuth'
import { DEMO } from '../platform/demo/store'
import './shell.css'

// Eager: these are the first paint for a new visitor, so a lazy chunk would
// only add a round trip.
import Landing from '../features/marketing/Landing'
import Login from '../features/auth/Login'
import Signup from '../features/auth/Signup'
import ResetPassword from '../features/auth/ResetPassword'
import NotFound from './NotFound'

// Lazy: everything behind auth. Dashboard and Analytics pull in Recharts, which
// is roughly half the bundle - no reason to ship it to a logged-out visitor.
const Dashboard = lazy(() => import('../features/overview/Dashboard'))
const NewTrade = lazy(() => import('../features/trades/NewTrade'))
const TradeLog = lazy(() => import('../features/trades/TradeLog'))
const Checklists = lazy(() => import('../features/checklists/Checklists'))
const Analytics = lazy(() => import('../features/overview/Analytics'))
const Coach = lazy(() => import('../features/assistant/Coach'))
const Settings = lazy(() => import('../features/settings/Settings'))

// Fade wrapper on route change
function FadePage({ children }) {
  const { pathname } = useLocation()
  return (
    <div
      key={pathname}
      style={{ animation: pathname === '/' ? 'none' : 'fadeIn 0.2s ease' }}
    >
      {children}
    </div>
  )
}

// "N" keyboard shortcut → /new-trade
function KeyboardShortcuts() {
  const navigate = useNavigate()
  const { session } = useAuth()

  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase()
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || document.activeElement?.isContentEditable) return
      if (['input', 'textarea', 'select'].includes(tag)) return
      if (e.key === 'n' || e.key === 'N') {
        if (session) navigate('/new-trade')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate, session])

  return null
}

function App() {
  const { pathname } = useLocation()
  const { user } = useAuth()
  const workspace = user && !['/', '/login', '/signup', '/reset-password'].includes(pathname)

  return (
    <>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <KeyboardShortcuts />
      {pathname !== '/' && <Navbar />}

      <main id="main-content" tabIndex={-1} className={workspace ? 'workspace-main' : ''}>
        <FadePage>
          <Suspense fallback={<RouteFallback />}>
          <Routes>
            {/* Landing page — handles /dashboard redirect internally for logged-in users */}
            <Route path="/" element={<Landing />} />

            {/* In demo mode there is nothing to log into — send these into the app. */}
            <Route path="/login" element={DEMO ? <Navigate to="/dashboard" replace /> : <Login />} />
            <Route path="/signup" element={DEMO ? <Navigate to="/dashboard" replace /> : <Signup />} />

            {/* Handles its own demo-mode notice, so it renders in both modes. */}
            <Route path="/reset-password" element={<ResetPassword />} />

            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/new-trade" element={<ProtectedRoute><NewTrade /></ProtectedRoute>} />
            <Route path="/log" element={<ProtectedRoute><TradeLog /></ProtectedRoute>} />
            <Route path="/checklists" element={<ProtectedRoute><Checklists /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
            <Route path="/coach" element={<ProtectedRoute><Coach /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </FadePage>
      </main>
    </>
  )
}

export default App
