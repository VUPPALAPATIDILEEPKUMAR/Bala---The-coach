# Chintu Stage 33 — Skills + Connector Runtime Task Plan

> Stage name: Stage 33 — Chintu Skills + Connector Runtime
> Created: 2026-06-19
> Goal: Turn Chintu from "commands scattered across runner/bridge/router" into a safe,
>       capability-based runtime where every action is registered, risk-labelled, and
>       auditable — before it ever executes.

---

## Why Stage 33

Stage 32 proved the raw plumbing:
- Telegram poll-once → intent → bridge → local execution
- Health-sensitive blocking
- Dry-run by default

Stage 33 makes the plumbing permanent and composable:
- Every capability is declared, not improvised
- Every execution path has a risk label
- Every action produces a structured trace
- Skills group related capabilities into safe bundles
- An approval queue holds dangerous actions until the founder says go

---

## Architecture Layers (Stage 33)

```
[Inbound Command]
     |
     v
[Capability Registry]   — what Chintu knows it can do, what it cannot
     |
     v
[Skill Router]          — maps command intent to the right skill
     |
     v
[Risk Gate]             — safe_read / dry_run / blocked / requires_approval
     |
     v
[Action Trace]          — every execution step stamped with full context
     |
     v
[Approval Queue]        — dangerous/irreversible actions wait here
     |
     v
[Execution Layer]       — only safe_read and approved actions cross here
     |
     v
[Audit Log]             — CHINTU_OUTBOX JSONL, gitignored, never secrets
```

---

## Task Cards

---

### Task 1 — Capability Registry

**File:** `scripts/chintu-capability-registry.js`
**Status:** ✅ Created (Stage 33)

Creates a declarative registry of every capability Chintu has. Each entry declares:
- `id` — unique slug
- `description` — what it does
- `riskLevel` — `safe_read` | `dry_run` | `requires_approval` | `blocked`
- `dryRunSupported` — boolean
- `executionAllowed` — boolean
- `requiresApproval` — boolean
- `localOnly` — boolean
- `testFile` — path to test

Capabilities registered in Stage 33:
- `chintu.status` — safe_read
- `chintu.repoSummary` — safe_read
- `chintu.checkEverything` — dry_run
- `chintu.githubStatusDryRun` — dry_run
- `bala.localHealthSummaryReadOnly` — safe_read
- `bala.doctorSummaryPreview` — safe_read
- `telegram.discoverIds` — safe_read
- `telegram.tokenCheck` — safe_read
- `connector.runtimeMap` — safe_read

Not-yet-executable (blocked until Stage 34+):
- `chintu.gitPush` — requires_approval
- `chintu.sendTelegram` — requires_approval
- `connector.webhook` — blocked

---

### Task 2 — Skill Map

**File:** `CHINTU_SKILLS_MAP.md`
**Status:** ✅ Created (Stage 33)

Skills group capabilities. Each skill declares what it can and cannot do.

Skills defined:
1. **Chintu Core Skill** — status, repo summary, check everything
2. **Telegram Connector Skill** — discover IDs, token check, poll-once dry-run
3. **GitHub Dry-Run Skill** — repo status, branch info, no push
4. **BALA Health-Awareness Skill** — local health summary, doctor summary preview
5. **Release Guard Skill** — validate before commit, never git add -A
6. **Safety Reviewer Skill** — medical claim scan, no-network egress check

---

### Task 3 — Action Trace Contract

**File:** `CHINTU_ACTION_TRACE_CONTRACT.md`
**Status:** ✅ Created (Stage 33)

Every runtime action must return this shape:
```json
{
  "actionId": "uuid-or-slug",
  "source": "telegram | bridge | cli",
  "userText": "check everything",
  "intent": "check_everything",
  "risk": "safe_read | dry_run | health_sensitive | requires_approval | blocked",
  "allowed": true,
  "dryRun": true,
  "executed": false,
  "endpoint": "/api/chat | /api/sequence | null",
  "resultSummary": "...",
  "blockedReason": null,
  "safetyNotes": [],
  "auditPath": "CHINTU_OUTBOX/telegram_connector_audit.jsonl"
}
```

---

### Task 4 — Approval Queue Design

**File:** `CHINTU_APPROVAL_QUEUE_DESIGN.md`
**Status:** ✅ Created (Stage 33, documentation-only)

Design (not yet implemented):
- Pending action stored in `CHINTU_OUTBOX/pending_approvals.jsonl`
- Each entry has: actionId, preview, riskLabel, requestedAt, approvedAt, rejectedAt
- Founder approves by running: `node scripts/chintu-approve.js <actionId>`
- Auto-reject on timeout (configurable, default: never auto-approve)
- No external send unless explicitly approved
- No auto-write to repo unless founder types exact approval phrase

---

### Task 5 — Free Tools / Hooks (Stage 33 inventory)

See `CHINTU_SKILLS_MAP.md` section "Allowed Free Tools".

Confirmed safe and documented:
- Telegram Bot API poll-once (no webhook, no send)
- GitHub CLI read-only (`gh repo view`, `gh status`)
- local Node scripts
- local PowerShell release guards
- local JSONL audit logs (gitignored)
- browser SpeechRecognition/SpeechSynthesis (BALA UX only)
- Windows Task Scheduler (optional, local scheduled checks)
- Git hooks (local validation only, no push)

NOT allowed without founder approval:
- Paid APIs
- Hosted automation
- Cloud health data storage
- Background daemon polling
- Automatic Telegram send
- Webhook activation

---

### Task 6 — BALA Connection Boundary

See `CHINTU_SKILLS_MAP.md` section "BALA Health-Awareness Skill".

**Chintu CAN help BALA:**
- Read local BALA repo status (git, tests)
- Run BALA tests (`node scripts/chintu-medical-claims.test.js` etc.)
- Summarize app state for the founder
- Generate doctor-ready summary preview from demo/local data
- Review safety copy for medical claim language
- Detect unsafe language patterns
- Prepare BALA release notes
- Suggest UX improvements

**Chintu CANNOT do for BALA:**
- Diagnose any user
- Interpret live health data as medical advice
- Send health data externally
- Perform emergency monitoring
- Make prediction or prevention claims
- Send automatic doctor messages
- Upload private health data anywhere

---

### Task 7 — Tests

**File:** `scripts/chintu-capability-registry.test.js`
**Status:** ✅ Created (Stage 33)

Tests cover:
- Registry has expected capabilities
- Every capability has required fields
- No capability with `blocked` riskLevel has `executionAllowed: true`
- No capability with `requires_approval` auto-executes
- Health-sensitive capabilities are blocked
- `localOnly: true` on all non-diagnostic capabilities
- Registry shape is stable (no missing fields)

---

## Stage 33 Sequence

1. ✅ Capability registry declared (`chintu-capability-registry.js`)
2. ✅ Skills map documented (`CHINTU_SKILLS_MAP.md`)
3. ✅ Action trace contract defined (`CHINTU_ACTION_TRACE_CONTRACT.md`)
4. ✅ Approval queue designed (`CHINTU_APPROVAL_QUEUE_DESIGN.md`)
5. ✅ Free tools/hooks inventoried
6. ✅ BALA boundary documented
7. ✅ Registry tests written and passing

## What is NOT in Stage 33

- No actual approval UI
- No real approval queue file writes (design-only)
- No new Telegram sends
- No new paid APIs
- No webhook
- No breaking changes to Stage 32 runtime

## Next Stage: Stage 34

Stage 34 will wire the capability registry into the brain router so every dispatch
goes through the registry risk gate before hitting the bridge. The approval queue
will become real for `requires_approval` actions.
