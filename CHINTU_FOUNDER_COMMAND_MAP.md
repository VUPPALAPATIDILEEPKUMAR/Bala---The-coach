# Chintu Founder Command Map

**Stage:** 11
**Mode:** local-first, founder-driven

The single canonical reference for every safe local command the founder can
run against Chintu OS. No command on this map activates network egress,
external automation, paid APIs, health-data transfer, secrets, or BALA
runtime behavior.

If a command is not on this map, treat it as parked until the founder
explicitly approves it.

## Quick triage (run in this order)

| # | Command | Why |
|---|---|---|
| 1 | `powershell -ExecutionPolicy Bypass -File scripts\chintu-os-health-check.ps1` | One-shot status of repo, scripts, and reports. |
| 2 | `powershell -ExecutionPolicy Bypass -File scripts\chintu-validate.ps1` | PASS/WARN/FAIL gate on syntax, manifest, medical, privacy. |
| 3 | `powershell -ExecutionPolicy Bypass -File scripts\chintu-alive-briefing.ps1` | Plain-English snapshot of today. |
| 4 | `powershell -ExecutionPolicy Bypass -File scripts\chintu-next-action.ps1` | The next exact action to take. |

## Daily operator loop

| Phase | Command |
|---|---|
| Morning | `scripts\chintu-daily-operator.ps1` |
| Midday | `scripts\chintu-agent-board.ps1` |
| Bridge sync | `scripts\chintu-bridge-command-center.ps1` |
| End of day | `scripts\chintu-endday-operator.ps1` |

## Validation lane

| Command | Purpose |
|---|---|
| `node --check app.js` | BALA app syntax. |
| `node --check sw.js` | Service worker syntax. |
| `node scripts\chintu-snapshot-consistency.test.js` | History vs dashboard snapshot. |
| `node scripts\chintu-agent-control-shell.test.js` | Agent control shell contract. |
| `scripts\chintu-validate.ps1` | Full validation gate. |
| `scripts\chintu-release-guard.ps1` | Pre-push guard. |
| `scripts\chintu-pre-memory-gate.ps1` | Memory vault gate. |

## Reporting / dashboards

| Command | Output |
|---|---|
| `scripts\chintu-control-room-index.ps1` | `CHINTU_CONTROL_ROOM_INDEX.html` |
| `scripts\chintu-agent-dashboard.ps1` | `CHINTU_AGENT_DASHBOARD.html` |
| `scripts\chintu-windows-reporter.ps1` | `chintu-windows-reporter-report.md` |
| `scripts\chintu-bridge-daily-export.ps1` | `chintu-bridge-daily-export-report.md` |
| `scripts\chintu-openclaw-readiness.ps1` | `chintu-openclaw-readiness-report.md` |
| `scripts\chintu-claude-overnight-package.ps1` | overnight builder package for Claude/Codex handoff |

## Master launcher (one command, full sweep)

```powershell
powershell -ExecutionPolicy Bypass -File scripts\chintu-master-launcher.ps1
```

Runs the validator, snapshot test, health check, alive briefing, and
control room regeneration in order, and stops on the first FAIL. See
`scripts\chintu-master-launcher.ps1`.

## What this map will never include

- Push, force-push, or destructive git
- Telegram / Discord / webhooks / cloud sync
- Phone notifications, voice cloning, voice calling
- External automation, paid APIs, network egress
- Health-data transfer
- BALA app file edits (`app.js`, `index.html`, `styles.css`, `sw.js`, `coach.js`, `manifest.webmanifest`, `privacy.html`, `functions/api/coach.js`)
- Service worker cache version bumps
- Memory-wiki activation

## Founder-only actions (not scripted)

These require explicit founder approval and a human keystroke:

- `git push`
- BALA app file edits
- Service worker bump
- Secret rotation
- Telegram, Discord, webhooks, cloud sync
- Approving any parked system listed in `CHINTU_MEMORY_VAULT/`

## BALA safety footer

BALA is a health-awareness companion. It does not diagnose, treat, predict, prevent, replace doctors, or provide emergency monitoring.
