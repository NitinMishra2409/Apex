import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../auth/useAuth'
import { useProfile } from './useProfile'
import { DEMO } from '../../platform/demo/store'
import { CURRENCIES } from '../../domain/trades/vocabulary'
import { currencySymbol } from '../../domain/journal/reporting'
import Select from '../../shared/ui/Select'
import { getThemePreference, setThemePreference } from '../../platform/preferences/theme'
import './settings.css'

function AccountMoney() {
    const profile = useProfile()
    const [currency, setCurrency] = useState(profile.currency)
    const [balance, setBalance] = useState(profile.startingBalance ?? '')
    const [saving, setSaving] = useState(false)
    useEffect(() => { setCurrency(profile.currency); setBalance(profile.startingBalance ?? '') }, [profile.currency, profile.startingBalance])
    const dirty = currency !== profile.currency || String(balance) !== String(profile.startingBalance ?? '')
    const save = async e => {
        e.preventDefault()
        setSaving(true)
        try { await profile.update({ currency, startingBalance: balance === '' ? null : Number(balance) }); toast.success('Account settings saved') }
        catch (err) { toast.error(err.message || 'Could not save your settings.') }
        finally { setSaving(false) }
    }
    return <form className="studio-panel settings-card" onSubmit={save}><h2>Money</h2>
        <label className="setting-row"><div><strong>Account currency</strong><p>Every price, fee and P&L is shown in this currency. Nothing is converted, so use the currency your instruments are priced in.</p></div>
            <Select aria-label="Account currency" value={currency} onValueChange={value => setCurrency(value)} disabled={profile.loading}>{CURRENCIES.map(c => <option key={c} value={c}>{c} {currencySymbol(c) !== c ? `(${currencySymbol(c)})` : ''}</option>)}</Select></label>
        <label className="setting-row"><div><strong>Starting balance</strong><p>Optional. Turns drawdowns and the Monte Carlo risk of ruin into percentages of your account.</p></div>
            <input aria-label="Starting balance" type="number" min="0" step="any" inputMode="decimal" placeholder="e.g. 100000" value={balance} onChange={e => setBalance(e.target.value)} disabled={profile.loading} /></label>
        <div className="settings-actions"><button className="btn-primary" disabled={!dirty || saving}>{saving ? 'Saving…' : 'Save'}</button></div>
    </form>
}

export default function Settings() {
    const { user } = useAuth()
    const [motion, setMotion] = useState(document.documentElement.dataset.motion !== 'reduced')
    const [theme, setTheme] = useState(getThemePreference)
    const updateTheme = value => { setTheme(value); setThemePreference(value) }
    const updateMotion = value => {
        setMotion(value)
        document.documentElement.dataset.motion = value ? 'full' : 'reduced'
        window.dispatchEvent(new Event('apex-motion-change'))
        try { localStorage.setItem('apexlog-motion', value ? 'full' : 'reduced'); toast.success('Motion preference saved') }
        catch { toast.success('Motion preference applied for this visit') }
    }
    return <div className="feature-page"><div className="studio-settings beta-settings">
        <div className="eyebrow">YOUR WORKSPACE</div><h1>Settings.</h1><p className="page-subtitle">A workspace that feels right for you.</p>
        <section className="studio-panel settings-card"><h2>Profile & workspace</h2>
            <div className="setting-row"><div><strong>Account</strong><p>Your signed-in trading journal</p></div><span className="setting-value">{user.email}</span></div>
            <div className="setting-row"><div><strong>Workspace</strong><p>{DEMO ? 'Sample trades stored locally in this browser' : 'Your personal journal and trading routines'}</p></div><span className="setting-value">{DEMO ? 'Demo account' : 'Main Account'}</span></div>
            <div className="setting-row"><div><strong>Time zone</strong><p>Dashboard dates follow your device’s local time</p></div><span className="setting-value">{Intl.DateTimeFormat().resolvedOptions().timeZone}</span></div>
        </section>
        <AccountMoney />
        <section className="studio-panel settings-card"><h2>Appearance & motion</h2>
            <div className="setting-row"><div><strong>Interface theme</strong><p>Follow your device setting or keep a light or dark workspace.</p></div><Select aria-label="Interface theme" value={theme} onValueChange={value => updateTheme(value)}><option value="system">Follow device</option><option value="dark">Dark</option><option value="light">Light</option></Select></div>
            <label className="setting-row"><div><strong>Interface animations</strong><p>Smooth charts, panel entrances, and responsive controls. Your device’s reduced-motion setting always takes priority.</p></div><input type="checkbox" aria-label="Interface animations" checked={motion} onChange={e => updateMotion(e.target.checked)} /></label>
        </section>
        <section className="studio-panel settings-card"><h2>Your journal</h2><div className="setting-row"><div><strong>Review & export trades</strong><p>Manage entries and download a CSV from your journal</p></div><Link className="text-link" to="/log">Open journal <ArrowRight size={15} /></Link></div><div className="setting-row"><div><strong>Daily playbooks</strong><p>Customize preparation, trading, and reflection checklists</p></div><Link className="text-link" to="/checklists">Open playbooks <ArrowRight size={15} /></Link></div></section>
    </div></div>
}
