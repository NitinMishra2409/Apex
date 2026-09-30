import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { DEFAULT_CURRENCY } from '../../domain/trades/vocabulary'
import { getProfile, saveProfile } from './repository'
import { ProfileContext } from './useProfile'

export function ProfileProvider({ children }) {
    const { user } = useAuth()
    const [profile, setProfile] = useState({ currency: DEFAULT_CURRENCY, startingBalance: null })
    const [loading, setLoading] = useState(false)
    useEffect(() => {
        if (!user) { setProfile({ currency: DEFAULT_CURRENCY, startingBalance: null }); return }
        let alive = true
        setLoading(true)
        getProfile(user.id).then(p => { if (alive) setProfile(p) }).catch(() => { /* keep defaults */ }).finally(() => { if (alive) setLoading(false) })
        return () => { alive = false }
    }, [user])
    const update = useCallback(async next => {
        const saved = await saveProfile(user.id, next)
        setProfile(saved)
        return saved
    }, [user])
    return <ProfileContext.Provider value={{ ...profile, loading, update }}>{children}</ProfileContext.Provider>
}
