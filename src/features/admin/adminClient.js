import { createClient } from '@supabase/supabase-js'

// This client uses the service role key — it bypasses Row Level Security.
// ONLY import this file inside src/features/admin/repository.js — never use it in regular pages.

let adminInstance = null

export const getAdminSupabase = () => {
    if (!adminInstance) {
        adminInstance = createClient(
            import.meta.env.VITE_SUPABASE_URL,
            import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false,
                    detectSessionInUrl: false,
                    storageKey: 'apexlog-admin'
                }
            }
        )
    }
    return adminInstance
}

export default getAdminSupabase()
