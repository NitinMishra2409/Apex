import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, ArrowUp, Mic, Square, Volume2, MessageCircle, Plus, Phone, AudioLines, RotateCcw } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { DEMO } from '../../platform/demo/store'
import useAssistant from './useAssistant'
import './assistant.css'
import ExpertCall, { ExpertCard } from './ExpertCall'

const PROMPTS = ['Review my recent performance.', 'Which mistakes are costing me the most?', 'Help me prepare for my next session.']
const STATUS = { idle: 'Ready when you are', starting: 'Connecting your microphone…', listening: 'Listening · pause to send', transcribing: 'Turning your voice into words…', thinking: 'Reviewing your journal…', replying: 'Apex is responding…' }
export default function Coach() {
    const { user } = useAuth()
    const [params, setParams] = useSearchParams()
    const [callOpen, setCallOpen] = useState(params.get('call') === 'expert')
    const initialPeriod = params.get('period') || '30'
    const [period, setPeriod] = useState(['all', '7', '30', '90', 'month'].includes(initialPeriod) ? initialPeriod : '30')
    const [includeNotes, setIncludeNotes] = useState(false)
    const [draft, setDraft] = useState('')
    const assistant = useAssistant({ period, includeNotes, userId: user.id })
    const scroll = useRef(null)
    const endExpertCall = () => {
        assistant.stop(); setCallOpen(false)
        if (params.has('call')) setParams(previous => { const next = new URLSearchParams(previous); next.delete('call'); return next }, { replace: true })
    }
    const periodLabel = { all: 'All recorded trades', '7': 'Last 7 days', '30': 'Last 30 days', '90': 'Last 90 days', month: 'This month' }[period]
    useEffect(() => {
        const box = scroll.current
        if (assistant.messages.length && box && box.scrollHeight - box.scrollTop - box.clientHeight < 180) box.scrollTop = box.scrollHeight
    }, [assistant.messages])
    const submit = e => {
        e?.preventDefault()
        if (!draft.trim() || assistant.busy) return
        assistant.send(draft); setDraft('')
    }
    const status = assistant.speechState === 'speaking' ? 'Speaking · you can interrupt' : assistant.speechState === 'generating' ? 'Preparing voice reply…' : STATUS[assistant.phase]
    return <div className="feature-page assistant-page">
        {callOpen && <ExpertCall assistant={assistant} periodLabel={periodLabel} onEnd={endExpertCall} />}
        <div className="assistant-heading"><div><div className="eyebrow">YOUR TRADING COMPANION</div><h1>Think it through with Apex.</h1><p className="page-subtitle">Your journal. A conversation. A clearer next step.</p></div><div className="assistant-heading-actions"><button className="btn-primary" onClick={() => setCallOpen(true)} disabled={assistant.busy}><Phone size={16} />Call an expert</button><button className="btn-secondary" onClick={assistant.clear}><Plus size={16} />New conversation</button></div></div>
        <div className="assistant-layout">
            <section className="assistant-chat studio-panel" aria-label="Conversation with Apex">
                <header className="assistant-chat-header"><span className="assistant-avatar"><AudioLines size={22} /></span><div><strong>Apex</strong><span role="status">{status}</span></div><span className={`assistant-connection ${assistant.voiceActive ? 'is-live' : ''}`}>{assistant.voiceActive ? 'Voice active' : 'Journal assistant'}</span></header>
                <div className="assistant-messages" ref={scroll} role="log" aria-label="Chat messages" aria-live="off">
                    {!assistant.messages.length && <div className="assistant-welcome"><div className="assistant-orbit"><MessageCircle size={34} /></div><h2>A little perspective goes a long way.</h2><p>Talk about a trade, explore a pattern, or work through a difficult session. I’ll use your journal to help you reflect.</p><div className="assistant-prompts">{PROMPTS.map(prompt => <button key={prompt} onClick={() => assistant.send(prompt)} disabled={assistant.busy}>{prompt}<ArrowRight size={15} /></button>)}</div></div>}
                    {assistant.messages.map(message => <article key={message.id} className={`assistant-message ${message.role}`}><span className="message-author">{message.role === 'user' ? 'You' : 'Apex'}</span><div className="message-body">{message.content || (message.pending ? 'Thinking through your question…' : 'Response stopped.')}{message.pending && <span className="assistant-caret" aria-hidden="true" />}</div>{message.interrupted && <small className="message-interrupted">Incomplete response</small>}{message.role === 'assistant' && message.content && !message.pending && !message.interrupted && <button className="message-play" aria-label="Read aloud" onClick={() => assistant.replay(message.content)} disabled={assistant.busy}><Volume2 size={13} />Read aloud</button>}</article>)}
                </div>
                {assistant.voiceProvider === 'device' && <p className="assistant-voice-notice" role="status">Orpheus reached its rate limit. Using your device voice for this conversation. New conversation will try Orpheus again.</p>}
                {assistant.error && <div className="assistant-error" role="alert"><span>{assistant.error}</span>{assistant.lastPrompt && !assistant.busy && <button onClick={() => assistant.send(assistant.lastPrompt)}><RotateCcw size={13} />Retry</button>}</div>}
                <div className="assistant-composer-wrap">
                    {assistant.voiceActive && <div className="assistant-voice-strip"><div className="assistant-wave" style={{ '--level': assistant.level }}>{Array.from({ length: 15 }, (_, i) => <i key={i} style={{ '--i': i }} />)}</div><span>{status}</span>{assistant.phase === 'listening' ? <button onClick={assistant.finishRecording}>Send now</button> : <button onClick={assistant.startVoice}>Interrupt</button>}<button onClick={assistant.stop} aria-label="End voice conversation"><Square size={13} />End</button></div>}
                    <form className="assistant-composer" onSubmit={submit}><textarea aria-label="Message Apex" placeholder="Ask about your trades, your process, or what to work on…" maxLength={4000} value={draft} onChange={e => setDraft(e.target.value)} disabled={assistant.voiceActive} rows={2} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit() } }} /><div className="assistant-composer-actions"><button type="button" className="assistant-mic" onClick={assistant.startVoice} disabled={assistant.voiceActive || assistant.busy} aria-label="Start voice conversation"><Mic size={17} /><span>Start voice</span></button><span className="composer-hint">Shift + Enter for a new line</span>{assistant.busy && !assistant.voiceActive ? <button type="button" className="assistant-send" onClick={assistant.stop} aria-label="Stop response"><Square size={15} /></button> : <button type="submit" className="assistant-send" disabled={!draft.trim() || assistant.busy} aria-label="Send message"><ArrowUp size={18} /></button>}</div></form>
                    <p className="assistant-data-note">Groq processes messages, journal summaries, and spoken replies. NVIDIA transcribes your microphone audio. On speech rate limits, your browser provides the fallback voice. Conversations stay in this tab.</p>
                </div>
            </section>
            <aside className="assistant-sidebar"><ExpertCard onCall={() => setCallOpen(true)} disabled={assistant.busy} />
                <section className="studio-panel assistant-context"><h2>Conversation context</h2><label className="assistant-field">Journal period<select value={period} onChange={e => setPeriod(e.target.value)} disabled={assistant.busy}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="month">This month</option><option value="all">All recorded trades</option></select></label><label className="assistant-option"><input type="checkbox" checked={includeNotes} onChange={e => setIncludeNotes(e.target.checked)} disabled={assistant.busy} /><span>Include reflection notes<small>Add the notes from your 40 most recent trades to the conversation.</small></span></label><label className="assistant-option"><input type="checkbox" checked={assistant.readAloud} onChange={e => assistant.setReadAloud(e.target.checked)} disabled={assistant.busy} /><span>Read replies aloud<small>Voice conversations always include spoken replies.</small></span></label>{assistant.context && <div className="assistant-context-summary">Using {assistant.context.tradeCount.toLocaleString()} trades{assistant.context.truncated ? ` · most recent ${assistant.context.limit.toLocaleString()} only` : ''}. {assistant.context.notesIncluded ? 'Reflection notes included.' : 'Reflection notes excluded.'}</div>}<p className="assistant-small">Changing the period or notes starts a fresh conversation. Apex remembers up to four completed exchanges in this tab.</p></section>
                <section className="studio-panel assistant-next"><h2>Put the reflection into practice.</h2><Link to="/new-trade">Log a trade<ArrowRight size={14} /></Link><Link to="/log">Review your journal<ArrowRight size={14} /></Link><Link to="/checklists">Refine your playbook<ArrowRight size={14} /></Link><p className="assistant-small">Apex analyzes your records. Live prices and trade execution are outside this conversation.</p></section>
                {DEMO && <div className="assistant-demo-note">Local demo testing: chat and voice use your demo journal and the configured Groq and NVIDIA keys. No sign-in needed on localhost. Responses use the live models.</div>}
            </aside>
        </div>
    </div>
}
