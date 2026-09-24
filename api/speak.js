import { AssistantError, authenticate, readJson, json, fail, requestLifetime } from '../server/assistant/runtime.js'
import { synthesize } from '../server/speech/synthesis.js'
export const config = { api: { bodyParser: false }, maxDuration: 120 }
export async function speakHandler(req, res, env = process.env) {
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return json(res, 405, { error: 'Method not allowed.' }) }
    const lifetime = requestLifetime(req, res, 95000)
    try {
        await authenticate(req, env, lifetime.signal)
        const body = await readJson(req, 10000)
        const wav = await synthesize(body?.text, env, lifetime.signal)
        if (wav.length > 4 * 1024 * 1024) throw new AssistantError(413, 'SPEECH_TOO_LARGE', 'This spoken passage is too long. Try a shorter reply.')
        if (!res.destroyed) { res.statusCode = 200; res.setHeader('Content-Type', 'audio/wav'); res.setHeader('Cache-Control', 'no-store'); res.end(wav) }
    } catch (err) { if (!res.destroyed) fail(res, err) }
    finally { lifetime.dispose() }
}
export default speakHandler
