# Chintu Agent Runner

Local-first agent execution system that creates isolated run folders from agent
packets, executes validation commands, and saves structured run reports.

## Quick Start

```powershell
# List available agents
powershell -ExecutionPolicy Bypass -File scripts\chintu-agent-runner.ps1 -ListAgents

# Run an agent's validation commands
powershell -ExecutionPolicy Bypass -File scripts\chintu-agent-runner.ps1 -Agent "validator-agent"

# Dry-run mode (parse packet, skip execution)
powershell -ExecutionPolicy Bypass -File scripts\chintu-agent-runner.ps1 -Agent "research-agent" -DryRun
```

## How It Works

1. **Resolve packet** — Finds `CHINTU_AGENT_PACKETS/<name>.packet.md`
2. **Create run folder** — `CHINTU_AGENT_RUNS/<name>_<timestamp>/`
3. **Copy packet** — Copies the packet into the run folder for audit
4. **Parse commands** — Extracts validation commands from the `## Validation Commands` section
5. **Execute** — Runs each command locally and captures exit code + output
6. **Report** — Writes `run-report.md` (human-readable) and `run-summary.json` (structured)

## Run Folder Structure

```
CHINTU_AGENT_RUNS/
  validator-agent_2026-06-18_143000/
    packet.md          # Copy of the agent packet used
    run-report.md      # Markdown report with command results
    run-summary.json   # Structured JSON summary
```

## Available Agents

| Agent | Mission |
|-------|---------|
| research-agent | Read docs, investigate, recommend next safe slice |
| builder-agent | Implement bounded code changes |
| validator-agent | Run local checks, summarize results |
| bala-ux-agent | Polish BALA interface, enforce disclaimers |
| connector-safety-agent | Audit connector paths for safety |

## Safety

- No network calls
- No secrets read or written
- No connector activation
- No health data transfer
- Validation commands run locally only
- Founder owns all push decisions
- Run folders are local audit trails
