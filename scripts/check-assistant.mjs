// Explicit live smoke check. Sends synthetic text to Groq and synthetic audio to NVIDIA.
// Does not load user sessions, read journal records, or log credentials.
import { loadEnv } from 'vite'
import { streamCompletion } from '../api/chat.js'
import { synthesize } from '../server/speech/synthesis.js'
import { transcribeWav } from '../server/speech/transcription.js'
const env = { ...loadEnv('development', process.cwd(), ''), ...process.env }
const envKey = env.NVIDIA_API_KEY
const check = async (name, fn) => {
    const start = Date.now()
    console.log(`${name}: starting`)
    try { await fn(); console.log(`${name}: passed in ${Math.round((Date.now() - start) / 1000)}s`) }
    catch (err) { console.error(`${name}: failed`, err.code || err.name, err.message); process.exitCode = 1 }
}
const jobs = []
if (!process.argv.includes('--speech-only')) jobs.push(check('Chat model', async () => {
    const start = Date.now()
    let firstToken = false
    const answer = await streamCompletion([{ role: 'user', content: 'Reply with exactly this sentence: Apex is ready to review your journal.' }], env, AbortSignal.timeout(170000), () => {
        if (!firstToken) { firstToken = true; console.log(`First answer text after ${((Date.now() - start) / 1000).toFixed(1)}s`) }
    })
    console.log('Chat streamed response:', answer.content)
}))
if (!process.argv.includes('--chat-only')) jobs.push(check('Speech round-trip', async () => {
    const signal = AbortSignal.timeout(120000)
    const audio = await synthesize('Apex is ready to review your journal. Let us talk about your trading process.', env, signal)
    console.log('Orpheus Autumn WAV:', audio.length, 'bytes')
    const transcript = await transcribeWav(audio, 'en-US', envKey, env.NVIDIA_ASR_FUNCTION_ID || undefined, signal)
    if (!transcript?.trim()) throw new Error('ASR returned an empty transcript.')
    console.log('Whisper round-trip:', transcript)
}))
await Promise.all(jobs)
