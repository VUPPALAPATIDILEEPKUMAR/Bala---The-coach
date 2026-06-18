# Chintu Alive Activation Plan

**Date:** 2026-06-18  
**Status:** Architecture — handoff to Codex  
**Model:** Chintu is a real personal operator OS. Real connectors with safe activation. Not fake dry-run forever.

---

## What Already Exists (Repo Snapshot)

| System | File | State |
|---|---|---|
| Connector send engine | `scripts/chintu-connector-send.js` | **FULLY BUILT** — 7-gate safety, real HTTPS, Telegram/Discord/Slack/Gmail |
| Heartbeat | `scripts/chintu-heartbeat.ps1` | Live — still reports connectors as "parked" even when code is ready |
| Operator console | `scripts/chintu-operator-console.ps1` + `.html` | Live — does not show live connector status |
| Action planner | `scripts/chintu-action-planner.ps1` | Live |
| Approval center | `scripts/chintu-approval-audit.ps1` | Live |
| Agent runner | `scripts/chintu-agent-runner.ps1` | Live — creates run folders, executes validation commands |
| Agent packets | `CHINTU_AGENT_PACKETS/*.packet.md` | 5 packets defined (research, builder, validator, bala-ux, connector-safety) |
| Agent runs | `CHINTU_AGENT_RUNS/` | Folder exists, run reports generate |
| BALA daily factors | `app.js` (behavior journal) | Live — localStorage-only |
| BALA doctor summary | `app.js` | Live — .txt download |
| BALA coach | `app.js` | Live — regex Q&A |

**Core finding:** The connector code is done. Telegram is not "parked architecture" — it is a fully implemented send path that needs env vars + one human activation step.

---

## The Activation Gap

```
Current state:
  heartbeat → lists Telegram as "parked"
  connector-send.js → fully capable, dry-run by default

Gap:
  1. Heartbeat and operator console do not read connector STATUS from the send engine
  2. No dedicated Telegram-first-test runbook exists
  3. No run status dashboard aggregates agent run folders
  4. BALA has no weekly reflection from accumulated daily factors
  5. Heartbeat "parked" list hard-codes connectors instead of reading live readiness
```

---

## Three-Lane Architecture

### Lane A — Real Connector Activation (Telegram First)

The send engine already implements the full 7-gate safety flow:

```
Gate 1: CHINTU_CONNECTOR_MODE=active (env var, off by default)
Gate 2: Connector pause file absent (CONNECTOR_telegram_PAUSE or CONNECTORS_GLOBAL_PAUSE)
Gate 3: All required env vars set (TG_BOT_TOKEN, TG_CHAT_ID, TG_TARGET, TG_ALLOWLIST)
Gate 4: Recipient in allowlist (CSV env var)
Gate 5: Approval phrase matches (CHINTU_CONNECTOR_APPROVAL_PHRASE)
Gate 6: Connector adapter mode = send-capable (not architecture-only)
Gate 7: Preview file exists and connector matches
```

**What is needed now:**
- Human: BotFather setup + env var provisioning (see runbook)
- Code: Heartbeat reads `chintu-connector-send.js --status` output and surfaces connector stage in JSON
- Code: Operator console shows connector status row (configured / ready / active / paused)
- Code: Pause/revoke surface in operator console
- Tests: Prove no accidental send in any test path; prove send is possible only with full env vars + explicit approval

**Connector ladder (current reality):**

| Connector | Adapter | Code state | Activation gap |
|---|---|---|---|
| Telegram | send-capable | **Ready** — needs env vars | BotFather setup + 4 env vars |
| Discord | send-capable | **Ready** — needs env vars | Create webhook + 3 env vars |
| Slack | send-capable | **Ready** — needs env vars | Create incoming webhook + 3 env vars |
| Gmail | architecture-only | Documented, no send path wired | Needs OAuth or SMTP wiring |

---

### Lane B — Agent Runner / Agent Board Power

**Current agent runner capability:**
- Creates timestamped run folder under `CHINTU_AGENT_RUNS/`
- Copies packet into run folder
- Parses `## Validation Commands` section
- Runs each command, captures exit code + output
- Writes `run-report.md` + `run-summary.json`

**What is missing:**
- No run status dashboard aggregating all run folders
- No packet structure validator (what makes a packet valid?)
- No parallel run support (founder running multiple agents manually at once)
- Agent board (`chintu-agent-board.ps1`) does not link to actual run folders
- No "latest run" concept — each run is timestamped but there is no `CHINTU_AGENT_RUNS/LATEST/` symlink or summary

**Next implementation targets:**
1. `scripts/chintu-agent-run-status.ps1` — scans all run folders, outputs status table to `CHINTU_AGENT_RUNS/RUN_STATUS.md`
2. Packet structure validator: every packet must have Mission, Files To Inspect, Validation Commands, Stop Condition
3. `CHINTU_AGENT_RUNS/LATEST_{agent}.json` — symlink concept (actually a JSON pointer file) to most recent run
4. Agent board dashboard updated to show run status per agent

---

### Lane C — BALA Coach Product Intelligence

**Current BALA state:**
- Daily Factors saved in localStorage (behavior journal — Stage 17)
- Factors: alcohol, caffeine, late meal, stress, soreness, travel, low movement, exercise, hydration + optional note
- Coach is regex Q&A only
- Doctor-ready summary is raw check-in export

**Next safe product layer:**
1. **Weekly Reflection** — show 7-day factor history grouped by factor type. No scoring, no medical framing. "Here is what you noted this week."
2. **Today's Guide enhancement** — current rule-based guide can safely reference "you noted high stress yesterday" as context
3. **Factor history** — factor entries visible alongside timeline check-ins
4. **Doctor-ready factor summary** — append factor history to the .txt download (user-entered data only, clearly labeled "daily notes I entered")
5. **Coach grounding** — coach answers can reference recent factor entries ("you mentioned stress recently — here are some awareness tips")

**Apple Watch / Apple Health:** BALA already has Apple Health ZIP/XML import (file-based, no live sync). Future movement awareness should reference this existing import path, not imply live wearable connection.

**Safety invariants (all BALA work):**
- No diagnose, treat, predict, prevent, replace doctors, emergency monitoring
- No cardiac/heart-attack language
- Daily factors are user-entered self-reports, not biometric readings
- "Listen to your body" — not "we detected an issue"
- Doctor-ready summary contains no scores, no interpretations

---

## Heartbeat + Console Integration (Cross-Lane)

The heartbeat's "parked" list is hard-coded. It should instead call the connector status function and report real stage per connector.

**Target heartbeat connector block:**
```json
"connectors": {
  "telegram": { "stage": "configured", "can_send_now": false, "paused": false },
  "discord":  { "stage": "discovered", "can_send_now": false, "paused": false },
  "slack":    { "stage": "discovered", "can_send_now": false, "paused": false },
  "gmail":    { "stage": "architecture-only", "can_send_now": false, "paused": false }
}
```

Stages: `unavailable` → `configured` → `ready` → `active` → `paused` → `revoked`

The operator console adds a Connector Status section with one row per connector showing stage, last-preview timestamp, and pause toggle reminder.

---

## Safety Invariants (All Lanes)

- No secrets in repo. No secrets in any generated file.
- No health data in any outgoing connector payload.
- No real send without `CHINTU_CONNECTOR_MODE=active` + explicit `--approval` phrase.
- No push from any agent or automation. Founder owns push.
- BALA safety footer on all generated outputs.
- `chintu-no-network-egress.test.js` must stay green at all times.
- `chintu-medical-claims.test.js` must stay green at all times.

---

## Commit Strategy for This Plan

This doc (and the four companion docs) are architecture only. They commit as:
```
docs: define Chintu alive activation layer
```
No push. Founder reviews and decides which slice to hand to Codex first.

---

*BALA is a health-awareness companion. It does not diagnose, treat, predict, prevent, replace doctors, or provide emergency monitoring.*
