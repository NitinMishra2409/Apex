import { useState } from 'react'
import { TIMING_STEPS, TIMING_SERVER_STEPS, timingDuration, timingElapsed, timingMarkdown } from './voiceTiming'

export default function VoiceTimingReadout({ turns }) {
    const [copyStatus, setCopyStatus] = useState('')
    const copy = async () => {
        try { await navigator.clipboard.writeText(timingMarkdown(turns)); setCopyStatus('Copied.') }
        catch { setCopyStatus('Clipboard unavailable. Copy from a secure browser tab.') }
    }
    return <section className="studio-panel assistant-timing" aria-label="Voice turn timings">
        <div className="assistant-timing-heading"><div><h2>Voice turn timings</h2><p>Milliseconds since speech ended. Server values are request durations.</p></div><button type="button" onClick={copy} disabled={!turns.length}>Copy as markdown</button></div>
        {!turns.length ? <p className="assistant-small">Complete a voice turn to see its timing.</p> : turns.map((turn, index) => <details key={index} open={index === turns.length - 1}>
            <summary>Turn {index + 1} · first audio {timingElapsed(turn, 'firstAudioStarted')}</summary>
            <div className="assistant-timing-grid">
                {TIMING_STEPS.map(([label, key]) => <div key={label}><span>{label}</span><strong>{timingElapsed(turn, key)}</strong></div>)}
                {TIMING_SERVER_STEPS.map(([label, route, name]) => <div key={label}><span>{label}</span><strong>{timingDuration(turn.server[route]?.[name])}</strong></div>)}
            </div>
        </details>)}
        {copyStatus && <span className="assistant-timing-copied" role="status">{copyStatus}</span>}
    </section>
}
