import { describe, expect, it } from 'vitest'
import { readSSE } from './sse'
async function decode(text, chunkSize = 1) {
    const bytes = new TextEncoder().encode(text)
    const stream = new ReadableStream({ start(controller) { for (let i = 0; i < bytes.length; i += chunkSize) controller.enqueue(bytes.slice(i, i + chunkSize)); controller.close() } })
    const result = []
    for await (const frame of readSSE(stream)) result.push(frame)
    return result
}
describe('SSE network framing', () => {
    it('preserves UTF-8 characters and CRLF split across packets', async () => { expect(await decode('data: {"text":"हैलो €"}\r\n\r\ndata: [DONE]\r\n\r\n')).toEqual(['{"text":"हैलो €"}', '[DONE]']) })
    it('ignores heartbeats and joins data lines', async () => { expect(await decode(': keepalive\n\ndata: one\ndata: two\n\n')).toEqual(['one\ntwo']) })
    it('handles multiple frames per packet and a final unterminated frame', async () => { expect(await decode('data: a\n\ndata: b\n\ndata: c', 200)).toEqual(['a', 'b', 'c']) })
})
