import { AssistantError } from '../assistant/runtime.js'

const MAX_AUDIO_BYTES = 4 * 1024 * 1024
export async function synthesize(text, env, signal) {
    if (typeof text !== 'string' || !text.trim() || text.length > 200) throw new AssistantError(400, 'BAD_TEXT', 'Speech requires between 1 and 200 characters per phrase.')
    if (!env.GROQ_API_KEY?.trim()) throw new AssistantError(503, 'NO_KEY', 'GROQ_API_KEY is not configured on the server. Add it to .env and restart the dev server.')
    signal?.throwIfAborted()
    const response = await fetch('https://api.groq.com/openai/v1/audio/speech', {
        method: 'POST', signal,
        headers: { Authorization: `Bearer ${env.GROQ_API_KEY}`, 'Content-Type': 'application/json', Accept: 'audio/wav' },
        body: JSON.stringify({ model: env.GROQ_TTS_MODEL || 'canopylabs/orpheus-v1-english', voice: env.GROQ_TTS_VOICE || 'autumn', response_format: 'wav', input: text.trim() }),
    })
    if (!response.ok) throw new AssistantError(response.status === 429 ? 429 : 502, 'SPEECH_UNAVAILABLE', response.status === 429 ? 'Groq speech quota was reached. Try again shortly.' : 'Groq could not generate speech. Check your API key and Orpheus model access.')
    if (!response.body) throw new AssistantError(502, 'BAD_SPEECH', 'The speech service returned no audio.')
    const reader = response.body.getReader()
    const chunks = []
    let size = 0
    try {
        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            size += value.byteLength
            if (size > MAX_AUDIO_BYTES) throw new AssistantError(413, 'SPEECH_TOO_LARGE', 'The spoken passage is too large. Try a shorter reply.')
            chunks.push(Buffer.from(value))
        }
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
    const wav = Buffer.concat(chunks)
    if (wav.length <= 44 || wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') throw new AssistantError(502, 'BAD_SPEECH', 'The speech service returned invalid WAV audio.')
    return wav
}
