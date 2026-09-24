import { afterEach, describe, expect, it, vi } from 'vitest'
import { encodeWav, startRecording } from './recording'
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
        await vi.advanceTimersByTimeAsync(1000); expect(onSilence).not.toHaveBeenCalled()
        await vi.advanceTimersByTimeAsync(400); expect(onSilence).toHaveBeenCalledTimes(1)
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
    it('encodes clipped PCM samples at the transcription sample rate', async () => {
        const wav = encodeWav(new Float32Array([-2, 0, 2]), 16000)
        const data = new DataView(await wav.arrayBuffer())
        expect(data.getUint32(24, true)).toBe(16000); expect(data.getInt16(44, true)).toBe(-32768); expect(data.getInt16(48, true)).toBe(32767)
    })
})
