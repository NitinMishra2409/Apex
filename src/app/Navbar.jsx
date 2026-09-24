import { useState, useEffect, useRef } from 'react'
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { House, BookOpen, ChartNoAxesCombined, ListChecks, Plus, LogOut, Menu, X, ChevronDown, Shield, Brain, Settings, CalendarDays } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../features/auth/useAuth'
import { DEMO } from '../platform/demo/store'
import { periodBounds, shortDate } from '../domain/journal/reporting'
import Brand from '../shared/ui/Brand'

const links = [
    { to: '/dashboard', label: 'Home', Icon: House },
    { to: '/log', label: 'Journal', Icon: BookOpen },
    { to: '/analytics', label: 'Analytics', Icon: ChartNoAxesCombined },
    { to: '/checklists', label: 'Playbooks', Icon: ListChecks },
    { to: '/coach', label: 'AI Coach', Icon: Brain },
]
export default function Navbar() {
    const { user, signOut, isAdmin } = useAuth()
    const { pathname } = useLocation()
    const [params, setParams] = useSearchParams()
    const navigate = useNavigate()
    const [mobileOpen, setMobileOpen] = useState(false)
    const [profileOpen, setProfileOpen] = useState(false)
    const profileRef = useRef(null)
    const mobileRef = useRef(null)
    const railRef = useRef(null)
    const period = params.get('period') || 'all'
    const bounds = periodBounds(period)
    useEffect(() => {
        const close = e => {
            if (e.type === 'mousedown' && !profileRef.current?.contains(e.target)) setProfileOpen(false)
            if (e.key === 'Escape') { setMobileOpen(false); setProfileOpen(false); mobileRef.current?.focus() }
        }
        document.addEventListener('mousedown', close)
        document.addEventListener('keydown', close)
        return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close) }
    }, [])
    useEffect(() => { if (mobileOpen) railRef.current?.querySelector('a')?.focus() }, [mobileOpen])
    const closeMenus = () => { setMobileOpen(false); setProfileOpen(false) }
    const logout = async () => {
        try { await signOut(); closeMenus(); navigate('/login') }
        catch { toast.error('Could not sign out. Please try again.') }
    }
    if (!user || ['/login', '/signup'].includes(pathname)) return <header className="public-header"><Link to="/"><Brand /></Link><Link className="btn-secondary" to="/login">Sign in</Link></header>
    const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Trader'
    return <>
        <a className="skip-link" href="#main-content">Skip to content</a>
        {mobileOpen && <button className="studio-scrim" aria-label="Close navigation" onClick={closeMenus} />}
        <aside ref={railRef} className={`studio-rail ${mobileOpen ? 'is-open' : ''}`}>
            <Link to="/dashboard" className="rail-logo" aria-label="Apex Log home" onClick={closeMenus}><Brand compact /></Link>
            <nav aria-label="Main navigation">
                {links.map(({ to, label, Icon }) => <NavLink key={to} to={to} onClick={closeMenus} className={({ isActive }) => `rail-link ${isActive ? 'active' : ''}`}><Icon size={21} strokeWidth={1.5} /><span>{label}</span></NavLink>)}
            </nav>
            <div className="rail-bottom">
                {isAdmin && <NavLink to="/admin" className="rail-link" onClick={closeMenus}><Shield size={20} strokeWidth={1.5} /><span>Admin</span></NavLink>}
                <NavLink to="/settings" className={({ isActive }) => `rail-link ${isActive ? 'active' : ''}`} onClick={closeMenus}><Settings size={21} strokeWidth={1.5} /><span>Settings</span></NavLink>
                <Link to="/settings" className="rail-avatar" aria-label="Your profile" onClick={closeMenus}>{name.slice(0, 1)}</Link>
            </div>
        </aside>
        <header className="studio-topbar">
            <div className="studio-wordmark"><button ref={mobileRef} className="icon-button studio-mobile-toggle" onClick={() => setMobileOpen(o => !o)} aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={mobileOpen}>{mobileOpen ? <X size={20} /> : <Menu size={20} />}</button><Link to="/dashboard">Apex Log</Link><span>Discipline compounds.</span></div>
            <div className="studio-toolbar">
                {DEMO && <span className="studio-demo">Demo data</span>}
                <div ref={profileRef} className="studio-account"><span className="toolbar-label">Account</span><button aria-label="Account menu" aria-expanded={profileOpen} className="toolbar-control" onClick={() => setProfileOpen(o => !o)}>Main Account<ChevronDown size={13} /></button>
                    {profileOpen && <div className="studio-popover"><small>Your workspace</small><strong>{name}</strong><p>{user.email}</p><Link to="/settings" onClick={closeMenus}><Settings size={15} />Account settings</Link><button onClick={logout}><LogOut size={15} />Sign out</button></div>}
                </div>
                {pathname === '/dashboard' && <label className="studio-date"><CalendarDays size={16} /><select aria-label="Performance date range" value={period} onChange={e => { const next = new URLSearchParams(params); next.set('period', e.target.value); setParams(next, { replace: true }) }}>
                    <option value="all">All recorded trades</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="month">This month</option>
                </select>{bounds && <span className="sr-only">{shortDate(bounds.start)} to {shortDate(bounds.end)}</span>}</label>}
                <Link to="/new-trade" className="btn-primary topbar-log"><Plus size={19} /><span>Log trade</span></Link>
            </div>
        </header>
    </>
}
