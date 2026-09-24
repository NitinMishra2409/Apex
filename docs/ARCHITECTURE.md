# Apexlog architecture

Apexlog is a React 18 / Vite SPA backed by Supabase Auth, Postgres, and row-level security. Vercel serves the static build and four server routes. NVIDIA Riva provides transcription; Groq supplies Coach chat and speech. [README](../README.md) owns setup, [CONTEXT](../CONTEXT.md) owns domain language, and this document owns implementation structure.

## Module map

```text
src/
  main.jsx                  React root and providers
  app/                      Route composition, navigation, fallback screen
  features/
    auth/                   AuthProvider, useAuth, guards, Login, Signup
    trades/                 NewTrade, TradeLog, EditTradeModal, repository, mistakes
    checklists/             Playbook screen and checklist/progress repository
    overview/               Dashboard and Analytics
    assistant/              Coach, ExpertCall, conversation and speech orchestration
    voice/                  Trade dictation UI and transcript parser
    admin/                  Admin screen and existing admin data adapter
    settings/               Preferences screen
    marketing/              Landing screen
  domain/
    trades/                 Math, record conversion, symbols, persisted vocabulary
    checklists/             Checklist types, labels, defaults
    journal/                Statistics, periods, chart series, display formatting
  platform/
    supabase/               Browser Supabase client
    demo/                   Seeded localStorage-backed demo workspace
    audio/                  Browser recording, silence detection, WAV encoding
  shared/
    ui/                     Brand and reusable presentation
    hooks/                  Reduced-motion preference
  styles/                   Base styles and Studio Black tokens
shared/                     Pure browser/server modules: SSE and demo journal projection
api/                        Vercel HTTP entry points: chat, listen, speak, transcribe
server/
  assistant/                Authentication/runtime helpers and journal snapshots
  speech/                   Transcription, synthesis, and bundled Riva protobufs
scripts/                    Vite route adapter and optional provider smoke check
tests/server/               Server route and provider integration tests
supabase/                   Schema and additive migrations
docs/agents/                Task-specific agent instructions
.scratch/<feature>/         Local specs and issues
```

Screens and data access live beside the feature they implement. Repositories hide Supabase/demo selection; callers do not coordinate storage details. Domain modules provide pure calculations without React or persistence setup. Cross-runtime modules have no browser or Node dependencies.

## Dependency direction

`app` composes feature screens. Features use domain rules, browser adapters, and shared UI. Platform adapters may use domain rules (the demo seed uses trade math). Shared UI and domain modules do not import features or app composition. Browser code never imports server implementations.

Server routes use `server/` and root `shared/`; server code does not reach into browser features. ESLint enforces lower-layer and browser/server import restrictions. Direct imports make ownership explicit; there are no catch-all barrel exports or compatibility copies of former folders.

Cross-feature calls use focused interfaces: overview calls trade and checklist repositories; screens use `auth/useAuth`; NewTrade uses `voice/VoiceTradeInput`. Application composition owns screen imports.

## Interfaces and invariants

| Module | Caller interface and behavior |
|---|---|
| `src/domain/trades/math.js` | `num`, `calcRR`, `calcPnl`, `getResult`. Blank inputs become null; P&L uses USDT notional; missing plan legs or invalid risk return null. |
| `src/domain/trades/record.js` | `prepareTrade(form, mistakes)` converts reviewed form values into a write payload and derives RR/P&L/result. Invalid dates throw. Omitted symbols stay excluded so edits preserve them; an explicitly blank symbol becomes null. |
| `src/domain/trades/symbols.js` | Normalization accepts typed/spoken aliases; display/filter helpers handle null symbols. Stored symbols are uppercase without separators. |
| `src/domain/trades/vocabulary.js` | Setups, default mistakes, direction and result choices. Persisted strings require a migration when renamed. |
| `src/domain/checklists/vocabulary.js` | Checklist types, labels, and default playbook items. |
| `src/domain/journal/statistics.js` | `computeTradeStats(trades)` is pure; input is newest-first for current streak. Returns aggregates, setup breakdowns, equity curve, mistake frequency, and weekday P&L. |
| `src/domain/journal/reporting.js` | Local-calendar periods, chart series, weekly rhythm, and journal display formatting. |
| `src/features/trades/repository.js` | Trade CRUD, `getTradesAndStats`, `getTradeStats`, `getTodaySummary`. Reads are newest-first, writes return saved rows, persistence errors throw. |
| `src/features/trades/mistakes.js` | Read/add custom mistake tags, independently of checklist progress. |
| `src/features/checklists/repository.js` | Checklist items, daily progress, batched `getChecklistSummary`. Daily keys currently use UTC dates. |
| `src/features/auth/useAuth.js` | Session, user, admin/loading state, and authentication actions supplied by AuthProvider. |
| `src/features/assistant/useAssistant.js` | Conversation/voice lifecycle for Coach and ExpertCall, with cancellation and speech cleanup. |
| `src/platform/audio/recording.js` | Recording, optional silence/level callbacks, conversion to 16 kHz mono WAV. Shared by dictation and Coach. |
| `shared/sse.js` | Streaming UTF-8 SSE decoding used by server and browser. |
| `shared/demoJournal.js` | Whitelisted demo journal projection, period filtering, note opt-in, truncation metadata. No localStorage access. |

Dashboard/analytics win rate includes open trades in its denominator. Setup win rate counts only wins and losses. Coach win rate counts completed trades including breakeven. These existing differences remain compatibility constraints until a product decision changes them.

## Runtime and routes

`src/main.jsx` composes StrictMode, BrowserRouter, AuthProvider, App, and the toast host. Base CSS loads before Studio Black overrides; the saved motion preference is applied before rendering.

`src/app/App.jsx` owns routes and the N shortcut for New Trade. Landing, Login, Signup, and NotFound load eagerly; authenticated screens load lazily. Charts remain in a separate vendor chunk, away from first paint for public routes.

| Access | Routes |
|---|---|
| Public | `/`, `/login`, `/signup` |
| ProtectedRoute | `/dashboard`, `/new-trade`, `/log`, `/checklists`, `/analytics`, `/coach`, `/settings` |
| AdminRoute | `/admin` |

Demo mode redirects login/signup into the workspace and keeps the landing preview available. Route guards are presentation controls; database/provider authorization must still be enforced on the server.

| HTTP route | Handler and behavior |
|---|---|
| `POST /api/transcribe` | Raw WAV to text for trade dictation through `transcribeHandler`. Query language defaults to `en-US`. |
| `POST /api/chat` | Authenticated journal-grounded Coach answer streamed as SSE. |
| `POST /api/listen` | Authenticated Coach speech transcription. |
| `POST /api/speak` | Authenticated Groq Orpheus speech; bounded text phrases and WAV output. |

`scripts/dev-api.js` mounts the same handlers in Vite with ordinary Node requests/responses. It passes the server environment and authorizes strictly local demo requests. Vercel entry points use `process.env`; deployed routes do not enable the local demo bypass. `npm run preview` serves static assets without these routes.

Transcription uses Riva gRPC with NVIDIA authorization and function-id metadata. `server/speech/proto/` is resolved relative to the transcription implementation and included by `vercel.json` for both speech-to-text routes. Keep these paths aligned when moving provider code.

Coach authentication, body limits, deadlines, response errors, and encrypted history live in `server/assistant/runtime.js`. `server/assistant/journal.js` reads with the verified user's token so RLS applies, then computes the snapshot before prompting the model. History holds up to four exchanges for one hour in an AES-256-GCM sealed blob; there is no conversation table. See [AI Assistant](AI_ASSISTANT.md) for protocol details and [Expert Call](EXPERT_CALL.md) for voice presentation.

## Main flows

1. **Trade capture:** NewTrade accepts typed/parsed voice fields, previews canonical math, and submits `prepareTrade` to the repository. EditTradeModal uses the same conversion. Voice parsing remains conservative and leaves review/save to the trader.
2. **Journal reporting:** Overview loads trades and statistics together. Period filters and chart series operate on fetched rows. Checklist summary batches reads; navbar summary requests only today's P&L rather than the full journal.
3. **Coaching:** The browser sends period, note consent, message, and sealed history. The server verifies identity, computes the snapshot, and streams the provider response. Model text never writes trades.
4. **Voice conversation:** Record until silence, transcribe, request a reply, queue short speech phrases, then listen again. Cancellation stops recording, requests, and playback. A TTS rate limit enables device speech fallback for the session.

## Data and demo adapters

`supabase/schema.sql` defines `user_profiles`, `trades`, `checklists`, `daily_progress`, and `custom_mistakes`. Existing databases use `supabase/migrations/`; a fresh schema is not a substitute for migrating existing data. Trade date/direction/entry are required; consumers handle optional values. Checklist/progress uniqueness is per user/type and user/date/type respectively.

Repositories preserve their demo branches. `src/platform/demo/store.js` owns the sample identity and 74 seeded trades, persists changes to localStorage, and uses canonical trade formulas. Dates are relative to the initial seed, then stay fixed until reset. Demo latency defaults to 60 ms and is configurable with `VITE_DEMO_LATENCY_MS`. Browser state is not imported by server code; only the whitelisted projection crosses the request seam.

Demo UI works without Supabase. Real Coach chat/voice still needs provider keys in local development. `scripts/check-assistant.mjs` consumes provider quota and is opt-in, separate from `npm test`.

## Styling and verification

`src/styles/base.css` provides base styles; `studio.css` supplies Studio Black tokens. Coach/ExpertCall styles stay with the assistant module. Honor reduced motion; see [UI Design](UI_DESIGN.md).

Run `npm test`, `npm run lint`, and `npm run build` after structural changes. Client/pure tests are colocated; server integration tests live in `tests/server/`. Tests use provider stand-ins rather than real keys. Import moves must update test mocks, dynamic imports, Vite middleware, and deployment includes too.

Build success does not establish that screens render. Smoke-test affected demo routes, trade create/edit, playbook progress, and Coach controls when changing their composition. Exercise real auth/provider flows separately when credentials and quota are available.

## Known issues

- **Admin credentials:** `src/features/admin/adminClient.js` still reads `VITE_SUPABASE_SERVICE_ROLE_KEY`. It enters the public bundle and bypasses RLS. Move admin operations behind a server-verified admin route before public deployment; relocating the module has not fixed this pre-existing issue.
- **Profile policy:** The broad `user_profiles` policy permits overly broad writes. Server-side admin checks need restrictive profile policies too.
- **Profile creation:** Both a database trigger and AuthProvider create profiles. Reconcile ownership in a dedicated auth/schema change.
- **Win-rate definitions:** The three denominators above differ; comparisons must name the measure.
- **Date semantics:** Journal periods use local calendar dates; checklist daily keys and today's summary use UTC dates.
- **Demo age:** Seed dates stay fixed until reset, so recent-period views can eventually be empty.
- **Password reset:** Auth sends a `/reset-password` redirect, but the route table has no reset-password screen.

Track fixes under the [local issue convention](agents/issue-tracker.md) and preserve existing user data when addressing them.
