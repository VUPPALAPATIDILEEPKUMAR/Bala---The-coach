# Chintu Free Connector + Plugin Roadmap

**Stage:** 21
**Status:** active planning — free-first, safe-activation model
**Mode:** local-first. Real connectors allowed behind founder-controlled gates.

---

## Framing

Chintu is not "no connectors." Chintu is **real free connectors with safe activation.**

Every connector in this roadmap is:
- Free or uses a free tier
- Activated only by the founder setting explicit env vars
- Preview-before-send enforced
- Approval-phrase-gated for real sends
- Audit-logged locally
- Pauseable and revocable
- Never activated during tests
- Never carrying BALA health data

Default: **dry-run**. Active send: **founder-controlled**.

---

## Connector Status Summary

| Connector | Free | Status | Secrets Handling | Next Action |
|---|---|---|---|---|
| Telegram Bot API | Yes (free) | Ready path — env-var gated | CHINTU_BOT_TOKEN, CHINTU_CHAT_ID (env only) | Set env vars, test dry-run |
| GitHub CLI | Yes (free) | Planned — GH_TOKEN gated | GH_TOKEN / GITHUB_TOKEN (env only) | Plan Stage 22 packet |
| Local filesystem / outbox | Yes (free) | **Active** — CHINTU_OUTBOX/ is live | No secrets needed | Already working |
| Browser / open command | Yes (free) | Planned — safe local launch only | No secrets | Plan Stage 22 |
| Discord webhook | Yes (free tier) | Parked — not needed yet | CHINTU_DISCORD_WEBHOOK (env only) | Park until needed |
| Slack webhook | Yes (free tier) | Parked — not needed yet | CHINTU_SLACK_WEBHOOK (env only) | Park until needed |
| Gmail (SMTP / OAuth) | Free (Gmail) | Architecture-only — OAuth complexity | OAuth tokens — NOT in repo | Full design before build |
| Phone / watch notifications | Varies | Future — parked | Depends on platform | Long-term roadmap |

---

## Connector 1: Telegram Bot API

**Status:** Ready path — parked pending founder env var setup

**Why first:** Free, simple HTTP API, no OAuth complexity, Chintu already has the safety scaffold built (chintu-connector-send.js, connector gate checks, dry-run adapter).

**Activation requirements:**
1. Create a bot via @BotFather on Telegram → get `CHINTU_BOT_TOKEN`
2. Get your personal chat ID → set as `CHINTU_CHAT_ID`
3. Set both as Windows environment variables (not in any file in the repo)
4. Set `CHINTU_CONNECTOR_MODE=active` when ready for real sends
5. Allowlist recipient IDs in `CHINTU_CONNECTORS_CONFIG.example.json` (copy to local config)
6. Approval phrase must be confirmed before any real send

**Safety gates (all must pass before real send):**
- `CHINTU_BOT_TOKEN` env var present
- `CHINTU_CHAT_ID` in allowlist
- `CHINTU_CONNECTOR_MODE=active` (not dry-run)
- Approval phrase: `"CHINTU_APPROVED"`
- Preview shown before send
- Local audit log entry written

**Secrets handling:**
- `CHINTU_BOT_TOKEN` — Windows env var only. Never in repo. Never printed.
- `CHINTU_CHAT_ID` — Windows env var only.
- `.gitignore` must include any local connector config file containing real values.

**No BALA health data:** Connector payloads must never include health metrics, check-in data, or BALA scores.

**Current status:** `dry-run`. Scripts exist. Env vars not set.

**Runbook:** `CHINTU_REAL_CONNECTOR_TELEGRAM_RUNBOOK.md`

**Next action:** Founder sets `CHINTU_BOT_TOKEN` + `CHINTU_CHAT_ID` as env vars, then runs dry-run test to confirm gate passes.

---

## Connector 2: GitHub CLI

**Status:** Planned — GH_TOKEN gated

**Why next after Telegram:** Free, powerful, already in the founder's workflow. Can automate: creating issues, adding comments, checking PR status, and eventually pushing branches if needed.

**Planned scope (repo-scoped only):**
- Read: repo status, open PRs, issues
- Write: create issues, add labels, post comments
- NOT: admin actions, billing, org-wide access, deleting repos

**Activation requirements (planned):**
1. Install GitHub CLI (`gh`) if not already installed
2. Create a fine-grained personal access token scoped to the single repo
3. Set as `GH_TOKEN` or `GITHUB_TOKEN` Windows env var
4. Allowlist: only the target repo (`Chintu OS + BALA`)
5. Dry-run preview: show what would be posted before posting
6. Approval phrase required for writes

**Secrets handling:**
- `GH_TOKEN` / `GITHUB_TOKEN` — env var only. Never in repo. Never printed.
- Token scope: single repo, minimum permissions needed.

**No BALA health data:** No health data in any GitHub issue, comment, or commit message.

**Current status:** Not implemented. Architecture planned.

**Next action:** Stage 22 — create GitHub connector packet + safe read-only first slice.

---

## Connector 3: Local Filesystem / Outbox

**Status:** Active — CHINTU_OUTBOX/ is the live local write path

**Why active:** No secrets. No network. No approval gate needed for local writes. Founder always controls the machine.

**Capabilities:**
- Write founder messages, daily briefs, agent reports to `CHINTU_OUTBOX/`
- Read files for context injection into prompts
- Write validation reports to `last-validation.txt`, `release-guard-report.md`
- Write agent run artifacts to `CHINTU_AGENT_RUNS/`

**Safety notes:**
- BALA health data must not flow into outbox files used for connector payloads.
- Outbox files committed to git must contain no secrets.
- Generated/runtime files in outbox are excluded from default commit.

**Next action:** Already working. Keep using as the primary safe write path.

---

## Connector 4: Browser / Open Command

**Status:** Planned — safe local launch only

**Scope:** Open local HTML files (CHINTU_OPERATOR_CONSOLE.html, CHINTU_VOICE_OPERATOR.html, BALA index.html) in the default browser using `start` (Windows) or `open` (macOS).

**Safety rules:**
- Only open local file:// paths or trusted localhost URLs.
- Never open external URLs from connector payloads.
- No click automation on external pages.
- No form submission or credential entry.

**Next action:** Add as a utility in the voice operator and operator console ("Open this file" buttons link to local paths). No separate connector needed — already partially implemented.

---

## Connector 5: Discord Webhook

**Status:** Parked — not needed yet

**Activation requirements (when needed):**
1. Create a Discord server or use existing
2. Create a webhook URL in server settings
3. Set as `CHINTU_DISCORD_WEBHOOK` env var
4. Same approval gate + preview + audit log as Telegram
5. Allowlist the webhook channel

**Secrets handling:** `CHINTU_DISCORD_WEBHOOK` — env var only. Never in repo.

**Current status:** Parked. No scripts written yet.

**Next action:** Activate only if Telegram is not sufficient and founder explicitly requests it.

---

## Connector 6: Slack Webhook

**Status:** Parked — not needed yet

**Same pattern as Discord.** Free tier Slack incoming webhooks work without OAuth.

**Activation requirements (when needed):**
1. Create Slack app → Incoming Webhook → get URL
2. Set as `CHINTU_SLACK_WEBHOOK` env var
3. Same approval gate + preview + audit log

**Current status:** Parked.

**Next action:** Activate only if explicitly needed by the founder.

---

## Connector 7: Gmail (SMTP / OAuth)

**Status:** Architecture-only — parked until OAuth is properly handled

**Why parked:** Gmail requires OAuth 2.0 or an App Password. OAuth tokens must be stored securely and refreshed. App Passwords require 2FA. Both require careful secrets management that goes beyond a simple env var.

**Future allowed scope:**
- Send a single daily brief to the founder's own email
- Subject line only (no health data in body by default)
- HTML body allowed only if no BALA data is included

**Not allowed:**
- Sending to third parties without explicit allowlist entry
- Including health data in email body
- Storing OAuth refresh tokens in the repo

**Architecture plan:**
- Use `nodemailer` with OAuth2 or App Password
- Store credentials in Windows Credential Manager or env vars only
- Preview-before-send enforced
- Audit log for every email sent

**Current status:** No code written. Architecture-only.

**Next action:** Design fully before building. Founder must approve scope and secrets strategy.

---

## Connector 8: Phone / Watch Notifications

**Status:** Future — parked

**Options (future research):**
- iOS Shortcuts + local webhook (requires iMac + iPhone setup)
- Pushover API (freemium, simple HTTP)
- Pushbullet (free tier)
- Telegram as a push notification replacement (already planned)

**No BALA health alerts via push.** Push notifications for health data create emergency monitoring expectations. BALA is awareness-only.

**Current status:** Parked. Telegram covers the immediate need.

---

## Universal Safety Gates (All Connectors)

Every connector, regardless of type, must satisfy ALL of these before any real send:

1. **Env var present** — secrets in Windows env vars only, never in repo
2. **Allowlist check** — recipient/endpoint in founder-controlled allowlist
3. **Mode check** — `CHINTU_CONNECTOR_MODE=active` explicitly set
4. **Preview shown** — full message preview displayed before send
5. **Approval phrase** — founder types `CHINTU_APPROVED` to confirm
6. **Audit log** — local entry written with timestamp, connector, recipient
7. **No health data** — payload scanned for BALA health fields (blocked if found)
8. **No secrets printed** — token values never logged or displayed
9. **Pause/revoke path** — founder can unset env var or flip mode to dry-run anytime
10. **No test sends** — all connector tests use dry-run adapter, never real send

---

## Plugin Roadmap (Future)

Plugins extend Chintu's capability beyond connectors.

| Plugin | Status | Notes |
|---|---|---|
| BALA Report Explainer | Architecture planned | See BALA_REPORT_EXPLAINER_ARCHITECTURE.md |
| BALA Language Lock | Architecture planned | See BALA_INDIAN_LANGUAGE_LOCK_PLAN.md |
| Prompt Template Library | Partially built | TASK_TEMPLATES in chintu-prompt-engine.js |
| Agent Board V2 | Planned — Stage 22 | See CHINTU_AGENT_BOARD_V2_PLAN.md |
| Multi-agent coordinator | Future | Stage 23+ |

---

*BALA is a health-awareness companion. It does not diagnose, treat, predict, prevent, replace doctors, or provide emergency monitoring.*
