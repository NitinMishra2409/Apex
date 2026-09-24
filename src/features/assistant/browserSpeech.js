import EasySpeech from 'easy-speech'

let initialization
function initialize() {
    if (!initialization) initialization = EasySpeech.init({ maxTimeout: 5000, interval: 250 }).catch(error => { initialization = null; throw error })
    return initialization
}

// Browser synthesis plays directly, without creating a WAV or calling our API.
// Cancellation must settle even on browsers that omit the utterance end event.
export function speakWithDevice(text, signal, onState) {
    return new Promise((resolve, reject) => {
        let settled = false, speaking = false, timeout
        const finish = error => {
            if (settled) return
            settled = true; clearTimeout(timeout); signal.removeEventListener('abort', abort)
            error ? reject(error) : resolve()
        }
        const cancel = error => {
            finish(error)
            if (speaking) { speaking = false; EasySpeech.cancel() }
        }
        const abort = () => cancel(new DOMException('Aborted', 'AbortError'))
        if (signal.aborted) return abort()
        signal.addEventListener('abort', abort, { once: true })
        initialize().then(() => {
            if (settled || signal.aborted) return
            const voices = EasySpeech.voices()
            const english = voices.filter(voice => /^en(?:[-_]|$)/i.test(voice.lang))
            const voice = english.find(voice => voice.localService) || english[0] || voices.find(voice => voice.default) || voices[0]
            if (!voice) throw new Error('No device voices available.')
            speaking = true
            timeout = setTimeout(() => cancel(new Error('Device speech took too long. Your answer is available in the chat.')), 45000)
            return EasySpeech.speak({ text, voice, rate: 1, pitch: 1, volume: 1, start: () => { if (!settled) onState('speaking') } })
        }).then(() => finish(), () => {
            cancel(new Error('Device voice is unavailable or playback was blocked. Try Read aloud, or continue with the text reply.'))
        })
    })
}
