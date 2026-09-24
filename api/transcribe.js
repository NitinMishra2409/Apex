// Vercel serverless function: POST /api/transcribe
//
// Body is raw WAV bytes; language comes in as a query param. The NVIDIA key is
// read from NVIDIA_API_KEY (set it in the Vercel project's environment
// variables) and never leaves the server.

import { transcribeWav, readRawBody, TranscribeError } from '../server/speech/transcription.js'

export const config = { api: { bodyParser: false } }

function respond(res, status, body) {
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(body))
}

export async function transcribeHandler(req, res, env = process.env) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST')
        return respond(res, 405, { error: 'Method not allowed.' })
    }

    try {
        const audio = await readRawBody(req)
        const language = (req.query?.language || new URL(req.url, 'http://localhost').searchParams.get('language') || 'en-US').toString()
        const text = await transcribeWav(
            audio, language, env.NVIDIA_API_KEY, env.NVIDIA_ASR_FUNCTION_ID || undefined,
        )
        return respond(res, 200, { text })
    } catch (err) {
        if (err instanceof TranscribeError) {
            return respond(res, err.status, { error: err.message, code: err.code })
        }
        console.error('[transcribe] unexpected failure', err)
        return respond(res, 500, { error: 'Transcription failed.', code: 'UNKNOWN' })
    }
}

export default function handler(req, res) { return transcribeHandler(req, res) }
