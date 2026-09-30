import { useState, useEffect, useRef } from 'react'
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { House, BookOpen, ChartNoAxesCombined, ListChecks, Plus, LogOut, Menu, X, ChevronDown, Brain, Settings, CalendarDays } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../features/auth/useAuth'
import { DEMO } from '../platform/demo/store'
import { periodBounds, shortDate } from '../domain/journal/reporting'
import Brand from '../shared/ui/Brand'
import Select from '../shared/ui/Select'
import AnchoredPopover from '../shared/ui/AnchoredPopover'

const links = [
    { to: '/dashboard', label: 'Home', Icon: House },
    { to: '/log', label: 'Journal', Icon: BookOpen },
    { to: '/analytics', label: 'Analytics', Icon: ChartNoAxesCombined },
    { to: '/checklists', label: 'Playbooks', Icon: ListChecks },
    { to: '/coach', label: 'AI Coach', Icon: Brain },
]
export default function Navbar() {
    const { user, signOut } = useAuth()
    const { pathname } = useLocation()
    const [params, setParams] = useSearchParams()
    const navigate = useNavigate()
    const [mobileOpen, setMobileOpen] = useState(false)
    const [profileOpen, setProfileOpen] = useState(false)
    const accountButtonRef = useRef(null)
    const mobileRef = useRef(null)
    const railRef = useRef(null)
    const period = params.get('period') || 'all'
    const bounds = periodBounds(period)
    useEffect(() => {
        const close = e => {
            if (e.key === 'Escape' && mobileOpen) {
                setMobileOpen(false)
                mobileRef.current?.focus()
            }
        }
        document.addEventListener('keydown', close)
        return () => { document.removeEventListener('keydown', close) }
    }, [mobileOpen])
    useEffect(() => {
        if (!mobileOpen) return
        const media = window.matchMedia('(max-width: 768px)')
        if (!media.matches) return
        const main = document.getElementById('main-content')
        const previousOverflow = document.body.style.overflow
        const previousInert = main?.inert
        document.body.style.overflow = 'hidden'
        if (main) main.inert = true
        railRef.current?.querySelector('a')?.focus()
        const trapFocus = e => {
            if (e.key !== 'Tab') return
            const controls = [...railRef.current.querySelectorAll('a'), mobileRef.current]
            const current = controls.indexOf(document.activeElement)
            e.preventDefault()
            controls[(current + (e.shiftKey ? -1 : 1) + controls.length) % controls.length]?.focus()
        }
        const resize = () => { if (!media.matches) setMobileOpen(false) }
        document.addEventListener('keydown', trapFocus)
        media.addEventListener('change', resize)
        return () => {
            document.body.style.overflow = previousOverflow
            if (main) main.inert = previousInert
            document.removeEventListener('keydown', trapFocus)
            media.removeEventListener('change', resize)
        }
    }, [mobileOpen])
    const closeMenus = () => { setMobileOpen(false); setProfileOpen(false) }
    const accountKeys = event => {
        if (event.key === 'Tab') { setProfileOpen(false); accountButtonRef.current?.focus(); return }
        const items = [...event.currentTarget.querySelectorAll('[role=menuitem]')]
        const index = items.indexOf(document.activeElement)
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : event.key === 'ArrowDown' ? (index + 1) % items.length : event.key === 'ArrowUp' ? (index - 1 + items.length) % items.length : null
        if (next !== null) { event.preventDefault(); items[next]?.focus() }
    }
    const logout = async () => {
        try { await signOut(); closeMenus(); navigate('/login') }
        catch { toast.error('Could not sign out. Please try again.') }
    }
    if (!user || ['/login', '/signup', '/reset-password'].includes(pathname)) return <header className="public-header"><Link to="/"><Brand /></Link><Link className="btn-secondary" to="/login">Sign in</Link></header>
    const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Trader'
    return <>
        <a className="skip-link" href="#main-content">Skip to content</a>
        {mobileOpen && <button className="studio-scrim" aria-label="Close navigation" onClick={closeMenus} />}
        <aside id="workspace-navigation" ref={railRef} className={`studio-rail ${mobileOpen ? 'is-open' : ''}`}>
            <Link to="/dashboard" className="rail-logo" aria-label="Apex Log home" onClick={closeMenus}><Brand compact /></Link>
            <nav aria-label="Main navigation">
                {links.map(({ to, label, Icon }) => <NavLink key={to} to={to} onClick={closeMenus} className={({ isActive }) => `rail-link ${isActive ? 'active' : ''}`}><Icon size={21} strokeWidth={1.5} /><span>{label}</span></NavLink>)}
            </nav>
            <div className="rail-bottom">
                <NavLink to="/settings" className={({ isActive }) => `rail-link ${isActive ? 'active' : ''}`} onClick={closeMenus}><Settings size={21} strokeWidth={1.5} /><span>Settings</span></NavLink>
                <Link to="/settings" className="rail-avatar" aria-label="Your profile" onClick={closeMenus}>{name.slice(0, 1)}</Link>
            </div>
        </aside>
        <header className="studio-topbar">
            <div className="studio-wordmark"><button ref={mobileRef} className="icon-button studio-mobile-toggle" onClick={() => setMobileOpen(o => !o)} aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={mobileOpen} aria-controls="workspace-navigation">{mobileOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}</button><Link to="/dashboard">Apex Log</Link><span>Discipline compounds.</span></div>
            <div className="studio-toolbar">
                {DEMO && <span className="studio-demo">Demo data</span>}
                <div className="studio-account"><span className="toolbar-label">Account</span><button ref={accountButtonRef} aria-label="Account menu" aria-haspopup="menu" aria-expanded={profileOpen} aria-controls={profileOpen ? 'account-popover' : undefined} className="toolbar-control" onClick={() => setProfileOpen(o => !o)}><span className="account-label-desktop">Main Account</span><span className="account-label-phone">Account</span><ChevronDown size={13} aria-hidden="true" /></button>
                    {profileOpen && <AnchoredPopover anchorRef={accountButtonRef} onClose={() => setProfileOpen(false)} id="account-popover" role="menu" aria-label="Account" className="studio-popover" width={248} height={240} focusOnOpen onKeyDown={accountKeys}><small>Your workspace</small><strong>{name}</strong><p>{user.email}</p><Link role="menuitem" tabIndex={-1} to="/settings" onClick={closeMenus}><Settings size={15} />Account settings</Link><button role="menuitem" tabIndex={-1} onClick={logout}><LogOut size={15} />Sign out</button></AnchoredPopover>}
                </div>
                {pathname === '/dashboard' && <label className="studio-date"><CalendarDays size={16} /><Select aria-label="Performance date range" value={period} onValueChange={value => { const next = new URLSearchParams(params); next.set('period', value); setParams(next, { replace: true }) }}>
                    <option value="all">All recorded trades</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="month">This month</option>
                </Select>{bounds && <span className="sr-only">{shortDate(bounds.start)} to {shortDate(bounds.end)}</span>}</label>}
                <Link to="/new-trade" className="btn-primary topbar-log"><Plus size={19} /><span>Log trade</span></Link>
            </div>
        </header>
    </>
}
