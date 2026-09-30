#!/usr/bin/env bash
#
# Ticket 09: Supabase (Mumbai) and Vercel deploy.
# Walks the owner through the dashboard steps an agent can't perform (creating
# the Supabase project, running the schema, enabling auth providers, creating
# the Vercel project, setting its env vars) and automates everything else:
# local .env bookkeeping, cleanup, and a live curl-based check of region and
# auth guards once the site is up.
#
# Run with: bash scripts/deploy-wizard.sh
# Safe to Ctrl-C and re-run — it remembers values already written to .env.
#
# Everything above the "STAGES" marker is the wizard library: do not hand-edit
# it. Author the per-step stages below the marker.

set -euo pipefail

# ──────────────────────────────────────────────────────────────────────────
# Wizard library: delightful, consistent UX, identical across every wizard.
# ──────────────────────────────────────────────────────────────────────────

if [[ -t 1 ]] && command -v tput >/dev/null 2>&1 && [[ "$(tput colors 2>/dev/null || echo 0)" -ge 8 ]]; then
  BOLD=$(tput bold); DIM=$(tput dim); RESET=$(tput sgr0)
  BLUE=$(tput setaf 4); GREEN=$(tput setaf 2); YELLOW=$(tput setaf 3); RED=$(tput setaf 1)
else
  BOLD=""; DIM=""; RESET=""; BLUE=""; GREEN=""; YELLOW=""; RED=""
fi

# Author sets this at the top of the stages section.
TOTAL_STAGES=0

_STAGE_INDEX=0
ENV_FILE="${ENV_FILE:-.env}"
WRITTEN_ENV=()    # KEYs written to ENV_FILE this run
WRITTEN_SECRET=() # secret NAMEs set this run
SKIPPED=()        # things we couldn't do (e.g. gh missing)

# _clear wipes the terminal so only the current step is on screen. No-op when
# output isn't a terminal, so piped logs stay readable.
_clear() {
  [[ -t 1 ]] || return 0
  if command -v tput >/dev/null 2>&1; then tput clear; else printf '\033[2J\033[3J\033[H'; fi
}

# banner "Title" shows the opening frame: what this wizard does.
banner() {
  _clear
  printf '\n%s%s  %s%s\n' "$BOLD" "$BLUE" "$1" "$RESET"
  printf '%s  %s stages%s\n\n' "$DIM" "$TOTAL_STAGES" "$RESET"
  printf '%s  You drive the browser; this wizard tells you exactly what to do and\n' "$DIM"
  printf '  captures the values you copy back. Stop any time with Ctrl-C and re-run\n'
  printf '  later, since it remembers values already saved.%s\n' "$RESET"
  pause "Ready to start?"
}

# stage "Name" clears the screen, then announces a stage and shows progress.
# Clearing keeps only the current step on screen.
stage() {
  _clear
  _STAGE_INDEX=$((_STAGE_INDEX + 1))
  printf '\n%s%s▸ Stage %s/%s · %s%s\n' \
    "$BOLD" "$BLUE" "$_STAGE_INDEX" "$TOTAL_STAGES" "$1" "$RESET"
}

# say "..." prints a plain instruction line.
say()  { printf '  %s\n' "$1"; }
# step "..." is a numbered-feeling action the human takes in the browser.
step() { printf '  %s•%s %s\n' "$BLUE" "$RESET" "$1"; }
note() { printf '  %s%s%s\n' "$DIM" "$1" "$RESET"; }
warn() { printf '  %s⚠ %s%s\n' "$YELLOW" "$1" "$RESET"; }

# open_url URL opens it in the human's browser, cross-platform incl. WSL.
open_url() {
  local url="$1"
  printf '  %s↗ opening%s %s\n' "$GREEN" "$RESET" "$url"
  { if   command -v wslview     >/dev/null 2>&1; then wslview "$url"
    elif command -v explorer.exe >/dev/null 2>&1; then explorer.exe "$url"
    elif command -v xdg-open    >/dev/null 2>&1; then xdg-open "$url"
    elif command -v open        >/dev/null 2>&1; then open "$url"
    else warn "couldn't open a browser; visit it manually: $url"; fi
  } >/dev/null 2>&1 || warn "couldn't open a browser, so visit it manually: $url"
}

# pause "msg" waits for the human to confirm they've done the manual part.
pause() {
  printf '  %s%s%s ' "$DIM" "${1:-Press Enter to continue}" "$RESET"
  read -r _ || true
}

# confirm "question" is a y/N gate; returns success on yes.
confirm() {
  local reply=""
  printf '  %s? %s [y/N] ' "$YELLOW" "$1"
  read -r reply || true
  [[ "$reply" =~ ^[Yy] ]]
}

# _existing KEY: current value of KEY in ENV_FILE, if any.
_existing() {
  [[ -f "$ENV_FILE" ]] || return 1
  local line; line=$(grep -E "^${1}=" "$ENV_FILE" | tail -n1) || return 1
  printf '%s' "${line#*=}"
}

# ask KEY "Prompt" reads a value into $KEY. Offers the existing .env value as
# a default on re-runs (Enter keeps it). Visible input (non-secret).
ask() {
  local key="$1" prompt="$2" current input
  current=$(_existing "$key" || true)
  if [[ -n "$current" ]]; then
    printf '  %s%s%s %s[Enter keeps current]%s ' "$BOLD" "$prompt" "$RESET" "$DIM" "$RESET"
  else
    printf '  %s%s%s ' "$BOLD" "$prompt" "$RESET"
  fi
  read -r input || true
  [[ -z "$input" && -n "$current" ]] && input="$current"
  printf -v "$key" '%s' "$input"
}

# ask_secret KEY "Prompt" is like ask, but input is hidden.
ask_secret() {
  local key="$1" prompt="$2" current input
  current=$(_existing "$key" || true)
  if [[ -n "$current" ]]; then
    printf '  %s%s%s %s[Enter keeps current]%s ' "$BOLD" "$prompt" "$RESET" "$DIM" "$RESET"
  else
    printf '  %s%s%s ' "$BOLD" "$prompt" "$RESET"
  fi
  read -rs input || true
  printf '\n'
  [[ -z "$input" && -n "$current" ]] && input="$current"
  printf -v "$key" '%s' "$input"
}

# write_env KEY VALUE upserts KEY=VALUE into ENV_FILE (creates it; replaces
# any existing line). Idempotent.
write_env() {
  local key="$1" value="$2" tmp
  touch "$ENV_FILE"
  tmp=$(mktemp)
  grep -vE "^${key}=" "$ENV_FILE" > "$tmp" || true
  printf '%s=%s\n' "$key" "$value" >> "$tmp"
  mv "$tmp" "$ENV_FILE"
  WRITTEN_ENV+=("$key")
  printf '  %s✓ wrote%s %s → %s\n' "$GREEN" "$RESET" "$key" "$ENV_FILE"
}

# set_secret NAME VALUE sets a GitHub Actions repo secret via gh. Falls back
# to a warning (and records it) if gh is unavailable or unauthenticated.
set_secret() {
  local name="$1" value="$2"
  if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
    if printf '%s' "$value" | gh secret set "$name" >/dev/null 2>&1; then
      WRITTEN_SECRET+=("$name")
      printf '  %s✓ set%s GitHub secret %s\n' "$GREEN" "$RESET" "$name"
      return
    fi
  fi
  SKIPPED+=("GitHub secret $name (set it manually: gh secret set $name)")
  warn "skipped GitHub secret $name: gh not ready; set it later"
}

# set_var NAME VALUE sets a GitHub Actions repo variable (non-secret).
set_var() {
  local name="$1" value="$2"
  if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
    if gh variable set "$name" --body "$value" >/dev/null 2>&1; then
      printf '  %s✓ set%s GitHub variable %s\n' "$GREEN" "$RESET" "$name"
      return
    fi
  fi
  SKIPPED+=("GitHub variable $name")
  warn "skipped GitHub variable $name, gh not ready; set it later"
}

# finish clears, then shows a closing summary of everything configured.
finish() {
  _clear
  printf '\n%s%s  ✓ Setup complete%s\n' "$BOLD" "$GREEN" "$RESET"
  (( ${#WRITTEN_ENV[@]} ))    && note "wrote ${#WRITTEN_ENV[@]} value(s) to $ENV_FILE: ${WRITTEN_ENV[*]}"
  (( ${#WRITTEN_SECRET[@]} )) && note "set ${#WRITTEN_SECRET[@]} GitHub secret(s): ${WRITTEN_SECRET[*]}"
  if (( ${#SKIPPED[@]} )); then
    printf '\n'; warn "still to do by hand:"
    for s in "${SKIPPED[@]}"; do note "  - $s"; done
  fi
  printf '\n'
}

# ──────────────────────────────────────────────────────────────────────────
# STAGES: ticket 09 — Supabase (Mumbai) and Vercel deploy.
# ──────────────────────────────────────────────────────────────────────────

TOTAL_STAGES=10

banner "Apexlog: Supabase (Mumbai) + Vercel deploy — ticket 09"

# ── Stage 1: create the Supabase project ───────────────────────────────────
stage "Create the Supabase project (Mumbai)"
say "It must be created in Mumbai so it sits next to Vercel's bom1 functions."
open_url "https://supabase.com/dashboard/new"
step "Name it (e.g. apexlog), set region to 'Mumbai (ap-south-1)', set a database password, and create the project."
note "Provisioning takes a minute or two."
pause "Project created and finished provisioning?"

# ── Stage 2: capture the URL + anon key ────────────────────────────────────
stage "Capture the Supabase URL and anon key"
step "Open Project Settings → API (gear icon in the left sidebar → API)."
ask VITE_SUPABASE_URL "Paste the Project URL (https://xxxx.supabase.co):"
ask VITE_SUPABASE_ANON_KEY "Paste the anon public key:"
write_env VITE_SUPABASE_URL "$VITE_SUPABASE_URL"
write_env VITE_SUPABASE_ANON_KEY "$VITE_SUPABASE_ANON_KEY"
PROJECT_REF="${VITE_SUPABASE_URL#https://}"; PROJECT_REF="${PROJECT_REF%%.*}"
note "Project ref detected: ${PROJECT_REF:-not detected — check the URL}"
warn "Never paste the service_role key here, into .env, or into Vercel — nothing in this codebase reads it any more."

# ── Stage 3: run the schema ─────────────────────────────────────────────────
stage "Run the schema (one file, no migrations)"
if [[ -n "$PROJECT_REF" ]]; then open_url "https://supabase.com/dashboard/project/$PROJECT_REF/sql/new"; else open_url "https://supabase.com/dashboard/project/_/sql/new"; fi
step "Copy the entire contents of supabase/schema.sql, paste into the SQL editor, and click Run."
if command -v clip.exe >/dev/null 2>&1; then
  clip.exe < supabase/schema.sql && note "Copied supabase/schema.sql to your clipboard — just paste."
elif command -v pbcopy >/dev/null 2>&1; then
  pbcopy < supabase/schema.sql && note "Copied supabase/schema.sql to your clipboard — just paste."
elif command -v xclip >/dev/null 2>&1; then
  xclip -selection clipboard < supabase/schema.sql && note "Copied supabase/schema.sql to your clipboard — just paste."
fi
warn "This is the single schema file — there are no migrations. Don't run an old one."
pause "Schema ran without errors?"

# ── Stage 4: auth providers ─────────────────────────────────────────────────
stage "Enable Email + Google sign-in"
if [[ -n "$PROJECT_REF" ]]; then open_url "https://supabase.com/dashboard/project/$PROJECT_REF/auth/providers"; else open_url "https://supabase.com/dashboard/project/_/auth/providers"; fi
step "Confirm Email is enabled (on by default) with 'Confirm email' on, so sign-up requires a confirmation email."
step "Toggle Google on. You need a Google OAuth client: Google Cloud Console → APIs & Services → Credentials → Create Credentials → OAuth client ID → Web application."
step "Copy the 'Callback URL (for OAuth)' Supabase shows on the Google row into that client's Authorized redirect URIs in Google Cloud Console."
step "Paste the resulting Google Client ID and Client Secret into Supabase's Google row, then Save."
note "Google Cloud Console's exact screens shift occasionally — if it looks different, follow Supabase's own 'Login with Google' guide linked from that page."
confirm "Email and Google are both enabled and saved?"
say "Checking the project with the anon key: schema tables and columns, auth providers."
node scripts/check-supabase.mjs || warn "Supabase check failed: fix what it reports, then re-run: node scripts/check-supabase.mjs"
pause "Continue to redirect URLs?"

# ── Stage 5: redirect URL allow-list ────────────────────────────────────────
stage "Allow-list the redirect URLs"
if [[ -n "$PROJECT_REF" ]]; then open_url "https://supabase.com/dashboard/project/$PROJECT_REF/auth/url-configuration"; else open_url "https://supabase.com/dashboard/project/_/auth/url-configuration"; fi
ask VERCEL_DOMAIN "Vercel production domain, if you already have one (e.g. apexlog.vercel.app; leave blank to fill in after Stage 6):"
if [[ -n "$VERCEL_DOMAIN" ]]; then
  write_env VERCEL_DOMAIN "$VERCEL_DOMAIN"
  step "Set Site URL to https://$VERCEL_DOMAIN"
  step "Add these Redirect URLs: https://$VERCEL_DOMAIN/**, https://$VERCEL_DOMAIN/reset-password, http://localhost:5173/**, http://localhost:5173/reset-password"
else
  step "Add these Redirect URLs for now: http://localhost:5173/**, http://localhost:5173/reset-password"
  warn "Re-run this wizard after Stage 6 to add the real https://<domain>/** and https://<domain>/reset-password entries."
fi
confirm "Saved the URL configuration?"

# ── Stage 6: create the Vercel project ──────────────────────────────────────
stage "Create the Vercel project"
open_url "https://vercel.com/new"
step "Import this GitHub repo. Framework preset: Vite."
note "vercel.json already pins functions to region 'bom1' (Mumbai) — leave that alone; the Hobby plan allows exactly one region."
pause "Project imported (the first deploy can fail until env vars are set below — that's expected)?"

# ── Stage 7: Vercel environment variables ───────────────────────────────────
stage "Set Vercel environment variables"
say "Open the new project → Settings → Environment Variables, and add each of these (Production + Preview)."
ask_secret GROQ_API_KEY "Groq API key (server-only; get one at console.groq.com):"
if [[ -z "${ASSISTANT_HISTORY_SECRET:-}" ]]; then
  current_secret=$(_existing ASSISTANT_HISTORY_SECRET || true)
  if [[ -n "$current_secret" ]]; then
    ASSISTANT_HISTORY_SECRET="$current_secret"
  elif command -v openssl >/dev/null 2>&1; then
    ASSISTANT_HISTORY_SECRET=$(openssl rand -hex 32)
    note "Generated a random ASSISTANT_HISTORY_SECRET for you."
  else
    ask_secret ASSISTANT_HISTORY_SECRET "ASSISTANT_HISTORY_SECRET (any long random string):"
  fi
fi
write_env GROQ_API_KEY "$GROQ_API_KEY"
write_env ASSISTANT_HISTORY_SECRET "$ASSISTANT_HISTORY_SECRET"
printf '\n'
note "Paste these into Vercel:"
note "  GROQ_API_KEY              = (the value you just entered)"
note "  ASSISTANT_HISTORY_SECRET  = $ASSISTANT_HISTORY_SECRET"
note "  VITE_SUPABASE_URL         = $VITE_SUPABASE_URL"
note "  VITE_SUPABASE_ANON_KEY    = $VITE_SUPABASE_ANON_KEY"
note "Leave VITE_DEMO_MODE unset (or false). Leave GROQ_CHAT_MODEL / GROQ_VOICE_MODEL / GROQ_FALLBACK_MODELS / GROQ_STT_MODEL / GROQ_TTS_MODEL / GROQ_TTS_VOICE unset unless overriding a default."
warn "Do NOT add VITE_SUPABASE_SERVICE_ROLE_KEY to Vercel. Nothing in the app reads it any more."
pause "All variables saved in Vercel and a redeploy triggered?"

# ── Stage 8: clean the local .env ───────────────────────────────────────────
stage "Clean up the local .env"
if [[ -f "$ENV_FILE" ]] && grep -qE "^VITE_SUPABASE_SERVICE_ROLE_KEY=" "$ENV_FILE"; then
  if confirm "Found VITE_SUPABASE_SERVICE_ROLE_KEY in $ENV_FILE. Delete it now?"; then
    tmp=$(mktemp); grep -vE "^VITE_SUPABASE_SERVICE_ROLE_KEY=" "$ENV_FILE" > "$tmp"; mv "$tmp" "$ENV_FILE"
    note "Removed VITE_SUPABASE_SERVICE_ROLE_KEY from $ENV_FILE."
  fi
else
  note "No VITE_SUPABASE_SERVICE_ROLE_KEY found in $ENV_FILE."
fi
if [[ -f "$ENV_FILE" ]] && grep -qE "^NVIDIA_" "$ENV_FILE"; then
  if confirm "Found obsolete NVIDIA_* entries in $ENV_FILE. Delete them now?"; then
    tmp=$(mktemp); grep -vE "^NVIDIA_" "$ENV_FILE" > "$tmp"; mv "$tmp" "$ENV_FILE"
    note "Removed NVIDIA_* entries from $ENV_FILE."
  fi
else
  note "No NVIDIA_* entries found in $ENV_FILE."
fi

# ── Stage 9: verify the live site ───────────────────────────────────────────
stage "Verify the live site"
ask VERCEL_DOMAIN "Vercel production domain (e.g. apexlog.vercel.app):"
[[ -n "$VERCEL_DOMAIN" ]] && write_env VERCEL_DOMAIN "$VERCEL_DOMAIN"
LIVE_URL="https://$VERCEL_DOMAIN"
if command -v curl >/dev/null 2>&1 && [[ -n "$VERCEL_DOMAIN" ]]; then
  say "Checking region + auth guards on $LIVE_URL ..."
  HDRS=$(curl -sI "$LIVE_URL/api/chat" 2>/dev/null || true)
  VID=$(printf '%s' "$HDRS" | grep -i '^x-vercel-id' || true)
  if [[ -n "$VID" ]]; then
    note "x-vercel-id: ${VID#*: }"
    [[ "$VID" == *bom1* ]] && note "✓ running in bom1" || warn "doesn't mention bom1 — check that vercel.json's region took effect"
  else
    warn "couldn't read x-vercel-id (site may still be deploying)"
  fi
  for path in api/chat api/transcribe api/speak; do
    CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$LIVE_URL/$path" 2>/dev/null || echo "?")
    note "POST /$path with no session → HTTP $CODE"
    [[ "$CODE" == "401" ]] || warn "expected 401 for /$path, got $CODE"
  done
else
  warn "curl unavailable or no domain given — check by hand: x-vercel-id should include bom1; /api/chat, /api/transcribe, /api/speak should all 401 without a session."
fi
say "By hand in the browser: sign up with a real email (confirm it), sign in, sign out, 'Continue with Google', and 'Forgot password' end to end."
say "Confirm a fresh account's profile defaults to INR, then change currency + starting balance in Settings and reload to confirm it persists."
say "RLS check: sign up a second test account and confirm it can't see or edit the first account's trades, checklists, progress or profile — through the app and through a direct REST call using the anon key."
confirm "All of the above checked out?"

# ── Stage 10: record the launch ─────────────────────────────────────────────
stage "Record the launch"
DATE=$(date +%Y-%m-%d)
RECORD_LINE="- $DATE: deployed at https://$VERCEL_DOMAIN (Supabase Mumbai + Vercel bom1)."
if [[ -n "$VERCEL_DOMAIN" ]]; then
  if [[ -f research/hackathon-roadmap.md ]] && grep -qF "$RECORD_LINE" research/hackathon-roadmap.md; then
    note "research/hackathon-roadmap.md already records this URL and date."
  else
    if ! grep -qF '## Live deployment' research/hackathon-roadmap.md 2>/dev/null; then
      printf '\n## Live deployment\n\n' >> research/hackathon-roadmap.md
    fi
    printf '%s\n' "$RECORD_LINE" >> research/hackathon-roadmap.md
    note "Appended the live URL and date to research/hackathon-roadmap.md."
  fi
  note "Also update ticket 09's Status and Comments, and progress.md, per the ticket flow in AGENTS.md."
else
  warn "No domain captured — add the live URL and date to research/hackathon-roadmap.md by hand."
fi

finish
