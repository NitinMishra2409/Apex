// Transcription against NVIDIA's hosted Whisper Large v3.
//
// The hosted model on build.nvidia.com is a Riva ASR service exposed through
// NVIDIA Cloud Functions over gRPC — NOT the OpenAI-style REST gateway at
// integrate.api.nvidia.com (that host serves LLMs only and 404s on
// /v1/audio/transcriptions). Calls go to grpc.nvcf.nvidia.com:443 with two
// metadata headers: `function-id` and `authorization`.
//
// Used by BOTH the Vercel function (api/transcribe.js) and the Vite dev
// middleware (vite.config.js), so dev and production share one code path.
// This module only ever runs in Node — the API key never reaches the browser.

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import grpc from '@grpc/grpc-js'
import protoLoader from '@grpc/proto-loader'

const HERE = path.dirname(fileURLToPath(import.meta.url))

export const NVCF_GRPC_TARGET = 'grpc.nvcf.nvidia.com:443'

// Published function id for openai/whisper-large-v3 on build.nvidia.com.
// Override with NVIDIA_ASR_FUNCTION_ID if NVIDIA republishes the model.
export const DEFAULT_FUNCTION_ID = 'b702f636-f60c-4a3d-a6f4-f3568c13bd7d'

// 16 kHz mono 16-bit PCM is ~32 KB/s, so this is roughly 13 minutes of audio.
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024

const CALL_TIMEOUT_MS = 120000

export class TranscribeError extends Error {
    constructor(status, code, message) {
        super(message)
        this.status = status
        this.code = code
    }
}

let cachedClient = null

function getClient() {
    if (cachedClient) return cachedClient

    const definition = protoLoader.loadSync('riva/proto/riva_asr.proto', {
        includeDirs: [path.join(HERE, 'proto')],
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
    })
    const proto = grpc.loadPackageDefinition(definition)
    const ServiceCtor = proto.nvidia.riva.asr.RivaSpeechRecognition

    cachedClient = new ServiceCtor(NVCF_GRPC_TARGET, grpc.credentials.createSsl(), {
        'grpc.max_receive_message_length': 16 * 1024 * 1024,
        'grpc.max_send_message_length': MAX_AUDIO_BYTES + 1024 * 1024,
    })
    return cachedClient
}

/** Strip the 44-byte RIFF header so we can hand Riva raw LINEAR_PCM samples. */
function stripWavHeader(buf) {
    if (buf.length < 44 || buf.toString('ascii', 0, 4) !== 'RIFF') {
        return { pcm: buf, sampleRate: 16000, channels: 1 }
    }
    const channels = buf.readUInt16LE(22)
    const sampleRate = buf.readUInt32LE(24)

    // Walk the chunk list rather than assuming data starts at byte 44.
    let offset = 12
    while (offset + 8 <= buf.length) {
        const id = buf.toString('ascii', offset, offset + 4)
        const size = buf.readUInt32LE(offset + 4)
        if (id === 'data') {
            return { pcm: buf.subarray(offset + 8, Math.min(offset + 8 + size, buf.length)), sampleRate, channels }
        }
        offset += 8 + size + (size % 2)
    }
    return { pcm: buf.subarray(44), sampleRate, channels }
}

const GRPC_CODE_MAP = {
    [grpc.status.UNAUTHENTICATED]: [401, 'BAD_KEY'],
    [grpc.status.PERMISSION_DENIED]: [403, 'BAD_KEY'],
    [grpc.status.RESOURCE_EXHAUSTED]: [429, 'RATE_LIMITED'],
    [grpc.status.UNAVAILABLE]: [503, 'UPSTREAM_UNREACHABLE'],
    [grpc.status.DEADLINE_EXCEEDED]: [504, 'TIMEOUT'],
    [grpc.status.INVALID_ARGUMENT]: [400, 'BAD_AUDIO'],
    [grpc.status.UNIMPLEMENTED]: [502, 'BAD_FUNCTION_ID'],
}

/**
 * Transcribe WAV audio via NVIDIA's hosted Whisper Large v3.
 *
 * @param {Buffer} audio     WAV bytes (the client encodes 16 kHz mono).
 * @param {string} language  BCP-47 code such as 'en-US', or 'multi'.
 * @param {string} apiKey    NVIDIA API key (server-side only).
 * @param {string} [functionId]
 * @returns {Promise<string>} the transcript
 */
export async function transcribeWav(audio, language, apiKey, functionId = DEFAULT_FUNCTION_ID, signal) {
    if (!apiKey) {
        throw new TranscribeError(503, 'NO_KEY',
            'NVIDIA_API_KEY is not set. Add it to .env (no VITE_ prefix) and restart the dev server.')
    }
    if (!audio?.length) {
        throw new TranscribeError(400, 'EMPTY_AUDIO', 'No audio was received.')
    }
    if (audio.length > MAX_AUDIO_BYTES) {
        throw new TranscribeError(413, 'TOO_LARGE',
            `Audio is ${(audio.length / 1048576).toFixed(1)} MB; the limit is ${MAX_AUDIO_BYTES / 1048576} MB.`)
    }

    const { pcm, sampleRate, channels } = stripWavHeader(audio)

    const metadata = new grpc.Metadata()
    metadata.set('function-id', functionId)
    metadata.set('authorization', `Bearer ${apiKey}`)

    const request = {
        config: {
            encoding: 'LINEAR_PCM',
            sample_rate_hertz: sampleRate,
            language_code: language || 'en-US',
            max_alternatives: 1,
            audio_channel_count: channels || 1,
            enable_automatic_punctuation: true,
        },
        audio: pcm,
    }

    const deadline = new Date(Date.now() + CALL_TIMEOUT_MS)

    const response = await new Promise((resolve, reject) => {
        if (signal?.aborted) return reject(new TranscribeError(499, 'CANCELLED', 'Transcription cancelled.'))
        const call = getClient().Recognize(request, metadata, { deadline }, (err, res) => {
            signal?.removeEventListener('abort', cancel)
            if (!err) return resolve(res)

            const [status, code] = GRPC_CODE_MAP[err.code] ?? [502, 'UPSTREAM_ERROR']
            const detail = (err.details || err.message || '').trim()
            reject(new TranscribeError(status, code,
                code === 'BAD_KEY'
                    ? `NVIDIA rejected the API key${detail ? ` (${detail})` : ''}.`
                    : `NVIDIA transcription failed${detail ? `: ${detail}` : ` (gRPC code ${err.code})`}.`))
        })
        const cancel = () => call.cancel()
        signal?.addEventListener('abort', cancel, { once: true })
    })

    const transcript = (response?.results ?? [])
        .map(r => r.alternatives?.[0]?.transcript ?? '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()

    return transcript
}

/** Collect a Node request stream into a Buffer, rejecting oversized payloads early. */
export async function readRawBody(req, limit = MAX_AUDIO_BYTES) {
    if (Buffer.isBuffer(req.body)) {
        if (req.body.length > limit) throw new TranscribeError(413, 'TOO_LARGE', 'Audio payload exceeds the size limit.')
        return req.body
    }
    const chunks = []
    let total = 0
    for await (const chunk of req) {
        total += chunk.length
        if (total > limit) throw new TranscribeError(413, 'TOO_LARGE', 'Audio payload exceeds the size limit.')
        chunks.push(chunk)
    }
    return Buffer.concat(chunks)
}
