import { useEffect, useRef, useState } from 'react'
import { startRecording, MAX_RECORDING_MS } from '../../platform/audio/recording'
import { chat, speech, transcribe } from './client'
import { createSpeechQueue } from './speechQueue'
import { speakWithDevice } from './browserSpeech'
import { periodBounds } from '../../domain/journal/reporting'

export default function useAssistant({ period, includeNotes, userId }) {
    const [messages, setMessages] = useState([])
    const [phase, setPhase] = useState('idle')
    const [speechState, setSpeechState] = useState('idle')
    const [voiceProvider, setVoiceProvider] = useState('orpheus')
    const voiceSession = useRef({ device: false })
    const [voiceActive, setVoiceActive] = useState(false)
    const [readAloud, setReadAloud] = useState(false)
    const [level, setLevel] = useState(0)
    const [error, setError] = useState('')
    const [context, setContext] = useState(null)
    const [lastPrompt, setLastPrompt] = useState('')
    const history = useRef(''), controller = useRef(null), recording = useRef(null), timer = useRef(null), epoch = useRef(0), active = useRef(false)
    const actions = useRef({})
    const busy = phase !== 'idle' || speechState !== 'idle'
    const stop = () => {
        epoch.current++; active.current = false
        controller.current?.abort(); recording.current?.cancel(); recording.current = null; clearTimeout(timer.current)
        setVoiceActive(false); setPhase('idle'); setSpeechState('idle'); setLevel(0)
        setMessages(items => items.map(item => item.pending ? { ...item, pending: false, interrupted: true } : item))
    }
    useEffect(() => () => { epoch.current++; active.current = false; controller.current?.abort(); recording.current?.cancel(); clearTimeout(timer.current) }, [])
    useEffect(() => {
        epoch.current++; active.current = false; controller.current?.abort(); recording.current?.cancel(); recording.current = null; clearTimeout(timer.current)
        voiceSession.current = { device: false }; setVoiceProvider('orpheus')
        history.current = ''; setMessages([]); setContext(null); setError(''); setLastPrompt(''); setVoiceActive(false); setPhase('idle'); setSpeechState('idle')
    }, [period, includeNotes, userId])
    const send = async (text, fromVoice = false) => {
        const message = text.trim()
        if (!message || (!fromVoice && busy)) return
        const run = ++epoch.current
        const current = new AbortController(); controller.current = current
        setError(''); setLastPrompt(message); setPhase('thinking')
        const id = crypto.randomUUID()
        setMessages(items => [...items, { id: `${id}-user`, role: 'user', content: message }, { id, role: 'assistant', content: '', pending: true }])
        const stillCurrent = () => epoch.current === run
        let speechFailed = false
        const queue = (fromVoice || readAloud) ? createSpeechQueue({ signal: current.signal, synthesize: speech, fallback: speakWithDevice, voiceSession: voiceSession.current, onProvider: value => { if (stillCurrent()) setVoiceProvider(value) }, onState: value => { if (stillCurrent()) setSpeechState(value) }, onError: err => { if (stillCurrent()) { speechFailed = true; setError(err.message); active.current = false; setVoiceActive(false) } } }) : null
        try {
            const range = periodBounds(period)
            const bounds = range ? { from: range.start.toISOString(), to: range.end.toISOString() } : {}
            await chat({ message, history: history.current, includeNotes, ...bounds }, current.signal, event => {
                if (!stillCurrent()) return
                if (event.type === 'context') setContext(event)
                if (event.type === 'token') { setPhase('replying'); setMessages(items => items.map(item => item.id === id ? { ...item, content: item.content + event.text } : item)); queue?.append(event.text) }
                if (event.type === 'done') history.current = event.history
            })
            if (!stillCurrent()) return
            setMessages(items => items.map(item => item.id === id ? { ...item, pending: false } : item))
            if (queue) await queue.finish()
            if (!stillCurrent()) return
            setPhase('idle'); setLastPrompt('')
            if (active.current && !speechFailed) actions.current.listen()
        } catch (err) {
            current.abort()
            if (!stillCurrent()) return
            active.current = false; setVoiceActive(false); setPhase('idle'); setSpeechState('idle')
            setMessages(items => items.map(item => item.id === id ? { ...item, pending: false, interrupted: true } : item))
            if (err.code === 'HISTORY_EXPIRED') history.current = ''
            setError(err.message)
        }
    }
    const finishRecording = async () => {
        const handle = recording.current
        if (!handle) return
        recording.current = null; clearTimeout(timer.current); setLevel(0); setPhase('transcribing')
        const run = epoch.current
        const current = new AbortController(); controller.current = current
        try {
            const wav = await handle.stop()
            if (epoch.current !== run) return
            const text = await transcribe(wav, current.signal)
            if (epoch.current !== run) return
            if (!text?.trim()) throw new Error('No speech was detected. Start voice again or type your message.')
            await actions.current.send(text, true)
        } catch (err) { if (epoch.current === run) { stop(); setError(err.message) } }
    }
    const listen = async () => {
        const run = ++epoch.current
        setPhase('starting'); setError('')
        try {
            const handle = await startRecording({
                onLevel: value => { if (epoch.current === run) setLevel(value) },
                onSilence: () => actions.current.finishRecording(),
                onNoSpeech: () => { stop(); setError('Voice paused because no speech was detected. Start again when you are ready.') },
            })
            if (epoch.current !== run) { handle.cancel(); return }
            recording.current = handle; setPhase('listening')
            timer.current = setTimeout(() => actions.current.finishRecording(), MAX_RECORDING_MS)
        } catch (err) { if (epoch.current === run) { stop(); setError(err.name === 'NotAllowedError' ? 'Microphone access was denied. Allow it in your browser or type your message.' : err.message) } }
    }
    actions.current = { listen, send, finishRecording }
    const startVoice = () => {
        stop(); active.current = true; setVoiceActive(true); listen()
    }
    const replay = async text => {
        stop()
        const run = epoch.current, current = new AbortController(); controller.current = current
        setError('')
        const queue = createSpeechQueue({ signal: current.signal, synthesize: speech, fallback: speakWithDevice, voiceSession: voiceSession.current, onProvider: value => { if (epoch.current === run) setVoiceProvider(value) }, onState: value => { if (epoch.current === run) setSpeechState(value) }, onError: err => { if (epoch.current === run) setError(err.message) } })
        queue.append(text); await queue.finish()
    }
    const clear = () => { stop(); voiceSession.current = { device: false }; setVoiceProvider('orpheus'); history.current = ''; setMessages([]); setError(''); setContext(null); setLastPrompt('') }
    return { messages, phase, speechState, voiceProvider, voiceActive, readAloud, setReadAloud, level, error, context, lastPrompt, busy, send, stop, startVoice, finishRecording, replay, clear }
}
