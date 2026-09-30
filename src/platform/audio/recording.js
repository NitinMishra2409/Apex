// Microphone capture with optional pause detection.
//
// The recorder's own compressed output (WebM/Ogg Opus, or MP4 on Safari) goes
// straight to /api/transcribe; Groq Whisper decodes it. Opus is ~4 KB/s versus
// ~32 KB/s for 16 kHz WAV, and skipping the decode/resample saves a step per turn.

export const MAX_RECORDING_MS = 120000 // 2 minutes is plenty to describe a trade
// Pause length that ends a Coach turn. Shorter feels snappier; too short cuts people off mid-thought.
export const SILENCE_MS = 800

export function recordingSupported() {
    return typeof window !== 'undefined'
        && typeof window.MediaRecorder !== 'undefined'
        && !!navigator?.mediaDevices?.getUserMedia
}

function pickMimeType() {
    const candidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
    ]
    return candidates.find(t => {
        try { return MediaRecorder.isTypeSupported(t) } catch { return false }
    }) ?? ''
}

/**
 * Begin recording. Resolves to a handle with stop() -> Promise<Blob> (recorder format) and cancel().
 * Throws if the user denies microphone permission.
 */
export async function startRecording({ onSilence, onLevel, onNoSpeech } = {}) {
    const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    })

    const releaseTracks = () => { for (const track of stream.getTracks()) track.stop() }
    const mimeType = pickMimeType()
    let recorder
    try { recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined) }
    catch (err) { releaseTracks(); throw err }
    const chunks = []
    recorder.ondataavailable = e => { if (e.data?.size) chunks.push(e.data) }
    try { recorder.start() } catch (err) { releaseTracks(); throw err }
    let audioContext, monitor, ended = false
    const releaseMic = () => {
        ended = true
        clearInterval(monitor)
        audioContext?.close().catch(() => {})
        releaseTracks()
    }
    if (onSilence) {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext
            audioContext = new AudioCtx()
            await audioContext.resume()
            const analyser = audioContext.createAnalyser()
            analyser.fftSize = 2048
            audioContext.createMediaStreamSource(stream).connect(analyser)
            const samples = new Float32Array(analyser.fftSize)
            const began = Date.now()
            let voicedFrames = 0, lastVoice = 0, lastVoiceMark = 0
            monitor = setInterval(() => {
                if (ended) return
                analyser.getFloatTimeDomainData(samples)
                const rms = Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length)
                onLevel?.(Math.min(1, rms * 9))
                if (rms > .018) { voicedFrames++; lastVoice = Date.now(); lastVoiceMark = performance.now() }
                if (voicedFrames >= 4 && Date.now() - lastVoice > SILENCE_MS) { clearInterval(monitor); onSilence(lastVoiceMark) }
                else if (voicedFrames < 4 && Date.now() - began > 30000) { clearInterval(monitor); onNoSpeech?.() }
            }, 100)
        } catch (err) { releaseMic(); try { recorder.stop() } catch { /* inactive */ } throw err }
    }

    return {
        get state() { return recorder.state },

        stop() {
            return new Promise((resolve, reject) => {
                recorder.onerror = e => {
                    releaseMic()
                    reject(e.error ?? new Error('Recording failed.'))
                }
                recorder.onstop = () => {
                    releaseMic()
                    const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' })
                    if (blob.size) resolve(blob)
                    else reject(new Error('No audio was captured.'))
                }
                if (recorder.state === 'inactive') recorder.onstop()
                else recorder.stop()
            })
        },

        cancel() {
            try { if (recorder.state !== 'inactive') { recorder.onstop = null; recorder.stop() } }
            catch { /* already stopped */ }
            releaseMic()
        },
    }
}
