// Authenticated requests to the app's own /api routes. The Supabase access token
// (or the local demo identity) proves who is calling; provider keys stay server-side.
import { supabase } from '../supabase/client'
import { DEMO } from '../demo/store'
import { MAX_TRANSCRIPT_CHARS, MAX_ITEMS, MAX_ITEM_CHARS } from '../../../shared/checklistLimits.js'

const demoSession = crypto.randomUUID()

export async function authHeaders(contentType) {
    if (DEMO) return { 'Content-Type': contentType, Authorization: 'Bearer demo-access-token', 'X-Apex-Demo-Session': demoSession }
    const { data } = await supabase.auth.getSession()
    if (!data.session) throw new Error('Sign in again to continue.')
    return { 'Content-Type': contentType, Authorization: `Bearer ${data.session.access_token}` }
}

/** Throw the route's JSON error (with its code and HTTP status) for a failed response. */
export async function checkResponse(response) {
    if (response.ok) return response
    let body
    try { body = await response.json() } catch { /* proxy returned HTML */ }
    const error = new Error(body?.error || `The request failed (${response.status}). Please try again.`)
    error.code = body?.code
    error.status = response.status
    throw error
}

/** Send a recorder blob for transcription. Resolves to the transcript text. */
export async function transcribeRecording(blob, signal, language = 'en', onTiming) {
    const type = blob.type || 'audio/webm'
    const response = await checkResponse(await fetch(`/api/transcribe?language=${language}`, { method: 'POST', headers: await authHeaders(type), body: blob, signal }))
    onTiming?.(response.headers.get('Server-Timing'))
    return (await response.json()).text ?? ''
}

const labels = value => Array.isArray(value) && value.every(label => typeof label === 'string')

/**
 * Ask the AI which checklist items a transcript ticks, in the trader's own words.
 * Resolves to { ticked, unsure }, or null when it is unavailable, rate limited or slow,
 * so the caller can carry on with the code matcher. Never throws.
 */
export async function matchChecklistRemote(transcript, items, signal, timeoutMs = 2500) {
    if (!transcript?.trim() || transcript.length > MAX_TRANSCRIPT_CHARS) return null
    if (!items?.length || items.length > MAX_ITEMS || items.some(item => item.length > MAX_ITEM_CHARS)) return null
    const controller = new AbortController()
    const cancel = () => controller.abort()
    const timer = setTimeout(cancel, timeoutMs)
    signal?.addEventListener('abort', cancel)
    try {
        const headers = await authHeaders('application/json')
        if (controller.signal.aborted) return null
        const response = await fetch('/api/checklist-match', { method: 'POST', headers, body: JSON.stringify({ transcript, items }), signal: controller.signal })
        if (!response.ok) return null
        const answer = await response.json()
        return labels(answer?.ticked) && labels(answer?.unsure) ? { ticked: answer.ticked, unsure: answer.unsure } : null
    } catch { return null }
    finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel) }
}
