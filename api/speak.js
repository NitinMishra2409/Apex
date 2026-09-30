import { authenticate, readJson, json, fail, requestLifetime } from '../server/assistant/runtime.js'
import { openSpeech, wavChunks } from '../server/speech/synthesis.js'
import { serverTiming } from '../server/assistant/timing.js'

export const config = { api: { bodyParser: false }, maxDuration: 30 }

// Streams Orpheus WAV through as it is generated, so the browser can start playing
// after the first few hundred milliseconds instead of waiting for the whole phrase.
export async function speakHandler(req, res, env = process.env) {
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return json(res, 405, { error: 'Method not allowed.' }) }
    const lifetime = requestLifetime(req, res, 25000)
    let started = false
    const timing = {}
    let providerStart
    try {
        const authStart = performance.now()
        await authenticate(req, env, lifetime.signal)
        timing.auth = performance.now() - authStart
        const body = await readJson(req, 10000)
        providerStart = performance.now()
        const audio = await openSpeech(body?.text, env, lifetime.signal)
        timing.provider = performance.now() - providerStart
        for await (const chunk of wavChunks(audio)) {
            if (res.destroyed) break
            if (!started) { res.statusCode = 200; res.setHeader('Content-Type', 'audio/wav'); res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Accel-Buffering', 'no'); res.setHeader('Server-Timing', serverTiming(timing)); started = true }
            res.write(chunk)
        }
        if (!res.destroyed) res.end()
    } catch (err) {
        if (res.destroyed) return
        if (Number.isFinite(providerStart) && !Number.isFinite(timing.provider)) timing.provider = performance.now() - providerStart
        // Once audio has started, the only honest signal left is a truncated stream.
        if (started) res.destroy(err)
        else { res.setHeader('Server-Timing', serverTiming(timing)); fail(res, err) }
    } finally { lifetime.dispose() }
}
export default speakHandler
