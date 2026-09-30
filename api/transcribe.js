// POST /api/transcribe — signed-in speech-to-text for trade dictation and the Coach.
// Body is the raw recorder output; ?language= takes an ISO-639-1 code (default en).
import { authenticate, json, fail, requestLifetime } from '../server/assistant/runtime.js'
import { readRawBody, transcribeAudio } from '../server/speech/transcription.js'
import { serverTiming } from '../server/assistant/timing.js'

export const config = { api: { bodyParser: false }, maxDuration: 30 }

export async function transcribeHandler(req, res, env = process.env) {
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return json(res, 405, { error: 'Method not allowed.' }) }
    const lifetime = requestLifetime(req, res, 25000)
    const timing = {}
    let providerStart
    try {
        const authStart = performance.now()
        await authenticate(req, env, lifetime.signal)
        timing.auth = performance.now() - authStart
        const audio = await readRawBody(req)
        const requested = (req.query?.language || new URL(req.url, 'http://localhost').searchParams.get('language') || 'en').toString()
        const language = /^[a-z]{2}$/.test(requested) ? requested : 'en'
        providerStart = performance.now()
        const text = await transcribeAudio(audio, req.headers['content-type'] || '', language, env, lifetime.signal)
        timing.provider = performance.now() - providerStart
        if (!res.destroyed) { res.setHeader('Server-Timing', serverTiming(timing)); json(res, 200, { text }) }
    } catch (err) { if (!res.destroyed) { if (Number.isFinite(providerStart) && !Number.isFinite(timing.provider)) timing.provider = performance.now() - providerStart; res.setHeader('Server-Timing', serverTiming(timing)); fail(res, err) } }
    finally { lifetime.dispose() }
}
export default transcribeHandler
