# Chintu C42.1 Telegram Live-Proof Preflight Inspector

This preflight is a small, truthful, read-only check that tells the founder
whether Chintu is actually ready for the next safe Telegram milestone.

Run it with:

```powershell
node scripts\chintu-c42-preflight.js --status
node scripts\chintu-c42-preflight.js --json
```

## What It Checks

- Whether `TELEGRAM_BOT_TOKEN` is configured in the local shell.
- Whether Telegram allowlist env vars are configured.
- Whether `CHINTU_TELEGRAM_SEND_ENABLED` is on or off.
- Whether the local bridge responds on `127.0.0.1:18791`.
- Whether `/api/runtime-status` responds on localhost.
- Whether required Chintu runner files exist.
- Whether `CHINTU_OUTBOX/telegram_connector_audit.jsonl` is ignored by Git.
- Whether safe local proof evidence already exists.

## What It Never Does

- It never prints the bot token.
- It never prints Telegram chat IDs or sender IDs.
- It never sends a Telegram message.
- It never calls `getUpdates`.
- It never creates or deletes a webhook.
- It never enables Telegram send.
- It never changes audit logs or runtime files.

Setup-ready does not mean live-proven.

## Readiness States

### `TOKEN_MISSING`

Meaning:
The local shell does not currently expose `TELEGRAM_BOT_TOKEN`.

Exact next safe action:
Set `TELEGRAM_BOT_TOKEN` only in the local shell, then rerun the setup check.

### `READY_FOR_IDENTITY_CHECK`

Meaning:
The token appears configured, but there is no local evidence yet that the bot
identity and webhook status were checked safely.

Exact next safe action:
Run:

```powershell
node scripts\chintu-telegram-runner.js --token-check
```

### `READY_FOR_ID_DISCOVERY`

Meaning:
The token identity looks checked, but the Telegram allowlist is still missing.

Exact next safe action:
Send one founder Telegram message to the bot, then run:

```powershell
node scripts\chintu-telegram-runner.js --poll-once --dry-run --discover-ids
```

After that, set the allowlist env vars locally.

### `READY_FOR_DRY_RUN`

Meaning:
Token and allowlist prerequisites are in place, but there is not yet a safe
dry-run signal that Chintu can read one inbound Telegram command truthfully.

Exact next safe action:
Run:

```powershell
node scripts\chintu-telegram-runner.js --poll-once --dry-run
```

### `READY_FOR_EXECUTE_LOCAL_PROOF`

Meaning:
The bridge truth checks are green and the next safe milestone is one inbound
Telegram command reaching the local runtime without enabling Telegram send.

Exact next safe action:
Run:

```powershell
node scripts\chintu-telegram-runner.js --poll-once --dry-run --execute-local
```

Then verify the result in the Runtime Reality panel.

### `LIVE_PROOF_UNCONFIRMED`

Meaning:
There is still not enough trustworthy local evidence to say the Telegram lane
is fully live-proven, or there is old evidence that still needs a truth check.

Exact next safe action:
Rerun the preflight, confirm the bridge truth checks, and only then repeat one
safe execute-local proof if needed.

## Eventual Live-Proof Path

Phone Telegram message -> poll-once -> allowlist -> local bridge -> Runtime Reality panel

That is the real milestone. The preflight does not perform it for you.

## Important Safety Reminder

Telegram sending remains disabled.
