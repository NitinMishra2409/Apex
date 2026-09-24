# Apex conversational assistant

Implemented September 14, 2026. The AI Coach route is now a conversational interface using the existing Studio Black design.

## Project structure and integration points

Apex Log is a React 18 / Vite SPA with Supabase Auth, Postgres and row-level security. Screens use feature repositories for journal and checklist access. `src/platform/audio/recording.js` records browser audio, converts it to 16 kHz mono WAV, and sends it to NVIDIA Whisper through server-side Riva gRPC. Vercel hosts API functions; Vite mounts the same handlers during development.

The existing dashboard, journal, analytics, trade editor, playbooks, account screens, and administration remain in place. The former Coach screen only displayed calculated observations. Its replacement supports streamed chat and voice conversations grounded in the authenticated account's journal.

| File | Responsibility |
| --- | --- |
| `src/features/assistant/Coach.jsx` | Conversation UI, context controls, voice actions, links into existing workflows |
| `src/features/assistant/useAssistant.js` | Conversation lifecycle, cancellation, automatic listening, bounded history |
| `src/features/assistant/client.js` | Authenticated streaming chat, transcription and speech requests |
| `src/features/assistant/speechQueue.js` | Phrase segmentation, ordered speech generation/playback, audio cleanup |
| `src/features/assistant/assistant.css` | Responsive chat layout and voice feedback |
| `src/platform/audio/recording.js` | Existing WAV recorder, extended with optional pause detection |
| `shared/sse.js` | Shared UTF-8 SSE decoding for server and browser |
| `api/chat.js` | Authenticated journal context and streamed Groq Llama response |
| `server/assistant/journal.js` | Owner-scoped journal retrieval and numerical summaries |
| `server/assistant/runtime.js` | Session verification, request limits, deadlines, encrypted history |
| `api/listen.js` | Authenticated Whisper endpoint for conversations |
| `api/speak.js`, `server/speech/synthesis.js` | Authenticated Groq Orpheus speech and bounded WAV responses |
| `src/features/assistant/browserSpeech.js` | Easy Speech device-voice fallback and cancellation |
| `scripts/check-assistant.mjs` | Optional live check using synthetic text/audio only |

## Model configuration

The main brain is Meta Llama 3.3 70B Versatile, served by Groq at https://api.groq.com/openai/v1/chat/completions. Requests use SSE streaming, temperature 0.6, top_p 1, and max_completion_tokens=1024. Only role/content message fields are sent; NVIDIA thinking parameters and reasoning history are excluded. Set the server-only GROQ_API_KEY; GROQ_CHAT_MODEL optionally overrides the default llama-3.3-70b-versatile. A missing Groq key produces an explicit configuration error and never falls back to the NVIDIA voice key. Sources: [Groq model](https://console.groq.com/docs/model/llama-3.3-70b-versatile), [streaming API](https://console.groq.com/docs/text-chat).

Orpheus V1 English runs on Groq at https://api.groq.com/openai/v1/audio/speech with the Autumn voice and WAV output. GROQ_API_KEY is shared with chat. The speech queue splits replies into at most 200-character phrases, preserving order and Unicode boundaries. The server rejects larger phrases and bounds returned audio to 4 MiB. No speech synthesis calls go to NVIDIA. Sources: [Groq speech](https://console.groq.com/docs/text-to-speech), [Orpheus limits and voices](https://console.groq.com/docs/text-to-speech/orpheus).

Server-only environment settings (also listed in `.env.example`):

```dotenv
NVIDIA_API_KEY=your-existing-nvidia-key
GROQ_API_KEY=your-groq-api-key
GROQ_CHAT_MODEL=llama-3.3-70b-versatile
GROQ_TTS_MODEL=canopylabs/orpheus-v1-english
GROQ_TTS_VOICE=autumn
NVIDIA_ASSISTANT_ASR_LANGUAGE=en-US
```

The existing Supabase URL and anon key are reused to verify sessions and read records under the user's token. Optional server aliases are `SUPABASE_URL` and `SUPABASE_ANON_KEY`. No service-role key is used by these assistant endpoints.

The current voice configuration is English, using the Autumn preset. The old NVIDIA_TTS_* settings are ignored. The portrait is an AI avatar and the voice is a provider preset, not a clone of the person depicted.

## Conversation behavior

1. A typed message goes to Llama 3.3 70B on Groq. Voice mode starts microphone capture only after the user chooses Start voice.
2. After approximately 1.25 seconds of silence following speech, the recorder stops and the audio is transcribed by Whisper. Send now also ends the turn manually.
3. The server verifies the Supabase bearer token, fetches that account's selected journal period, calculates summaries, and asks Llama to answer using those records.
4. Answer text streams into the conversation. In voice mode, complete phrases enter an ordered Orpheus synthesis/playback queue while remaining text is still arriving.
5. Listening resumes after speech playback finishes. Interrupt cancels the current response/audio and starts listening again. End stops capture, playback, queued speech and active requests.

This is automatic **turn-based voice**, using the existing batch transcription service. It is not simultaneous full-duplex audio: the microphone is off during assistant playback, and interruption is manual. Hosted model latency and quota availability determine response time. No fixed latency is promised.

Typed replies can optionally be read aloud; completed answers also have a Read aloud button. The chat supports retry, clear/new conversation, date-period selection, and optional reflection notes.

## Data scope and ownership

- Deployed AI API routes require a verified Supabase user session. Vite development middleware additionally permits loopback-only demo requests when `VITE_DEMO_MODE=true`, with matching local host/origin and no forwarded remote requests. Client-supplied user IDs are ignored. Queries explicitly filter by the verified ID and use the user's RLS credentials.
- Model requests contain the current message, recent conversation, selected-period summaries, and up to 40 recent trade details. Personal IDs, email addresses and account tokens are not included in the journal context.
- Up to 5,000 selected trades contribute to aggregates. The context and UI indicate when this cap is reached. Setup, symbol, month, mistake, profit-factor and completed-trade win-rate summaries are computed in code.
- Open trades are excluded from completed-trade win rate. Planned R:R is labeled separately from realized P&L; position size is USDT notional.
- Reflection notes are excluded unless the user enables them; included notes are limited to 600 characters per recent trade. Changing notes or period clears the conversation history.
- Conversation state is tab-local and not persisted in browser storage or a new database table. An AES-256-GCM envelope preserves up to four complete exchanges for one hour, binds them to the user, and drops older pairs if needed to stay within request limits. Rotating the Groq key invalidates existing envelopes. The provider switch also expires prior NVIDIA conversations; start a new conversation after switching.
- The assistant has no write tools, broker integration, or live market feed. Existing trade-entry and review screens remain the place to confirm changes. Model output is rendered as text rather than executable HTML.
- Local demo mode supports real Groq chat/speech and NVIDIA transcription without Supabase sign-in. Start `npm run dev` with `VITE_DEMO_MODE=true` and open localhost. Up to 500 filtered demo trades are sent from the browser, normalized to journal fields on the server, and labeled as sample data. Reflection notes remain opt-in. A tab-specific demo identity separates encrypted history. The bypass exists only in the Vite middleware; setting the demo environment variable on Vercel does not bypass authentication. Existing demo trade dictation behavior is unchanged.

## Run and verify

Add GROQ_API_KEY to .env and restart the dev server after saving it. Keep NVIDIA_API_KEY for Whisper transcription. Old NVIDIA_CHAT_MODEL / NVIDIA_CHAT_ENABLE_THINKING settings are ignored. Use `npm run dev` for local API support. `npm run preview` serves static assets only and cannot run these APIs. On Vercel, use the server environment settings above; `vercel.json` includes the Riva protocol files and function duration limits.

```powershell
npm.cmd test -- --run
npm.cmd run lint
npm.cmd run build
# Optional: consumes live provider usage; no journal data is sent.
node scripts/check-assistant.mjs
node scripts/check-assistant.mjs --speech-only
node scripts/check-assistant.mjs --chat-only
```

Validation commands are `npm test`, `npm run lint`, and `npm run build`; see the architecture guide for the current layout. Coverage includes authenticated route isolation, encrypted history, grounded aggregates, streaming boundaries, incomplete responses, speech ordering/cancellation, WAV encoding, pause detection and microphone cleanup. Browser checks cover desktop/mobile rendering, context controls, and no horizontal document overflow at 390px. Additional tests cover local demo chat/voice identity, demo context filtering, and rejection of remote, forwarded, cross-origin and deployed demo access.

Live provider verification: Groq Llama returned first answer text after approximately 0.7 seconds. Orpheus Autumn returned a 261,190-byte WAV; Whisper transcribed the synthetic sentence correctly, with the speech round-trip completing in approximately three seconds. The check used the server providers and synthetic content only. Rate-limit fallback and browser cancellation are covered by mocked tests; a real provider quota was not deliberately exhausted, and a human microphone call was not part of this check.

## Existing project issue found during review

`src/features/admin/adminClient.js` imports `VITE_SUPABASE_SERVICE_ROLE_KEY` into browser code and is used by the Admin page. Service-role credentials bypass row-level security. The existing profile policy also allows broad profile writes. These predate this assistant work and must be migrated to a server-enforced admin flow before public deployment. The assistant uses only the anon key and verified user token, and does not depend on that admin client.

## Automatic device voice fallback

Orpheus is the primary TTS engine. Only an HTTP 429 from the speech synthesis request switches output to Easy Speech, which uses browser-provided voices. The phrase that could not be synthesized is spoken once by the fallback; previously played phrases are not repeated. The same device voice mode persists across replies, read-aloud, pause/resume and call interruptions until New conversation or a context/account change. A new conversation retries Orpheus. Chat and transcription rate limits do not trigger this speech-only fallback.

The call screen and chat show a non-error notice on switching. Unsupported browsers, missing voices, and blocked playback produce a readable error while retaining the text answer. Abort cancels browser speech and settles the playback promise even if the browser omits its end event. Initialization is bounded; playback has a watchdog. No fallback occurs for authentication, configuration, generic server, or audio playback errors. English local voices are preferred; browsers without one may use a remote voice, so this is not an offline guarantee. Source: [Easy Speech](https://github.com/leaonline/easy-speech).