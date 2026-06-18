# Chintu Real Connector Architecture

**Stage:** 18 planning  
**Purpose:** Define how Chintu becomes a connector-capable agent OS while keeping secrets safe, approvals mandatory, and health data protected.  
**Principle:** Chintu is not local-only forever. Chintu is connector-capable, free-tool-first, env-var-secrets-only, allowlisted, approval-gated, auditable, and reversible.

---

## 1. Chintu Core Loop

The core loop runs locally and produces all state before any connector touches it:

```
heartbeat → operator console → action planner → approval center → approval audit
         → agent board → agent packets → connector send foundation
```

| Component | Script | Output |
|---|---|---|
| Heartbeat | `scripts/chintu-heartbeat.ps1` | `CHINTU_HEARTBEAT.md`, `CHINTU_OUTBOX/latest_heartbeat.json` |
| Operator Console | `scripts/chintu-operator-console.ps1` | `CHINTU_OPERATOR_CONSOLE.html` |
| Action Planner | `scripts/chintu-action-planner.ps1` | `CHINTU_ACTION_QUEUE.md`, planner JSON |
| Approval Center | `scripts/chintu-approval-center.ps1` | `CHINTU_APPROVAL_CENTER.md`, approval cards |
| Approval Audit | `scripts/chintu-approval-audit.ps1` | `CHINTU_APPROVAL_AUDIT.md`, audit JSON |
| Agent Board | `scripts/chintu-agent-board.ps1` | `chintu-agent-board-report.md` |
| Agent Packets | `CHINTU_AGENT_PACKETS/*.packet.md` | Planning prompts for specialist agents |
| Connector Send | `scripts/chintu-connector-send.js` | Readiness JSON, preview JSON, audit JSONL, sent JSONL |

### Core Loop Invariants

- Every outgoing message must pass through preview → approval → send.
- No connector activates without `CHINTU_CONNECTOR_MODE=active` in the environment.
- Default mode is always `dry-run`.
- Health data is blocked from all outgoing connector payloads by default.
- Secrets live in environment variables only, never committed to the repo.
- The founder owns push. Agents stop before push.

---

## 2. Real Connector Ladder

Every connector progresses through these stages:

| Stage | Meaning | Who triggers | Reversible |
|---|---|---|---|
| **unavailable** | No code path exists for this connector | Builder agent | N/A |
| **configured** | Env vars are set, code exists, but mode is dry-run | Founder sets env vars | Yes — unset env vars |
| **dry-run** | Preview files are generated, no network call made | Default behavior | Always |
| **ready** | All gates pass (env vars, allowlist, approval phrase configured) but mode is still dry-run | Automatic when config is complete | Yes — remove env vars |
| **active** | `CHINTU_CONNECTOR_MODE=active` and founder provides approval phrase; real sends happen | Founder sets env var + provides phrase | Yes — set mode back to dry-run |
| **paused** | Pause file present; blocks all sends even if mode is active | Founder creates pause file | Yes — remove pause file |
| **revoked** | Env vars removed or approval phrase cleared; connector falls back to unavailable/configured | Founder clears env vars | Yes — reconfigure |

### Stage Transitions

```
unavailable → configured    (founder sets env vars)
configured  → dry-run       (default, automatic)
dry-run     → ready         (all gates pass, automatic check)
ready       → active        (founder sets CHINTU_CONNECTOR_MODE=active)
active      → paused        (founder creates CONNECTOR_{name}_PAUSE or CONNECTORS_GLOBAL_PAUSE)
active      → revoked       (founder clears env vars or approval phrase)
paused      → active        (founder removes pause file)
revoked     → configured    (founder reconfigures env vars)
any         → dry-run       (founder sets CHINTU_CONNECTOR_MODE=dry-run or unsets it)
```

---

## 3. Telegram Path

**API:** Telegram Bot API (free, no rate-limit issues for single-bot usage)  
**Cost:** Free  
**Auth:** Bot token from `@BotFather`

### Environment Variables

| Variable | Purpose |
|---|---|
| `CHINTU_TG_BOT_TOKEN` | Bot API token (from @BotFather) |
| `CHINTU_TG_CHAT_ID` | Target chat/group ID |
| `CHINTU_TG_TARGET` | Human-readable target label |
| `CHINTU_TG_ALLOWLIST` | CSV of allowed target labels |
| `CHINTU_CONNECTOR_MODE` | `dry-run` (default) or `active` |
| `CHINTU_CONNECTOR_APPROVAL_PHRASE` | Exact phrase founder must provide to approve send |

### Send Flow

1. Agent or script generates message body.
2. `chintu-connector-send.js --preview --connector telegram --body "..."` writes preview JSON.
3. Founder reviews preview JSON in operator console or file.
4. Founder runs `chintu-connector-send.js --send --connector telegram --preview-file <path> --approval "<phrase>"`.
5. Script checks all gates: env vars present, recipient in allowlist, mode is active, approval phrase matches, no pause file, no health data in body.
6. If all gates pass, HTTPS POST to `api.telegram.org/bot{token}/sendMessage`.
7. Response logged to `connector_sent.log.jsonl`.
8. Audit entry logged to `connector_audit.log.jsonl`.
9. If any gate fails, send is blocked and reason is logged to audit.

### Telegram Safety

- Bot token never committed — env var only.
- Chat ID never committed — env var only.
- Dry-run by default: preview file is generated but no network call made.
- Health data patterns are scanned and blocked before preview generation.
- Medical claims language is scanned and blocked.
- BALA safety footer appended to context but not sent as message content.

---

## 4. Discord Path

**API:** Discord Webhook (free, no bot required)  
**Cost:** Free  
**Auth:** Webhook URL contains the auth token

### Environment Variables

| Variable | Purpose |
|---|---|
| `CHINTU_DISCORD_WEBHOOK_URL` | Full webhook URL |
| `CHINTU_DISCORD_TARGET` | Human-readable channel/server label |
| `CHINTU_DISCORD_ALLOWLIST` | CSV of allowed target labels |
| `CHINTU_CONNECTOR_MODE` | `dry-run` (default) or `active` |
| `CHINTU_CONNECTOR_APPROVAL_PHRASE` | Exact approval phrase |

### Send Flow

Same gated flow as Telegram. POST to webhook URL with `{ content: body, allowed_mentions: { parse: [] } }`.  
`allowed_mentions` is locked to empty to prevent @everyone/@here pings.

### Discord Safety

- Webhook URL never committed — env var only.
- Same health data and medical claims guards as Telegram.
- `allowed_mentions` hardcoded to `{ parse: [] }` — no mass pings possible.

---

## 5. Slack Path

**API:** Slack Incoming Webhooks (free where workspace allows)  
**Cost:** Free  
**Auth:** Webhook URL contains the auth token

### Environment Variables

| Variable | Purpose |
|---|---|
| `CHINTU_SLACK_WEBHOOK_URL` | Full incoming webhook URL |
| `CHINTU_SLACK_TARGET` | Human-readable workspace/channel label |
| `CHINTU_SLACK_ALLOWLIST` | CSV of allowed target labels |
| `CHINTU_CONNECTOR_MODE` | `dry-run` (default) or `active` |
| `CHINTU_CONNECTOR_APPROVAL_PHRASE` | Exact approval phrase |

### Send Flow

Same gated flow. POST to webhook URL with `{ text: body }`.

### Slack Safety

- Webhook URL never committed — env var only.
- Same health data and medical claims guards.
- Workspace must have incoming webhooks enabled (admin setting).

---

## 6. Gmail Path

**API:** Gmail API (requires OAuth2 or application-specific password)  
**Cost:** Free (Google account required)  
**Auth:** OAuth2 local flow or app-specific password  
**Stage:** Architecture-only (heavier than webhook connectors)

### Phase 1: Draft Architecture

- Script generates a draft email body locally.
- Draft is written to `CHINTU_OUTBOX/latest_gmail_draft.json`.
- No network call. Founder reviews draft.
- Future: use Gmail API `users.messages.insert` with `labelIds: ["DRAFT"]` to create a real draft in Gmail that the founder can review and send manually.

### Phase 2: Send Architecture (future)

- Requires OAuth2 token stored in local credential file (never committed).
- `.gitignore` must include credential paths.
- Send flow follows same gated pattern: preview → approval → send.
- Founder must explicitly set up OAuth2 flow locally.

### Gmail Environment Variables

| Variable | Purpose |
|---|---|
| `CHINTU_GMAIL_TARGET` | Target email address |
| `CHINTU_GMAIL_ALLOWLIST` | CSV of allowed email addresses |
| `CHINTU_GMAIL_FROM` | Sender address |
| `CHINTU_GMAIL_CREDENTIALS_PATH` | Path to local OAuth2 credentials (never committed) |

### Gmail Safety

- Credentials never committed — `.gitignore` enforced.
- No health data in email body by default.
- Draft-first architecture: founder always sees what will be sent before it goes.
- `buildRequest()` returns `null` in current stage — no accidental sends.

---

## 7. Local Desktop / Outbox / Dashboard

**Always available.** No env vars needed. No network. No secrets.

| Output | Path |
|---|---|
| Founder message | `CHINTU_OUTBOX/latest_founder_message.md` |
| Heartbeat JSON | `CHINTU_OUTBOX/latest_heartbeat.json` |
| Connector readiness | `CHINTU_OUTBOX/latest_connector_readiness.json` |
| Connector preview | `CHINTU_OUTBOX/latest_connector_preview.json` |
| Connector audit log | `CHINTU_OUTBOX/connector_audit.log.jsonl` |
| Connector sent log | `CHINTU_OUTBOX/connector_sent.log.jsonl` |
| Operator console | `CHINTU_OPERATOR_CONSOLE.html` |
| Control room index | `CHINTU_CONTROL_ROOM_INDEX.html` |

---

## 8. Future: Phone Notifications

Only if safe, free, and practical. Candidates:

- **Telegram** already covers phone via Telegram mobile app.
- **ntfy.sh** — free, open-source push notification service. Could be added as a connector with same gated pattern.
- **Pushover** — low-cost push notification API. Same gated pattern.

Not designed yet. Will be added as a connector when a practical free path is validated.

---

## 9. BALA Safety Layer

BALA is a health-awareness companion. It does not:

- Diagnose
- Treat
- Predict
- Prevent
- Replace doctors
- Provide emergency monitoring
- Predict heart attacks or cardiac arrest
- Transfer health data externally by default

### BALA Connector Rules

- Health data patterns (`heart rate`, `rhr`, `hrv`, `spo2`, `blood oxygen`, `sleep`, `steps`, `glucose`, `blood pressure`, `weight`, `symptom`, `chest pain`) are blocked from all outgoing connector payloads.
- Medical claims language (`diagnose`, `treat`, `predict`, `prevent`, `emergency monitoring`) is blocked from all outgoing connector payloads.
- BALA Behavior Journal stays local-only.
- BALA daily factors stay local-only.
- No BALA data is sent through any connector unless the founder explicitly creates a new, reviewed data-export path with its own approval gate.

---

## 10. Security Model Summary

| Threat | Mitigation |
|---|---|
| Secrets in repo | Env vars only; `.gitignore` blocks credential files |
| Accidental send | Dry-run default; preview required; approval phrase required |
| Health data leak | Pattern-based blocklist on all outgoing payloads |
| Mass ping / spam | Discord `allowed_mentions` locked; all connectors allowlisted |
| Unauthorized connector | Pause files; revoke by clearing env vars |
| Audit gap | Every send attempt (success or blocked) logged to JSONL |
| Irreversible action | All connector states are reversible; pause/revoke always available |
