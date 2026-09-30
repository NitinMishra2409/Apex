import { useEffect, useRef, useState } from 'react'
import { startRecording, MAX_RECORDING_MS } from '../../platform/audio/recording'
import { chat, speech, transcribe } from './client'
import { createSpeechQueue } from './speechQueue'
import { createWavPlayer } from './wavStream'
import { speakWithDevice } from './browserSpeech'
import { periodBounds } from '../../domain/journal/reporting'
import { createVoiceTiming, parseServerTiming } from './voiceTiming'
import { readVoiceChoice, saveVoiceChoice } from './voiceChoice'

export default function useAssistant({ period, includeNotes, userId, timingEnabled = false }) {
    const [messages, setMessages] = useState([])
    const [phase, setPhase] = useState('idle')
    const [speechState, setSpeechState] = useState('idle')
    const [voiceChoice, setVoiceChoiceState] = useState(readVoiceChoice)
    const [voiceProvider, setVoiceProvider] = useState(() => voiceChoice === 'device' ? 'device' : 'orpheus')
    const choice = useRef(voiceChoice)
    const voiceSession = useRef({ device: voiceChoice === 'device' })
    // A conversation starts on the chosen voice; a studio rate limit moves only that conversation to the device.
    const freshVoiceSession = () => { voiceSession.current = { device: choice.current === 'device' }; setVoiceProvider(choice.current === 'device' ? 'device' : 'orpheus') }
    const [voiceActive, setVoiceActive] = useState(false)
    const [readAloud, setReadAloud] = useState(false)
    const [level, setLevel] = useState(0)
    const [error, setError] = useState('')
    const [context, setContext] = useState(null)
    const [lastPrompt, setLastPrompt] = useState('')
    const [timingTurns, setTimingTurns] = useState([])
    const timing = useRef(null)
    if (timingEnabled && !timing.current) timing.current = createVoiceTiming(setTimingTurns)
    const history = useRef(''), controller = useRef(null), recording = useRef(null), timer = useRef(null), epoch = useRef(0), active = useRef(false)
    const actions = useRef({})
    const player = useRef(null)
    if (!player.current) player.current = createWavPlayer()
    const speechOptions = (signal, stillCurrent) => ({
        signal, synthesize: speech, fallback: speakWithDevice, voiceSession: voiceSession.current,
        play: (body, s, onState) => player.current.play(body, s, onState), drain: s => player.current.drain(s),
        stop: () => player.current.stop(),
        onProvider: value => { if (stillCurrent()) setVoiceProvider(value) }, onState: value => { if (stillCurrent()) setSpeechState(value) },
    })
    // Audio can only start from a user gesture; call this from click handlers.
    const unlockAudio = () => { player.current.unlock() }
    const busy = phase !== 'idle' || speechState !== 'idle'
    const stop = () => {
        timing.current?.discard()
        epoch.current++; active.current = false
        controller.current?.abort(); recording.current?.cancel(); recording.current = null; clearTimeout(timer.current); player.current.stop()
        setVoiceActive(false); setPhase('idle'); setSpeechState('idle'); setLevel(0)
        setMessages(items => items.map(item => item.pending ? { ...item, pending: false, interrupted: true } : item))
    }
    useEffect(() => () => { epoch.current++; active.current = false; controller.current?.abort(); recording.current?.cancel(); clearTimeout(timer.current); player.current.dispose() }, [])
    useEffect(() => {
        epoch.current++; active.current = false; controller.current?.abort(); recording.current?.cancel(); recording.current = null; clearTimeout(timer.current)
        player.current.stop()
        freshVoiceSession()
        history.current = ''; setMessages([]); setContext(null); setError(''); setLastPrompt(''); setVoiceActive(false); setPhase('idle'); setSpeechState('idle')
    }, [period, includeNotes, userId])
    const send = async (text, fromVoice = false) => {
        const message = text.trim()
        if (!message || (!fromVoice && busy)) return
        if (!fromVoice && readAloud) unlockAudio()
        const run = ++epoch.current
        const current = new AbortController(); controller.current = current
        setError(''); setLastPrompt(message); setPhase('thinking')
        const id = crypto.randomUUID()
        setMessages(items => [...items, { id: `${id}-user`, role: 'user', content: message }, { id, role: 'assistant', content: '', pending: true }])
        const stillCurrent = () => epoch.current === run
        let speechFailed = false
        let firstSpeech = true
        const queue = (fromVoice || readAloud) ? createSpeechQueue({
            ...speechOptions(current.signal, stillCurrent),
            synthesize: (phrase, signal) => speech(phrase, signal, fromVoice && timingEnabled && firstSpeech ? header => {
                firstSpeech = false
                timing.current?.server('speak', parseServerTiming(header))
            } : undefined),
            onFirstSentence: () => { if (fromVoice && timingEnabled) timing.current?.mark('firstSentenceQueued') },
            onState: value => {
                if (stillCurrent()) setSpeechState(value)
                if (fromVoice && timingEnabled && value === 'speaking') timing.current?.mark('firstAudioStarted')
            },
            onError: err => { if (stillCurrent()) { speechFailed = true; setError(err.message); active.current = false; setVoiceActive(false) } },
        }) : null
        try {
            const range = periodBounds(period)
            const bounds = range ? { from: range.start.toISOString(), to: range.end.toISOString() } : {}
            await chat({ message, history: history.current, includeNotes, voice: fromVoice, ...bounds }, current.signal, event => {
                if (!stillCurrent()) return
                if (event.type === 'context') setContext(event)
                if (event.type === 'token') { if (fromVoice && timingEnabled) timing.current?.mark('firstToken'); setPhase('replying'); setMessages(items => items.map(item => item.id === id ? { ...item, content: item.content + event.text } : item)); queue?.append(event.text) }
                if (event.type === 'done') { history.current = event.history; if (fromVoice && timingEnabled) timing.current?.server('chat', event.timing || {}) }
            })
            if (!stillCurrent()) return
            setMessages(items => items.map(item => item.id === id ? { ...item, pending: false } : item))
            const speechComplete = queue ? await queue.finish() : true
            if (!stillCurrent()) return
            if (fromVoice && timingEnabled) {
                if (speechComplete && !speechFailed) timing.current?.finish()
                else timing.current?.discard()
            }
            setPhase('idle'); setLastPrompt('')
            if (active.current && !speechFailed) actions.current.listen()
        } catch (err) {
            if (fromVoice && timingEnabled) timing.current?.discard()
            current.abort()
            if (!stillCurrent()) return
            active.current = false; setVoiceActive(false); setPhase('idle'); setSpeechState('idle')
            setMessages(items => items.map(item => item.id === id ? { ...item, pending: false, interrupted: true } : item))
            if (err.code === 'HISTORY_EXPIRED') history.current = ''
            setError(err.message)
        }
    }
    const finishRecording = async (speechEnd) => {
        const handle = recording.current
        if (!handle) return
        if (timingEnabled) timing.current?.start(speechEnd, Number.isFinite(speechEnd))
        recording.current = null; clearTimeout(timer.current); setLevel(0); setPhase('transcribing')
        const run = epoch.current
        const current = new AbortController(); controller.current = current
        try {
            const audio = await handle.stop()
            if (epoch.current !== run) return
            const text = await transcribe(audio, current.signal, timingEnabled ? header => timing.current?.server('transcribe', parseServerTiming(header)) : undefined)
            if (epoch.current !== run) return
            if (timingEnabled) timing.current?.mark('transcriptReceived')
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
                onSilence: speechEnd => actions.current.finishRecording(speechEnd),
                onNoSpeech: () => { stop(); setError('Voice paused because no speech was detected. Start again when you are ready.') },
            })
            if (epoch.current !== run) { handle.cancel(); return }
            recording.current = handle; setPhase('listening')
            timer.current = setTimeout(() => actions.current.finishRecording(), MAX_RECORDING_MS)
        } catch (err) { if (epoch.current === run) { stop(); setError(err.name === 'NotAllowedError' ? 'Microphone access was denied. Allow it in your browser or type your message.' : err.message) } }
    }
    actions.current = { listen, send, finishRecording }
    // Audio in flight stops first, so the two voices never overlap; the new voice applies from the next reply.
    const setVoiceChoice = next => {
        if (next === choice.current) return
        if (speechState !== 'idle') stop()
        choice.current = next; setVoiceChoiceState(next); saveVoiceChoice(next)
        // A studio rate limit holds for the rest of the conversation, whatever is picked afterwards.
        const device = next === 'device' || !!voiceSession.current.limited
        voiceSession.current.device = device; setVoiceProvider(device ? 'device' : 'orpheus')
    }
    const startVoice = () => {
        stop(); unlockAudio(); active.current = true; setVoiceActive(true); listen()
    }
    const replay = async text => {
        stop(); unlockAudio()
        const run = epoch.current, current = new AbortController(); controller.current = current
        setError('')
        const queue = createSpeechQueue({ ...speechOptions(current.signal, () => epoch.current === run), onError: err => { if (epoch.current === run) setError(err.message) } })
        queue.append(text); await queue.finish()
    }
    const clear = () => { stop(); freshVoiceSession(); history.current = ''; setMessages([]); setError(''); setContext(null); setLastPrompt('') }
    return { messages, phase, speechState, voiceChoice, setVoiceChoice, voiceProvider, voiceActive, readAloud, setReadAloud, level, error, context, lastPrompt, busy, send, stop, startVoice, finishRecording, replay, clear, timingTurns }
}
