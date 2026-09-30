import { DEMO, demoDb } from '../../platform/demo/store'
import { authHeaders, checkResponse, transcribeRecording } from '../../platform/http/client'
import { readSSE } from '../../../shared/sse'
import { demoJournalRows } from '../../../shared/demoJournal'

export async function chat(input, signal, onEvent) {
    const body = DEMO ? { ...input, ...demoJournalRows(demoDb().trades, input), currency: demoDb().profile?.currency, startingBalance: demoDb().profile?.starting_balance } : input
    const response = await checkResponse(await fetch('/api/chat', { method: 'POST', headers: await authHeaders('application/json'), body: JSON.stringify(body), signal }))
    let complete = false
    for await (const frame of readSSE(response.body)) {
        const event = JSON.parse(frame)
        if (event.type === 'error') { const error = new Error(event.error); error.code = event.code; throw error }
        if (event.type === 'done') complete = true
        onEvent(event)
    }
    if (!complete) throw new Error('The connection ended before the answer finished. Please retry your message.')
}
export const transcribe = (recording, signal, onTiming) => transcribeRecording(recording, signal, 'en', onTiming)
/** Start Orpheus speech for one phrase; resolves to the still-streaming WAV body. */
export async function speech(text, signal, onTiming) {
    const response = await fetch('/api/speak', { method: 'POST', headers: await authHeaders('application/json'), body: JSON.stringify({ text }), signal })
    onTiming?.(response.headers.get('Server-Timing'))
    await checkResponse(response)
    if (!response.body) throw new Error('The speech service returned no audio.')
    return response.body
}
