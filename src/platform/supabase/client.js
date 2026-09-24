import { createClient } from '@supabase/supabase-js'

let supabaseInstance = null

export const getSupabase = () => {
    if (!supabaseInstance) {
        supabaseInstance = createClient(
            import.meta.env.VITE_SUPABASE_URL,
            import.meta.env.VITE_SUPABASE_ANON_KEY,
            {
                auth: {
                    autoRefreshToken: true,
                    persistSession: true,
                    detectSessionInUrl: true,
                    storageKey: 'apexlog-auth'
                }
            }
        )
    }
    return supabaseInstance
}

export const supabase = getSupabase()
