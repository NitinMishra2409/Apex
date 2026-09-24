import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../../platform/supabase/client'
import { DEMO, DEMO_USER, DEMO_SESSION } from '../../platform/demo/store'

import { AuthContext } from './useAuth'

export const AuthProvider = ({ children }) => {
    const [session, setSession] = useState(DEMO ? DEMO_SESSION : null)
    const [user, setUser] = useState(DEMO ? DEMO_USER : null)
    const [isAdmin, setIsAdmin] = useState(DEMO)
    const [loading, setLoading] = useState(!DEMO)
    const navigate = useNavigate()

    const fetchProfile = useCallback(async (userId) => {
        if (!userId) { setIsAdmin(false); return }
        try {
            const { data } = await supabase
                .from('user_profiles')
                .select('is_admin')
                .eq('user_id', userId)
                .single()
            setIsAdmin(data?.is_admin ?? false)
        } catch {
            setIsAdmin(false)
        }
    }, [])

    useEffect(() => {
        if (DEMO) return // demo session is already seeded above

        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
            setUser(session?.user ?? null)
            fetchProfile(session?.user?.id).finally(() => setLoading(false))
        })

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                setSession(session)
                setUser(session?.user ?? null)

                if (event === 'SIGNED_IN') {
                    // Create user profile if it doesn't exist
                    if (session?.user?.id) {
                        await supabase
                            .from('user_profiles')
                            .upsert(
                                { user_id: session.user.id, is_admin: false },
                                { onConflict: 'user_id', ignoreDuplicates: true }
                            )
                        fetchProfile(session.user.id)
                    }
                    navigate('/dashboard')
                }

                if (event === 'SIGNED_OUT') {
                    setIsAdmin(false)
                    navigate('/login')
                }
            }
        )

        return () => subscription.unsubscribe()
    }, [fetchProfile, navigate])

    const signUp = async (email, password) => {
        if (DEMO) { toast.success('Demo mode — already signed in as the demo trader.'); navigate('/dashboard'); return }
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        toast.success('Account created! Check your email to verify.')
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
        setIsAdmin(false)
    }

    const resetPassword = async (email) => {
        if (DEMO) { toast('Demo mode — password reset is disabled.'); return }
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`,
        })
        if (error) throw error
        toast.success('Password reset email sent!')
    }

    return (
        <AuthContext.Provider value={{ session, user, isAdmin, loading, signUp, signIn, signInWithGoogle, signOut, resetPassword }}>
            {children}
        </AuthContext.Provider>
    )
}

