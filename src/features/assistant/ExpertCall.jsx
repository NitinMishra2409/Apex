import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AudioLines, Mic, MicOff, Phone, PhoneOff, Send, X } from 'lucide-react'
import './expert.css'

export const EXPERT_PORTRAIT = '/images/apex-expert.png'

export function ExpertCard({ onCall, disabled }) {
    return <section className="expert-card" aria-label="Call an AI expert">
        <img src={EXPERT_PORTRAIT} alt="Apex’s seasoned coach avatar" />
        <div className="expert-card-content">
            <span className="expert-label">APEX · AI COACH</span>
            <h2>A little perspective.<br />A clearer next step.</h2>
            <p>Talk through a trade with a calm voice in your corner.</p>
            <button className="btn-primary" onClick={onCall} disabled={disabled}><Phone size={16} />Call an expert</button>
            <small>A voice conversation with your AI coach</small>
        </div>
    </section>
}

const PHASES = {
    starting: ['Connecting your microphone', 'Allow microphone access in your browser to begin.'],
    listening: ['I’m listening.', 'Talk naturally. Pause when you’re ready for a reply.'],
    transcribing: ['Taking in what you said', 'Your microphone is off while your words are transcribed.'],
    thinking: ['Thinking it through', 'A considered reply can take a moment. You can interrupt at any time.'],
    replying: ['Putting it into words', 'Your reply appears below as it arrives.'],
}

export default function ExpertCall({ assistant, periodLabel, onEnd }) {
    const dialog = useRef(null)
    const [startedAt, setStartedAt] = useState(null)
    const [elapsed, setElapsed] = useState(0)
    useEffect(() => {
        const element = dialog.current
        const previousFocus = document.activeElement
        const previousOverflow = document.body.style.overflow
        element.showModal()
        document.body.style.overflow = 'hidden'
        return () => {
            element.close()
            document.body.style.overflow = previousOverflow
            if (previousFocus?.isConnected) previousFocus.focus()
        }
    }, [])
    useEffect(() => {
        if (!startedAt) return
        const tick = () => setElapsed(Math.floor((Date.now() - startedAt) / 1000))
        tick()
        const timer = setInterval(tick, 1000)
        return () => clearInterval(timer)
    }, [startedAt])
    const start = () => { setStartedAt(value => value || Date.now()); assistant.startVoice() }
    const speaking = assistant.speechState === 'speaking'
    const listening = assistant.phase === 'listening'
    const state = assistant.error && !assistant.voiceActive ? 'error' : speaking ? 'speaking' : assistant.phase
    const [title, hint] = state === 'error' ? ['Let’s reconnect.', 'You can try again or continue by typing in the journal chat.']
        : speaking ? ['Apex is speaking.', 'Need to add something? Interrupt and take the floor.']
            : assistant.speechState === 'generating' ? ['Preparing your voice reply', 'Your microphone is off while Apex prepares to speak.']
                : PHASES[assistant.phase] || (startedAt ? ['Take your time.', 'Your microphone is off. Resume whenever you’re ready.'] : ['Let’s talk it through.', 'Start with what’s on your mind. Apex will listen first.'])
    const lastMessage = assistant.messages.at(-1)
    const caption = lastMessage?.content
    return createPortal(<dialog ref={dialog} className="expert-dialog" aria-labelledby="expert-call-title" onCancel={event => { event.preventDefault(); onEnd() }}>
        <div className="expert-call-layout">
            <div className={`expert-portrait-panel is-${state}`}>
                <img className="expert-portrait" src={EXPERT_PORTRAIT} alt="Apex, your AI trading coach" />
                <div className="expert-portrait-top"><span className="expert-label">APEX LOG</span><span className="expert-ai-badge">AI avatar</span></div>
                <div className="expert-portrait-copy"><span className="expert-label">A CALMER PERSPECTIVE</span><h2>Good decisions<br />start with a conversation.</h2><p>Your journal. Your process. A little room to reflect.</p></div>
            </div>
            <div className="expert-call-body">
                <header className="expert-call-header"><div><span className="expert-label">CALL AN EXPERT</span><h2 id="expert-call-title">Apex <span>· AI coach</span></h2></div><button className="expert-icon-button" onClick={onEnd} aria-label="Close expert call"><X size={20} /></button></header>
                <div className="expert-call-context"><span>{periodLabel}</span><span>{assistant.context ? `${assistant.context.tradeCount} trades in context` : 'Your journal context'}{assistant.context?.demo ? ' · Demo' : ''}</span></div>
                <div className="expert-call-stage">
                    <div className={`expert-call-wave ${speaking ? 'is-speaking' : ''} ${listening ? 'is-listening' : ''}`} aria-hidden="true">{Array.from({ length: 25 }, (_, i) => <i key={i} style={{ '--bar': i, '--height': `${listening ? 5 + assistant.level * (18 + (i * 7 % 37)) : 5 + (i * 13 % 38)}px` }} />)}</div>
                    <h3 role="status">{title}</h3><p>{hint}</p>
                    {startedAt && <span className="expert-call-timer" aria-label="Call duration">{String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}</span>}
                </div>
                <div className="expert-caption" aria-label="Latest conversation caption"><span>{caption ? lastMessage.role === 'user' ? 'YOU' : 'APEX' : 'A SPACE TO REFLECT'}</span><p>{caption || (assistant.busy ? 'Your response will appear here.' : '“Let’s look at the decision, not just the outcome.”')}</p></div>
                {assistant.voiceProvider === 'device' && <p className="expert-voice-notice" role="status">Using device voice · Orpheus rate limit reached. Start a new conversation to try Orpheus again.</p>}
                {assistant.error && <div className="expert-call-error" role="alert">{assistant.error}</div>}
                <div className="expert-call-controls">
                    {!assistant.voiceActive && !assistant.busy ? <button className="btn-primary expert-start" onClick={start}><Phone size={17} />{!startedAt ? 'Start call' : assistant.error ? 'Try again' : 'Resume call'}</button> : <>
                        <button className="expert-control" onClick={assistant.stop}><span><MicOff size={21} /></span>Pause call</button>
                        <button className="expert-control" onClick={listening ? assistant.finishRecording : start}><span>{listening ? <Send size={21} /> : <Mic size={21} />}</span>{listening ? 'Send now' : 'Interrupt'}</button>
                    </>}
                    <button className="expert-control expert-end" onClick={onEnd}><span><PhoneOff size={21} /></span>{startedAt ? 'End call' : 'Back to chat'}</button>
                </div>
                <footer className="expert-call-footer"><AudioLines size={14} /><span>{assistant.voiceProvider === 'device' ? 'Device voice' : 'Orpheus voice'} · {listening ? 'Microphone on' : 'Microphone off'}</span><p>Groq handles chat and spoken replies; NVIDIA transcribes your audio. Your browser supplies the rate-limit fallback voice. Your conversation stays in this tab.</p></footer>
            </div>
        </div>
    </dialog>, document.body)
}
