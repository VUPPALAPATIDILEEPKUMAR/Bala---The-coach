# Chintu Agent Runner — Next Layer

**Date:** 2026-06-18  
**Status:** Architecture — handoff to Codex  
**Current agent runner:** `scripts/chintu-agent-runner.ps1` — working, creates run folders and executes validation commands

---

## What the Current Runner Does

- Lists available agent packets in `CHINTU_AGENT_PACKETS/*.packet.md`
- Creates a timestamped run folder: `CHINTU_AGENT_RUNS/{agent}_{YYYY-MM-DD_HHmmss}/`
- Copies the packet into the run folder as `packet.md`
- Parses `## Validation Commands` block from the packet
- Executes each command, captures exit code + output (or skips in `--DryRun`)
- Writes `run-report.md` and `run-summary.json` into the run folder
- Supports `--ListAgents`, `--Agent <name>`, `--DryRun`

## What Is Missing

| Gap | Impact |
|---|---|
| No run status dashboard | Founder cannot see across all agents which ran, when, pass/fail |
| No packet structure validator | Malformed packets silently fail at runtime |
| No "latest run" pointer per agent | Hard to find the most recent run output |
| No parallel run log | When founder runs 2+ agents at once, no cross-run summary exists |
| Agent board does not link to run folders | `CHINTU_AGENT_BOARD.md` shows agent names but not run history |
| Connector status not surfaced in runs | Connector-safety agent packet does not read live connector stage |
| No validation mode switch on runs | Cannot run packet in "validate-only" vs "live" mode explicitly |

---

## Next Implementation: Run Status Dashboard

### New Script: `scripts/chintu-agent-run-status.ps1`

**Behavior:**
1. Scan all subdirectories of `CHINTU_AGENT_RUNS/` that contain a `run-summary.json`
2. Parse each summary: agent name, run_id, timestamp, overall status (pass/fail/skipped), command count
3. Group by agent name, show most recent run per agent
4. Write `CHINTU_AGENT_RUNS/RUN_STATUS.md` with a status table
5. Write `CHINTU_AGENT_RUNS/RUN_STATUS.json` as a machine-readable summary
6. Print the table to stdout

**Output format (`RUN_STATUS.md`):**

```markdown
# Chintu Agent Run Status
Generated: {timestamp}

| Agent | Last Run | Overall | Commands | Run Folder |
|---|---|---|---|---|
| validator-agent | 2026-06-18 15:44 | PASS | 9 | CHINTU_AGENT_RUNS/validator-agent_2026-06-18_154421/ |
| research-agent  | 2026-06-18 10:00 | PASS | 3 | CHINTU_AGENT_RUNS/research-agent_2026-06-18_100012/ |
| builder-agent   | — | — | — | no runs yet |
| bala-ux-agent   | — | — | — | no runs yet |
| connector-safety-agent | — | — | — | no runs yet |
```

**Safety:** No network calls. No secrets. No connector activation. Local file reads only.

---

## Next Implementation: Packet Structure Validator

### New Script: `scripts/chintu-agent-packet-validate.ps1`

**What makes a valid packet:**

Every `*.packet.md` must contain all of these sections:

| Section header | Required | Why |
|---|---|---|
| `## Mission` | Yes | Defines what the agent does |
| `## Files To Inspect` | Yes | Scopes the agent's reading |
| `## Validation Commands` | Yes | The runner extracts commands from here |
| `## Stop Condition` | Yes | Prevents runaway agent sessions |
| `## Forbidden Actions` | Yes | Safety boundary |

Optional but strongly recommended:
- `## Allowed Actions`
- `## Protected Files`
- `## Copy-Paste Prompt For Codex/Claude`

**Validation output:** Pass/fail per packet, exact missing section names. Exit code 1 if any packet fails.

**When to run:** Add this to the validator-agent packet's `## Validation Commands`.

---

## Next Implementation: Latest Run Pointer

After each run, the runner writes a pointer file:

`CHINTU_AGENT_RUNS/LATEST_{agent-name}.json`

Content:
```json
{
  "agent": "validator-agent",
  "run_id": "validator-agent_2026-06-18_154421",
  "run_folder": "CHINTU_AGENT_RUNS/validator-agent_2026-06-18_154421",
  "timestamp": "2026-06-18T15:44:21Z",
  "overall": "pass"
}
```

This lets any script or dashboard read the latest result without scanning all folders.

**Implementation:** Add 4 lines to the end of `scripts/chintu-agent-runner.ps1`.

---

## Agent Board Link Update

`CHINTU_AGENT_BOARD.md` currently lists agent names with no run history. After implementing the run status dashboard:

Add a section: `## Recent Runs` that embeds the `RUN_STATUS.md` table or links to it.

The agent board script (`scripts/chintu-agent-board.ps1`) should call `chintu-agent-run-status.ps1` and embed the output into the board markdown.

---

## Agent Packet: Connector Safety — Live Stage Awareness

The `connector-safety-agent.packet.md` should include a validation command that reads connector status:

```
## Validation Commands
- `node scripts/chintu-connector-send.js --status`
- `node scripts/chintu-connector-send.js --validate-env`
- `node scripts/chintu-medical-claims.test.js`
- `node scripts/chintu-no-network-egress.test.js`
```

This way, when the connector-safety agent runs, it captures the live connector stage in the run report.

---

## Research Agent Packet Enhancement

The research agent should include the new activation docs in `## Files To Inspect`:

```
## Files To Inspect
- CHINTU_ALIVE_ACTIVATION_PLAN.md
- CHINTU_REAL_CONNECTOR_TELEGRAM_RUNBOOK.md
- CHINTU_AGENT_RUNNER_NEXT_LAYER.md
- BALA_NEXT_PRODUCT_INTELLIGENCE_PLAN.md
- CHINTU_MEMORY_VAULT/BALA_PRODUCT_STATE.md
- CHINTU_AGENT_BOARD.md
- CHINTU_AGENT_RUNS/RUN_STATUS.md (if present)
```

---

## Parallel Run Support (Manual)

Chintu does not auto-run agents in parallel. The founder runs agents manually.

When running two agents at the same time from two PowerShell windows, both create their own timestamped run folders. No collision. No shared state.

The run status dashboard script reads all folders and shows them in time order — this is the parallel run log.

**No automation of parallel runs.** No scheduler. No agent calling another agent. Manual founder-directed only.

---

## Implementation Priority Order

1. **`chintu-agent-run-status.ps1`** — high value, low risk, no external dependencies
2. **Latest run pointer** — 4 lines in existing runner, immediate benefit
3. **`chintu-agent-packet-validate.ps1`** — prevents silent failures
4. **Agent board run status integration** — improves operator visibility
5. **Connector-safety and research packet updates** — improves what agents report

---

## Safety Rules (All Agent Runner Work)

- No script may make network calls (enforced by `chintu-no-network-egress.test.js`)
- No script may read secrets or write env vars
- No script may activate connectors
- No script may push to git — all pushes are founder-initiated
- Run reports must include the footer: `No network calls. No secrets. No connector activation. No health data transfer.`
- Agent run folders are local only and not committed (add `CHINTU_AGENT_RUNS/**/` to `.gitignore` except `.gitkeep`)

---

*BALA is a health-awareness companion. It does not diagnose, treat, predict, prevent, replace doctors, or provide emergency monitoring.*
