# Chintu Real Connector — Telegram Activation Runbook

**Status:** Architecture — ready for founder to execute human steps  
**Connector code:** `scripts/chintu-connector-send.js` — FULLY IMPLEMENTED  
**All 7 safety gates are in the code.** This runbook is the human activation path.

---

## What Already Exists

The connector-send engine supports Telegram today:

- `buildRequest()` constructs the exact Telegram Bot API payload
- All 7 safety gates are enforced before any HTTP call
- `--preview` writes a local preview file with no network call
- `--send` requires mode=active + allowlist + approval phrase
- Audit log appended on every blocked or sent attempt
- Per-connector pause file supported (`CHINTU_OUTBOX/CONNECTOR_telegram_PAUSE`)
- Global pause file supported (`CHINTU_OUTBOX/CONNECTORS_GLOBAL_PAUSE`)
- Health data guard blocks any payload containing health-related keywords
- Medical claims guard blocks prohibited language

**Nothing needs to be coded for Telegram to work.** The human steps below are what unlock it.

---

## Stage 1 — BotFather Setup (Human, ~5 minutes)

These steps happen on Telegram (phone or desktop). Nothing touches the repo.

1. Open Telegram and search for `@BotFather`.
2. Send `/newbot`.
3. Choose a name: `Chintu OS` (display name, can be anything).
4. Choose a username: `ChintuOS_bot` (must end in `_bot`; must be globally unique).
5. BotFather replies with your **bot token**. It looks like: `7123456789:AAFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
6. Copy and store this token in **Windows Credential Manager** or a User environment variable — NOT in the repo, NOT in `.env`, NOT in any file.

**Create a dedicated channel/group:**
1. Create a new private Telegram group: `Chintu OS Status`.
2. Add your `ChintuOS_bot` to the group.
3. Promote it to admin (so it can send messages).
4. Get your chat ID: Send one message in the group, then visit:
   `https://api.telegram.org/bot{YOUR_BOT_TOKEN}/getUpdates`
   Look for `"chat":{"id": -XXXXXXXXXX}` — that negative number is your chat ID.
5. Store the chat ID. It will be `CHINTU_TG_CHAT_ID`.

---

## Stage 2 — Env Var Provisioning (Human, Windows)

Set these as **User environment variables** (not System, not repo). Never write them to any file.

Open PowerShell (not as admin):

```powershell
# Replace values with your real values
[Environment]::SetEnvironmentVariable("CHINTU_TG_BOT_TOKEN",  "7123456789:AAFxxx...", "User")
[Environment]::SetEnvironmentVariable("CHINTU_TG_CHAT_ID",    "-1001234567890",        "User")
[Environment]::SetEnvironmentVariable("CHINTU_TG_TARGET",     "founder-room",          "User")
[Environment]::SetEnvironmentVariable("CHINTU_TG_ALLOWLIST",  "founder-room",          "User")
```

**What each variable means:**

| Variable | Purpose | Example |
|---|---|---|
| `CHINTU_TG_BOT_TOKEN` | Bot API token from BotFather | `7123456789:AAF...` |
| `CHINTU_TG_CHAT_ID` | Numeric chat ID of your Chintu OS group | `-1001234567890` |
| `CHINTU_TG_TARGET` | Logical label for the target (must match allowlist) | `founder-room` |
| `CHINTU_TG_ALLOWLIST` | CSV of allowed target labels | `founder-room` |

The allowlist is a comma-separated list of logical labels. The target must appear in the allowlist or send is blocked. This prevents accidental sends to wrong channels.

**Restart PowerShell after setting env vars** to pick them up.

---

## Stage 3 — Set Approval Phrase

```powershell
[Environment]::SetEnvironmentVariable("CHINTU_CONNECTOR_APPROVAL_PHRASE", "chintu-send-approved-2026", "User")
```

Choose a phrase you will remember. It must be passed as `--approval "chintu-send-approved-2026"` on every real send. If the phrase does not match, the send is blocked and logged.

---

## Stage 4 — Validate Configuration (Dry-Run)

Open a new PowerShell in the repo root. These commands make no network calls.

```powershell
# Check env validation
node scripts\chintu-connector-send.js --validate-env

# Check full readiness report
node scripts\chintu-connector-send.js --check

# Check connector status table
node scripts\chintu-connector-send.js --status
```

Expected output when configured correctly:
```
CHINTU_CONNECTOR_STATUS
  [READY] telegram  (send-capable)  can_send_now: false
  [---]   discord   (send-capable)  can_send_now: false
  [---]   slack     (send-capable)  can_send_now: false
  [---]   gmail     (architecture-only)  can_send_now: false
```

`can_send_now: false` is correct at this stage — mode is still dry-run.

---

## Stage 5 — Preview Payload (Dry-Run)

Build a preview file. This makes NO network call. It writes to `CHINTU_OUTBOX/latest_connector_preview.json`.

```powershell
node scripts\chintu-connector-send.js --preview --connector telegram --body "Chintu heartbeat. Branch: main. Build: clean. Next: review action queue."
```

Open `CHINTU_OUTBOX/latest_connector_preview.json` and inspect:
- `connector`: should be `telegram`
- `recipient`: should match `CHINTU_TG_TARGET`
- `recipient_allowlisted`: should be `true`
- `body`: the exact text that would be sent
- `body_sha256`: the hash (used for audit trail)
- `no_real_send_reason`: explains why no send happened

**Review this carefully before proceeding.**

---

## Stage 6 — Activate and First Live Test

When you are satisfied with the preview:

```powershell
# Set mode to active (User env var, not in repo)
[Environment]::SetEnvironmentVariable("CHINTU_CONNECTOR_MODE", "active", "User")
```

Restart PowerShell, then run the send command:

```powershell
node scripts\chintu-connector-send.js --send --connector telegram --preview-file CHINTU_OUTBOX\latest_connector_preview.json --approval "chintu-send-approved-2026"
```

Expected output:
```json
{
  "status": "sent",
  "httpStatus": 200
}
```

Check your Telegram group for the message. Check `CHINTU_OUTBOX/connector_sent.log.jsonl` for the sent record.

---

## Stage 7 — Sent Log Verification

```powershell
# View last sent record
Get-Content CHINTU_OUTBOX\connector_sent.log.jsonl | Select-Object -Last 1 | ConvertFrom-Json
```

Verify:
- `connector`: `telegram`
- `recipient`: your target label
- `http_status`: `200`
- `timestamp`: matches when you ran the command

View audit log for the full trace:
```powershell
Get-Content CHINTU_OUTBOX\connector_audit.log.jsonl | Select-Object -Last 5 | ForEach-Object { $_ | ConvertFrom-Json }
```

---

## Stage 8 — Pause

To pause Telegram immediately (no code change required):

```powershell
# Create pause file
New-Item -ItemType File -Force CHINTU_OUTBOX\CONNECTOR_telegram_PAUSE

# Verify pause
node scripts\chintu-connector-send.js --status
```

Output will show `paused: true` for Telegram. All send attempts will be blocked and logged.

To pause ALL connectors:
```powershell
New-Item -ItemType File -Force CHINTU_OUTBOX\CONNECTORS_GLOBAL_PAUSE
```

---

## Stage 9 — Revoke

To fully revoke Telegram access:

```powershell
# Remove env vars
[Environment]::SetEnvironmentVariable("CHINTU_TG_BOT_TOKEN", $null, "User")
[Environment]::SetEnvironmentVariable("CHINTU_TG_CHAT_ID",   $null, "User")
[Environment]::SetEnvironmentVariable("CHINTU_TG_TARGET",    $null, "User")
[Environment]::SetEnvironmentVariable("CHINTU_TG_ALLOWLIST", $null, "User")

# Set mode back to dry-run
[Environment]::SetEnvironmentVariable("CHINTU_CONNECTOR_MODE", "dry-run", "User")
```

Connector falls back to "discovered" state. Audit log is preserved.

---

## Acceptable Message Body (What Chintu May Send via Telegram)

**Allowed content:**
- Heartbeat status: branch, working tree, unpushed count
- Next action title
- Build pass/fail summary (command names only, no output)
- Connector status summary (configured/active/paused)

**Never allowed in Telegram messages:**
- BALA user data of any kind
- Health metrics (heart rate, sleep, steps, HRV, SpO2, weight, glucose, BP)
- Mood or symptom entries
- Coach conversations
- Medical content
- Any file path under `CHINTU_MEMORY_VAULT/`
- Secrets, tokens, or env var values

The health data guard in `chintu-connector-send.js` will block many of these automatically. The allowlist is the second layer.

**Safe heartbeat message template:**
```
Chintu heartbeat
{timestamp} | branch {branch}
Tree: {status}. Unpushed: {n}.
Next: {next_action_title}
```

---

## Discord / Slack as Next Paths

Both are already implemented in the send engine with the same 7-gate flow.

**Discord:**
1. Create a private Discord server or use an existing one.
2. Go to a channel → Edit Channel → Integrations → Webhooks → New Webhook.
3. Copy the webhook URL. Store as `CHINTU_DISCORD_WEBHOOK_URL` (User env var, not in repo).
4. Set `CHINTU_DISCORD_TARGET=founder-server`, `CHINTU_DISCORD_ALLOWLIST=founder-server`.
5. Follow the same preview → active → send → log → pause flow.

**Slack:**
1. Go to `api.slack.com/apps` → Create New App → From Scratch.
2. Add Incoming Webhooks, activate, create webhook for a channel.
3. Copy the webhook URL. Store as `CHINTU_SLACK_WEBHOOK_URL` (User env var, not in repo).
4. Set `CHINTU_SLACK_TARGET=chintu-status`, `CHINTU_SLACK_ALLOWLIST=chintu-status`.
5. Follow the same flow.

Discord and Slack are lower priority than Telegram. Activate Telegram successfully first.

---

## no-network-egress Test Compatibility

The `chintu-no-network-egress.test.js` already allowlists `chintu-connector-send.js`. This means:
- The test will not flag the send engine itself.
- All other scripts are still scanned.
- When mode is `dry-run` (default), no network call is made from the script in normal operation.
- Real sends only happen when the founder sets `CHINTU_CONNECTOR_MODE=active` and runs the `--send` command manually.

The test must remain green at all times. Adding any new script that makes network calls requires updating the test allowlist **and** getting founder approval.

---

*BALA is a health-awareness companion. It does not diagnose, treat, predict, prevent, replace doctors, or provide emergency monitoring.*
