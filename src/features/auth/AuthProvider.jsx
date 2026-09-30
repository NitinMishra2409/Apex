import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../../platform/supabase/client'
import { DEMO, DEMO_USER, DEMO_SESSION } from '../../platform/demo/store'

import { AuthContext } from './useAuth'

const ENTRY_PATHS = ['/', '/login', '/signup']

export const AuthProvider = ({ children }) => {
    const [session, setSession] = useState(DEMO ? DEMO_SESSION : null)
    const [user, setUser] = useState(DEMO ? DEMO_USER : null)
    const [loading, setLoading] = useState(!DEMO)
    const [passwordRecovery, setPasswordRecovery] = useState(false)
    const navigate = useNavigate()

    useEffect(() => {
        if (DEMO) return // demo session is already seeded above

        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
            setUser(session?.user ?? null)
            setLoading(false)
        })

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                setSession(session)
                setUser(session?.user ?? null)

                if (event === 'PASSWORD_RECOVERY') {
                    // Recovery sign-in must land on the reset form, not the generic
                    // SIGNED_IN → Dashboard redirect below.
                    setPasswordRecovery(true)
                    navigate('/reset-password')
                    return
                }

                if (event === 'SIGNED_IN') {
                    // Create the profile row (currency, starting balance) on first sign-in.
                    // Deferred: awaiting another Supabase call inside this callback can deadlock the client.
                    const userId = session?.user?.id
                    if (userId) setTimeout(() => {
                        supabase.from('user_profiles')
                            .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true })
                            .then(({ error }) => { if (error) console.warn('[auth] profile upsert failed', error.message) })
                    }, 0)
                    // SIGNED_IN also arrives from other tabs and session recovery; only
                    // leave the public entry pages, never a workspace screen mid-edit.
                    if (ENTRY_PATHS.includes(window.location.pathname)) navigate('/dashboard')
                }

                if (event === 'SIGNED_OUT') {
                    navigate('/login')
                }
            }
        )

        return () => subscription.unsubscribe()
    }, [navigate])

    const signUp = async (email, password) => {
        if (DEMO) { toast.success('Demo mode — already signed in as the demo trader.'); navigate('/dashboard'); return }
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            // Return the confirmation link to the site the trader signed up on (must be allow-listed).
            options: { emailRedirectTo: window.location.origin },
        })
        if (error) throw error
        // With email confirmation on, Supabase answers an existing address with a user that has no identities.
        if (data.user && !data.user.identities?.length) throw new Error('An account with this email already exists. Sign in instead.')
        if (data.session) return { needsConfirmation: false }
        toast.success('Account created! Check your email to verify.')
        return { needsConfirmation: true }
    }

    const signIn = async (email, password) => {
        if (DEMO) { toast.success('Demo mode — already signed in as the demo trader.'); navigate('/dashboard'); return }
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
    }

    const signInWithGoogle = async () => {
        if (DEMO) { toast.success('Demo mode — Google sign-in is disabled.'); navigate('/dashboard'); return }
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin
            }
        })
        if (error) throw error
    }

    const signOut = async () => {
        if (DEMO) { toast('Demo mode — set VITE_DEMO_MODE=false in .env to sign out.'); return }
        await supabase.auth.signOut()
    }

    const resetPassword = async (email) => {
        if (DEMO) { toast('Demo mode — password reset is disabled.'); return }
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`,
        })
        if (error) throw error
        toast.success('Password reset email sent!')
    }

    const updatePassword = async (password) => {
        if (DEMO) { toast('Demo mode — password reset is disabled.'); return }
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw error
        setPasswordRecovery(false)
    }

    return (
        <AuthContext.Provider value={{ session, user, loading, passwordRecovery, signUp, signIn, signInWithGoogle, signOut, resetPassword, updatePassword }}>
            {children}
        </AuthContext.Provider>
    )
}

