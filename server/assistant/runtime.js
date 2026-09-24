import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const localDemoRequests = new WeakSet()
// Called only by Vite's development middleware, never by deployed API handlers.
export function allowLocalDemo(req, env) {
    if (env.VITE_DEMO_MODE !== 'true') return
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket?.remoteAddress)) return
    if (req.headers.forwarded || req.headers['x-forwarded-for'] || req.headers['sec-fetch-site'] === 'cross-site') return
    try {
        const host = new URL(`http://${req.headers.host}`)
        if (!['localhost', '127.0.0.1', '[::1]'].includes(host.hostname)) return
        if (req.headers.origin && new URL(req.headers.origin).host !== host.host) return
        localDemoRequests.add(req)
    } catch { /* An invalid host cannot opt into local testing. */ }
}

export class AssistantError extends Error {
    constructor(status, code, message) { super(message); this.status = status; this.code = code }
}
export function json(res, status, value) {
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 'no-store')
    res.end(JSON.stringify(value))
}
export function fail(res, err) {
    json(res, err.status || 500, { error: err.status ? err.message : 'The assistant could not complete this request.', code: err.code || 'ASSISTANT_ERROR' })
}
export async function readJson(req, limit = 280000) {
    // Vercel may already expose a parsed body; Vite provides a raw Node stream.
    let parsed
    try { parsed = req.body } catch { throw new AssistantError(400, 'BAD_REQUEST', 'Expected a JSON request.') }
    if (parsed !== undefined) {
        const raw = Buffer.isBuffer(parsed) ? parsed : Buffer.from(typeof parsed === 'string' ? parsed : JSON.stringify(parsed))
        if (raw.length > limit) throw new AssistantError(413, 'TOO_LARGE', 'This conversation is too large. Start a new conversation.')
        try { return JSON.parse(raw.toString('utf8')) } catch { throw new AssistantError(400, 'BAD_REQUEST', 'Expected a JSON request.') }
    }
    let size = 0
    const chunks = []
    for await (const chunk of req) {
        size += chunk.length
        if (size > limit) throw new AssistantError(413, 'TOO_LARGE', 'This conversation is too large. Start a new conversation.')
        chunks.push(chunk)
    }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) }
    catch { throw new AssistantError(400, 'BAD_REQUEST', 'Expected a JSON request.') }
}
export async function authenticate(req, env, signal) {
    const token = req.headers.authorization?.match(/^Bearer (.+)$/i)?.[1]
    if (token === 'demo-access-token' && localDemoRequests.has(req)) {
        const session = req.headers['x-apex-demo-session']
        if (typeof session !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(session)) throw new AssistantError(400, 'DEMO_SESSION', 'Refresh the page to start a demo conversation.')
        return { userId: `local-demo:${session}`, demo: true }
    }
    if (!token || token === 'demo-access-token') throw new AssistantError(401, 'SIGN_IN_REQUIRED', 'Demo AI is available on localhost with npm run dev and VITE_DEMO_MODE=true. Deployed apps require sign-in.')
    const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL
    const key = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY
    if (!url || !key) throw new AssistantError(503, 'AUTH_CONFIG', 'Supabase authentication is not configured on the server.')
    const headers = { Authorization: `Bearer ${token}`, apikey: key }
    const response = await fetch(`${url}/auth/v1/user`, { headers, signal })
    if (!response.ok) throw new AssistantError(401, 'SESSION_EXPIRED', 'Your session expired. Sign in again.')
    const user = await response.json()
    if (!user.id) throw new AssistantError(401, 'SESSION_EXPIRED', 'Your session could not be verified.')
    return { userId: user.id, url, headers }
}
// Preserve full provider assistant messages between turns, including reasoning.
// Carry them in an authenticated, encrypted envelope; never render or expose that
// internal content as a chat reply. Binding to the authenticated user prevents reuse.
function historyKey(secret) { return createHash('sha256').update(`apexlog-history-v1:${secret}`).digest() }
export function sealHistory(messages, userId, secret, now = Date.now()) {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', historyKey(secret), iv)
    const retained = messages.slice(-8)
    while (retained.length > 2 && Buffer.byteLength(JSON.stringify(retained)) > 150000) retained.splice(0, 2)
    const data = Buffer.from(JSON.stringify({ userId, expires: now + 3600000, messages: retained }))
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()])
    const token = Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url')
    if (token.length > 250000) throw new AssistantError(413, 'HISTORY_TOO_LARGE', 'This response is too large to retain. Start a new conversation.')
    return token
}
export function openHistory(token, userId, secret, now = Date.now()) {
    if (!token) return []
    try {
        const bytes = Buffer.from(token, 'base64url')
        const decipher = createDecipheriv('aes-256-gcm', historyKey(secret), bytes.subarray(0, 12))
        decipher.setAuthTag(bytes.subarray(12, 28))
        const body = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8'))
        if (body.userId !== userId || body.expires < now || !Array.isArray(body.messages)) throw new Error()
        return body.messages
    } catch { throw new AssistantError(400, 'HISTORY_EXPIRED', 'This conversation expired. Start a new conversation to continue.') }
}
export function requestLifetime(req, res, timeoutMs = 170000) {
    const controller = new AbortController()
    const abort = () => controller.abort()
    const timeout = setTimeout(abort, timeoutMs)
    req.on('aborted', abort)
    req.on('error', abort)
    res.on('close', abort)
    return { signal: controller.signal, dispose() { clearTimeout(timeout); req.off('aborted', abort); req.off('error', abort); res.off('close', abort) } }
}
