import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('easy-speech', () => ({ default: { init: vi.fn(), voices: vi.fn(), speak: vi.fn(), cancel: vi.fn() } }))
import EasySpeech from 'easy-speech'

beforeEach(() => {
    vi.resetModules(); vi.clearAllMocks()
    EasySpeech.init.mockResolvedValue(true)
    EasySpeech.voices.mockReturnValue([{ name: 'Device English', lang: 'en-US', localService: true }])
    EasySpeech.speak.mockImplementation(async ({ start }) => { start() })
})
describe('device speech adapter', () => {
    it('selects a local English voice and waits for playback completion', async () => {
        const { speakWithDevice } = await import('./browserSpeech')
        const onState = vi.fn()
        await speakWithDevice('Hello.', new AbortController().signal, onState)
        expect(EasySpeech.speak).toHaveBeenCalledWith(expect.objectContaining({ text: 'Hello.', voice: expect.objectContaining({ localService: true }), rate: 1 }))
        expect(onState).toHaveBeenCalledWith('speaking')
    })
    it('stops browser playback immediately even if its promise never settles', async () => {
        const { speakWithDevice } = await import('./browserSpeech')
        const controller = new AbortController()
        let started
        const ready = new Promise(resolve => { started = resolve })
        EasySpeech.speak.mockImplementation(({ start }) => { start(); started(); return new Promise(() => {}) })
        const result = speakWithDevice('Hello.', controller.signal, vi.fn())
        const rejected = expect(result).rejects.toMatchObject({ name: 'AbortError' })
        await ready; controller.abort(); await rejected
        expect(EasySpeech.cancel).toHaveBeenCalledTimes(1)
    })
    it('does not start speech when interrupted during voice loading', async () => {
        const { speakWithDevice } = await import('./browserSpeech')
        let initialized
        EasySpeech.init.mockReturnValue(new Promise(resolve => { initialized = resolve }))
        const controller = new AbortController(), result = speakWithDevice('Hello.', controller.signal, vi.fn())
        const rejected = expect(result).rejects.toMatchObject({ name: 'AbortError' })
        controller.abort(); initialized(true); await rejected
        expect(EasySpeech.speak).not.toHaveBeenCalled(); expect(EasySpeech.cancel).not.toHaveBeenCalled()
    })
    it('reports unsupported browsers and permits a later initialization retry', async () => {
        const { speakWithDevice } = await import('./browserSpeech')
        EasySpeech.init.mockRejectedValueOnce(new Error('No voices'))
        await expect(speakWithDevice('Hello.', new AbortController().signal, vi.fn())).rejects.toThrow('Device voice is unavailable')
        await speakWithDevice('Retry.', new AbortController().signal, vi.fn())
        expect(EasySpeech.init).toHaveBeenCalledTimes(2)
    })
})
