const KEY = 'apexlog-coach-voice'
export const DEFAULT_VOICE = 'device'

// The trader's spoken-reply voice, remembered in this browser: 'device' or 'studio' (Groq Orpheus).
export function readVoiceChoice() {
    try {
        const value = localStorage.getItem(KEY)
        return value === 'studio' || value === 'device' ? value : DEFAULT_VOICE
    } catch { return DEFAULT_VOICE }
}

export function saveVoiceChoice(choice) {
    try { localStorage.setItem(KEY, choice) } catch { /* private browsing: the choice lasts for this visit only */ }
}
