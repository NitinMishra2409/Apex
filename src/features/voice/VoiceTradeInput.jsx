import { useState, useRef, useEffect, useCallback } from 'react'
import { Mic, Square, X, Loader2, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { startRecording, recordingSupported, MAX_RECORDING_MS } from '../../platform/audio/recording'
import { parseTradeSpeech, FIELD_LABELS } from './voiceParse'
import { DEMO } from '../../platform/demo/store'

// Used only when demo mode is on and no NVIDIA key is configured yet, so the
// flow can be seen end to end before the key arrives.
const DEMO_TRANSCRIPT = 'Long bitcoin at 68,400 with a stop at 67,200 and target 71,500, size 5000, breakout setup, I chased the entry a little'

const fmtTime = (ms) => {
    const s = Math.floor(ms / 1000)
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const describeValue = (key, value) =>
    key === 'mistakes' ? value.join(', ') : String(value)

export default function VoiceTradeInput({ onParsed, extraMistakes = [] }) {
    const [phase, setPhase] = useState('idle') // idle | recording | working
    const [elapsed, setElapsed] = useState(0)
    const [result, setResult] = useState(null) // { transcript, matched, fields, simulated }

    const handleRef = useRef(null)
    const startedAt = useRef(0)
    const tickRef = useRef(null)
    const autoStopRef = useRef(null)

    const clearTimers = () => {
        clearInterval(tickRef.current)
        clearTimeout(autoStopRef.current)
        tickRef.current = autoStopRef.current = null
    }

    useEffect(() => () => { clearTimers(); handleRef.current?.cancel() }, [])

    const transcribe = useCallback(async (wav) => {
        const res = await fetch('/api/transcribe?language=en-US', {
            method: 'POST',
            headers: { 'Content-Type': 'audio/wav' },
            body: wav,
        })

        let payload = {}
        try { payload = await res.json() } catch { /* non-JSON error page */ }

        if (!res.ok) {
            const err = new Error(payload.error || `Transcription failed (${res.status}).`)
            err.code = payload.code
            throw err
        }
        return payload.text ?? ''
    }, [])

    const finish = useCallback((transcript, simulated) => {
        const text = (transcript || '').trim()
        if (!text) {
            toast.error('Nothing was transcribed — try speaking a little longer.')
            setPhase('idle')
            return
        }

        const parsed = parseTradeSpeech(text, extraMistakes)
        if (!parsed.matched.length) {
            toast.error('Could not pick out any trade details from that.')
        } else {
            onParsed?.({ fields: parsed.fields, transcript: text })
            toast.success(`Filled ${parsed.matched.length} field${parsed.matched.length > 1 ? 's' : ''} from voice.`)
        }
        setResult({ transcript: text, matched: parsed.matched, fields: parsed.fields, simulated })
        setPhase('idle')
    }, [extraMistakes, onParsed])

    const stop = useCallback(async () => {
        clearTimers()
        const handle = handleRef.current
        if (!handle) return
        handleRef.current = null
        setPhase('working')

        try {
            const wav = await handle.stop()
            let transcript, simulated = false
            try {
                transcript = await transcribe(wav)
            } catch (err) {
                // Let the feature be demoed before the API key is added.
                if (DEMO && err.code === 'NO_KEY') {
                    transcript = DEMO_TRANSCRIPT
                    simulated = true
                    toast('No NVIDIA key yet — showing a sample transcript.', { icon: '🎧' })
                } else {
                    throw err
                }
            }
            finish(transcript, simulated)
        } catch (err) {
            toast.error(err.message || 'Transcription failed.')
            setPhase('idle')
        }
    }, [finish, transcribe])

    const start = useCallback(async () => {
        if (!recordingSupported()) {
            toast.error('This browser cannot record audio.')
            return
        }
        setResult(null)
        try {
            handleRef.current = await startRecording()
        } catch (err) {
            const denied = err?.name === 'NotAllowedError' || err?.name === 'SecurityError'
            toast.error(denied ? 'Microphone permission was denied.' : (err.message || 'Could not start recording.'))
            return
        }
        startedAt.current = Date.now()
        setElapsed(0)
        setPhase('recording')
        tickRef.current = setInterval(() => setElapsed(Date.now() - startedAt.current), 200)
        autoStopRef.current = setTimeout(() => { toast('Reached the 2 minute limit.'); stop() }, MAX_RECORDING_MS)
    }, [stop])

    const cancel = () => {
        clearTimers()
        handleRef.current?.cancel()
        handleRef.current = null
        setPhase('idle')
    }

    const busy = phase === 'working'

    return (
        <div style={{ marginBottom: '1.1rem' }}>
            <style>{`@keyframes vtPulse{0%,100%{opacity:1}50%{opacity:.45}} @keyframes vtSpin{to{transform:rotate(360deg)}}`}</style>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {phase !== 'recording' ? (
                    <button
                        type="button" onClick={start} disabled={busy}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: 8,
                            padding: '9px 16px', borderRadius: 9, cursor: busy ? 'default' : 'pointer',
                            border: '1px solid var(--accent)', background: 'rgba(241,182,87,0.12)',
                            color: 'var(--accent)', fontWeight: 600, fontSize: 13,
                            fontFamily: 'inherit', opacity: busy ? 0.6 : 1,
                        }}>
                        {busy
                            ? <><Loader2 size={14} style={{ animation: 'vtSpin 0.8s linear infinite' }} /> Transcribing…</>
                            : <><Mic size={14} /> Dictate trade</>}
                    </button>
                ) : (
                    <>
                        <button
                            type="button" onClick={stop}
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: 8,
                                padding: '9px 16px', borderRadius: 9, cursor: 'pointer',
                                border: '1px solid var(--red)', background: 'rgba(255,80,80,0.14)',
                                color: 'var(--red)', fontWeight: 600, fontSize: 13, fontFamily: 'inherit',
                            }}>
                            <Square size={12} fill="currentColor" /> Stop &amp; transcribe
                        </button>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--red)', fontWeight: 600 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', animation: 'vtPulse 1s ease-in-out infinite' }} />
                            {fmtTime(elapsed)}
                        </span>
                        <button type="button" onClick={cancel}
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <X size={12} /> Cancel
                        </button>
                    </>
                )}

                {phase === 'idle' && !result && (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        e.g. “long BTC at 68,400, stop 67,200, target 71,500, size 5000, breakout”
                    </span>
                )}
            </div>

            {result && (
                <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 9, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                        <Sparkles size={13} color="var(--accent)" />
                        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                            {result.simulated ? 'Sample transcript' : 'Heard'}
                        </span>
                        <button type="button" onClick={() => setResult(null)}
                            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2, lineHeight: 1 }}>
                            <X size={13} />
                        </button>
                    </div>

                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 10 }}>“{result.transcript}”</p>

                    {result.matched.length > 0 && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                            {result.matched.map(key => (
                                <span key={key} style={{ padding: '3px 9px', borderRadius: 6, fontSize: 11.5, background: 'rgba(0,255,136,0.10)', color: 'var(--green)', border: '1px solid rgba(0,255,136,0.22)' }}>
                                    {FIELD_LABELS[key]}: {describeValue(key, result.fields[key])}
                                </span>
                            ))}
                        </div>
                    )}

                    <button type="button" onClick={() => onParsed?.({ fields: { emotional_notes: result.transcript }, transcript: result.transcript })}
                        style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, padding: '5px 11px', fontFamily: 'inherit' }}>
                        Use as emotional notes
                    </button>
                    <span style={{ marginLeft: 10, fontSize: 11.5, color: 'var(--text-muted)' }}>Check the filled values before saving.</span>
                </div>
            )}
        </div>
    )
}
