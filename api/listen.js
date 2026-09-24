import { authenticate, json, fail, requestLifetime } from '../server/assistant/runtime.js'
import { readRawBody, transcribeWav } from '../server/speech/transcription.js'
export const config = { api: { bodyParser: false }, maxDuration: 150 }
export async function listenHandler(req, res, env = process.env) {
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return json(res, 405, { error: 'Method not allowed.' }) }
    const lifetime = requestLifetime(req, res, 125000)
    try {
        await authenticate(req, env, lifetime.signal)
        const audio = await readRawBody(req, 4 * 1024 * 1024)
        const text = await transcribeWav(audio, env.NVIDIA_ASSISTANT_ASR_LANGUAGE || 'en-US', env.NVIDIA_API_KEY, env.NVIDIA_ASR_FUNCTION_ID || undefined, lifetime.signal)
        if (!res.destroyed) json(res, 200, { text })
    } catch (err) { if (!res.destroyed) fail(res, err) }
    finally { lifetime.dispose() }
}
export default listenHandler
