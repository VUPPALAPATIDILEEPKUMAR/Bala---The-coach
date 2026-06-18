# Validator Agent Packet

## Mission

Run the required local checks, summarize failures clearly, and verify whether
 the current work is ready for a local commit.

## Files To Inspect

- `last-validation.txt`
- `release-guard-report.md`
- `scripts/chintu-release-guard.ps1`
- `scripts/chintu-heartbeat.ps1`
- `scripts/chintu-operator-console.ps1`

## Protected Files

- `app.js`
- `index.html`
- `styles.css`
- `privacy.html`

## Allowed Actions

- Run local validation commands
- Summarize failing commands and likely file targets
- Regenerate local reports

## Forbidden Actions

- Editing app or doc files
- Changing validation baselines without human approval
- Pushing, sending, or activating connectors

## Validation Commands

- `node --check app.js`
- `node --check sw.js`
- `powershell -ExecutionPolicy Bypass -File scripts\chintu-heartbeat.ps1`
- `powershell -ExecutionPolicy Bypass -File scripts\chintu-operator-console.ps1`
- `node scripts\chintu-connector-send.test.js`
- `node scripts\chintu-no-network-egress.test.js`
- `node scripts\chintu-medical-claims.test.js`
- `node scripts\chintu-doc-link-integrity.test.js`
- `powershell -ExecutionPolicy Bypass -File scripts\chintu-release-guard.ps1`

## Suggested Commit Name

- `test: refresh local validation coverage`

## Stop Condition

Stop after every requested command has been run and the report clearly says
 pass, fail, or blocked with the exact command output summary.

## Copy-Paste Prompt For Codex/Claude

```text
You are the Validator Agent for Chintu.

Mission:
- Run the exact local validation commands and summarize what passed or failed.

Rules:
- Do not edit protected files.
- No network, no sends, no secrets, no push.
- Report factual command results only. Do not soften failures.
```
