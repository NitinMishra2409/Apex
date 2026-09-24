import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, Mic, ChartNoAxesCombined, ListChecks, BookOpen, Check, Target } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { DEMO } from '../../platform/demo/store'
import Brand from '../../shared/ui/Brand'

const features = [
    { Icon: BookOpen, number: '01', title: 'Capture the whole trade.', text: 'Record your entries, exits, setup, and state of mind. Give every decision the context it deserves.' },
    { Icon: ChartNoAxesCombined, number: '02', title: 'Let your patterns surface.', text: 'Explore performance by setup, instrument, and day. Find what is working and what needs a closer look.' },
    { Icon: ListChecks, number: '03', title: 'Make discipline a habit.', text: 'Build your pre-market, session, and post-trade routines with checklists that keep you accountable.' },
]
const questions = [
    ['What can I track with Apex Log?', 'Log crypto trades with entry and exit prices, position size, stop loss, take profit, strategy, mistakes, and emotional notes. Your journal calculates P&L and planned risk / reward for you.'],
    ['How does AI-assisted entry work?', 'Use voice entry to dictate a trade. Apex Log transcribes your recording and fills the fields it recognizes. Review and edit the details before saving. Voice transcription requires the service to be configured.'],
    ['Do I need to connect an exchange?', 'No. You log trades manually or with voice assistance. Apex Log is a journal for reflecting on your trades, and does not execute orders.'],
    ['Can I export my journal?', 'Yes. Use Export CSV on the trade journal page to download your trades.'],
]
function Preview() {
    return <div className="landing-preview" aria-label="Illustrative trading journal preview with example data">
        <div className="preview-top"><span><span className="status-dot" />YOUR PERFORMANCE</span><span>Illustrative data</span></div>
        <div className="preview-metrics"><div><small>Net profit & loss</small><strong className="positive">+$2,840.50</strong><span>Every decision, accounted for.</span></div><div><small>Win rate</small><strong>64.2<span>%</span></strong><div className="preview-meter"><i /></div></div></div>
        <div className="preview-chart"><div className="preview-grid"><span>$3,000</span><span>$2,000</span><span>$1,000</span><span>$0</span></div><svg viewBox="0 0 520 200" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="previewFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f1b657" stopOpacity=".2" /><stop offset="100%" stopColor="#f1b657" stopOpacity="0" /></linearGradient></defs><path d="M0 183 20 177 35 184 48 161 65 157 80 165 97 135 113 139 125 111 145 121 165 116 180 127 199 91 211 95 230 80 245 90 258 70 276 73 287 45 300 52 319 61 338 48 350 63 367 33 386 40 405 17 420 23 438 35 450 16 470 27 487 11 508 18 520 3V200H0Z" fill="url(#previewFill)" /><path d="M0 183 20 177 35 184 48 161 65 157 80 165 97 135 113 139 125 111 145 121 165 116 180 127 199 91 211 95 230 80 245 90 258 70 276 73 287 45 300 52 319 61 338 48 350 63 367 33 386 40 405 17 420 23 438 35 450 16 470 27 487 11 508 18 520 3" fill="none" stroke="#f1b657" strokeWidth="2.5" strokeLinejoin="round" /></svg></div><div className="preview-dates"><span>MON</span><span>TUE</span><span>WED</span><span>THU</span><span>FRI</span></div>
        <div className="preview-trade"><span className="coin-icon">B</span><strong>BTC / USDT</strong><span className="badge-long">↗ Long</span><span>Breakout</span><strong className="positive">+$185.20</strong></div>
        <div className="preview-note"><span><Check size={15} /></span><div>A routine worth repeating.<small>Pre-market checklist complete</small></div><ListChecks size={21} /></div>
    </div>
}
export default function Landing() {
    const { user, loading } = useAuth()
    const navigate = useNavigate()
    useEffect(() => { if (!DEMO && !loading && user) navigate('/dashboard', { replace: true }) }, [user, loading, navigate])
    if (!DEMO && (loading || user)) return null
    return <div className="landing-page">
        <header className="landing-nav"><Link to="/" aria-label="Apex Log home"><Brand /></Link><nav aria-label="Product navigation"><a href="#features">The workspace</a><a href="#workflow">How it works</a><a href="#faq">FAQ</a></nav><div><Link className="landing-signin" to="/login">Sign in</Link><Link className="btn-primary" to="/signup">{DEMO ? 'Explore demo' : 'Get started'}<ArrowUpRight size={15} /></Link></div></header>
        <section className="landing-hero"><div className="hero-copy"><div className="hero-label"><span className="status-dot" />THE WORKSPACE FOR INTENTIONAL TRADERS</div><h1>Your next edge<br />is in your<br /><span>last trade.</span></h1><p>A clearer journal. A deeper understanding.<br />Turn your trades into insights, and your insights into a more disciplined process.</p><div className="hero-actions"><Link to="/signup" className="btn-primary">{DEMO ? 'Explore the workspace' : 'Start your journal'}<ArrowRight size={17} /></Link><a href="#features" className="hero-secondary">Take a closer look <ArrowDown /></a></div><div className="hero-footnote"><Check size={13} />No exchange connection needed<span>·</span>Built for crypto traders</div></div><Preview /></section>
        <div className="landing-strip"><span>LESS NOISE. MORE PERSPECTIVE.</span><div><BookOpen size={17} />Trade journaling</div><div><ChartNoAxesCombined size={17} />Performance analytics</div><div><Mic size={17} />AI-assisted voice entry</div><div><ListChecks size={17} />Daily routines</div></div>
        <section id="features" className="landing-section"><div className="landing-section-heading"><div><div className="eyebrow">BUILT AROUND YOUR PROCESS</div><h2>Everything you need<br />to see the bigger picture.</h2></div><p>Great trading habits start with an honest look at your decisions. Keep it all in one focused workspace.</p></div><div className="feature-grid">{features.map(({ Icon, number, title, text }) => <article key={number}><div className="feature-icon"><Icon size={23} /><span>{number}</span></div><h3>{title}</h3><p>{text}</p><Link to="/signup">Explore the workspace <ArrowUpRight size={14} /></Link></article>)}</div></section>
        <section id="workflow" className="workflow-section"><div className="workflow-visual"><Mic size={25} /><blockquote>“Long BTC. Entry at 64,200.<br />Stop at 63,800. Breakout setup.”</blockquote><div><span className="badge-long">BTC / USDT</span><span className="badge-long">Long</span><span className="subtle-badge">BREAKOUT</span></div><p><Check size={13} />Dictate. Review. Save.</p></div><div><div className="eyebrow">LESS TYPING. MORE REFLECTION.</div><h2>Say it. Log it.<br />Learn from it.</h2><p>Capture a trade while it’s still fresh. AI-assisted voice entry helps fill in the details, so you can spend more time on the thinking behind them.</p><Link className="text-link" to="/new-trade">Try voice entry <ArrowRight size={16} /></Link></div></section>
        <section id="faq" className="landing-section faq-section"><div><div className="eyebrow">A LITTLE MORE CLARITY</div><h2>Before your first trade.</h2><p>The details, without the noise.</p></div><div>{questions.map(([q, a]) => <details key={q}><summary>{q}<PlusIcon /></summary><p>{a}</p></details>)}</div></section>
        <section className="landing-cta"><Target size={28} /><h2>Trade with intention.<br /><span>Review with perspective.</span></h2><p>Your trading story is already unfolding. Start keeping track.</p><Link to="/signup" className="btn-primary">{DEMO ? 'Open demo workspace' : 'Create your journal'}<ArrowRight size={16} /></Link></section>
        <footer className="landing-footer"><Brand /><span>Build your edge. One trade at a time.</span><small>© {new Date().getFullYear()} Apex Log</small></footer>
    </div>
}
function ArrowDown() { return <ArrowRight size={15} style={{ transform: 'rotate(90deg)' }} /> }
function PlusIcon() { return <span className="faq-plus" aria-hidden="true">+</span> }
