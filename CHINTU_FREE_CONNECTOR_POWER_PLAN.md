# Chintu Free Connector Power Plan

**Stage:** 19 — Connector Power Layer  
**Purpose:** Move Chintu from gated dry-run architecture to real, free, safe connector sending.  
**Principle:** Active mode is not forbidden. Active mode is earned through a seven-stage ladder with founder-controlled gates at every transition.

---

## 1. Design Philosophy

Chintu is a connector-capable agent OS. The goal is **real sending through free tools**, not theoretical architecture. Every connector follows the same safety ladder, but the destination is live, working message delivery.

The founder is the only human who activates connectors. Agents propose, preview, and audit — they never activate.

---

## 2. Connector Ladder (Seven Stages)

Every connector progresses through these stages:

| # | Stage | Who Triggers | Network Calls | Reversible |
|---|---|---|---|---|
| 1 | **discovered** | Agent research / founder request | None | N/A |
| 2 | **configured** | Founder sets env vars | None | Unset env vars |
| 3 | **dry-run** | Default behavior (automatic) | None | Always default |
| 4 | **ready** | Automatic when all gates pass | None | Remove env vars |
| 5 | **active** | Founder sets `CHINTU_CONNECTOR_MODE=active` + approval phrase | Yes — gated | Set mode to dry-run |
| 6 | **paused** | Founder creates pause file | None | Remove pause file |
| 7 | **revoked** | Founder clears env vars or approval phrase | None | Reconfigure |

### Active Mode Requirements (ALL must be true)

- `CHINTU_CONNECTOR_MODE=active` in environment
- Connector-specific env vars set (token/webhook, target, allowlist)
- `CHINTU_CONNECTOR_APPROVAL_PHRASE` set (minimum 8 characters)
- Recipient matches an entry in the allowlist
- Preview file exists for the message
- Approval phrase provided at send time matches env var
- No global pause file (`CHINTU_OUTBOX/CONNECTORS_GLOBAL_PAUSE`)
- No per-connector pause file (`CHINTU_OUTBOX/CONNECTOR_{name}_PAUSE`)
- Message body passes health-data guard
- Message body passes medical-claims guard
- Connector adapter is `send-capable` (not `architecture-only`)

If **any** gate fails, the send is blocked and the reason is logged to `connector_audit.log.jsonl`.

---

## 3. Connector Targets (Research-Backed)

### 3.1 Telegram Bot API

| Property | Value |
|---|---|
| **Free?** | Yes — unlimited for single-bot personal use |
| **What Chintu can do** | Send text messages to founder's chat/group, send daily bridge reports, send heartbeat alerts |
| **Credentials needed** | Bot token (from @BotFather), chat ID |
| **Env vars** | `CHINTU_TG_BOT_TOKEN`, `CHINTU_TG_CHAT_ID`, `CHINTU_TG_TARGET`, `CHINTU_TG_ALLOWLIST` |
| **Never commit** | Bot token, chat ID |
| **Validation** | Token format: digits, colon, alphanumeric. Chat ID: integer. Allowlist: non-empty CSV |
| **First safe real test** | Send "Chintu connector test — Telegram active" to founder's private chat |
| **Rollback/pause** | Create `CONNECTOR_telegram_PAUSE` or set mode to dry-run |
| **Audit** | All sends logged to `connector_sent.log.jsonl` with timestamp, recipient, HTTP status |
| **BALA data** | Never sent. Health-data regex guard blocks heart rate, HRV, SpO2, sleep, steps, glucose, BP, weight, symptoms |

**Implementation status:** Code exists in `chintu-connector-send.js`. `buildRequest()` is complete. Ready for founder activation.

### 3.2 Discord Webhooks

| Property | Value |
|---|---|
| **Free?** | Yes — webhooks are free, no bot hosting required |
| **What Chintu can do** | Post to a private Discord channel (bridge reports, status updates, alerts) |
| **Credentials needed** | Webhook URL (from channel settings → Integrations → Webhooks) |
| **Env vars** | `CHINTU_DISCORD_WEBHOOK_URL`, `CHINTU_DISCORD_TARGET`, `CHINTU_DISCORD_ALLOWLIST` |
| **Never commit** | Webhook URL |
| **Validation** | URL starts with `https://discord.com/api/webhooks/` or `https://discordapp.com/api/webhooks/`. Non-empty. |
| **First safe real test** | Post "Chintu connector test — Discord active" to founder's private channel |
| **Rollback/pause** | Create `CONNECTOR_discord_PAUSE` or delete webhook in Discord settings |
| **Audit** | Same JSONL audit trail |
| **BALA data** | Never sent by default |

**Implementation status:** Code exists. `buildRequest()` complete. `allowed_mentions: { parse: [] }` prevents @everyone pings.

### 3.3 Slack Incoming Webhooks

| Property | Value |
|---|---|
| **Free?** | Yes — incoming webhooks are free on all Slack plans |
| **What Chintu can do** | Post to a private Slack channel (reports, alerts, status) |
| **Credentials needed** | Webhook URL (from Slack App → Incoming Webhooks) |
| **Env vars** | `CHINTU_SLACK_WEBHOOK_URL`, `CHINTU_SLACK_TARGET`, `CHINTU_SLACK_ALLOWLIST` |
| **Never commit** | Webhook URL |
| **Validation** | URL starts with `https://hooks.slack.com/services/`. Non-empty. |
| **First safe real test** | Post "Chintu connector test — Slack active" to founder's private channel |
| **Rollback/pause** | Create `CONNECTOR_slack_PAUSE` or deactivate webhook in Slack settings |
| **Audit** | Same JSONL audit trail |
| **BALA data** | Never sent by default |

**Implementation status:** Code exists. `buildRequest()` complete.

### 3.4 Gmail API / Draft Architecture

| Property | Value |
|---|---|
| **Free?** | Yes — Gmail API free tier (250 sends/day for personal use) |
| **What Chintu can do** | Create email drafts in founder's Gmail (not auto-send). Founder reviews and clicks Send. Future: auto-send with OAuth2 |
| **Credentials needed** | OAuth2 credentials (Google Cloud Console → API credentials) or app password |
| **Env vars** | `CHINTU_GMAIL_TARGET`, `CHINTU_GMAIL_ALLOWLIST`, `CHINTU_GMAIL_FROM`, `CHINTU_GMAIL_CREDENTIALS_PATH` |
| **Never commit** | OAuth credentials, app password, credentials JSON |
| **Validation** | Email format check. Credentials file exists and is valid JSON. |
| **First safe real test** | Create a draft (not send) with "Chintu connector test — Gmail draft" |
| **Rollback/pause** | Create `CONNECTOR_gmail_PAUSE`. Delete draft manually. |
| **Audit** | Draft creation logged. No send logged until auto-send is enabled. |
| **BALA data** | Never sent by default |

**Implementation status:** Architecture-only. `buildRequest()` returns null. Draft-create adapter is the next implementation step.

### 3.5 GitHub CLI / GitHub API

| Property | Value |
|---|---|
| **Free?** | Yes — `gh` CLI is free, GitHub API is free for personal repos |
| **What Chintu can do** | Create issues, comment on PRs, create releases, post status checks. Chintu can use this for self-reporting. |
| **Credentials needed** | `gh auth login` (interactive, already done on many dev machines) |
| **Env vars** | `CHINTU_GH_REPO` (target repo), `CHINTU_GH_ALLOWLIST` (allowed repos) |
| **Never commit** | GitHub tokens (gh manages these in OS keychain) |
| **Validation** | `gh auth status` returns authenticated. Repo exists and is accessible. |
| **First safe real test** | Create a draft issue: "Chintu connector test — GitHub CLI" |
| **Rollback/pause** | Create `CONNECTOR_github_PAUSE`. Close/delete the test issue. |
| **Audit** | Issue/comment URLs logged |
| **BALA data** | Never sent by default |

**Implementation status:** Not yet wired. `gh` is likely available locally. Adapter needed.

### 3.6 Local Desktop / Outbox / Dashboard

| Property | Value |
|---|---|
| **Free?** | Yes — runs entirely local |
| **What Chintu can do** | Write reports to `CHINTU_OUTBOX/`, update operator console HTML, update heartbeat markdown |
| **Credentials needed** | None |
| **Env vars** | None |
| **Never commit** | Outbox contents (already gitignored) |
| **Validation** | Files written successfully, JSON is valid |
| **First safe real test** | Already working — every heartbeat writes to outbox |
| **Rollback/pause** | N/A — always active |
| **Audit** | File modification timestamps |
| **BALA data** | BALA data lives locally in behavior journal. Not sent externally. |

**Implementation status:** Active. Working.

### 3.7 Claude Code Hooks / Subagents / MCP-Style Local Orchestration

| Property | Value |
|---|---|
| **Free?** | Yes — Claude Code hooks and subagents are built-in |
| **What Chintu can do** | Trigger agent packets, run validation suites, dispatch research agents, coordinate builder/validator flows |
| **Credentials needed** | None beyond Claude Code session |
| **Env vars** | None specific |
| **Never commit** | N/A |
| **Validation** | Packet files exist, agent board reports match |
| **First safe real test** | Already working — agent board dispatches packets |
| **Rollback/pause** | Stop the Claude Code session |
| **Audit** | Agent board report, agent packet logs |
| **BALA data** | BALA UX agent has read access to behavior journal for local UX only |

**Implementation status:** Active. Agent board and packets are working.

### 3.8 Phone Push Notifications (Future)

| Property | Value |
|---|---|
| **Free?** | ntfy.sh: free, self-hostable. Pushover: $5 one-time. Gotify: free, self-hosted. |
| **What Chintu can do** | Push critical alerts (heartbeat failure, approval needed, connector error) to founder's phone |
| **Credentials needed** | ntfy.sh: topic name (no auth for public topics, token for private). Pushover: user key + app token |
| **Env vars** | `CHINTU_PUSH_SERVICE`, `CHINTU_PUSH_TOKEN`, `CHINTU_PUSH_TARGET`, `CHINTU_PUSH_ALLOWLIST` |
| **Never commit** | Tokens, user keys |
| **Validation** | HTTP endpoint reachable, token valid |
| **First safe real test** | Send "Chintu push test" via ntfy.sh to founder's topic |
| **Rollback/pause** | Create `CONNECTOR_push_PAUSE` or unsubscribe from topic |
| **Audit** | Same JSONL audit trail |
| **BALA data** | Never sent by default |

**Implementation status:** Not started. ntfy.sh is the recommended first path (free, no app install needed on Android, simple HTTP POST).

---

## 4. BALA Safety Contract

BALA is a health-awareness companion. It does not diagnose, treat, predict, prevent, replace doctors, or provide emergency monitoring.

### Default Rules for All Connectors

1. **No health data in outgoing payloads by default.** The health-data regex guard in `chintu-connector-send.js` blocks: heart rate, RHR, HRV, SpO2, blood oxygen, sleep, steps, glucose, blood pressure, weight, symptoms, chest pain.
2. **No medical claims in outgoing payloads.** The medical-claims guard blocks: diagnose, treat, predict, prevent, emergency monitoring.
3. **If the founder later wants BALA summaries sent externally**, they must:
   - Create a `BALA_EXTERNAL_SHARE_APPROVED` flag file in `CHINTU_OUTBOX/`
   - Summaries must be generic (no raw metrics, no time-series data)
   - Summaries must include the BALA safety footer
   - Each summary must pass preview → approval → send like any other message
4. **BALA behavior journal never leaves the local machine** unless explicitly approved per above.

---

## 5. Audit Architecture

### Log Files

| File | Purpose | Format |
|---|---|---|
| `CHINTU_OUTBOX/connector_audit.log.jsonl` | All connector events (preview, blocked, sent) | JSONL — one event per line |
| `CHINTU_OUTBOX/connector_sent.log.jsonl` | Successful sends only (HTTP status, recipient, timestamp) | JSONL |
| `CHINTU_OUTBOX/latest_connector_readiness.json` | Current readiness snapshot | JSON |
| `CHINTU_OUTBOX/latest_connector_preview.json` | Most recent preview | JSON |
| `CHINTU_OUTBOX/latest_connector_status.txt` | Human-readable status table | Plain text |

### Audit Record Shape

```json
{
  "timestamp": "ISO 8601",
  "event": "preview_generated | blocked_send | active_send",
  "connector": "telegram | discord | slack | gmail | github | push",
  "connector_mode": "dry-run | active",
  "recipient": "target identifier or null",
  "recipient_allowlisted": true,
  "approval_phrase_present": true,
  "preview_sha256": "hex hash of message body",
  "outcome": "preview | blocked | sent",
  "reason": "human-readable reason or null"
}
```

---

## 6. CLI Interface Design

```
node scripts/chintu-connector-send.js --discover        # list all known connectors and stages
node scripts/chintu-connector-send.js --status           # human-readable status table
node scripts/chintu-connector-send.js --validate-env     # check env vars for all connectors
node scripts/chintu-connector-send.js --check            # write readiness JSON
node scripts/chintu-connector-send.js --preview --connector telegram --body "..."
node scripts/chintu-connector-send.js --send --connector telegram --preview-file ... --approval "..."
```

### Flags

| Flag | Purpose | Network? |
|---|---|---|
| `--discover` | Print all connectors with current stage | No |
| `--status` | Print status table, write to status file | No |
| `--validate-env` | Validate format of all configured env vars | No |
| `--check` | Write full readiness JSON | No |
| `--preview` | Generate preview JSON for a specific message | No |
| `--send` | Attempt gated send (requires active mode + all gates) | Yes (if all gates pass) |

---

## 7. Implementation Priority

| Priority | Connector | First Milestone |
|---|---|---|
| P0 | Local outbox | Already working |
| P0 | Claude Code hooks/agents | Already working |
| P1 | Telegram | First real external send |
| P2 | Discord | Second external send |
| P2 | Slack | Third external send |
| P3 | GitHub CLI | Self-reporting to repo |
| P4 | Gmail (drafts) | Email draft creation |
| P5 | Phone push (ntfy.sh) | Mobile alerts |

---

## 8. What This Plan Does NOT Do

- Does not commit tokens, webhook URLs, or secrets
- Does not call real network during tests
- Does not auto-activate any connector
- Does not send BALA health data externally
- Does not bypass the approval ladder
- Does not push to remote (founder owns push)

## 9. What This Plan DOES Do

- Documents real, free connector paths with real API details
- Defines the seven-stage ladder with clear transitions
- Provides exact env var names and validation rules
- Specifies first safe real test for every connector
- Specifies rollback/pause for every connector
- Provides CLI commands to discover, validate, preview, and send
- Keeps BALA data private by default with an explicit opt-in path
- Logs every connector event for audit
