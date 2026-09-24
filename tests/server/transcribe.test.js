import { beforeEach, describe, expect, it, vi } from 'vitest'
import { transcribeHandler } from '../../api/transcribe.js'
import { readRawBody, transcribeWav, TranscribeError } from '../../server/speech/transcription.js'

vi.mock('../../server/speech/transcription.js', () => ({
    readRawBody: vi.fn(), transcribeWav: vi.fn(),
    TranscribeError: class extends Error {
        constructor(status, code, message) { super(message); this.status = status; this.code = code }
    },
}))

const response = () => ({ setHeader: vi.fn(), end: vi.fn() })
beforeEach(() => vi.resetAllMocks())

describe('shared transcription handler', () => {
    it.each([
        { url: '/?language=hi-IN' },
        { url: '/api/transcribe', query: { language: 'hi-IN' } },
    ])('accepts language from either host request shape: %j', async request => {
        const audio = Buffer.from('audio')
        readRawBody.mockResolvedValue(audio)
        transcribeWav.mockResolvedValue('Long bitcoin.')
        const res = response()
        await transcribeHandler({ method: 'POST', ...request }, res, { NVIDIA_API_KEY: 'key', NVIDIA_ASR_FUNCTION_ID: 'model' })
        expect(transcribeWav).toHaveBeenCalledWith(audio, 'hi-IN', 'key', 'model')
        expect(res.statusCode).toBe(200)
        expect(JSON.parse(res.end.mock.calls[0][0])).toEqual({ text: 'Long bitcoin.' })
    })
    it('rejects other methods before consuming audio', async () => {
        const res = response()
        await transcribeHandler({ method: 'GET' }, res, {})
        expect(res.statusCode).toBe(405)
        expect(res.setHeader).toHaveBeenCalledWith('Allow', 'POST')
        expect(readRawBody).not.toHaveBeenCalled()
    })
    it('preserves provider errors', async () => {
        readRawBody.mockRejectedValue(new TranscribeError(413, 'TOO_LARGE', 'Audio too large.'))
        const res = response()
        await transcribeHandler({ method: 'POST', url: '/' }, res, {})
        expect(res.statusCode).toBe(413)
        expect(JSON.parse(res.end.mock.calls[0][0])).toEqual({ error: 'Audio too large.', code: 'TOO_LARGE' })
    })
})
