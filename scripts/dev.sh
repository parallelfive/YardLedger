#!/usr/bin/env bash
#
# dev.sh — local dev stack orchestrator for YardLedger (Expo + Supabase).
#
# One command up, one command down — frees all ports when you switch projects.
#
#   npm run dev          # Supabase + edge functions + app on iOS simulator
#   npm run dev:clear    # same, but reset Metro cache
#   npm run dev:stop     # tear everything down, free ports 8081/54321/54323…
#   npm run dev:status   # what's running
#   npm run dev:reset    # wipe LOCAL Supabase db (confirmation prompt)
#
# ── ONE-TIME SETUP ───────────────────────────────────────────────────────────
# This app uses native modules (document scanner, ML Kit, signature) that need a
# custom dev client — Expo Go won't work. Build it once on a device/simulator:
#
#     npx expo run:ios
#
# After that, `npm run dev` (which runs `expo start --ios`) launches into that
# dev client. Re-run `expo run:ios` only when native deps change.
#
# Edge-function secrets: `supabase functions serve` auto-injects SUPABASE_URL /
# ANON / SERVICE_ROLE_KEY for local. Any extra secrets (e.g. CRON_SECRET) go in
# supabase/functions/.env — if that file exists it's passed via --env-file.
# ─────────────────────────────────────────────────────────────────────────────

set -uo pipefail

# Always operate from the repo root, regardless of where this is invoked.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DEV_DIR=".dev"
PID_FILE="$DEV_DIR/functions.pid"
LOG_FILE="$DEV_DIR/functions.log"
FN_ENV_FILE="supabase/functions/.env"
METRO_PORT=8081

c_green=$'\033[0;32m'; c_yellow=$'\033[0;33m'; c_red=$'\033[0;31m'; c_dim=$'\033[2m'; c_reset=$'\033[0m'
info()  { printf '%s▸%s %s\n' "$c_green" "$c_reset" "$*"; }
warn()  { printf '%s!%s %s\n' "$c_yellow" "$c_reset" "$*"; }
err()   { printf '%s✗%s %s\n' "$c_red" "$c_reset" "$*" >&2; }
dim()   { printf '%s%s%s\n' "$c_dim" "$*" "$c_reset"; }

# ── helpers ──────────────────────────────────────────────────────────────────
supabase_up() { supabase status >/dev/null 2>&1; }

functions_pid() { [ -f "$PID_FILE" ] && cat "$PID_FILE" 2>/dev/null || true; }

functions_running() {
  local pid; pid="$(functions_pid)"
  [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null
}

metro_pids() { lsof -ti:"$METRO_PORT" 2>/dev/null || true; }

# ── teardown (used by `stop` and by the start trap) ──────────────────────────
TORE_DOWN=0
teardown() {
  [ "$TORE_DOWN" = "1" ] && return 0
  TORE_DOWN=1
  echo
  info "Tearing down local dev stack…"

  # 1. edge functions (tracked PID + any strays)
  local pid; pid="$(functions_pid)"
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
    dim "  stopped edge functions (pid $pid)"
  fi
  pkill -f "supabase functions serve" 2>/dev/null || true
  rm -f "$PID_FILE"

  # 2. Metro / port 8081
  local mp; mp="$(metro_pids)"
  if [ -n "$mp" ]; then
    # shellcheck disable=SC2086
    kill $mp 2>/dev/null || true
    dim "  freed Metro on :$METRO_PORT"
  fi

  # 3. Supabase
  if supabase_up; then
    supabase stop >/dev/null 2>&1 || true
    dim "  stopped local Supabase"
  fi

  info "${c_green}All down — ports are free for your other projects.${c_reset}"
}

# ── start ────────────────────────────────────────────────────────────────────
cmd_start() {
  local clear_flag=""
  [ "${1:-}" = "--clear" ] && clear_flag="--clear"

  mkdir -p "$DEV_DIR"

  # a. Supabase (idempotent)
  if supabase_up; then
    info "Local Supabase already running — skipping start."
  else
    info "Starting local Supabase…"
    supabase start || { err "supabase start failed"; exit 1; }
  fi

  # b. Edge functions in the background
  if functions_running; then
    info "Edge functions already serving (pid $(functions_pid))."
  else
    local env_arg=()
    if [ -f "$FN_ENV_FILE" ]; then
      env_arg=(--env-file "$FN_ENV_FILE")
      dim "  using $FN_ENV_FILE for function secrets"
    fi
    info "Serving edge functions → $LOG_FILE"
    # `${arr[@]+"${arr[@]}"}` is the bash-3.2-safe way to expand a possibly-
    # empty array under `set -u` (macOS ships bash 3.2).
    supabase functions serve ${env_arg[@]+"${env_arg[@]}"} >"$LOG_FILE" 2>&1 &
    echo $! >"$PID_FILE"
    dim "  pid $(functions_pid)"
  fi

  # Tear down on Ctrl-C / TERM, and also after the app exits on its own.
  trap 'teardown; exit 0' INT TERM

  # c. App on the iOS simulator (foreground)
  info "Launching app on iOS simulator${clear_flag:+ (clearing Metro cache)}…"
  echo
  npx expo start --ios $clear_flag || true

  teardown
}

# ── stop ──────────────────────────────────────────────────────────────────────
cmd_stop() { teardown; }

# ── status ─────────────────────────────────────────────────────────────────────
cmd_status() {
  info "Local dev stack status:"
  if supabase_up; then
    printf '  %sSupabase%s      running\n' "$c_green" "$c_reset"
  else
    printf '  %sSupabase%s      stopped\n' "$c_dim" "$c_reset"
  fi
  if functions_running; then
    printf '  %sEdge functions%s running (pid %s)\n' "$c_green" "$c_reset" "$(functions_pid)"
  else
    printf '  %sEdge functions%s stopped\n' "$c_dim" "$c_reset"
  fi
  if [ -n "$(metro_pids)" ]; then
    printf '  %sMetro :%s%s     running\n' "$c_green" "$METRO_PORT" "$c_reset"
  else
    printf '  %sMetro :%s%s     stopped\n' "$c_dim" "$METRO_PORT" "$c_reset"
  fi
}

# ── reset (LOCAL db only) ───────────────────────────────────────────────────────
cmd_reset() {
  warn "This wipes your LOCAL Supabase database and re-runs all migrations + seed."
  warn "It only touches the local stack — your remote/linked project is NOT affected."
  printf '%sProceed? [y/N] %s' "$c_yellow" "$c_reset"
  read -r answer
  case "$answer" in
    y | Y | yes | YES)
      info "Resetting local database…"
      supabase db reset
      ;;
    *)
      info "Cancelled — nothing changed."
      ;;
  esac
}

# ── dispatch ────────────────────────────────────────────────────────────────────
case "${1:-}" in
  start)  shift; cmd_start "${1:-}" ;;
  stop)   cmd_stop ;;
  status) cmd_status ;;
  reset)  cmd_reset ;;
  *)
    err "Usage: scripts/dev.sh {start [--clear] | stop | status | reset}"
    exit 1
    ;;
esac
