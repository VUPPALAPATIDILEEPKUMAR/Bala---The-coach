# Chintu Intelligence Core

**Stage:** 20
**Status:** planning — active implementation slice
**Mode:** local-first agent operating system — real connector-capable, safe activation

---

## What Chintu Is

Chintu is a local-first intelligent operator OS built for one founder.
It is not a cloud SaaS, not a generic AI assistant, and not a toy script runner.

Chintu is becoming a real coworker-style system:
- Plans and executes multi-agent tasks locally
- Generates structured, copy-paste-ready prompts
- Runs validation and produces audit-grade reports
- Routes tasks to specialist agents
- Surfaces connector readiness and activation status
- Speaks in the founder's tone: warm, direct, practical, ambitious

Chintu uses real free connectors behind founder-controlled gates.
Default is dry-run. Active send requires env vars + allowlist + approval phrase + preview.

---

## Intelligence Stack

### Layer 1 — Heartbeat + Operator Console
- Daily health check of all systems
- Connector readiness per gate
- Next human action surfaced clearly
- Local-only HTML + JSON output

### Layer 2 — Agent Board + Specialist Agents
- Validator Agent
- Builder Agent
- Research Agent
- BALA UX Agent
- Connector Safety Agent
- Prompt Engineer Agent ← Stage 20
- Product Strategist Agent ← planned
- Release Manager Agent ← planned

### Layer 3 — Action Planner + Approval Queue
- Prioritized action queue
- Approval cards for gated actions
- Audit log for every approved/blocked action

### Layer 4 — Connector Gateway
- Telegram (first activation target, send-capable)
- Discord / Slack (send-capable scaffold)
- Gmail (architecture-only)
- GitHub CLI / local filesystem (planned)
- Preview-before-send enforced
- Allowlist + approval phrase required for active sends

### Layer 5 — Prompt Engine (Stage 20)
- XML, COSTAR, ACR prompt skeleton generation
- Track-aware: chintu | bala | both
- Task-aware: writes safety reminders and output format per track
- Local-only, no network, no secrets
- See: CHINTU_PROMPT_ENGINE_PLAN.md + scripts/chintu-prompt-engine.js

### Layer 6 — Tone + Persona (Stage 20)
- Founder tone profile: warm, bro-style, direct, ambitious, smart
- Applied in founder messages, prompts, and briefings
- See: CHINTU_TONE_PROFILE.md

---

## Core Principles

1. **Local-first.** Nothing leaves the machine unless the founder explicitly activates a connector.
2. **Approval-gated.** Every external action requires env vars + allowlist + approval phrase + preview.
3. **Dry-run default.** No real send ever happens by accident.
4. **Audit-logged.** Every blocked and sent action is recorded locally.
5. **No secrets in repo.** Secrets live in shell env vars only.
6. **No health data externally.** BALA data never flows through connectors by default.
7. **No overbuild.** Add real capability when it is safe and needed, not as speculation.

---

## Stage 20 Implementation Slice

| Item | Status |
|---|---|
| CHINTU_INTELLIGENCE_CORE.md | Done — this file |
| CHINTU_TONE_PROFILE.md | Done |
| CHINTU_PROMPT_ENGINE_PLAN.md | Done |
| CHINTU_AGENT_BOARD_V2_PLAN.md | Done |
| scripts/chintu-prompt-engine.js | Done |
| scripts/chintu-prompt-engine.test.js | Done |
| BALA alcohol standard drink calculator | Done |
| BALA_CYCLE_REFLECTION_PRIVACY_PLAN.md | Done |
| BALA_REPORT_EXPLAINER_SAFETY_PLAN.md | Done |
| BALA_INDIAN_LANGUAGE_LOCK_PLAN.md | Done |
| BALA_WEARABLE_MARKET_RESEARCH_NOTES.md | Done |

---

## What Remains Parked

- Live Telegram send (requires founder env var setup)
- GitHub connector
- Voice calling / voice cloning
- Cloud sync
- Paid APIs
- External analytics
- Women's cycle module (future, privacy-first)
- Health report explainer module (future, safe)
- Indian language lock (future)
- BALA notification push (future)

---

*BALA is a health-awareness companion. It does not diagnose, treat, predict, prevent, replace doctors, or provide emergency monitoring.*
