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
| Agent run | `scripts\chintu-agent-runner.ps1 -Agent "validator-agent"` |
| Bridge sync | `scripts\chintu-bridge-command-center.ps1` |
| End of day | `scripts\chintu-endday-operator.ps1` |

## Validation lane

| Command | Purpose |
|---|---|
| `node --check app.js` | BALA app syntax. |
| `node --check sw.js` | Service worker syntax. |
| `node scripts\chintu-snapshot-consistency.test.js` | History vs dashboard snapshot. |
| `node scripts\chintu-agent-control-shell.test.js` | Agent control shell contract. |
| `node scripts\chintu-command-map.test.js` | This map vs scripts/ integrity. |
| `node scripts\chintu-memory-vault.test.js` | Vault README vs files integrity. |
| `node scripts\chintu-no-network-egress.test.js` | Chintu scripts contain no egress patterns. |
| `node scripts\chintu-medical-claims.test.js` | Chintu/BALA docs contain no unsafe claims. |
| `node scripts\chintu-safety-boundary.test.js` | Protected BALA file list stays canonical. |
| `node scripts\chintu-doc-link-integrity.test.js` | Local markdown links between Chintu docs resolve. |
| `node scripts\chintu-generated-files-map.test.js` | Generated-files map vs scripts/ + repo root integrity. |
| `node scripts\chintu-bala-safe-docs.test.js` | BALA_*.md docs carry footer + parked/planning header. |
| `node scripts\chintu-parked-systems.test.js` | *_PARKED.md docs stay parked and footered. |
| `node scripts\chintu-continuation-prompts.test.js` | Review/continuation prompts forbid push + name protected files. |
| `node scripts\chintu-runtime-health.test.js` | Runtime health script + report safety contract. |
| `node scripts\chintu-heartbeat.test.js` | Heartbeat script has no network egress; report carries footer. |
| `node scripts\chintu-restart-recovery.test.js` | Restart-recovery script + report safety contract. |
| `node scripts\chintu-telegram-status-plan.test.js` | Telegram status plan stays parked and no script targets api.telegram.org. |
| `node scripts\chintu-bridge-loop-reality-check.test.js` | Bridge reality-check script + docs carry footer, no forbidden URLs or secrets. |
| `node scripts\chintu-imac-option-12-sha-parse.test.js` | iMac Option 12 install script uses robust SHA-256 parsing + lowercase compare. |
| `node scripts\chintu-dry-run-adapter.test.js` | Dry-run adapter has no HTTP client / connector URLs; payloads marked DRY RUN ONLY. |
| `node scripts\chintu-connector-policy.test.js` | Connector registry + policy + example config consistent, no real secrets, no `active`/`ready` status. |
| `node scripts\chintu-outbox-shape.test.js` | Outbox folder shape correct; no real connector URLs anywhere under CHINTU_OUTBOX/. |
| `node scripts\chintu-action-planner.test.js` | Action queue + approval center + JSON mirror carry footer, parked listing, approve-id phrase or "no approval needed" header. |
| `node scripts\chintu-action-planner-fixtures.test.js` | Fixture-driven planner ranking contract: safe-now before approval, push-only when unpushed, parked/research stay non-sending. |
| `node scripts\chintu-approval-audit.test.js` | Approval-audit helper stays local-only; tracked audit log keeps the expected schema and footer. |
| `node scripts\chintu-operator-console.test.js` | Operator console stays local-only, points at heartbeat/planner artifacts, and keeps no-send founder badges visible. |
| `scripts\chintu-validate.ps1` | Full validation gate. |
| `scripts\chintu-release-guard.ps1` | Pre-push guard. |
| `scripts\chintu-pre-memory-gate.ps1` | Memory vault gate. |

## Runtime / restart recovery

| Command | Output |
|---|---|
| `scripts\chintu-runtime-health.ps1` | `CHINTU_RUNTIME_HEALTH.md` (GREEN/YELLOW/RED) |
| `scripts\chintu-heartbeat.ps1` | Founder message + planner + dry-run previews + control room refresh + operator console refresh -> `CHINTU_HEARTBEAT.md` + `CHINTU_OUTBOX/latest_heartbeat.json` |
| `scripts\chintu-restart-recovery.ps1` | `CHINTU_RESTART_RECOVERY.md` + console resume action |
| `scripts\chintu-bridge-loop-reality-check.ps1` | `CHINTU_BRIDGE_LOOP_REALITY_CHECK.md` (GREEN/YELLOW/RED bridge readiness) |
| `scripts\chintu-founder-message.ps1` | `CHINTU_DAILY_BRIEF.md` + `CHINTU_OUTBOX/latest_founder_message.md` + appends to `founder_message_history.md` |
| `node scripts\chintu-message-dry-run.js` | `CHINTU_OUTBOX/dry_run_payloads/{telegram,slack,discord}_preview.json` (NEVER sent) |
| `scripts\chintu-action-planner.ps1` | `CHINTU_ACTION_QUEUE.md` + `CHINTU_ACTION_QUEUE_TRACKED.md` + `CHINTU_APPROVAL_CENTER.md` + `CHINTU_NEXT_OPERATOR_PROMPT.md` + `CHINTU_OUTBOX/latest_action_plan.json` |
| `scripts\chintu-approval-audit.ps1 -ApprovalPhrase "approve <id>"` | Appends one founder approval row to `CHINTU_APPROVAL_AUDIT.md` |
| `scripts\chintu-operator-console.ps1` | `CHINTU_OPERATOR_CONSOLE.html` + `CHINTU_OUTBOX/latest_operator_console.json` |

## Reporting / dashboards

| Command | Output |
|---|---|
| `scripts\chintu-control-room-index.ps1` | `CHINTU_CONTROL_ROOM_INDEX.html` |
| `scripts\chintu-agent-dashboard.ps1` | `CHINTU_AGENT_DASHBOARD.html` |
| `scripts\chintu-operator-console.ps1` | `CHINTU_OPERATOR_CONSOLE.html` |
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
