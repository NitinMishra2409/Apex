// Speech-to-text through Groq Whisper, shared by trade dictation and the Coach.
// The browser uploads its recorder output (WebM/Ogg Opus or MP4) as-is; Groq
// decodes it, so there is no client-side WAV conversion on the hot path.
import { AssistantError } from '../assistant/runtime.js'

export const MAX_AUDIO_BYTES = 4 * 1024 * 1024
const ENDPOINT = 'https://api.groq.com/openai/v1/audio/transcriptions'
const EXTENSIONS = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/flac': 'flac' }
// Whisper's prompt biases spelling toward trading vocabulary (max 224 tokens).
const VOCABULARY = 'Trading journal. Long, short, entry, exit, stop loss, take profit, units, lots, fees, breakout, checklist one, NIFTY, BANKNIFTY, BTCUSDT, ETHUSDT.'

export function audioExtension(contentType = '') {
    return EXTENSIONS[contentType.split(';')[0].trim().toLowerCase()] ?? null
}

/**
 * Transcribe one recording.
 * @param {Buffer} audio  Recorder bytes.
 * @param {string} contentType  The request's Content-Type, e.g. 'audio/webm;codecs=opus'.
 * @param {string} language  ISO-639-1 code such as 'en'.
 */
export async function transcribeAudio(audio, contentType, language, env, signal) {
    if (!env.GROQ_API_KEY?.trim()) throw new AssistantError(503, 'NO_KEY', 'GROQ_API_KEY is not configured on the server. Add it to .env and restart the dev server.')
    if (!audio?.length) throw new AssistantError(400, 'EMPTY_AUDIO', 'No audio was received.')
    const extension = audioExtension(contentType)
    if (!extension) throw new AssistantError(415, 'BAD_AUDIO', 'Unsupported audio format.')
    const form = new FormData()
    form.append('model', env.GROQ_STT_MODEL || 'whisper-large-v3-turbo')
    form.append('language', language)
    form.append('response_format', 'json')
    form.append('temperature', '0')
    form.append('prompt', VOCABULARY)
    form.append('file', new Blob([audio], { type: contentType.split(';')[0] }), `speech.${extension}`)
    const response = await fetch(ENDPOINT, { method: 'POST', headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` }, body: form, signal })
    if (!response.ok) {
        if (response.status === 429) throw new AssistantError(429, 'RATE_LIMITED', 'Transcription is busy right now. Try again in a few seconds.')
        if (response.status === 400) throw new AssistantError(400, 'BAD_AUDIO', 'The recording could not be read. Try recording again.')
        throw new AssistantError(502, 'TRANSCRIPTION_FAILED', response.status === 401 ? 'Groq rejected the server API key. Check GROQ_API_KEY.' : 'Transcription failed. Please try again.')
    }
    const body = await response.json()
    return typeof body.text === 'string' ? body.text.replace(/\s+/g, ' ').trim() : ''
}

/** Collect a Node request stream into a Buffer, rejecting oversized payloads early. */
export async function readRawBody(req, limit = MAX_AUDIO_BYTES) {
    if (Buffer.isBuffer(req.body)) {
        if (req.body.length > limit) throw new AssistantError(413, 'TOO_LARGE', 'The recording is too long. Keep it under two minutes.')
        return req.body
    }
    const chunks = []
    let total = 0
    for await (const chunk of req) {
        total += chunk.length
        if (total > limit) throw new AssistantError(413, 'TOO_LARGE', 'The recording is too long. Keep it under two minutes.')
        chunks.push(chunk)
    }
    return Buffer.concat(chunks)
}
