import { describe, expect, it, vi } from 'vitest'
import { createSpeechQueue, splitSpeech } from './speechQueue'
describe('spoken responses', () => {
    it('cancels prefetched speech and stops playback on failure while reporting one readable error', async () => {
        const requests = [], stop = vi.fn(), onError = vi.fn(), states = []
        const queue = createSpeechQueue({
            signal: new AbortController().signal,
            synthesize: async (text, signal) => { requests.push(signal); return text },
            play: async () => { throw new Error('Speech playback failed.') },
            stop, onError, onState: state => states.push(state),
        })
        queue.append('This is the first complete spoken sentence. This is the second complete spoken sentence.')
        expect(await queue.finish()).toBe(false)
        expect(requests).toHaveLength(2)
        expect(requests.every(signal => signal.aborted)).toBe(true)
        expect(stop).toHaveBeenCalledTimes(1)
        expect(onError).toHaveBeenCalledTimes(1)
        expect(states.at(-1)).toBe('idle')
    })
    it('reports failure during the playback drain instead of silently returning success', async () => {
        const onError = vi.fn()
        const queue = createSpeechQueue({ signal: new AbortController().signal, synthesize: async () => 'audio', play: async () => {}, drain: async () => { throw new Error('Audio was interrupted.') }, onError, onState: vi.fn() })
        queue.append('This is a complete spoken sentence.')
        expect(await queue.finish()).toBe(false)
        expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'Audio was interrupted.' }))
    })
    it('retries only the unspoken phrase on rate limit and retains device voice across replies', async () => {
        const controller = new AbortController(), voiceSession = { device: false }, heard = [], onError = vi.fn(), onProvider = vi.fn()
        const synthesize = vi.fn().mockResolvedValueOnce('first audio').mockRejectedValue(Object.assign(new Error('quota'), { status: 429 }))
        const fallback = vi.fn(async text => heard.push(text))
        const options = { signal: controller.signal, synthesize, voiceSession, fallback, play: async text => heard.push(text), onState: vi.fn(), onError, onProvider }
        const queue = createSpeechQueue(options)
        queue.append('First phrase is long enough to speak. Second phrase is also long enough to speak. Third phrase is long enough to speak.')
        expect(await queue.finish()).toBe(true)
        const next = createSpeechQueue(options); next.append('Another reply in the same conversation.'); await next.finish()
        expect(synthesize).toHaveBeenCalledTimes(2)
        expect(heard).toEqual(['first audio', 'Second phrase is also long enough to speak.', 'Third phrase is long enough to speak.', 'Another reply in the same conversation.'])
        expect(onProvider).toHaveBeenCalledWith('device'); expect(onError).not.toHaveBeenCalled()
        expect(voiceSession.limited).toBe(true)
        const fresh = createSpeechQueue({ ...options, voiceSession: { device: false }, synthesize: vi.fn().mockResolvedValue('new conversation') })
        fresh.append('A fresh conversation tries Orpheus again.'); await fresh.finish()
        expect(heard.at(-1)).toBe('new conversation')
    })
    it.each([401, 403, 500])('does not mask other speech failures with fallback (%s)', async status => {
        const fallback = vi.fn(), onError = vi.fn()
        const queue = createSpeechQueue({ signal: new AbortController().signal, synthesize: async () => { throw Object.assign(new Error('failure'), { status }) }, fallback, onState: vi.fn(), onError })
        queue.append('A reply that cannot be generated.'); expect(await queue.finish()).toBe(false)
        expect(fallback).not.toHaveBeenCalled(); expect(onError).toHaveBeenCalledTimes(1)
    })
    it('cancels during fallback without speaking remaining phrases or reporting an error', async () => {
        const controller = new AbortController(), fallback = vi.fn(async () => { controller.abort(); throw new DOMException('Aborted', 'AbortError') }), onError = vi.fn()
        const queue = createSpeechQueue({ signal: controller.signal, synthesize: async () => { throw Object.assign(new Error('quota'), { status: 429 }) }, fallback, onState: vi.fn(), onError })
        queue.append('This phrase starts device playback. This phrase must never be spoken.'); await queue.finish()
        expect(fallback).toHaveBeenCalledTimes(1); expect(onError).not.toHaveBeenCalled()
    })
    it('speaks on the device without any synthesize call when the device voice is chosen', async () => {
        const voiceSession = { device: true }, synthesize = vi.fn(), heard = [], onProvider = vi.fn()
        const queue = createSpeechQueue({ signal: new AbortController().signal, synthesize, voiceSession, fallback: async text => heard.push(text), onProvider, onState: vi.fn(), onError: vi.fn() })
        queue.append('This is the first complete sentence. This is the second complete sentence.')
        expect(await queue.finish()).toBe(true)
        expect(synthesize).not.toHaveBeenCalled()
        expect(heard).toHaveLength(2); expect(onProvider).toHaveBeenCalledWith('device')
    })
    it('applies a voice change from the next phrase without overlapping audio', async () => {
        const voiceSession = { device: false }, order = []
        const queue = createSpeechQueue({
            signal: new AbortController().signal, voiceSession, synthesize: async text => text,
            play: async text => { order.push(`studio:${text.slice(0, 5)}`); voiceSession.device = true },
            drain: async () => { order.push('drained') }, fallback: async text => { order.push(`device:${text.slice(0, 5)}`) },
            onState: vi.fn(), onError: vi.fn(),
        })
        queue.append('The first phrase is a full sentence. The second phrase is another full sentence.')
        await queue.finish()
        expect(order.slice(0, 3)).toEqual(['studio:The f', 'drained', 'device:The s'])
    })
    it('reports unavailable device speech once and leaves subsequent phrases unspoken', async () => {
        const fallback = vi.fn().mockRejectedValue(new Error('No voices')), onError = vi.fn()
        const queue = createSpeechQueue({ signal: new AbortController().signal, voiceSession: { device: true }, synthesize: vi.fn(), fallback, onState: vi.fn(), onError })
        queue.append('This phrase cannot use a device voice. This phrase must not try again.'); expect(await queue.finish()).toBe(false)
        expect(fallback).toHaveBeenCalledTimes(1); expect(onError).toHaveBeenCalledTimes(1)
    })
    it('holds a partial sentence until there is enough context', () => { expect(splitSpeech('Review your entries')).toEqual({ chunks: [], remainder: 'Review your entries' }) })
    it('bounds chunks to Orpheus limits and strips presentation markup', () => { const { chunks, remainder } = splitSpeech('**Review** the [journal](/log) before planning your next session. ' + 'word '.repeat(500), true); expect(remainder).toBe(''); expect(chunks.every(v => v.length <= 200)).toBe(true); expect(chunks[0]).not.toContain('**'); expect(chunks[0]).not.toContain('/log') })
    it('preserves long unbroken input and Unicode at phrase boundaries', () => {
        const input = 'a'.repeat(199) + '😀' + 'b'.repeat(240)
        const { chunks, remainder } = splitSpeech(input, true)
        expect(chunks.join('')).toBe(input); expect(remainder).toBe('')
        expect(chunks.every(chunk => chunk.length <= 200 && !/[\uD800-\uDBFF]$/.test(chunk))).toBe(true)
    })
    it('requests the next phrase while the current one plays, and plays in text order', async () => {
        const order = [], controller = new AbortController()
        const queue = createSpeechQueue({ signal: controller.signal, synthesize: async text => { order.push(`synthesize:${text.slice(0, 5)}`); return text }, play: async text => { order.push(`play:${text.slice(0, 5)}`) }, onState: vi.fn(), onError: vi.fn() })
        queue.append('Take a moment to review the decisions behind your last trade. '); queue.append('There is another useful pattern in your completed journal entries. ')
        await queue.finish()
        expect(order).toEqual(['synthesize:Take ', 'synthesize:There', 'play:Take ', 'play:There'])
    })
    it('waits for scheduled audio to finish before a device voice takes over', async () => {
        const order = [], controller = new AbortController()
        const synthesize = vi.fn().mockResolvedValueOnce('streamed').mockRejectedValue(Object.assign(new Error('quota'), { status: 429 }))
        const queue = createSpeechQueue({ signal: controller.signal, synthesize, play: async () => { order.push('scheduled') }, drain: async () => { order.push('drained') }, fallback: async text => { order.push(`device:${text.slice(0, 5)}`) }, voiceSession: { device: false }, onState: vi.fn(), onError: vi.fn() })
        queue.append('The first phrase streams from Orpheus. The second phrase hits the rate limit.')
        await queue.finish()
        expect(order).toEqual(['scheduled', 'drained', 'device:The s', 'drained'])
    })
    it('lets a short opening sentence start speaking straight away', () => {
        expect(splitSpeech('Good question. Your breakouts', false, 12).chunks).toEqual(['Good question.'])
        expect(splitSpeech('Good question. Your breakouts').chunks).toEqual([])
    })
    it('stops queued work after cancellation and reports speech failure once', async () => {
        const controller = new AbortController(), synthesize = vi.fn(), onError = vi.fn()
        controller.abort()
        const queue = createSpeechQueue({ signal: controller.signal, synthesize, onState: vi.fn(), onError })
        queue.append('A sentence that should never go to the speech generation service. '); await queue.finish(); expect(synthesize).not.toHaveBeenCalled()
        const failed = createSpeechQueue({ signal: new AbortController().signal, synthesize: async () => { throw new Error('Unavailable') }, onState: vi.fn(), onError })
        failed.append('A long enough sentence to begin speech synthesis for this response. Another long enough sentence to queue speech generation after failure. ')
        expect(await failed.finish()).toBe(false); expect(onError).toHaveBeenCalledTimes(1)
    })
})
