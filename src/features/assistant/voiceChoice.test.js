import { afterEach, describe, expect, it, vi } from 'vitest'
import { readVoiceChoice, saveVoiceChoice } from './voiceChoice'

const stubStorage = values => vi.stubGlobal('localStorage', {
    getItem: key => values[key] ?? null,
    setItem: (key, value) => { values[key] = value },
})

describe('remembered coach voice', () => {
    afterEach(() => vi.unstubAllGlobals())
    it('defaults to the device voice when nothing is stored or the value is unknown', () => {
        stubStorage({}); expect(readVoiceChoice()).toBe('device')
        stubStorage({ 'apexlog-coach-voice': 'robot' }); expect(readVoiceChoice()).toBe('device')
    })
    it('round-trips the studio and device choices', () => {
        const values = {}; stubStorage(values)
        saveVoiceChoice('studio'); expect(readVoiceChoice()).toBe('studio')
        saveVoiceChoice('device'); expect(readVoiceChoice()).toBe('device')
    })
    it('still works when storage is blocked, as in private browsing', () => {
        vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } })
        expect(readVoiceChoice()).toBe('device')
        expect(() => saveVoiceChoice('studio')).not.toThrow()
    })
})
