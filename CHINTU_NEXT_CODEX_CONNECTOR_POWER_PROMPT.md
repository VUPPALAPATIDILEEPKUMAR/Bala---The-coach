# Chintu Next Codex Prompt — Stage 19: Connector Power Slice

## Context for Codex

You are building Chintu OS, a local-first, connector-capable agent operating system for a founder named Chintu.

Chintu has a working connector send foundation in `scripts/chintu-connector-send.js` that supports:
- `--check` → writes readiness JSON (no network)
- `--preview` → writes preview JSON (no network)
- `--send` → attempts gated send (blocked unless ALL gates pass: active mode + env vars + allowlist + preview + approval phrase + no pause + health-data guard)

Tests exist in `scripts/chintu-connector-send.test.js` proving dry-run defaults and blocked sends.

Architecture docs:
- `CHINTU_REAL_CONNECTOR_ARCHITECTURE.md` — core loop, connector ladder, Telegram/Discord/Slack/Gmail paths
- `CHINTU_CONNECTOR_ACTIVATION_MATRIX.md` — activation checklist per connector
- `CHINTU_AGENT_ORCHESTRATION_SPEC.md` — parent operator model, specialist agents, packet shape
- `CHINTU_FREE_CONNECTOR_POWER_PLAN.md` — full research-backed plan for all 8 connector targets
- `CHINTU_CONNECTOR_DISCOVERY_MATRIX.md` — detailed capability matrix with validation rules
- `CHINTU_AGENT_POWER_ROADMAP.md` — seven-phase roadmap from CLI hardening to scheduled reports

Latest commits:
- `f351a99 docs: define Chintu real connector architecture`
- `c2d2a14 chore: refresh Chintu consoles after Stage 17`
- `8824f5b feat: add Chintu agent board and BALA behavior journal`

---

## Stage 19 Implementation Tasks

### Task 1: Strengthen `scripts/chintu-connector-send.js`

Add these commands to the existing script. Do not break existing `--check`, `--preview`, or `--send` functionality.

#### 1a. `--discover` command

Print a table to stdout showing all connectors:

```
CHINTU CONNECTOR DISCOVERY
==========================
#  Connector   Stage              Free?  Code?  Next Action
1  telegram    dry-run            yes    yes    Founder creates bot, sets env vars
2  discord     dry-run            yes    yes    Founder creates webhook, sets env vars
3  slack       dry-run            yes    yes    Founder creates Slack app, sets env vars
4  gmail       architecture-only  yes    partial  Design draft adapter
5  github      discovered         yes    no     Write adapter
6  local       active             yes    yes    Already working
7  agents      active             yes    yes    Already working
8  push        discovered         yes    no     Write ntfy.sh adapter
```

Also write this to `CHINTU_OUTBOX/latest_connector_discovery.txt`.

Determine stage by checking:
- Does code exist? (check `CONNECTORS` object)
- Are env vars set? (check environment)
- Is mode active? (check `CHINTU_CONNECTOR_MODE`)
- Is connector paused? (check pause files)
- For `local` and `agents`: always show `active`
- For `github` and `push`: show `discovered` (no adapter yet)

#### 1b. `--status` command

Print a detailed status table for all connectors with code:

```
CHINTU CONNECTOR STATUS
=======================
Connector: telegram
  Stage:       dry-run
  Env vars:    CHINTU_TG_BOT_TOKEN=missing  CHINTU_TG_CHAT_ID=missing  ...
  Allowlist:   (not configured)
  Recipient:   (not configured)
  Paused:      no
  Can preview: yes
  Can send:    no (mode is dry-run, env vars missing)

Connector: discord
  ...
```

Write to `CHINTU_OUTBOX/latest_connector_status.txt`.

#### 1c. `--validate-env` command

For each connector that has env vars set, validate their format:

- **Telegram bot token:** matches `/^\d+:[A-Za-z0-9_-]{35,}$/`
- **Telegram chat ID:** integer (positive or negative)
- **Discord webhook URL:** starts with `https://discord.com/api/webhooks/` or `https://discordapp.com/api/webhooks/`
- **Slack webhook URL:** starts with `https://hooks.slack.com/services/`
- **Allowlists:** non-empty when set, valid CSV
- **Approval phrase:** at least 8 characters when set

Print validation results. Exit 0 if all pass, exit 1 if any fail.

Add a `warnings` array to the readiness JSON output (from `--check`) that includes validation warnings.

#### 1d. Audit logging for `--preview`

When `--preview` runs, append to `connector_audit.log.jsonl` with event `preview_generated`. Currently only sends/blocked sends are audited.

### Task 2: Add connector status to operator console

Update `scripts/chintu-operator-console.ps1` to include a "Connector Status" section. This section should:

1. Run `node scripts/chintu-connector-send.js --check` and parse the readiness JSON
2. Show each connector as a colored badge: green=active, yellow=dry-run, gray=unconfigured, red=paused
3. Show whether env vars are set (yes/no, not the values)
4. Show the BALA safety status (no health data sent externally)

### Task 3: Add connector status to heartbeat

Update `scripts/chintu-heartbeat.ps1` to include connector summary data in the heartbeat JSON:

```json
{
  "connectors": {
    "telegram": { "stage": "dry-run", "can_send": false },
    "discord": { "stage": "dry-run", "can_send": false },
    "slack": { "stage": "dry-run", "can_send": false },
    "gmail": { "stage": "architecture-only", "can_send": false }
  }
}
```

### Task 4: Strengthen tests

Add tests to `scripts/chintu-connector-send.test.js`:

1. **`--discover` output test** — Verify discover output lists all connectors with correct stages.
2. **`--status` output test** — Verify status output includes env var information.
3. **`--validate-env` test** — Set mock env vars with invalid formats, verify validation catches them.
4. **Preview audit log test** — Verify `--preview` writes an audit log entry with event `preview_generated`.
5. **Health-data guard test** — Verify messages containing "heart rate", "SpO2", "blood pressure" are blocked.
6. **Active mode gate tests** — Verify that `--send` is blocked when:
   - Mode is `dry-run` (default)
   - Env vars are missing
   - Recipient is not on allowlist
   - Approval phrase is missing or wrong
   - Pause file exists
   - Connector is `architecture-only`
7. **No network egress test** — Verify no test makes a real HTTP call. (Existing `chintu-no-network-egress.test.js` should continue to pass.)

**Critical: Do not make real network calls in any test. Do not use real tokens. Do not commit secrets.**

### Task 5: Update existing test guards

Ensure these existing tests still pass after changes:

- `node scripts/chintu-no-network-egress.test.js`
- `node scripts/chintu-medical-claims.test.js`
- `node scripts/chintu-doc-link-integrity.test.js`
- `node scripts/chintu-connector-send.test.js`

---

## Protected Files (do not modify)

- `.gitignore` (unless adding new outbox patterns)
- `CHINTU_FOUNDER_MESSAGE.md`
- `CHINTU_BALA_BEHAVIOR_JOURNAL.md` (BALA health data — never sent externally)
- Any file in `CHINTU_OUTBOX/` (runtime artifacts, not committed)
- Environment variables (never written to files)

## Files You May Create

- New test files in `scripts/`
- New documentation in project root (`.md` files)
- New connector adapters in `scripts/` (if needed)

## Files You Should Modify

- `scripts/chintu-connector-send.js` — add `--discover`, `--status`, `--validate-env`, preview audit logging
- `scripts/chintu-connector-send.test.js` — add new tests
- `scripts/chintu-operator-console.ps1` — add connector status section
- `scripts/chintu-heartbeat.ps1` — add connector summary to heartbeat JSON

---

## Commit Convention

Use conventional commits:
- `feat:` for new features
- `test:` for new tests
- `chore:` for maintenance

Suggested commit messages for this slice:
- `feat: add discover, status, and validate-env commands to connector CLI`
- `test: add connector discovery, validation, and audit tests`
- `feat: add connector status to operator console and heartbeat`

---

## BALA Safety Reminder

BALA is a health-awareness companion. It does not diagnose, treat, predict, prevent, replace doctors, or provide emergency monitoring.

- No health data in outgoing connector payloads by default
- Health-data regex guard blocks: heart rate, RHR, HRV, SpO2, blood oxygen, sleep, steps, glucose, blood pressure, weight, symptoms, chest pain
- Medical-claims guard blocks: diagnose, treat, predict, prevent, emergency monitoring
- BALA behavior journal never leaves the local machine

---

## Validation Commands

Run these before committing:

```bash
node scripts/chintu-no-network-egress.test.js
node scripts/chintu-medical-claims.test.js
node scripts/chintu-doc-link-integrity.test.js
node scripts/chintu-connector-send.test.js
powershell -ExecutionPolicy Bypass -File scripts\chintu-release-guard.ps1
```

All must pass. Do not commit if any fail.

---

## Stop Condition

Stop after implementing Tasks 1-5. Do not push. Founder owns push.
