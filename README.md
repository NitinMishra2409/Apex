# Apexlog — Crypto Trading Journal

A trading journal for crypto traders: log every trade, surface the mistakes that
repeat, and find your edge.

> **Deep dive:** [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) documents every module,
> the data model, key flows, performance decisions and known issues.

---

## Quick start

```bash
npm install
cp .env.example .env      # fill in the values below
npm run dev               # http://localhost:5173
```

**Want to look around without a backend?** Set `VITE_DEMO_MODE=true` in `.env`
and you get a signed-in demo account with 74 seeded trades, no Supabase project
required.

---

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server + all four `/api/` routes |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve `dist/` — **no API routes**, so voice dictation won't work |
| `npm run lint` | ESLint (baseline is 0 errors — keep it there) |
| `npm test` | Vitest, 127 tests |
| `npm run test:watch` | Vitest in watch mode |

---

## Environment variables

Copy `.env.example` to `.env`. **Restart the dev server after any change** —
Vite reads `.env` only at startup, and this is the most common "why isn't it
working" cause.

| Variable | Public? | Required | Purpose |
|---|---|---|---|
| `VITE_SUPABASE_URL` | **yes** | yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | **yes** | yes | Anon key; RLS protects the data |
| `VITE_SUPABASE_SERVICE_ROLE_KEY` | **yes** ⚠️ | admin panel | Bypasses RLS — see the warning below |
| `VITE_DEMO_MODE` | **yes** | no | `true` = seeded demo data, no backend |
| `VITE_DEMO_LATENCY_MS` | **yes** | no | Artificial demo delay, default `60` |
| `NVIDIA_API_KEY` | no | voice | Server-side only, no `VITE_` prefix |
| `NVIDIA_ASR_FUNCTION_ID` | no | no | Override the Whisper function id |

> **The rule:** `VITE_` = baked into the public bundle and readable by anyone.
> No prefix = stays on the server. Never put a secret behind `VITE_`.

---

## Features

- **Trade logging** — entry, exit, SL, TP, size, setup, mistakes, emotional
  notes, with RR / P&L / result computed live as you type
- **Voice dictation** — speak a trade and it fills the form
  (*"long BTC at 68,400, stop 67,200, target 71,500, size 5000, breakout"*)
- **Dashboard** — today's performance, six stat cards, equity curve, checklist
  progress
- **Trade log** — filter by result / direction / setup / date, inline edit,
  CSV export
- **Analytics** — mistake frequency, per-setup win rates, P&L by weekday,
  win/loss split, monthly heatmap
- **Checklists** — pre-market, during-trade and post-trade, ticked per day
- **Admin panel** — user management and app-wide stats
- Press <kbd>N</kbd> anywhere to jump to New Trade

---

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Run [`supabase/schema.sql`](./supabase/schema.sql) in the SQL editor — it
   creates the tables, RLS policies and the signup trigger.
3. **Authentication → Providers**: enable Email.
4. **Authentication → URL Configuration**: add your deployed URL as both Site URL
   and a Redirect URL (`https://your-app.vercel.app/**`).
5. Make yourself an admin:
   ```sql
   UPDATE user_profiles SET is_admin = true WHERE user_id = 'YOUR_USER_ID';
   ```

---

## Voice dictation setup

Speech-to-text runs on NVIDIA's hosted Whisper Large v3. Get a key at
[build.nvidia.com](https://build.nvidia.com/openai/whisper-large-v3), then:

```
NVIDIA_API_KEY=nvapi-...
```

No `VITE_` prefix — the key is used only by the server route, so it never
reaches the browser. Restart the dev server afterwards.

> The hosted model is **Riva ASR over gRPC**, not the REST endpoint shown on the
> model page (that one is for self-hosted containers and returns 404 here). See
> ARCHITECTURE.md §5.4 before changing anything in `api/`.

The microphone requires `localhost` or HTTPS — browsers block it otherwise.

---

## Deploying to Vercel

1. Push to GitHub and import the repo on [vercel.com](https://vercel.com).
2. Add every environment variable from the table above in project settings.
3. Deploy.

`vercel.json` does two necessary things: rewrites all paths to `/` so client-side
routing survives a refresh, and `includeFiles: "server/speech/proto/**"` so the protobuf
files ship with the serverless function. **Without the second, the build
succeeds and transcription fails at runtime.**

After deploying, work through [`docs/SETUP_CHECKLIST.md`](./docs/SETUP_CHECKLIST.md).

---

## ⚠️ Before you deploy publicly

`VITE_SUPABASE_SERVICE_ROLE_KEY` is currently read in client-side code
(`src/features/admin/adminClient.js`), which means **it ships inside the public
JavaScript bundle**. That key bypasses Row Level Security entirely — anyone who
opens devtools can read or delete every user's data.

Verify for yourself:

```bash
npm run build && grep -o "your-service-role-key" dist/assets/*.js
```

The fix is to move `src/features/admin/repository.js` behind a server route, the same way
`/api/transcribe` handles the NVIDIA key. Until then, treat this as a
demo/personal deployment only. See ARCHITECTURE.md §10.

## Conversational AI Coach

AI Coach now connects authenticated journal context to streaming Llama 3.3 70B chat on Groq, with Whisper transcription and Groq Orpheus (Autumn) voice replies. For local testing, use `VITE_DEMO_MODE=true`, server-only `GROQ_API_KEY` for chat/speech and `NVIDIA_API_KEY` for transcription, and `npm run dev` on localhost—no sign-in is needed. Deployed use requires a real signed-in account (`VITE_DEMO_MODE=false`). Voice mode detects pauses between turns and provides Interrupt/End controls.

See [assistant setup, architecture and live verification status](docs/AI_ASSISTANT.md). The Orpheus/Whisper synthetic round-trip passed. On speech rate limits, Easy Speech supplies a device voice for the remainder of the conversation. The assistant now uses Groq Llama 3.3 70B; see the linked verification status for the latest live model check. No live journal data was used in the provider checks.
