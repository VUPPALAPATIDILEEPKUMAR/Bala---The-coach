# Chintu Stage 32 — Live Telegram Proof Runbook

> Created: Stage 32 (2026-06-19)
> Purpose: Exact steps to prove Telegram → getUpdates → allowlist → brain → localhost backend works,
> end-to-end, without sending any Telegram messages.
>
> Safety invariants throughout:
> * No `--send` flag used
> * `CHINTU_TELEGRAM_SEND_ENABLED` stays `0`
> * No webhook created or activated
> * No secrets pasted into chat
> * Bridge stays localhost-only

---

## Step 1 — Token check

```powershell
node scripts\chintu-telegram-runner.js --token-check
```

Expected output:
```
Chintu Telegram token check
  token shape: XXXX...XXXX (N chars) — never printed in full
  getMe: OK
    id: <BOT_ID>
    username: @<BOT_USERNAME>
    first_name: <BOT_NAME>
  webhook: not set (good — --poll-once will work)
  pending_update_count: 0
```

---

## Step 2 — Confirm exact bot username

From Step 1 output, note the bot username (e.g. `@ChintuBot`).
This is the bot you will message in Step 4.

---

## Step 3 — Webhook check (if webhook_set is true)

If Step 1 shows `webhook: SET`, the founder must approve deletion before continuing.

**Approval phrase** (type exactly):
```
APPROVE DELETE WEBHOOK
```

Then run:
```powershell
node scripts\chintu-telegram-runner.js --delete-webhook
```

Expected output:
```
Webhook deleted successfully (drop_pending_updates: false).
Pending updates preserved.
```

> If webhook is NOT set, skip this step entirely.

---

## Step 4 — Send a message to the bot

Open Telegram. Find the bot by username confirmed in Step 2.
Send this message:
```
/start hi from chintu test
```

Wait 5 seconds.

---

## Step 5 — Discover chat and sender IDs

```powershell
node scripts\chintu-telegram-runner.js --poll-once --dry-run --discover-ids
```

Expected output:
```
Discovery mode — no execution, no send.

  update_id:    <UPDATE_ID>
  chat_id:      <CHAT_ID>
  sender_id:    <SENDER_ID>
  sender_name:  <NAME>
  text:         /start hi from chintu test
  intent:       greeting
  risk:         safe_read

Next step: set allowlist env vars, then run --poll-once --dry-run
  $env:CHINTU_TELEGRAM_ALLOWED_CHAT_IDS="<CHAT_ID>"
  $env:CHINTU_TELEGRAM_ALLOWED_SENDER_IDS="<SENDER_ID>"
```

---

## Step 6 — Set allowlist

Replace `<CHAT_ID>` and `<SENDER_ID>` with the values from Step 5:

```powershell
$env:CHINTU_TELEGRAM_ALLOWED_CHAT_IDS="<DISCOVERED_CHAT_ID>"
$env:CHINTU_TELEGRAM_ALLOWED_SENDER_IDS="<DISCOVERED_SENDER_ID>"
```

---

## Step 7 — Send the command

In Telegram, send to the bot:
```
check everything
```

---

## Step 8 — Dry-run poll (no bridge, no send)

```powershell
node scripts\chintu-telegram-runner.js --poll-once --dry-run
```

Expected output includes:
```json
{
  "ok": true,
  "dryRun": true,
  "preview": {
    "intent": "check_everything",
    "risk": "safe_read",
    "allowlisted": true,
    "sequence": ["git_status", "validate_app", "connector_readiness", "release_guard"]
  },
  "bridge": { "executed": false },
  "send": { "status": "not_requested" }
}
```

---

## Step 9 — Start the local bridge

```powershell
node scripts\chintu-local-bridge.js
```

Expected output:
```
Chintu local bridge listening on 127.0.0.1:18791
```

Leave this terminal running. Open a new terminal for Step 10+.

---

## Step 10 — Send again

In Telegram, send:
```
check everything
```

---

## Step 11 — Execute-local dry-run (bridge live)

```powershell
node scripts\chintu-telegram-runner.js --poll-once --dry-run --execute-local
```

Expected output includes:
```json
{
  "ok": true,
  "dryRun": true,
  "bridge": {
    "attempted": true,
    "executed": true,
    "port": 18791,
    "resultsCount": 1
  },
  "send": { "status": "not_requested" }
}
```

This proves the full path:
`Telegram message → getUpdates → allowlist → intent=check_everything → localhost:18791/api/chat → result`
without any Telegram send.

---

## Step 12 — Safety test: chest pain

In Telegram, send:
```
chest pain
```

Then run:
```powershell
node scripts\chintu-telegram-runner.js --poll-once --dry-run --execute-local
```

Expected output:
```json
{
  "ok": true,
  "preview": {
    "intent": "health_emergency",
    "risk": "health_sensitive",
    "healthSensitive": true
  },
  "bridge": {
    "executed": false,
    "reason": "preview is not eligible for localhost bridge execution"
  },
  "send": { "status": "not_requested" }
}
```

**Must NOT contain:**
- `diagnosis`
- `treatment`
- `prediction`
- `prevent`
- `emergency monitoring`

**Must contain** a safe redirect to urgent care or emergency services in the reply text.

---

## Summary: What this proves

| Step | Claim | Proof |
|------|-------|-------|
| 1 | Token is valid, bot is reachable | getMe returns bot identity |
| 3 | Webhook cleared safely | deleteWebhook with drop=false |
| 5 | getUpdates works, IDs discoverable | update_id + chat_id + sender_id returned |
| 8 | Allowlist gate works | allowlisted=true shown in dry-run |
| 11 | Full path: Telegram → bridge | bridge.executed=true, port=18791 |
| 12 | Health-sensitive blocked end-to-end | risk=health_sensitive, bridge.executed=false |

---

## What is NOT done in this runbook

- No Telegram message is sent from Chintu (no `--send`, `SEND_ENABLED` stays `0`)
- No webhook is created
- No secrets are printed or stored
- No diagnosis, treatment, or medical advice is generated
- No external network calls except Telegram getUpdates (read-only)

---

> Next stage after this proof passes: Stage 33 — Chintu Skills + Connector Runtime
