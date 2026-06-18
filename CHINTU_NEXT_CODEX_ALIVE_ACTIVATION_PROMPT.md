# Chintu Next Codex Prompt — Alive Activation

**Date:** 2026-06-18  
**Purpose:** Implementation-ready handoff to Codex for the first real activation slice  
**Scope:** Two sub-slices in one session — Chintu connector live-readiness + BALA weekly reflection  
**Do not push. Founder reviews and pushes.**

---

## Context You Must Read First

Before writing any code, read these files in this order:

1. `CHINTU_ALIVE_ACTIVATION_PLAN.md` — master architecture
2. `CHINTU_REAL_CONNECTOR_TELEGRAM_RUNBOOK.md` — what the human activation steps are
3. `CHINTU_AGENT_RUNNER_NEXT_LAYER.md` — agent runner improvements
4. `BALA_NEXT_PRODUCT_INTELLIGENCE_PLAN.md` — BALA safe next layer
5. `scripts/chintu-connector-send.js` — the existing connector engine (DO NOT MODIFY)
6. `scripts/chintu-heartbeat.ps1` — the existing heartbeat (you will modify this)
7. `scripts/chintu-agent-runner.ps1` — the existing runner (you will extend this)
8. `CHINTU_MEMORY_VAULT/BALA_MEDICAL_SAFETY_RULES.md` — medical safety rules (non-negotiable)
9. `app.js` — BALA app (you will add weekly reflection)

---

## Absolute Rules (Non-Negotiable)

1. **No secrets committed.** Zero. Not in code, not in comments, not in strings.
2. **No network calls in any new script** (except `chintu-connector-send.js` which is already allowlisted).
3. **No health data in any connector payload.** The existing health data guard in `chintu-connector-send.js` must not be weakened.
4. **No push.** Commit locally. Founder pushes.
5. **No real Telegram send.** The connector engine stays in dry-run by default. Do not change the default mode.
6. **No medical claims.** Every user-facing BALA string must pass the medical claims test.
7. **No sw.js edit** unless a BALA UI change strictly requires a cache version bump (and then only bump the version number).
8. **Run all 4 validation scripts before committing.** They must all pass.
9. **No fake claims that agents ran.** If a script runs a command, show actual output or "not executed (dry run)."

---

## Sub-Slice 1: Chintu Connector Live-Readiness

### Goal
Make Chintu's heartbeat and operator console surface real connector stage (configured/ready/active/paused) instead of always reporting connectors as "parked."

### Task 1A: Heartbeat Connector Status

**File to modify:** `scripts/chintu-heartbeat.ps1`

**What to change:**

The heartbeat currently has a hard-coded `parked` array. Replace it with a real connector status block that calls `node scripts\chintu-connector-send.js --status` and parses the output.

**Exact behavior:**
1. Run `node scripts\chintu-connector-send.js --status` and capture output
2. Parse each connector line — extract name, adapter mode, `can_send_now` value
3. Determine stage per connector:
   - If env vars are all set AND `can_send_now: true` → `active`
   - If env vars are all set AND mode is dry-run → `ready`
   - If some env vars are set → `configured`
   - If no env vars → `discovered`
   - If pause file exists → `paused`
4. Output this in the heartbeat JSON as a `connectors` object (replace the `parked` array)
5. Keep the `parked` label only for Gmail (architecture-only adapter)

**New heartbeat JSON shape:**
```json
"connectors": {
  "telegram": { "stage": "configured", "can_send_now": false, "paused": false },
  "discord":  { "stage": "discovered", "can_send_now": false, "paused": false },
  "slack":    { "stage": "discovered", "can_send_now": false, "paused": false },
  "gmail":    { "stage": "architecture-only", "can_send_now": false, "paused": false }
}
```

**Safety:** The heartbeat must NOT print env var values. It only prints stages and boolean flags.

### Task 1B: Operator Console Connector Row

**File to modify:** `scripts/chintu-operator-console.ps1`

**What to add:** A Connector Status section in the operator console HTML and JSON output.

Each connector gets one row showing:
- Name
- Stage (configured / ready / active / paused / discovered / architecture-only)
- `can_send_now` boolean
- Pause status
- Last preview timestamp (read from `CHINTU_OUTBOX/latest_connector_preview.json` if present)

**Copy for the operator console:**
- `[ACTIVE]` — connector is live
- `[READY]` — all gates pass, mode is dry-run
- `[CONFIGURED]` — env vars set, not all gates pass
- `[DISCOVERED]` — code exists, no env vars
- `[PAUSED]` — pause file present
- `[ARCH-ONLY]` — no send path (Gmail)

**Pause reminder line:** Add one line below the connector table: "To pause all connectors: create CHINTU_OUTBOX/CONNECTORS_GLOBAL_PAUSE"

### Task 1C: Pause/Revoke Status in Heartbeat

**Add to `scripts/chintu-heartbeat.ps1`:**

Check for global pause file and per-connector pause files. Report in heartbeat JSON:
```json
"connector_pause_status": {
  "global_pause": false,
  "telegram_paused": false,
  "discord_paused": false,
  "slack_paused": false
}
```

### Task 1D: Tests Proving Safe Behavior

**File to create:** `scripts/chintu-connector-activation.test.js`

This test must prove:
1. Default connector mode is `dry-run` (not `active`)
2. With no env vars set, `can_send_now` is `false` for all connectors
3. With `CHINTU_CONNECTOR_MODE=dry-run` and all env vars set, `can_send_now` is still `false`
4. A preview file can be created without any network call
5. A send attempt with mode=dry-run returns `{ status: 'blocked', reason: '...' }` without making any HTTP request
6. A global pause file blocks send even if mode would otherwise be active
7. A payload containing health data keywords is blocked by the health data guard

**How to test #5 without a real send:** Mock the `attemptSend` function with dry-run mode env var set. Assert return value is blocked. Assert no HTTP request was made (track via spy or by checking that `dispatchRequest` was never reached).

**This test must be added to the no-network-egress allowlist** because it imports `chintu-connector-send.js` which contains the `require('node:https')` pattern. Add `chintu-connector-activation.test.js` to `scannerAllowlist` in `chintu-no-network-egress.test.js`.

---

## Sub-Slice 2: BALA Weekly Reflection

### Goal
Add a Weekly Reflection view to the BALA app that shows the last 7 days of daily factor entries, grouped by factor type. Reads existing localStorage data. No new data model.

**File to modify:** `app.js`

### Task 2A: Weekly Reflection Data Function

Add a function `getWeeklyFactorSummary()`:
- Reads `BALA_BEHAVIOR_JOURNAL` from localStorage
- Filters entries from the last 7 calendar days
- Groups by factor type: count per factor, dates noted, notes array
- Returns a safe summary object (no scoring, no weighting, no AI)

**Output shape:**
```javascript
{
  weekStart: '2026-06-12',
  weekEnd: '2026-06-18',
  entryCount: 5,
  factors: {
    stress:     { count: 3, dates: ['2026-06-16', '2026-06-17', '2026-06-18'], notes: ['...'] },
    caffeine:   { count: 4, dates: [...], notes: [] },
    exercise:   { count: 2, dates: [...], notes: [] },
    // ... etc for all 9 factors
  }
}
```

### Task 2B: Weekly Reflection UI Section

Add a Weekly Reflection section to the BALA app. It should:
- Appear in the journal/history area or as a new tab near Daily Factors
- Show a simple list of factors noted this week with counts
- Show "You noted {factor} {N} time(s) this week" for each active factor
- Show a note preview (first 60 chars) if a note exists
- If no factors logged this week: show "No daily notes this week yet"

**Safe copy rules for all text in this section:**
- "You noted {factor}" — not "You experienced {factor}"
- "Here's what you logged this week" — not "Here's what happened to you"
- "These are your own reflections" — somewhere in the section header or subtitle
- No medical interpretation. No "this may mean..." statements.
- No scores derived from factor counts.

**Forbidden in this UI:**
- Any language connecting factors to BALA Score ("your stress score")
- Any predictive statement ("high stress this week may lead to...")
- Any comparison to others
- Any medical recommendation

### Task 2C: Safe Copy Review for Weekly Reflection

Before committing, run `node scripts/chintu-medical-claims.test.js` and `node scripts/chintu-bala-safe-docs.test.js`. Both must pass.

Also manually scan every new user-facing string in `app.js` against the prohibited word list from `CHINTU_MEMORY_VAULT/BALA_MEDICAL_SAFETY_RULES.md`.

### Task 2D: sw.js

If the Weekly Reflection requires any new JavaScript or a new UI section that changes the app shell, bump the sw.js cache version. Current version is `bala-shell-v43`. If you bump, use `bala-shell-v44`.

Do not touch sw.js for a JS-only change that does not affect the HTML shell.

---

## Run Order

1. Read all context files listed above
2. Implement Task 1A (heartbeat connector status)
3. Implement Task 1B (operator console connector row)
4. Implement Task 1C (pause status)
5. Implement Task 1D (connector activation test)
6. Implement Task 2A (weekly reflection data function)
7. Implement Task 2B (weekly reflection UI)
8. Implement Task 2C (copy review)
9. Decide on Task 2D (sw.js bump if needed)
10. Run all validation scripts:
    - `git status --short`
    - `node scripts/chintu-no-network-egress.test.js`
    - `node scripts/chintu-medical-claims.test.js`
    - `node scripts/chintu-doc-link-integrity.test.js`
    - `powershell -ExecutionPolicy Bypass -File scripts\chintu-release-guard.ps1`
11. If all pass → `git add -A && git commit -m "feat: Chintu connector live-readiness and BALA weekly reflection"`
12. Do not push.

---

## What Success Looks Like

**Connector lane:**
- `latest_heartbeat.json` has a `connectors` object (not a `parked` array) with real stage per connector
- `CHINTU_OPERATOR_CONSOLE.html` has a Connector Status section
- `scripts/chintu-connector-activation.test.js` passes and proves no accidental send is possible
- `node scripts/chintu-connector-send.js --status` output matches the heartbeat connector block

**BALA lane:**
- Weekly Reflection section appears in the app when daily factor entries exist
- All copy passes medical claims test
- No sw.js breakage (test via `node --check sw.js`)

**Both lanes:**
- All 4 validation scripts pass (green)
- No secrets in any file
- No network calls in any new script
- No push

---

## What Codex Must NOT Do

- Do not modify `chintu-connector-send.js` logic
- Do not change the default connector mode to `active`
- Do not add any real Telegram credentials anywhere
- Do not add a scheduler or cron that sends messages
- Do not add any health data to the connector preview or send path
- Do not claim a feature is live unless you have implemented it
- Do not push
- Do not edit `CHINTU_MEMORY_VAULT/BALA_MEDICAL_SAFETY_RULES.md`
- Do not remove any safety gate from the connector send engine

---

## Commit Message

```
feat: Chintu connector live-readiness and BALA weekly reflection
```

---

*BALA is a health-awareness companion. It does not diagnose, treat, predict, prevent, replace doctors, or provide emergency monitoring.*
