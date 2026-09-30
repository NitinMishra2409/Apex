import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, ArrowDown, Check, ListChecks, BookOpen, ScanLine, Mic, MessageSquare } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { DEMO } from '../../platform/demo/store'
import Brand from '../../shared/ui/Brand'
import LandingScene, { LandingTradeStrip } from './LandingScene'
import './landing.css'

const routine = [
    { Icon: ListChecks, stage: 'Prepare', title: 'Prepare with intention.', text: 'Start with your pre-market checklist. Before each trade, use a separate per-trade checklist to record the checks behind that decision.', detail: 'Daily routine + checks saved with each trade' },
    { Icon: BookOpen, stage: 'Log', title: 'Log the decision.', text: 'Capture the entry, exit, units, and fees. Add your setup, mistakes, and a reflection while the details are still fresh.', detail: 'Type it, or dictate a draft and review it' },
    { Icon: ScanLine, stage: 'Review', title: 'Make time to review.', text: 'Close the day with your post-market checklist. Compare your trades, revisit recurring mistakes, and bring a question to your Coach.', detail: 'Daily checklists reset at your local midnight' },
]
const questions = [
    ['Which assets can I journal?', 'Stocks, crypto, forex, futures, options, and other instruments. Record units as the total quantity traded: shares, coins, or lots multiplied by lot size. No broker or exchange connection is required.'],
    ['How does account currency work?', 'Choose your account currency in Settings. Every price, fee, and P&L is shown in that currency. Apex Log does not convert currencies; enter values consistently in your account currency.'],
    ['What happens when I dictate a trade?', 'Voice entry transcribes your recording and fills a draft. It can also match spoken checks to your per-trade checklist. You review the fields and checklist, correct anything missing or uncertain, and choose when to save. Voice transcription needs the service to be configured.'],
    ['Can I export my trades?', 'Yes. Use Export CSV in the trade journal to download your trades for your own records or further review.'],
    ['What can the AI Coach do?', 'Apex discusses your own journal for the period you select. Sharing reflection notes is optional. The Coach is read-only: it cannot edit trades or place orders, and has no live market data. It helps you review recorded decisions; it does not predict market moves.'],
]
function JournalLink() {
    return <Link className="al-button" to={DEMO ? '/dashboard' : '/signup'}>{DEMO ? 'Open demo workspace' : 'Start your journal'}<ArrowRight size={18} aria-hidden="true" /></Link>
}
export default function Landing() {
    const { user, loading } = useAuth()
    const navigate = useNavigate()
    useEffect(() => { if (!DEMO && !loading && user) navigate('/dashboard', { replace: true }) }, [user, loading, navigate])
    if (!DEMO && (loading || user)) return null
    return <div className="al-page">
        <a className="al-skip" href="#main">Skip to content</a>
        <header className="al-nav al-shell">
            <Link to="/" aria-label="Apex Log home" translate="no"><Brand /></Link>
            <nav aria-label="Product navigation"><a href="#routine">How it works</a><a href="#coach">AI Coach</a><a href="#faq">FAQ</a></nav>
            <Link className="al-signin" to="/login">Sign in <ArrowRight size={16} aria-hidden="true" /></Link>
        </header>
        <div id="main" tabIndex={-1}>
            <section className="al-hero al-shell" aria-labelledby="hero-title">
                <div className="al-hero-copy">
                    <p className="al-eyebrow">A journal for intentional traders</p>
                    <h1 id="hero-title">See the habits behind your trades.</h1>
                    <p className="al-lead">Log your decisions, review your patterns, and build a more consistent routine with your AI Coach.</p>
                    <div className="al-actions"><JournalLink /><a className="al-secondary" href="#routine">See how it works <ArrowDown size={16} aria-hidden="true" /></a></div>
                    <p className="al-footnote"><Check size={15} aria-hidden="true" />Any asset class. No exchange connection needed.</p>
                </div>
                <LandingScene />
                <LandingTradeStrip />
            </section>
            <section id="routine" className="al-section al-shell" aria-labelledby="routine-title">
                <div className="al-section-heading"><div><p className="al-eyebrow">Your daily routine</p><h2 id="routine-title">A little structure.<br />A clearer trading day.</h2></div><p>You already make the decisions.<br />Give yourself a way to learn from them.</p></div>
                <ol className="al-routine">{routine.map(({ Icon, stage, title, text, detail }) => <li key={title}>
                    <div className="al-step-top"><span>{stage}</span><Icon size={25} aria-hidden="true" /></div>
                    <h3>{title}</h3><p>{text}</p><small>{detail}</small>
                </li>)}</ol>
            </section>
            <section id="capture" className="al-section al-shell al-split" aria-labelledby="capture-title">
                <div className="al-section-copy"><p className="al-eyebrow">Capture the context</p><h2 id="capture-title">Keep the thinking<br />behind the trade.</h2><p>Prices tell part of the story. Your setup, checklist, and reflection explain why you took the trade.</p><p>Enter details manually or dictate a draft. Review the fields and matched checklist items before you save.</p><a className="al-text-link" href="#routine">Explore the daily routine <ArrowRight size={16} aria-hidden="true" /></a></div>
                <figure className="al-capture al-panel">
                    <figcaption className="al-panel-caption"><Mic size={17} aria-hidden="true" />Illustrative voice draft · USD account</figcaption>
                    <blockquote>“Long AAPL. Entry 180, exit 184. Ten units, two in fees. Entry trigger confirmed, stop defined, risk reviewed.”</blockquote>
                    <div className="al-draft-tags"><span>AAPL</span><span>LONG</span><span>10 units</span><span>2.00 USD fees</span></div>
                    <div className="al-draft-note"><BookOpen size={20} aria-hidden="true" /><div><strong>Your review comes first.</strong><p>Check the prices, units, fees, and checklist before you save.</p></div></div>
                    <p className="al-caption">Example only. This preview does not record audio.</p>
                </figure>
            </section>
            <section id="patterns" className="al-section al-shell al-pattern-section" aria-labelledby="patterns-title">
                <div className="al-section-copy"><p className="al-eyebrow">Notice the patterns</p><h2 id="patterns-title">Look beyond<br />a winning trade.</h2><p>Compare trades where you used your checklist with those where you skipped it. Revisit repeated mistakes and the notes behind each decision.</p><p>A single outcome can hide a lot. Sample counts keep the comparison in perspective.</p></div>
                <figure className="al-patterns al-panel">
                    <figcaption className="al-panel-caption">Illustrative review · 12 sample trades</figcaption><h3>Did I follow my process?</h3>
                    <div className="al-comparison"><div><span>Planned</span><strong>8 <small>trades</small></strong><p>Per-trade checklist used</p></div><div><span>Unplanned</span><strong>4 <small>trades</small></strong><p>Per-trade checklist skipped</p></div></div>
                    <div className="al-count-bar" aria-hidden="true"><span /><span /></div>
                    <div className="al-observation"><ScanLine size={19} aria-hidden="true" /><p><strong>A starting point for review</strong>What was different about the decisions in each group?</p></div>
                    <p className="al-caption">“Unplanned” describes checklist use, not trade quality. These counts don’t establish which approach performs better.</p>
                </figure>
            </section>
            <section id="coach" className="al-section al-shell al-split al-coach-section" aria-labelledby="coach-title">
                <div className="al-section-copy al-coach-heading"><p className="al-eyebrow">Reflect with your AI Coach</p><h2 id="coach-title">Bring a question.<br />Find a place to start.</h2></div>
                <div className="al-section-copy al-coach-detail"><p>Talk through your own journal with Apex. Explore a selected period, compare your habits, and decide what deserves a closer look.</p><p>Your Coach is read-only. It cannot change trades or place orders, and has no live market data. Sharing reflection notes is your choice.</p><span className="al-coach-label"><MessageSquare size={17} aria-hidden="true" />Grounded in your journal</span></div>
                <figure className="al-conversation al-panel">
                    <figcaption className="al-panel-caption">Illustrative conversation · no live AI response</figcaption>
                    <div className="al-chat-question"><span>You</span><p>Where should I start my review?</p></div>
                    <div className="al-chat-answer"><div><Brand compact /><strong>Apex <small>AI Coach</small></strong></div><p>In this sample of 12 trades, 8 used a per-trade checklist and 4 skipped it.</p><p>Start by reviewing those 4 trades. What led you to skip the checklist, and what do your recorded notes tell you about the decision?</p><p className="al-chat-caveat">Checklist use alone doesn’t tell us whether a trade was a good decision.</p></div>
                    <p className="al-caption">You choose what to take into your next session.</p>
                </figure>
            </section>
            <section id="faq" className="al-section al-shell" aria-labelledby="faq-title">
                <div className="al-faq"><div><p className="al-eyebrow">A few practical details</p><h2 id="faq-title">Before you<br />begin.</h2></div><div>{questions.map(([q, a]) => <details key={q}><summary>{q}<span aria-hidden="true">+</span></summary><p>{a}</p></details>)}</div></div>
                <div className="al-closing"><span aria-hidden="true"><Brand compact /></span><h2>Your next review<br />starts with a record.</h2><p>Make room for a more consistent routine.</p><JournalLink /></div>
            </section>
        </div>
        <footer className="al-footer al-shell"><span translate="no"><Brand /></span><p>A little more perspective. Every trading day.</p><small>© {new Date().getFullYear()} Apex Log</small></footer>
    </div>
}
