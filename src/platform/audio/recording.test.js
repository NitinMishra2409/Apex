import { afterEach, describe, expect, it, vi } from 'vitest'
import { startRecording } from './recording'
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
function microphone() {
    const track = { stop: vi.fn() }, close = vi.fn().mockResolvedValue(), level = { value: .05 }
    const stream = { getTracks: () => [track] }
    class Recorder {
        static isTypeSupported() { return true }
        start() { this.state = 'recording' }
        stop() { this.state = 'inactive'; this.onstop?.() }
    }
    class Context {
        resume() { return Promise.resolve() }
        close = close
        createAnalyser() { return { getFloatTimeDomainData: samples => samples.fill(level.value) } }
        createMediaStreamSource() { return { connect() {} } }
    }
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(stream) } })
    vi.stubGlobal('MediaRecorder', Recorder)
    vi.stubGlobal('window', { MediaRecorder: Recorder, AudioContext: Context })
    return { track, close, level }
}
describe('voice capture lifecycle', () => {
    it('detects the end of speech only after a sustained pause', async () => {
        vi.useFakeTimers()
        const { level, track, close } = microphone(), onSilence = vi.fn()
        const handle = await startRecording({ onSilence })
        await vi.advanceTimersByTimeAsync(500); expect(onSilence).not.toHaveBeenCalled()
        level.value = 0
        await vi.advanceTimersByTimeAsync(700); expect(onSilence).not.toHaveBeenCalled()
        await vi.advanceTimersByTimeAsync(300); expect(onSilence).toHaveBeenCalledTimes(1)
        handle.cancel(); expect(track.stop).toHaveBeenCalled(); expect(close).toHaveBeenCalled()
    })
    it('stops the idle microphone workflow after 30 seconds without speech', async () => {
        vi.useFakeTimers()
        const { level } = microphone(), onNoSpeech = vi.fn(); level.value = 0
        const handle = await startRecording({ onSilence: vi.fn(), onNoSpeech })
        await vi.advanceTimersByTimeAsync(30200); expect(onNoSpeech).toHaveBeenCalledTimes(1); handle.cancel()
    })
    it('releases acquired tracks when the recorder cannot initialize', async () => {
        const { track } = microphone()
        class BrokenRecorder { static isTypeSupported() { return true } constructor() { throw new Error('Unsupported') } }
        vi.stubGlobal('MediaRecorder', BrokenRecorder)
        await expect(startRecording()).rejects.toThrow('Unsupported'); expect(track.stop).toHaveBeenCalledTimes(1)
    })
    it('returns the recorder output as-is, typed for upload', async () => {
        const { track } = microphone()
        class OpusRecorder {
            static isTypeSupported(type) { return type === 'audio/webm;codecs=opus' }
            constructor(stream, options) { this.mimeType = options.mimeType }
            start() { this.state = 'recording' }
            stop() { this.state = 'inactive'; this.ondataavailable({ data: new Blob(['opus']) }); this.onstop() }
        }
        vi.stubGlobal('MediaRecorder', OpusRecorder)
        const blob = await (await startRecording()).stop()
        expect(blob.type).toBe('audio/webm;codecs=opus'); expect(await blob.text()).toBe('opus'); expect(track.stop).toHaveBeenCalled()
    })
})
