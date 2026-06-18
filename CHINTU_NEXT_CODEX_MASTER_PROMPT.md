# Chintu Next Codex Master Prompt — Stage 18: First Real Connector Milestone

## Context for Codex

You are building Chintu OS, a local-first agent operating system for a founder named Chintu.
Chintu is connector-capable. The goal is real messaging through free tools (Telegram, Discord, Slack) with full safety gates.

The connector send foundation already exists in `scripts/chintu-connector-send.js`. It supports:
- `--check` → writes readiness JSON
- `--preview` → writes preview JSON (no network)
- `--send` → attempts gated send (blocked unless all gates pass)

Tests exist in `scripts/chintu-connector-send.test.js` proving dry-run default and blocked sends.

Architecture docs exist in:
- `CHINTU_REAL_CONNECTOR_ARCHITECTURE.md`
- `CHINTU_CONNECTOR_ACTIVATION_MATRIX.md`
- `CHINTU_AGENT_ORCHESTRATION_SPEC.md`

Latest commits:
- `8824f5b feat: add Chintu agent board and BALA behavior journal`
- `c2d2a14 chore: refresh Chintu consoles after Stage 17`

---

## Stage 18 Implementation Tasks

### Task 1: Improve `scripts/chintu-connector-send.js`

Add these capabilities to the existing script:

1. **Connector status command** — `--status` flag that prints a human-readable table of all connectors showing: name, current stage (unavailable/configured/dry-run/ready/active/paused/revoked), missing env vars, and whether it can send now. Write to stdout and also to `CHINTU_OUTBOX/latest_connector_status.txt`.

2. **Stronger env-var validation** — When `--check` or `--status` runs, validate that:
   - Bot tokens / webhook URLs look structurally valid (non-empty, reasonable length, no whitespace)
   - Allowlists are non-empty CSV when set
   - Approval phrase is at least 8 characters when set
   - Log validation warnings to the readiness JSON under a `warnings` array

3. **Paused/revoked state support** — Add explicit stage detection:
   - `paused` — pause file exists (already implemented, make it visible in status)
   - `revoked` — env vars were previously set but are now missing (track via a `CHINTU_OUTBOX/connector_configured_history.json` file that records which connectors have been configured at least once)

4. **Local sent-log and audit-log for dry-run** — When `--preview` runs, also append to `connector_audit.log.jsonl` with event `preview_generated`. Currently only sends/blocked sends are audited.

5. **Telegram active-send code path** — The `buildRequest()` for Telegram already exists and works. Verify it handles:
   - API error responses (non-2xx status)
   - Timeout (already 10s timeout, good)
   - Response body parsing for error messages
   Add a `--send` response that includes the Telegram API response body (or error) in the result JSON.

### Task 2: Add connector status/readiness script

Create `scripts/chintu-connector-status.ps1` that:
1. Runs `node scripts/chintu-connector-send.js --status`
2. Prints the status table
3. Includes safety footer
4. Writes no secrets to disk

### Task 3: Strengthen tests

Update `scripts/chintu-connector-send.test.js` to also test:
1. `--status` flag produces readable output
2. Preview generates audit log entry
3. Health data blocklist covers all patterns
4. Empty body is rejected
5. Connector with `architecture-only` mode is blocked from send even with all other gates passing

**Critical test rule:** No test may make a real network call. All tests must work offline. Use only the `dry-run` and `blocked` paths. If `CHINTU_CONNECTOR_MODE=active` is set in a test, ensure at least one other gate (approval phrase mismatch, missing env var) blocks the actual send.

### Task 4: Update heartbeat and operator console with connector state

1. In `scripts/chintu-heartbeat.ps1` — add a section to the heartbeat report showing connector readiness summary (run `--check` and extract the summary).
2. In `scripts/chintu-operator-console.ps1` — add a card in the operator console HTML showing connector status for each connector.

### Task 5: Update action planner

In the planner, ensure the action queue includes connector-related actions when connectors are in `ready` state:
- "Send test message via Telegram" (needs-approval)
- "Send test message via Discord" (needs-approval)
- "Send test message via Slack" (needs-approval)

These should only appear when the connector readiness check shows the connector is in `ready` or `active` state.

---

## Hard Rules for Codex

1. **No real sends during implementation or tests.** All tests must use dry-run mode or ensure sends are blocked by at least one gate.
2. **No secrets in code.** All tokens, webhook URLs, and credentials come from environment variables only.
3. **No network egress in tests.** Tests must pass `chintu-no-network-egress.test.js` — this scans for actual network calls, not just connector sends.
4. **Do not edit `sw.js`** unless absolutely required for a bug fix.
5. **Do not modify BALA safety disclaimers** or health data blocklist patterns without explicit founder approval.
6. **Do not create new connectors** beyond the four defined (Telegram, Discord, Slack, Gmail). Gmail stays architecture-only.
7. **Dry-run is always the default.** Never change the default mode.
8. **Stop before push.** The founder owns push.

---

## Validation Commands (run all before committing)

```bash
node --check app.js
node --check sw.js
node scripts/chintu-connector-send.test.js
node scripts/chintu-no-network-egress.test.js
node scripts/chintu-medical-claims.test.js
node scripts/chintu-doc-link-integrity.test.js
powershell -ExecutionPolicy Bypass -File scripts/chintu-agent-board.ps1
node scripts/chintu-agent-board.test.js
powershell -ExecutionPolicy Bypass -File scripts/chintu-heartbeat.ps1
powershell -ExecutionPolicy Bypass -File scripts/chintu-operator-console.ps1
powershell -ExecutionPolicy Bypass -File scripts/chintu-release-guard.ps1
```

All must pass before commit.

---

## Suggested Commit Messages

- `feat: add connector status command and env-var validation`
- `feat: add paused/revoked state tracking and dry-run audit`
- `feat: integrate connector readiness into heartbeat and operator console`
- `test: strengthen connector send tests with offline-only coverage`

Or if done as a single commit:
- `feat: implement first real connector milestone — status, validation, audit`

---

## Stop Condition

Stop when:
1. All validation commands pass.
2. `--status` shows all four connectors with accurate stage detection.
3. `--check` includes env-var validation warnings.
4. Preview generates audit log entry.
5. Tests prove no accidental network calls.
6. Heartbeat and operator console show connector state.
7. No secrets are committed.
8. No health data leaks through connector payloads.

Do not push. The founder pushes.
