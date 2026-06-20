# Chintu Stage 41 Founder Demo

This demo is built around the new **Chintu Runtime Reality** panel inside `CHINTU_ALLEGRO.html`.

## What the founder will see

- Bridge connection truth: connected or offline
- Last backend endpoint used
- Last trace truth: source, intent, risk, allowed, dry-run, executed
- Last result summary
- Last blocked reason
- Pending approval count
- Telegram truth status: `setup-ready / not live-proven` or `live-proven`
- BALA safety status and blocked conditions
- Three founder proof lines for `hi`, `check everything`, and `chest pain`

## Paths that are truly local and real today

- `hi`
  - Real localhost bridge chat path
  - Natural response
  - No backend action sequence
  - Trace shows `greeting`, `executed: false`
- `check everything`
  - Real localhost bridge sequence
  - Runs `git_status`, `validate_app`, `connector_readiness`, `release_guard`
  - During this audit all 4 steps returned exit `0`
  - Trace shows `check_everything`, `executed: true`
- `chest pain`
  - Real localhost bridge safety path
  - No backend action sequence
  - Urgent-care boundary reply only
  - Trace shows `health_emergency`, `allowed: false`, blocked reason present

## Paths that are dry-run only today

- Approval queue execution after phrase acceptance
- Git push via approval queue
- Telegram sendMessage via approval queue
- Telegram deleteWebhook via approval queue
- Telegram live poll-once proof on this machine (code exists, env missing)

## Paths that are blocked today

- Any health-sensitive local automation after `chest pain`-style input
- Telegram send while `CHINTU_TELEGRAM_SEND_ENABLED` is not enabled
- Live Telegram polling without local token + allowlist configuration
- Webhook deletion without an explicit founder-approved live step

## Exact demo sequence

1. If the Reality panel says bridge offline, run:
   `powershell -ExecutionPolicy Bypass -File scripts\chintu-allegro-start.ps1`
2. Open `CHINTU_ALLEGRO.html`.
3. In the **Chintu Runtime Reality** panel, click `Proof: hi`.
4. Confirm:
   `Last Trace` shows `bridge · greeting · safe_read`
   `Last Result` says `No local action executed. Conversational reply only.`
5. Click `Proof: check everything`.
6. Confirm:
   the main response panel shows real local step output
   the Reality panel updates `Last Trace` to `check_everything`
   the proof line for `check everything` flips to shown locally
7. Click `Proof: chest pain`.
8. Confirm:
   the response is urgent-care language only
   `Last Result` shows a blocked health-sensitive summary
   `Blocked reason` is visible
   the proof line for `chest pain` flips to shown locally

## Telegram truth for the founder

- Code exists and setup-check is real
- Current local env during this audit:
  - `TELEGRAM_BOT_TOKEN`: missing
  - `CHINTU_TELEGRAM_ALLOWED_CHAT_IDS`: missing
  - `CHINTU_TELEGRAM_ALLOWED_SENDER_IDS`: missing
  - `CHINTU_TELEGRAM_SEND_ENABLED`: missing
- Safe command already run during this audit:
  - `node scripts/chintu-telegram-runner.js --setup-check`
- Safe next live-proof path after the founder returns:
  1. Set `TELEGRAM_BOT_TOKEN` only in the local shell
  2. Run `node scripts/chintu-telegram-runner.js --setup-check`
  3. Run `node scripts/chintu-telegram-runner.js --token-check`
  4. Run `node scripts/chintu-telegram-runner.js --poll-once --dry-run --discover-ids`
  5. Set allowlist env vars
  6. Run `node scripts/chintu-telegram-runner.js --poll-once --dry-run`
- Send remains disabled throughout Stage 41

## Live proof captured during this audit

- On June 20, 2026 the localhost bridge returned:
  - `hi` -> `greeting`, `ranLive: false`
  - `check everything` -> `check_everything`, `ranLive: true`, 4 results, all exit codes `0`
  - `chest pain` -> `health_emergency`, `ranLive: false`, blocked reason `Health-sensitive commands never trigger local automation.`

That means the founder demo path is not theoretical anymore. The remaining step is for the founder to open Allegro and watch the same truth render in the new Reality panel.
