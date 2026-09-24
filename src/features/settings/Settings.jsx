import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../auth/useAuth'
import { DEMO } from '../../platform/demo/store'

export default function Settings() {
    const { user } = useAuth()
    const [motion, setMotion] = useState(document.documentElement.dataset.motion !== 'reduced')
    const updateMotion = value => {
        setMotion(value)
        document.documentElement.dataset.motion = value ? 'full' : 'reduced'
        window.dispatchEvent(new Event('apex-motion-change'))
        try { localStorage.setItem('apexlog-motion', value ? 'full' : 'reduced'); toast.success('Motion preference saved') }
        catch { toast.success('Motion preference applied for this visit') }
    }
    return <div className="feature-page"><div className="studio-settings" style={{ margin: 'auto' }}>
        <div className="eyebrow">YOUR WORKSPACE</div><h1 style={{ marginTop: 10 }}>Settings.</h1><p className="page-subtitle">A workspace that feels right for you.</p>
        <section className="studio-panel settings-card"><h2>Profile & workspace</h2>
            <div className="setting-row"><div><strong>Account</strong><p>Your signed-in trading journal</p></div><span className="setting-value">{user.email}</span></div>
            <div className="setting-row"><div><strong>Workspace</strong><p>{DEMO ? 'Sample trades stored locally in this browser' : 'Your personal journal and trading routines'}</p></div><span className="setting-value">{DEMO ? 'Demo account' : 'Main Account'}</span></div>
            <div className="setting-row"><div><strong>Time zone</strong><p>Dashboard dates follow your device’s local time</p></div><span className="setting-value">{Intl.DateTimeFormat().resolvedOptions().timeZone}</span></div>
        </section>
        <section className="studio-panel settings-card"><h2>Appearance & motion</h2>
            <div className="setting-row"><div><strong>Studio Black</strong><p>Charcoal, amber, and periwinkle glass</p></div><span className="studio-demo" style={{ display: 'block' }}>Active theme</span></div>
            <label className="setting-row"><div><strong>Interface animations</strong><p>Smooth charts, panel entrances, and responsive controls. Your device’s reduced-motion setting always takes priority.</p></div><input type="checkbox" aria-label="Interface animations" checked={motion} onChange={e => updateMotion(e.target.checked)} /></label>
        </section>
        <section className="studio-panel settings-card"><h2>Your journal</h2><div className="setting-row"><div><strong>Review & export trades</strong><p>Manage entries and download a CSV from your journal</p></div><Link className="text-link" to="/log">Open journal <ArrowRight size={15} /></Link></div><div className="setting-row"><div><strong>Daily playbooks</strong><p>Customize preparation, trading, and reflection checklists</p></div><Link className="text-link" to="/checklists">Open playbooks <ArrowRight size={15} /></Link></div></section>
    </div></div>
}
