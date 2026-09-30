const PLAYBACK_TIMEOUT_MS = 45000
// One silent 16-bit sample; playing it inside a gesture lets iOS Safari start this element later.
const SILENT_WAV = 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQIAAAAAAA=='
export const abortError = () => new DOMException('Aborted', 'AbortError')
export const playbackError = () => new Error('Speech playback failed or was blocked. Try Read aloud, or continue with the text reply.')

// Native decoders need final lengths instead of the streaming RIFF/data placeholders.
function completeWav(bytes) {
    const out = bytes.slice(), view = new DataView(out.buffer)
    const text = at => String.fromCharCode(...out.subarray(at, at + 4))
    if (out.length < 12 || text(0) !== 'RIFF' || text(8) !== 'WAVE') throw playbackError()
    view.setUint32(4, out.length - 8, true)
    for (let offset = 12; offset + 8 <= out.length;) {
        const size = view.getUint32(offset + 4, true)
        if (text(offset) === 'data') {
            if (out.length === offset + 8) throw playbackError()
            if (size === 0xFFFFFFFF) view.setUint32(offset + 4, out.length - offset - 8, true)
            return out
        }
        offset += 8 + size + size % 2
    }
    throw playbackError()
}

/** Buffered playback through one <audio> element; each play resolves only after its phrase finishes. */
export function createBufferedAudio() {
    let audio = null, cancel = null
    return {
        play(bytes, signal, onState) {
            return new Promise((resolve, reject) => {
                let url, timeout, settled = false
                const finish = error => {
                    if (settled) return
                    settled = true
                    clearTimeout(timeout)
                    signal.removeEventListener('abort', abort)
                    if (audio) {
                        audio.onended = audio.onerror = audio.onplaying = null
                        audio.pause(); audio.removeAttribute('src'); audio.load()
                    }
                    if (url) URL.revokeObjectURL(url)
                    cancel = null
                    error ? reject(error) : resolve()
                }
                const abort = () => finish(abortError())
                if (signal.aborted) return abort()
                cancel = abort
                signal.addEventListener('abort', abort, { once: true })
                try {
                    audio ||= new Audio()
                    url = URL.createObjectURL(new Blob([completeWav(bytes)], { type: 'audio/wav' }))
                    audio.src = url
                    audio.onended = () => finish()
                    audio.onerror = () => finish(playbackError())
                    audio.onplaying = () => { if (!settled) onState('speaking') }
                    timeout = setTimeout(() => finish(playbackError()), PLAYBACK_TIMEOUT_MS)
                    Promise.resolve(audio.play()).catch(() => finish(playbackError()))
                } catch { finish(playbackError()) }
            })
        },
        /** Call from a user gesture, before any phrase needs the element. */
        prime() {
            if (cancel) return
            try {
                audio ||= new Audio()
                audio.src = SILENT_WAV
                Promise.resolve(audio.play()).then(() => { if (!cancel) audio.pause() }, () => { /* the phrase reports its own error */ })
            } catch { /* no media element support; the phrase reports its own error */ }
        },
        stop() { cancel?.() },
    }
}
