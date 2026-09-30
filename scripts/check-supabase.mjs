// Explicit live check of the Supabase project in .env. Uses only the public
// anon key: confirms the project answers, supabase/schema.sql has been run
// (every table and column the app reads or writes exists), and which auth
// providers are on. Reads no user rows and never prints key values.
import { loadEnv } from 'vite'
const env = { ...loadEnv('development', process.cwd(), ''), ...process.env }
const url = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').replace(/\/+$/, '')
const key = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || ''
// Columns mirror supabase/schema.sql and the writes in src/domain/trades/record.js.
const TABLES = {
    user_profiles: 'user_id,currency,starting_balance,created_at,updated_at',
    trades: 'id,user_id,date,symbol,asset_class,direction,entry,exit_price,sl,tp,units,fees,rr,pnl,result,setup_type,mistakes,emotional_notes,checklist,created_at',
    checklists: 'id,user_id,type,items,updated_at',
    daily_progress: 'id,user_id,date,type,checked_items',
    custom_mistakes: 'id,user_id,label,created_at',
}
const warn = message => console.log(`warning: ${message}`)
const fail = message => { console.error(`failed: ${message}`); process.exitCode = 1 }

if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)) fail('VITE_SUPABASE_URL must look like https://<project-ref>.supabase.co (Project Settings -> API).')
if (key.length < 40) fail('VITE_SUPABASE_ANON_KEY is missing or still a placeholder (Project Settings -> API keys).')
if (process.exitCode) process.exit()
if (env.VITE_DEMO_MODE === 'true') warn('VITE_DEMO_MODE=true, so the app still uses seeded demo data. Set it to false to use this project.')
if (env.VITE_SUPABASE_SERVICE_ROLE_KEY) warn('VITE_SUPABASE_SERVICE_ROLE_KEY is set. Nothing reads it and a VITE_ value can reach the browser; delete it.')

const headers = { apikey: key }
const settings = await fetch(`${url}/auth/v1/settings`, { headers, signal: AbortSignal.timeout(15000) })
    .catch(err => fail(`could not reach ${url}: ${err.message}`))
if (!settings) process.exit()
if (!settings.ok) {
    fail(`auth settings returned ${settings.status}. Check the anon key belongs to this project.`)
    process.exit()
}
const auth = await settings.json()
console.log(`Project reachable: ${new URL(url).hostname}`)
console.log(`Email sign-in: ${auth.external?.email ? 'on' : 'OFF'}${auth.mailer_autoconfirm ? ' (confirmation email off)' : ' (confirmation email on)'}`)
console.log(`Google sign-in: ${auth.external?.google ? 'on' : 'off'}`)
if (!auth.external?.email) fail('enable the Email provider under Authentication -> Sign In / Providers.')
if (!auth.external?.google) warn('Google sign-in is off; the Google button will error until the provider is enabled.')

for (const [table, columns] of Object.entries(TABLES)) {
    const response = await fetch(`${url}/rest/v1/${table}?select=${columns}&limit=1`, { headers, signal: AbortSignal.timeout(15000) })
    const body = await response.json().catch(() => null)
    if (!response.ok) fail(`${table}: ${response.status} ${body?.code || ''} ${body?.message || ''}. Run supabase/schema.sql in the SQL editor.`)
    else if (Array.isArray(body) && body.length) fail(`${table}: anonymous read returned rows, so row-level security is not protecting it.`)
    else console.log(`${table}: ok`)
}
console.log(process.exitCode ? 'Supabase check failed.' : 'Supabase check passed.')
