import { useEffect, useState } from 'react'
import { dayKey } from '../../domain/journal/reporting'

/**
 * Today's local calendar date ("2026-09-28"), updated at the trader's midnight.
 * Screens that show daily checklists depend on it so a tab left open overnight resets.
 */
export function useLocalDay() {
    const [day, setDay] = useState(() => dayKey(new Date()))
    useEffect(() => {
        const next = new Date(); next.setHours(24, 0, 1, 0)
        const timer = setTimeout(() => setDay(dayKey(new Date())), next - Date.now())
        // Timers pause in background tabs; re-check when the tab becomes visible.
        const onVisible = () => { if (document.visibilityState === 'visible') setDay(dayKey(new Date())) }
        document.addEventListener('visibilitychange', onVisible)
        return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', onVisible) }
    }, [day])
    return day
}
