# Chintu Agent Control Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-only Chintu Agent dashboard and Claude handoff package, with a documented BALA-safe planning boundary and no BALA runtime changes.

**Architecture:** The dashboard generator reads only local Git metadata and approved Markdown reports, then renders a self-contained escaped HTML snapshot. A second parameterized generator writes a deterministic bounded Claude prompt. Static policy docs and memory-vault appendices record Stage 10 decisions, parked systems, and next-stage choices.

**Tech Stack:** PowerShell 5.1, static HTML/CSS, small inline JavaScript, Node.js assertions, Git, Markdown.

---

### Task 1: Lock the generator contracts with a failing integration test

**Files:**
- Create: `scripts/chintu-agent-control-shell.test.js`
- Test: `scripts/chintu-agent-control-shell.test.js`

- [ ] **Step 1: Write the failing test**

Create a temporary local Git repository, seed operator/bridge/parked-state fixtures (including HTML metacharacters), invoke both Stage 10 PowerShell generators with `-RepoRoot`, and assert:

```text
dashboard: all required sections, escaped fixture content, no external URLs, local-only disclaimer, BALA safety footer
Claude prompt: operator mode, inspect Stage 8/9/10, protected BALA files, local-first/non-medical boundary, no external automation, validate/commit/stop-before-push, low-usage handoff
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node scripts/chintu-agent-control-shell.test.js`

Expected: FAIL because `scripts/chintu-agent-dashboard.ps1` and `scripts/chintu-claude-overnight-package.ps1` do not exist.

### Task 2: Implement the dashboard generator and generated dashboard

**Files:**
- Create: `scripts/chintu-agent-dashboard.ps1`
- Create: `CHINTU_AGENT_DASHBOARD.html`

- [ ] **Step 1: Implement the minimal dashboard generator**

The script accepts `-RepoRoot` and optional `-OutFile`, reads local Git state plus the four approved reports, HTML-escapes every dynamic value, and writes one self-contained responsive HTML file. It contains no network cmdlets, remote URLs, trackers, external assets, or backend calls.

- [ ] **Step 2: Run the focused test**

Run: `node scripts/chintu-agent-control-shell.test.js`

Expected: still FAIL only because the Claude package generator is missing.

### Task 3: Implement the Claude overnight package generator

**Files:**
- Create: `scripts/chintu-claude-overnight-package.ps1`
- Create: `CHINTU_CLAUDE_OVERNIGHT_PROMPT.md`

- [ ] **Step 1: Implement the minimal prompt generator**

The script accepts `-RepoRoot` and optional `-OutFile`, captures the latest local commit, and writes a deterministic prompt with these boundaries:

```text
inspect Stage 8/9/10; do not touch BALA app files; plan BALA Voice Coach only; local-first and non-medical; no external automation/network/voice/calling; validate; commit if safe; stop before push; write a handoff before low-usage exit
```

- [ ] **Step 2: Verify the test turns green**

Run: `node scripts/chintu-agent-control-shell.test.js`

Expected: PASS.

### Task 4: Add the Stage 10 control-shell and safety documentation

**Files:**
- Create: `CHINTU_AGENT_CONTROL_SHELL.md`
- Create: `BALA_SAFE_TOUCHPOINTS.md`
- Create: `CHINTU_STAGE_11_QUEUE.md`
- Create: `CHINTU_FREE_POWER_LANES.md`

- [ ] **Step 1: Write the control-shell contract**

Document what Chintu Agent is/is not, local report inputs, one-action guidance, safe BALA planning, Claude/Codex preparation, parked voice research, and hard safety limits.

- [ ] **Step 2: Write the BALA touchpoint boundary**

Separate BALA from Chintu OS; permit only product-state and planning language; prohibit diagnosis, treatment, prediction, prevention, emergency monitoring, default health-data export, and app-file changes.

- [ ] **Step 3: Write the Stage 11 queue and free-power lanes**

List Stage 11A through 11F exactly as approved and mark local LLM/dashboard/speech/automation/control-room/BALA lanes as research-only and parked pending founder approval.

### Task 5: Record Stage 10 in durable Chintu memory

**Files:**
- Modify: `scripts/chintu-endday-operator.ps1`
- Modify: `CHINTU_HANDOFF.md`
- Modify: `CHINTU_MEMORY_VAULT/NEXT_SPRINT_QUEUE.md`
- Modify: `CHINTU_MEMORY_VAULT/PARKED_SYSTEMS.md`
- Modify: `CHINTU_MEMORY_VAULT/DECISIONS.md`
- Modify: `CHINTU_MEMORY_VAULT/BLOCKERS.md`

- [ ] **Step 1: Append the Stage 10 handoff and decisions**

Record the control shell, both generators, safe touchpoints, free-power research lanes, unchanged BALA app, and the continued founder-only activation boundary.

- [ ] **Step 2: Re-rank future work without activating it**

Point the queue to `CHINTU_STAGE_11_QUEUE.md`; keep iMac Option 12 validation actionable; keep voice/personality, external automation, and cloud sync parked.

- [ ] **Step 3: Remove stale stage-specific restart wording**

Make the end-day handoff describe generic current Chintu OS changes, protect `functions/api/coach.js`, and prohibit BALA feature work without explicit founder instruction. Verify this behavior in `scripts/chintu-agent-control-shell.test.js`.

### Task 6: Generate artifacts, validate, scope-check, and commit once

**Files:**
- Regenerate: `CHINTU_AGENT_DASHBOARD.html`
- Regenerate: `CHINTU_CLAUDE_OVERNIGHT_PROMPT.md`
- Possibly refresh through required validators: existing generated Chintu reports

- [ ] **Step 1: Run both Stage 10 generators**

```powershell
powershell -ExecutionPolicy Bypass -File scripts/chintu-agent-dashboard.ps1
powershell -ExecutionPolicy Bypass -File scripts/chintu-claude-overnight-package.ps1
```

- [ ] **Step 2: Run the complete handoff validation list**

Run the Node syntax checks, snapshot consistency test, Stage 10 integration test, Chintu validator/release guard, agent board, bridge command center, daily operator, next action, end-day operator, dashboard generator, and Claude package generator.

Expected: every command exits 0; the validator verdict is PASS (warnings may require a recorded human glance).

- [ ] **Step 3: Prove the protected BALA files are unchanged**

Run:

```powershell
git diff --exit-code HEAD -- app.js index.html styles.css sw.js coach.js manifest.webmanifest privacy.html functions/api/coach.js
```

Expected: no output and exit 0. Also scan the Stage 10 scripts/artifacts for external URLs, network/send cmdlets, secrets, health-data transfer, and activation language.

- [ ] **Step 4: Review the final diff and commit exactly once**

```powershell
git add -- CHINTU_AGENT_CONTROL_SHELL.md CHINTU_AGENT_DASHBOARD.html CHINTU_CLAUDE_OVERNIGHT_PROMPT.md BALA_SAFE_TOUCHPOINTS.md CHINTU_STAGE_11_QUEUE.md CHINTU_FREE_POWER_LANES.md CHINTU_HANDOFF.md CHINTU_OPERATOR_STATUS.md CHINTU_TOMORROW_START.md CHINTU_MEMORY_VAULT/NEXT_SPRINT_QUEUE.md CHINTU_MEMORY_VAULT/PARKED_SYSTEMS.md CHINTU_MEMORY_VAULT/DECISIONS.md CHINTU_MEMORY_VAULT/BLOCKERS.md CHINTU_MEMORY_VAULT/DAILY_LOGS/2026-06-18.md scripts/chintu-endday-operator.ps1 scripts/chintu-agent-dashboard.ps1 scripts/chintu-claude-overnight-package.ps1 scripts/chintu-agent-control-shell.test.js docs/superpowers/plans/2026-06-18-chintu-agent-control-shell.md
git commit -m "chore: add Chintu agent control shell and BALA touchpoints"
```

Expected: one local commit; do not push.
