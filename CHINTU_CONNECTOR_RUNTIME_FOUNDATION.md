# Chintu Connector Runtime Foundation

> Last updated: Stage 32 (2026-06-19)
> Scope: defines the safe connector architecture so future connectors can be added without chaos.

---

## 1. Chintu Connector Layers

Every inbound command from any channel flows through these layers in order. All layers must
be traversed — skipping any gate is a safety violation.

```
[Channel Input]
     |
     v
[Identity Layer]      — bot username, chatId, senderId extracted from raw update
     |
     v
[Trust Gate]          — allowlist: CHINTU_TELEGRAM_ALLOWED_CHAT_IDS / _SENDER_IDS
     |  (blocked = return preview + audit, no further action)
     v
[Intent Layer]        — brain router classifies intent, risk, and action sequence
     |
     v
[Execution Gate]      — dry-run by default; --execute-local required to cross
     |                — --send disabled unless CHINTU_TELEGRAM_SEND_ENABLED=1
     v
[Runtime Layer]       — localhost bridge ONLY at 127.0.0.1:18791
     |                — calls /api/chat with raw message text
     v
[Action Layer]        — bridge dispatches to allowlisted local actions only
     |                — no git push, no network egress beyond localhost
     v
[Audit Layer]         — every run appended to CHINTU_OUTBOX/ as JSONL (gitignored)
     |                — no secrets, no tokens, no raw update text in audit
     v
[Safety Layer]        — health-sensitive + dangerous commands block execution gate
                      — no diagnosis, treatment, prediction, emergency monitoring
```

---

## 2. Backend Reality Map

> Honest map of what is real, what is dry-run, and what is missing as of Stage 32.

| Path | Status | Notes |
|------|--------|-------|
| Telegram getUpdates (--poll-once) | **Real** | Calls Telegram API. Requires TELEGRAM_BOT_TOKEN in env. |
| Telegram getMe (--token-check) | **Real** | Returns bot id, username, first_name. Token never printed. |
| Telegram getWebhookInfo (--token-check) | **Real** | Returns webhook_set, pending_update_count, last_error. |
| Telegram deleteWebhook (--delete-webhook) | **Real** (gated) | drop_pending_updates=false hardcoded. Dry-run preview always runs first. |
| Intent classification (brain router) | **Real** | Local-only, no network. Every message classified before any action. |
| Allowlist check | **Real** | CHINTU_TELEGRAM_ALLOWED_CHAT_IDS / _SENDER_IDS env vars. Deny-by-default. |
| /api/health probe (probeLocalBridge) | **Real** | Tries ports 18791–18796. Returns first healthy port. |
| /api/chat (executeLocalBridgeChat) | **Real** (when bridge up) | Calls 127.0.0.1:18791/api/chat with `{ message }` body. |
| Local action sequences (git_status, validate_app, etc.) | **Real** (when bridge up) | Bridge dispatches to allowlisted binaries. No shell injection. |
| Health-sensitive block (chest pain, etc.) | **Real** | canExecuteLocally() returns false. Bridge never called. |
| Telegram sendMessage | **Dry-run today** | Gated by CHINTU_TELEGRAM_SEND_ENABLED=1 + --send flag. |
| GitHub connector (dry-run) | **Dry-run today** | gh binary. auth not confirmed. --dry-run only. |
| Discovery (--discover-ids) | **Real read-only** | Reads chatId/senderId from update. Never executes. Never sends. |

---

## 3. Connector Command Contract

Every connector action must answer **all ten questions** before any execution is allowed:

| # | Question | Where answered |
|---|----------|---------------|
| 1 | Who sent it? | `preview.commandSummary.senderId`, `.chatId`, `.senderName` |
| 2 | Was sender allowed? | `preview.allowlisted`, `preview.allowReason` |
| 3 | What command was detected? | `preview.intent`, `preview.text` |
| 4 | Was action allowed? | `adapter.canExecuteLocally(preview)` — false if health-sensitive |
| 5 | Was it dry-run? | `result.dryRun`, `result.executeLocalRequested` |
| 6 | Was backend called? | `result.bridge.executed` |
| 7 | Which endpoint was called? | `/api/chat` at `127.0.0.1:<port>` — `result.bridge.port` |
| 8 | What result came back? | `result.bridge.intent`, `.risk`, `.resultsCount`, `.reply` |
| 9 | Was anything blocked? | `result.send.status`, `result.bridge.reason`, `result.preview.healthSensitive` |
| 10 | Was any external send/write attempted? | `result.send.sent` (false in dry-run), audit JSONL entry |

Every run is appended to `CHINTU_OUTBOX/telegram_connector_audit.jsonl` (gitignored).
The audit entry answers all ten questions without containing secrets or raw update PII.

---

## 4. Stage 32 Diagnostic Flag Reference

These flags exist **today** in `scripts/chintu-telegram-runner.js`:

| Flag | What it does | Safety |
|------|-------------|--------|
| `--setup-check` | Local env check: token, allowlist, bridge, send status. No network call. | Safe to run any time. |
| `--token-check` | getMe + getWebhookInfo. Prints bot id/username/first_name + webhook status. | Token never printed. No send. |
| `--get-updates-debug` | getUpdates(timeout=0, limit=10). Prints update metadata. **No offset set — updates NOT consumed.** | Safe to call repeatedly. |
| `--delete-webhook --dry-run` | Previews webhook deletion only. No actual delete. | No state change. |
| `--delete-webhook` | Deletes webhook. `drop_pending_updates: false` hardcoded. | Run --dry-run first. Requires founder approval. |
| `--poll-once --dry-run --discover-ids` | Reads one update. No allowlist needed. Prints chatId/senderId. | Never executes. Never sends. |
| `--poll-once --dry-run` | Reads update, classifies intent, shows preview. No bridge. No send. | Requires token + allowlist env. |
| `--poll-once --dry-run --execute-local` | Full path to bridge. Bridge called if online. No send. | Requires token + allowlist + bridge running. |
| `--poll-once --send` | Full send. **Gated by CHINTU_TELEGRAM_SEND_ENABLED=1.** | Only use when explicitly approved. |

### Zero-updates diagnosis flowchart

```
--poll-once returns updatesSeen: 0
       |
       +-- Run --token-check
              |
              +-- webhook_set: true?
              |      YES → Ask founder: "Approve webhook deletion?"
              |             On approval: --delete-webhook (drop_pending_updates: false)
              |             Then resend message and retry --poll-once
              |
              +-- webhook_set: false?
                     YES → Run --get-updates-debug
                            |
                            +-- raw getUpdates sees updates?
                            |      YES → runner bug (offset issue)
                            |      Fix: check offset in runWithArgs
                            |
                            +-- raw getUpdates sees zero?
                                   Causes:
                                   1. Wrong bot username — message sent to different bot
                                   2. Old updates already consumed by prior getUpdates
                                   3. Another process polling same token
                                   4. Message sent before token was configured
                                   Fix: confirm bot username from getMe, send fresh message
```

---

## 5. Approved Allowlist Env Setup

After `--discover-ids` returns chatId and senderId:

```powershell
# Set in your local shell ONLY. Never commit these values.
$env:CHINTU_TELEGRAM_ALLOWED_CHAT_IDS="<DISCOVERED_CHAT_ID>"
$env:CHINTU_TELEGRAM_ALLOWED_SENDER_IDS="<DISCOVERED_SENDER_ID>"
```

Then verify:
```powershell
node scripts\chintu-telegram-runner.js --setup-check
```

---

## 6. Local Bridge Endpoint Used by execute-local

When `--execute-local` is set and the bridge is online:

```
executeLocalBridgeChat(port, preview.text)
  → POST http://127.0.0.1:<port>/api/chat
  → body: { "message": "<command text>" }
  → brain router classifies and routes
  → returns: { ok, intent, risk, ranLive, results[], reply, nextSuggestedAction }
```

The `/api/chat` endpoint is the correct path. The bridge dispatches `check everything` to the
`check_everything` sequence (git_status → validate_app → connector_readiness → release_guard).

**The bridge is never called for health-sensitive commands.** `canExecuteLocally(preview)`
returns `false` when `preview.healthSensitive === true`. The safety block happens before
any bridge probe.

---

## 7. Health-Sensitive Safety Layer

These phrases route to `health_emergency` intent with `risk: health_sensitive`:

- chest pain, chest pressure, trouble breathing, can't breathe
- fainting, someone is fainting
- stroke symptoms
- any combination of health-emergency signals

When `healthSensitive` is true:
- `canExecuteLocally()` → `false` → bridge never called
- `maybeSend()` → `blocked` (reason: health-sensitive commands never send replies)  
- Brain router reply → "Please seek urgent/emergency care or contact local emergency services."
- No diagnosis, treatment, prediction, prevention, or monitoring claim is made

---

## 8. Future Safe Connector Additions

These are documented for architecture visibility. **Not implemented today.**

| Future connector | Safe path | Gating required |
|-----------------|-----------|----------------|
| Discord dry-run | Same adapter contract as Telegram | New identity gate, same allowlist pattern |
| GitHub authenticated read | `gh` CLI after `gh auth` confirmed | Read-only only. No push. gh dry-run flag. |
| Local notification bridge | OS-level notify, no external API | Require explicit approval gate |
| Scheduled local reports | Cron-style trigger, bridge dispatch | Dry-run preview before any schedule activation |
| Voice command path | Transcription → same intent layer | Same 10-question contract before execution |
| Richer action registry | Add actions to bridge allowlist | Each action requires explicit safety review |
| Approval queue | Pre-execution confirmation step | Required before any write or external action |

**Adding any future connector must:**
1. Implement the 10-question command contract
2. Pass through the identity + trust gate
3. Default to dry-run
4. Route through the same brain router intent layer
5. Only call 127.0.0.1 for local actions
6. Have a test that proves health-sensitive commands are blocked
7. Have a test that proves no send happens in dry-run mode

---

## 9. Files That Implement This Foundation (Stage 32)

| File | Role |
|------|------|
| `scripts/chintu-telegram-runner.js` | Main connector runtime. All diagnostic flags. execute-local path. |
| `scripts/chintu-telegram-adapter.js` | buildTelegramDryRunPreview, canExecuteLocally, reply envelope |
| `scripts/chintu-phone-command-contract.js` | Normalization, allowlist, classification, reply envelope |
| `scripts/chintu-brain-router.js` | Intent classification, health-sensitive detection, action sequences |
| `scripts/chintu-local-bridge.js` | HTTP server on 127.0.0.1. Action allowlist. Origin gate. |
| `scripts/chintu-stage32-release.ps1` | Gated Stage 32 commit script. Explicit 5-file allowlist. |
| `CHINTU_FOUNDER_COMMAND_MAP.md` | Human-readable command reference for all diagnostic flags |
| `.gitignore` | Ensures audit JSONL files are never committed |

---

*Chintu must safely know what it can actually do, what is dry-run, what is blocked,*
*and what backend action really happened. This document is the proof layer.*
