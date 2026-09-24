import { supabase } from '../../platform/supabase/client'
import { DEMO, demoDb } from '../../platform/demo/store'
import { readSSE } from '../../../shared/sse'
import { demoJournalRows } from '../../../shared/demoJournal'

const demoSession = crypto.randomUUID()

async function headers(type) {
    if (DEMO) return { 'Content-Type': type, Authorization: 'Bearer demo-access-token', 'X-Apex-Demo-Session': demoSession }
    const { data } = await supabase.auth.getSession()
    if (!data.session) throw new Error('Sign in again to use your assistant.')
    return { 'Content-Type': type, Authorization: `Bearer ${data.session.access_token}` }
}
async function check(response) {
    if (response.ok) return response
    let body
    try { body = await response.json() } catch { /* proxy returned HTML */ }
    const error = new Error(body?.error || `The request failed (${response.status}). Please try again.`)
    error.code = body?.code
    error.status = response.status
    throw error
}
export async function chat(input, signal, onEvent) {
    const body = DEMO ? { ...input, ...demoJournalRows(demoDb().trades, input) } : input
    const response = await check(await fetch('/api/chat', { method: 'POST', headers: await headers('application/json'), body: JSON.stringify(body), signal }))
    let complete = false
    for await (const frame of readSSE(response.body)) {
        const event = JSON.parse(frame)
        if (event.type === 'error') { const error = new Error(event.error); error.code = event.code; throw error }
        if (event.type === 'done') complete = true
        onEvent(event)
    }
    if (!complete) throw new Error('The connection ended before the answer finished. Please retry your message.')
}
export async function transcribe(wav, signal) {
    const response = await check(await fetch('/api/listen', { method: 'POST', headers: await headers('audio/wav'), body: wav, signal }))
    return (await response.json()).text
}
export async function speech(text, signal) {
    const response = await check(await fetch('/api/speak', { method: 'POST', headers: await headers('application/json'), body: JSON.stringify({ text }), signal }))
    return response.blob()
}
