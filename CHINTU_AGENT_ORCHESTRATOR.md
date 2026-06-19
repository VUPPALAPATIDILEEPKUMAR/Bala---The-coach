# Chintu Agent Orchestrator — Stage 30

The orchestrator is the seed of "multiple agents working over time". The first
version is deliberately safe: it coordinates and reports, it does not edit files,
push, or send.

## Files

- `scripts/chintu-agent-orchestrator.js` — the board + run summary writer.
- `scripts/chintu-agent-orchestrator.test.js` — proves it stays dry-run and only
  names real bridge actions.
- Bridge action: `agent_orchestrator_dry_run`.
- Allegro: routed via "run agent board dry run".
- CLI summary mode: `node scripts/chintu-agent-orchestrator.js --summary`

## The board

| Agent | Track | Mode | Bridge action |
| --- | --- | --- | --- |
| Validator Agent | both | dry-run | `run_validator_dry_run` |
| Connector Safety Agent | chintu | read | `connector_readiness` |
| BALA UX Agent | bala | read | `validate_app` |
| Prompt Engineer Agent | both | dry-run | `prompt_xml_bala` |
| Release Manager Agent | both | read | `release_guard` |

## Run model

- Parallel-safe (read / dry-run) jobs are grouped into the first wave.
- The release manager runs last, sequentially — it is the gate the others feed.
- Each job names the allowlisted bridge action the operator can run to actually
  perform its check. The orchestrator itself performs none of them.
- The `--summary` mode adds an operator-facing summary of:
  - available agents
  - safe jobs
  - bridge action mappings
  - what stays dry-run only
  - what still requires human approval

## Output

`CHINTU_AGENT_RUNS/latest_orchestrator_summary.json` and
`CHINTU_AGENT_RUNS/latest_orchestrator_summary.md`.

## Approval boundary

- The orchestrator never edits files.
- The orchestrator never pushes.
- The orchestrator never sends connector messages.
- Human approval is still required for any real connector send, file-edit path,
  or release action.

## Parked

Editing files from the orchestrator, real parallel execution, and any
destructive action are parked until a later stage adds per-job permission modes
and approval gates.
