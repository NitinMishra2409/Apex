# Apex Log

A trading journal for any market: record your decisions, follow your playbooks, review your results, and discuss your journal with a read-only AI Coach.

**Run it locally without signing up.** Demo mode gives you a simulated signed-in trader and 90 sample trades. Log and edit trades, use checklists, explore analytics, and change settings without a Supabase account, API key, or authentication. Coach and voice features are optional and need your own Groq API key.

**Bring Your Own Key (BYOK):** each person running their own copy supplies their own Groq key for AI features. Requests use that key's account, quota, and any applicable billing. No shared project key is included. The current integration supports Groq.

Public live app and demo video: pending publication. The local setup below is the available way to try the app.

## Contents

- [Choose how to run it](#choose-how-to-run-it)
- [Install the prerequisites](#install-the-prerequisites)
- [Windows setup](#windows-setup)
- [macOS setup](#macos-setup)
- [Linux setup](#linux-setup)
- [Your first session](#your-first-session)
- [Local data and resetting the demo](#local-data-and-resetting-the-demo)
- [Bring your own API key: Coach and voice](#bring-your-own-api-key-coach-and-voice)
- [Use your own Supabase backend](#use-your-own-supabase-backend)
- [Environment variables](#environment-variables)
- [Features and calculations](#features-and-calculations)
- [Coach architecture and latency](#coach-architecture-and-latency)
- [Security and privacy](#security-and-privacy)
- [Development and verification](#development-and-verification)
- [Deploy to Vercel](#deploy-to-vercel)
- [Troubleshooting](#troubleshooting)

## Choose how to run it

| Mode | Sign-in | What you need | Where journal changes live |
| --- | --- | --- | --- |
| Local demo | None | Node.js and this repository | This browser's local storage |
| Local demo with Coach and voice | None | The above, internet access, and a Groq API key | Journal stays in local storage; relevant context/audio goes to Groq when used |
| Your own connected workspace | Email/password or configured Google sign-in | Your Supabase project; Groq is optional | Your Supabase database, scoped to your account |

Demo mode starts with sample data and has no cloud sync. It is intended for exploration and development, not as an encrypted or backed-up personal database. Each browser has its own sample workspace.

The supported no-authentication API path is **`npm run dev` on localhost with `VITE_DEMO_MODE=true`**. It is deliberately limited to local requests. Deployed Coach/voice endpoints require a real signed-in account; setting the demo flag on a public deployment does not remove that requirement.

## Install the prerequisites

Use **Node.js 24 LTS**, which includes npm, and Git. A current browser is also required. Internet access is needed to download the project and dependencies; Coach, transcription, and a connected Supabase workspace also need internet access at runtime.

- **Windows:** install Node.js 24 LTS using the Windows installer from [Node.js Downloads](https://nodejs.org/en/download). Install [Git for Windows](https://git-scm.com/downloads/win), then open a new PowerShell window.
- **macOS:** use the macOS installer from [Node.js Downloads](https://nodejs.org/en/download). Install Git using the [official macOS Git instructions](https://git-scm.com/downloads/mac). Open Terminal after installation. Choose the download for Apple Silicon or Intel if prompted.
- **Linux:** select Linux and Node.js 24 LTS on [Node.js Downloads](https://nodejs.org/en/download) and follow its instructions for your shell and CPU architecture. Install Git through your distribution's package manager, for example `sudo apt install git` on Debian/Ubuntu or `sudo dnf install git` on Fedora. Distribution-provided Node packages may be older; check the version before continuing.

Verify in the terminal you will use for the project:

```text
node --version
npm --version
git --version
```

Node should report `v24.x.x`. Reopen your terminal if a newly installed command is not found. No Docker, Python, Supabase CLI, or global Vite installation is required for the demo.

## Windows setup

Use **PowerShell**. These commands are for a new clone. If you already have the repository, open its folder and preserve any existing `.env` before changing it.

### 1. Download and install

```powershell
git clone https://github.com/NitinMishra2409/apexlog.git
cd apexlog
npm ci
Copy-Item .env.example .env
notepad .env
```

For a fork, substitute your fork's clone URL. Alternatively, use GitHub's **Code → Download ZIP**, extract it, and open PowerShell inside the folder containing `package.json`; then start at `npm ci`.

### 2. Configure a demo with no credentials

In Notepad, replace the contents of `.env` with this block and save:

```dotenv
VITE_DEMO_MODE=true
VITE_SUPABASE_URL=https://demo.supabase.co
VITE_SUPABASE_ANON_KEY=demo-anon-key
VITE_DEMO_LATENCY_MS=60
```

These are dummy values, not credentials. They let the shared Supabase client initialize; demo journal and account repositories use local storage. You do not need to create the project named in that URL. Leave `GROQ_API_KEY` out for now.

The filename must be **`.env`**, not `.env.txt`, beside `package.json`.

### 3. Start the app

```powershell
npm run dev -- --host localhost --port 5173 --strictPort
```

Open **http://localhost:5173/dashboard**. You should enter the sample workspace directly, without a login screen. The landing page is at http://localhost:5173/.

Leave PowerShell running while using the app. Press **Ctrl+C** to stop. To start again, open PowerShell in this folder and repeat the start command; no reinstall is needed.

If PowerShell says `npm.ps1` cannot run because scripts are disabled, replace `npm` with `npm.cmd` in every command: for example, `npm.cmd ci` and `npm.cmd run dev -- --host localhost --port 5173 --strictPort`. This avoids changing your execution policy.

## macOS setup

Use **Terminal** with its default zsh shell or bash. These commands create a new clone; preserve any existing `.env` if configuring an existing copy.

```bash
git clone https://github.com/NitinMishra2409/apexlog.git
cd apexlog
npm ci
cp .env.example .env
nano .env
```

Replace the contents of `.env` with:

```dotenv
VITE_DEMO_MODE=true
VITE_SUPABASE_URL=https://demo.supabase.co
VITE_SUPABASE_ANON_KEY=demo-anon-key
VITE_DEMO_LATENCY_MS=60
```

In nano, save with **Ctrl+O**, press **Enter**, then exit with **Ctrl+X**. These Supabase values are dummy initialization values; no backend account or key is needed. Other editors work too: save plain text with the exact filename `.env`.

Start the app:

```bash
npm run dev -- --host localhost --port 5173 --strictPort
```

Open **http://localhost:5173/dashboard** to enter the signed-in demo workspace. Keep Terminal running, and press **Ctrl+C** when finished. On later visits, repeat the start command from this folder.

If you downloaded a ZIP instead of cloning, extract it and `cd` into the folder containing `package.json` before `npm ci`. Quote paths containing spaces, for example `cd "/Users/you/Projects/Apex Log"`.

## Linux setup

Use a terminal with **bash** or **zsh** after installing Node.js and Git. For a new clone:

```bash
git clone https://github.com/NitinMishra2409/apexlog.git
cd apexlog
npm ci
cp .env.example .env
nano .env
```

Replace the contents of `.env` with:

```dotenv
VITE_DEMO_MODE=true
VITE_SUPABASE_URL=https://demo.supabase.co
VITE_SUPABASE_ANON_KEY=demo-anon-key
VITE_DEMO_LATENCY_MS=60
```

Save in nano with **Ctrl+O**, **Enter**, and **Ctrl+X**. Any plain-text editor works if nano is unavailable. These values are placeholders; there is no Supabase setup or sign-in step. Preserve your previous `.env` if using an existing project folder.

Start the app:

```bash
npm run dev -- --host localhost --port 5173 --strictPort
```

Open **http://localhost:5173/dashboard**, keep the terminal running, and stop with **Ctrl+C**. To return later, repeat the start command from this folder. For ZIP downloads, extract first and run commands from the folder containing `package.json`.

Run project npm commands as your ordinary user, without `sudo`. For permissions errors, use a user-owned project folder and check your Node installation and npm cache ownership.

## Your first session

Follow this six-step daily loop with the sample journal:

1. **Enter the workspace.** In demo mode, open `/dashboard` directly. With your own backend, sign up or sign in first.
2. **Prepare.** Tick the pre-market checklist on the dashboard or in Playbooks. Daily progress follows your computer's local calendar day.
3. **Log two trades.** Enter one with per-trade checklist items ticked; it is Planned. Enter another with no items ticked; it is Unplanned. With Groq enabled, dictate the first trade and review the fields and checklist before saving.
4. **Review Analytics.** Compare Planned and Unplanned results, inspect tilt, and explore the Monte Carlo simulation of your recorded results.
5. **Discuss the journal.** With Groq configured, ask Coach, “How did I do this month, and how did planned trades compare with unplanned trades?” Try **Call an expert** for a voice conversation with the same AI Coach. Without a key, continue exploring the journal and analytics.
6. **Close the day.** Complete the post-market checklist. Daily checklists start fresh at local midnight; saved per-trade checklists stay attached to their trades.

Example manual trade: LONG AAPL, entry 190, exit 194, stop 188, target 196, units 10, fees 2. Net realised P&L is **38** in your account currency, planned risk **20**, realised R **1.9**, and planned R:R **3**. Set your intended currency in Settings; changing currency changes the displayed label, not the numeric amounts.

## Local data and resetting the demo

Demo edits survive reloads in the same browser and origin using local storage. They do not sync between devices, browsers, ports, or `localhost` and `127.0.0.1`. Private browsing and clearing site data can remove them. If storage is blocked, changes may last only for the current visit.

Sample dates are relative to the first seed and then stay fixed. If recent-period charts become empty over time, select **All time** or reset the sample workspace.

To reset, open your browser's developer tools, select **Console**, and run:

```javascript
window.resetDemoData()
```

This **discards all demo journal changes, playbooks, daily progress, and demo profile settings** at the current origin, reloads the page, and creates fresh sample data. Export trades from Journal first if you want to keep them. CSV export is a record of trades, not a full backup or supported restore/import mechanism. Resetting the demo does not delete a connected Supabase journal.

## Bring your own API key: Coach and voice

Manual journaling, checklists, dashboard, analytics, and settings work without a provider key. Real Coach responses, microphone transcription, AI checklist matching, and studio speech need Groq.

### 1. Get your Groq API key

1. Open the [Groq console](https://console.groq.com/) and create an account or sign in. This is your provider account; it does not require an Apex Log account when running the local demo.
2. Open the console's [API Keys page](https://console.groq.com/keys) and choose the create-key action.
3. Give the key a recognizable name, such as `apexlog-local`, if prompted, and create it.
4. Copy the generated secret into your local configuration below. Store a recovery copy in your password manager if needed; treat it like a password.
5. Check your account's available models, usage, and limits before relying on Coach or studio voice. Your own provider account is responsible for usage and any enabled paid billing.

Groq's [official quickstart](https://console.groq.com/docs/quickstart) also links to key creation and explains environment-variable configuration. You do not need to install a separate Groq SDK for this project.

### 2. Add the key to your local copy

Open `.env` beside `package.json`: `notepad .env` on Windows or `nano .env` on macOS/Linux. Keep the four demo settings and add one line:

```dotenv
GROQ_API_KEY=replace-with-your-own-groq-key
```

Replace the text after `=` with the actual key. Do not add angle brackets, a `Bearer ` prefix, or a `VITE_` prefix. Use only one `GROQ_API_KEY` entry in the file. Save it as `.env`, not `.env.txt`.

The key belongs in your private `.env`, **not** `.env.example`, application source, browser local storage, or a Coach message. This repository ignores `.env`. Never force-add it to Git or share a screenshot containing it.

### 3. Restart and verify

Stop the server with **Ctrl+C**, then run:

```text
npm run dev -- --host localhost --port 5173 --strictPort
```

Open **http://localhost:5173/coach** and send a short typed question about the sample journal. A response confirms that your local server can use your key for chat. This request consumes your quota; there is no need to run a voice test first.

For dictation or an Expert call, allow browser microphone access. Use `localhost`; an ordinary HTTP LAN address may block microphones and does not qualify for local demo API authorization. Keep **Device voice**, the default, for speech from your OS. **Studio voice** opts into Groq Orpheus. Device voice avoids studio speech quota; reasoning and transcription still need Groq.

### 4. Keys on your own deployment

For Vercel, open your project's **Settings → Environment Variables**, add `GROQ_API_KEY` with your secret as its value, select the environments you intend to use, and deploy or redeploy. Your laptop's `.env` is not automatically uploaded. Follow [Deploy to Vercel](#deploy-to-vercel) for Supabase authentication and the remaining deployment settings.

BYOK here is configured **per running server or deployment**. If you host one installation for multiple people, its AI requests share the host's Groq key and quota. There is currently no in-app field for each signed-in visitor to supply a separate key. For separate quotas, each person runs or deploys their own copy with their own configuration.

To replace a key, create a new one in Groq, update `.env` and restart locally, or update Vercel and redeploy. Revoke the old key in Groq when it is no longer needed. If a key was exposed publicly, revoke it promptly; deleting it from a file does not invalidate it. Changing the Groq key can expire existing Coach conversations when no separate history secret is configured; start a new conversation.

Dictation fills a draft for review and never saves automatically. Spoken checklist numbers and supported wording can tick items; uncertain matches are highlighted. Device voice availability varies by browser and OS. Typed Coach chat remains usable without a microphone.

Model access and quotas depend on your account. Consult Groq's [supported models](https://console.groq.com/docs/models) and [rate limits](https://console.groq.com/docs/rate-limits) if a model is unavailable or requests are throttled. Free-tier access is not unlimited. A studio rate limit switches speech to the device voice for the rest of that conversation.

## Use your own Supabase backend

Skip this section for the no-auth demo. This setup uses a hosted Supabase project and real authentication; it does not run a local database.

### 1. Create the database

Create a project at [Supabase](https://supabase.com). Mumbai (`ap-south-1`) matches the supplied Vercel function region (`bom1`) if you plan to deploy.

In the new project's SQL editor, run the complete [supabase/schema.sql](supabase/schema.sql) **once**. It creates five application tables and their row-level security policies. Use a new database: the schema contains `CREATE TABLE` statements and is not an idempotent upgrade script. Do not drop existing tables to resolve a schema mismatch without a backup and a migration plan.

### 2. Configure authentication

Enable Email authentication. In Authentication's URL Configuration, set the local Site URL to `http://localhost:5173` and allow:

```text
http://localhost:5173
http://localhost:5173/reset-password
```

Use the same host and port in your browser; add other origins explicitly if you change them. For optional Google sign-in, follow [Supabase's Google provider setup](https://supabase.com/docs/guides/auth/social-login/auth-google): create a Google OAuth client, use the Supabase callback URL shown in the dashboard as its authorized redirect URI, and configure its client ID and secret in Supabase.

Email confirmations and recovery depend on Supabase email configuration and limits. Its [redirect URL guidance](https://supabase.com/docs/guides/auth/redirect-urls) explains the Site URL and allow-list.

### 3. Set the environment

In your own Supabase project, open its **Connect** dialog or project settings to copy the project URL. In **Settings → API Keys**, find the legacy **anon** key (under the legacy API keys section if the dashboard separates key types). The variable is named `VITE_SUPABASE_ANON_KEY`, and this setup uses that public anon key. Do not copy the `service_role` key, a secret key, or the database password. Supabase's [API key guide](https://supabase.com/docs/guides/api/api-keys) explains the key types.

Replace the demo configuration in `.env`:

```dotenv
VITE_DEMO_MODE=false
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

Keep `GROQ_API_KEY` only if you want Coach and voice. Do not use a service-role key. The public anon key works with the signed-in user's token and the database's row-level security policies.

### 4. Restart and create an account

Restart the dev server, visit `/signup`, create an account, and follow the confirmation email if enabled. Sign in at `/login`. The app creates your profile on sign-in; set currency and optional starting balance in Settings.

Create a trade and reload to verify persistence. Check a daily checklist, sign-out/sign-in, and password recovery using **Forgot password** on `/login` and the emailed `/reset-password` link. Connected accounts start with their own data; switching modes does **not** import the demo into Supabase.

## Environment variables

[.env.example](.env.example) contains the full configuration reference. Save local values in `.env` beside `package.json` and restart Vite after edits. `.env.local`, mode-specific files, or variables already set in your terminal can override `.env`; remove conflicting overrides if a setting appears ignored. Never commit real secrets.

Every `VITE_` value is public browser configuration embedded at build time. Other variables below are read by the local API middleware or deployed server functions.

| Variable | Visibility | Requirement / default |
| --- | --- | --- |
| `VITE_DEMO_MODE` | Public | `true` enables the sample workspace. Template default: `false`. |
| `VITE_SUPABASE_URL` | Public | Real project URL for connected mode. Demo still needs a URL-shaped placeholder such as `https://demo.supabase.co`. |
| `VITE_SUPABASE_ANON_KEY` | Public | Real public anon key for connected mode; `demo-anon-key` suffices for demo. |
| `VITE_DEMO_LATENCY_MS` | Public | Artificial delay per demo repository call, default `60` ms; `0` disables it. |
| `GROQ_API_KEY` | Server only | Required only for Coach and provider-backed voice features. One key serves chat, transcription, checklist matching, and studio speech. |
| `GROQ_CHAT_MODEL` | Server only | Typed chat default: `openai/gpt-oss-120b`. |
| `GROQ_VOICE_MODEL` | Server only | Voice conversation default: `openai/gpt-oss-20b`. |
| `GROQ_FALLBACK_MODELS` | Server only | Comma-separated fallbacks; default `openai/gpt-oss-120b,openai/gpt-oss-20b,qwen/qwen3.8-27b`. Empty disables additional fallbacks. |
| `GROQ_STT_MODEL` | Server only | Transcription default: `whisper-large-v3-turbo`. |
| `GROQ_CHECKLIST_MODEL` | Server only | Checklist matching default: `openai/gpt-oss-20b`. |
| `GROQ_TTS_MODEL` | Server only | Studio speech default: `canopylabs/orpheus-v1-english`. |
| `GROQ_TTS_VOICE` | Server only | Studio voice default: `autumn`. |
| `ASSISTANT_HISTORY_SECRET` | Server only | Optional conversation-encryption secret, recommended for deployment. Falls back to `GROQ_API_KEY`. |
| `SUPABASE_URL` | Server only | Optional server override; defaults to `VITE_SUPABASE_URL`. Use the same project as the browser. |
| `SUPABASE_ANON_KEY` | Server only | Optional public anon-key server override; defaults to `VITE_SUPABASE_ANON_KEY`. |

Model names are this code's defaults, not guaranteed provider availability. Override them with models your account supports when needed.

## Features and calculations

- **Any asset class:** stocks, crypto, forex, futures, options, and other instruments. Record direction, entry/exit, stop, target, units, fees, setup, mistakes, and reflection notes.
- **Account settings:** currency and optional starting balance. No exchange-rate conversion occurs.
- **Playbooks:** editable pre-market/post-market routines and per-trade checklists saved with each trade. Daily routines reset at local midnight. Unplanned means no checklist was used; it does not itself mean a bad trade.
- **Journal:** filtering, editing/deletion, CSV export, and voice drafts for review before saving.
- **Dashboard:** statistics, equity curve, and daily checklist progress.
- **Coach:** streaming chat and turn-based Expert calls, with no live market feed, order execution, or ability to change records.
- **Presentation:** light/dark themes, system theme preference, responsive layouts, and reduced-motion support.

| Advanced analysis | What it helps you inspect |
| --- | --- |
| Checklist discipline | Planned versus Unplanned results and checklist completion |
| Monte Carlo | Equity paths resampled from your own closed trades; requires at least 10 |
| Drawdown | Falls from previous equity highs and time below them |
| Expectancy in R and SQN | Outcomes relative to planned risk and their consistency |
| Tilt | Results after a recent loss or losing streak versus other trades |
| Time heatmap | Outcomes by trading day and hour |
| Fee drag | How fees affect net results |
| Win-rate interval | Uncertainty around the measured win rate |

Monte Carlo resamples historical outcomes; it is not a market forecast. Tilt compares entry timing and outcomes, rather than detecting emotional state. Coach discusses journal discipline and is not a financial adviser.

Net realised P&L is `(exit - entry) × units × direction - fees`, where direction is `+1` for LONG and `-1` for SHORT. Units mean total quantity: multiply lot count by lot size. This linear formula does not add contract multipliers or currency conversion; use quantities/prices consistent with your account's accounting.

Amount at risk is `|entry - stop| × units` with a valid stop on the correct side. Realised R is net P&L divided by that risk; planned R:R describes target reward divided by planned risk. Missing inputs leave the relevant result unavailable. An “open” journal trade means P&L cannot be calculated, not confirmation of an open broker position.

Win-rate denominators differ: dashboard/journal analytics use all journal trades in scope; setup win rate uses wins plus losses; Coach win rate uses completed trades, including breakeven. Compare the same scope and definition when reconciling numbers.

## Coach architecture and latency

Groq model requests go through server routes. Typed chat starts with the chat model; voice turns start with the smaller voice model. A `429` or `404` before streaming tries the next distinct model in the fallback chain. This cannot guarantee a response if all eligible models are unavailable or throttled.

The server computes a compact numerical journal snapshot instead of sending the entire database. Short voice replies, streamed text, queued speech phrases, and a 60-second cache of verified access tokens reduce repeated work. Device voice is the default. Studio speech passes WAV chunks through the server with streaming playback where supported and buffered playback fallbacks.

The deployment configuration selects Mumbai (`bom1`). Creating Supabase in Mumbai pairs the intended application/database regions; deployed latency still needs measurement.

Historical local provider checks on **2026-09-28**, from a development machine in India with synthetic input, measured:

| Isolated measurement | Observed duration |
| --- | --- |
| Groq Whisper transcription of an 8.4-second clip | 201–358 ms |
| `gpt-oss-20b`, low reasoning, first answer text | 0.68–0.83 s |
| Orpheus completion of a 125-character speech phrase | 1.49–1.71 s |

These are historical component measurements, not current live-site benchmarks or complete microphone-to-speaker results. The device-voice target is about 2.5 seconds from end of speech to first audio; it is not a verified production claim. Hosted end-to-end measurements remain pending.

For your own measurements, visit `/coach?timing=1`, make voice turns, and copy the timing table. It reports stages of recent turns without persisting transcripts in the timing readout.

## Security and privacy

- All five database tables are owner-scoped through Supabase row-level security. Server journal reads use the verified user's token.
- Deployed provider routes require authorization. Warm instances may reuse token verification for up to 60 seconds. Only Vite's development adapter grants the demo exception for eligible loopback, same-origin requests; deployed handlers reject the demo token.
- Provider keys and conversation secrets stay server-side. No service-role key is needed or read by the current app. Never put provider secrets in `VITE_` variables.
- Coach sends a computed snapshot and conversation input to Groq. Reflection notes are excluded unless you opt in. Voice use sends audio for transcription; AI checklist matching sends the transcript and checklist labels.
- Conversation history uses a user-bound encrypted envelope, retaining up to four exchanges for one hour. There is no conversation-history database table. This does not mean the AI runs offline or that provider processing has no retention; review provider terms for sensitive data.
- Coach cannot place orders or modify journal entries. You review dictated fields and save them yourself.

## Development and verification

Run commands from the directory containing [package.json](package.json):

| Command | Purpose |
| --- | --- |
| `npm ci` | Install exact dependency versions from the lockfile |
| `npm run dev` | Start Vite and the four local `/api/` routes |
| `npm test` | Run Vitest with provider stand-ins, without real API quota |
| `npm run test:watch` | Rerun tests during development |
| `npm run lint` | ESLint, including module import boundaries |
| `npm run build` | Build the frontend into `dist/` |
| `npm run preview` | Serve the built frontend; **no `/api/` routes** |

Build and preview after configuring `.env`:

```text
npm run build
npm run preview -- --host localhost
```

Open Vite's printed URL, normally `http://localhost:4173`. This is a static UI preview: Coach, transcription, checklist AI matching, and studio speech require the dev server or a backend deployment. Demo preview uses separate browser storage because its port differs. Rebuild after changing `VITE_` values; edits after a build do not rewrite its bundle.

Optional live provider checks, after configuring `GROQ_API_KEY`:

```text
node scripts/check-assistant.mjs --chat-only
node scripts/check-assistant.mjs --speech-only
```

Run `node scripts/check-assistant.mjs` for both. These send synthetic text/audio and **consume Groq quota**, including studio quota for speech. They do not validate real sign-in, database policies, physical microphones, or the complete browser voice flow.

The stack is React 18, Vite, React Router, Recharts, Lucide, plain CSS, Supabase, Groq, and Vercel Node route handlers, with Vitest and ESLint.

```text
src/
  app/                 Routes and workspace shell
  features/            Screens, feature state, and repositories
  domain/              Pure trade calculations and journal rules
  platform/            Demo storage, Supabase, audio, browser adapters
  shared/              Reusable UI and hooks
  styles/              Themes and workspace styling
api/                   Vercel route entry points
server/                Authentication, journal context, speech providers
shared/                Pure browser/server contracts and analytics
scripts/               Local API adapter and optional verification utilities
tests/server/          Server integration tests
supabase/schema.sql    Fresh-project schema and row-level security
public/                Static assets
```

Frontend and pure-module tests live beside their modules. Use feature repositories for data access to preserve demo and connected behavior.

## Deploy to Vercel

Deployment is optional. For a shared, authenticated installation:

1. Complete Supabase setup and publish your application source to your GitHub repository.
2. Import it into [Vercel](https://vercel.com) as a Vite project: build `npm run build`, output `dist`. Keep [vercel.json](vercel.json), including SPA routing, function settings, and `bom1` region.
3. Configure `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_DEMO_MODE=false`. Add server-only `GROQ_API_KEY` for Coach/voice and a dedicated `ASSISTANT_HISTORY_SECRET`. Add model overrides as needed.
4. Generate a conversation secret with this cross-platform command and paste it into the server environment setting:

   ```text
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

5. Deploy. Set Supabase's Site URL to your HTTPS deployment URL and allow the exact deployed root and `/reset-password` URLs. Retain localhost redirects if developing locally.
6. Verify signup/confirmation, sign-in, recovery, persistence, settings, and Coach. Use two accounts to check each sees only its own records. Unauthenticated POSTs to each `/api/` route should return `401`, including requests with only the demo token.

Deploy both frontend and root `api/` routes. Uploading `dist/` alone to a static host does not provide Coach/voice APIs. Environment changes require redeployment; public build-time values must be rebuilt. Each person deploying a copy supplies their own backend and provider credentials.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Command not found | Finish installing Node/Git and reopen the terminal. Check Node reports version 24. |
| PowerShell blocks `npm.ps1` | Replace `npm` with `npm.cmd`; no policy change is needed. |
| `package.json` not found | Change into the extracted/cloned project folder first. |
| `npm ci` fails | Check its first error, network/proxy access, Node version, and matching package/lockfile versions. Do not delete the lockfile as a default fix. |
| Blank screen / “Invalid supabaseUrl” | Demo still needs the valid-looking URL and nonempty dummy key above. `your_supabase_project_url` is not a URL. Save `.env`, then restart. |
| Demo asks for sign-in | Set exactly `VITE_DEMO_MODE=true`, check `.env.txt` and conflicting overrides, then restart. Rebuild for preview. |
| Port 5173 is in use | Stop the other server or use an unused port such as `5174` in both command and browser URL. Update connected-mode auth redirects too. |
| Coach key missing or invalid | Set your own `GROQ_API_KEY` without `VITE_` and restart. Manual demo features need no key. |
| Demo Coach returns `401` | Use the same localhost origin and `npm run dev`. LAN hosts, tunnels, and deployed handlers do not enable demo authorization. |
| API returns HTML/404 in preview | Preview has no API middleware; use the dev server for local Coach/voice. |
| Model unavailable / `429` | Check Groq access/quota; wait or configure supported models. Device voice avoids studio quota. |
| No microphone or audible speech | Allow browser/OS microphone permissions, use localhost or HTTPS, and check volume, output device, installed device voices, and voice selection. |
| Signup/reset redirects incorrectly | Match Supabase Site URL and redirects to the exact origin and `/reset-password` path; check email delivery/configuration. |
| Missing database tables | Run the complete schema once in the intended new Supabase project; confirm environment values point to it. |
| Empty recent demo analytics | Choose All time or reset the sample journal; seed dates do not advance on reload. |
| Demo changes disappeared | Check browser, host, port, private mode, and site storage; data is local and unsynced. |

For a bug report, include OS, Node version, browser, mode, command, and error message. Remove API keys, tokens, personal journal content, and `.env` values before sharing logs.
