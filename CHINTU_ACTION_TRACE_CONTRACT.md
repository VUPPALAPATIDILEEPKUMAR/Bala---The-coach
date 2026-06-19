# Chintu Action Trace Contract — Stage 33

> Created: 2026-06-19
> Purpose: Define the exact JSON shape every runtime action in Chintu OS must return.
>          No action may execute without producing a valid trace object.
>          No trace may omit safety fields.

---

## Why an Action Trace

Every Chintu action crosses:
1. An intent classifier (brain router)
2. A risk gate (capability registry)
3. An execution layer (bridge or CLI)
4. An audit log (CHINTU_OUTBOX)

The trace is the handshake between all four layers. It records what was asked, what was
decided, why, and what happened — without ever including secrets or health data.

---

## Canonical Trace Shape (v1)

```json
{
  "traceVersion": "1",
  "actionId": "string — uuid v4 or deterministic slug (e.g. check_everything_20260619T142300Z)",
  "timestamp": "string — ISO 8601 UTC (e.g. 2026-06-19T14:23:00.000Z)",

  "source": "telegram | bridge | cli | fixture",
  "userText": "string — original message text (never substituted, never redacted)",
  "intent": "string — classified intent slug (e.g. check_everything, health_emergency, greeting)",
  "risk": "safe_read | dry_run | health_sensitive | requires_approval | blocked",

  "allowed": "boolean — true only if capability registry returned allowed=true",
  "allowedReason": "string or null — e.g. 'safe_read capability' or null if allowed=true",
  "blockedReason": "string or null — populated when allowed=false",

  "dryRun": "boolean — true if --dry-run flag was set OR execution was skipped",
  "executed": "boolean — true only if bridge actually ran the action sequence",

  "capabilityId": "string or null — the capability registry ID that was checked",
  "endpoint": "string or null — e.g. '/api/chat', '/api/sequence', null if not reached",
  "sequence": "array of strings or null — planned action sequence (e.g. ['git_status', 'validate_app'])",

  "resultSummary": "string — human-readable one-line summary of result or reason for no result",
  "bridgeResult": "object or null — raw bridge response (sanitized, no secrets, no health data)",

  "healthSensitive": "boolean — true if risk === 'health_sensitive'",
  "sendStatus": "not_requested | blocked | dry_run | sent",
  "sendBlockedReason": "string or null — reason send was blocked (e.g. 'health-sensitive commands never send replies')",

  "safetyNotes": "array of strings — any safety decisions made during this trace",
  "auditPath": "string — path to audit log file (e.g. CHINTU_OUTBOX/telegram_connector_audit.jsonl)",

  "secretsPresent": false,
  "healthDataPresent": false
}
```

---

## Field-by-Field Rules

### `traceVersion`
Always `"1"` in Stage 33. Increment only with breaking schema changes.

### `actionId`
Must be unique per execution. Use `crypto.randomUUID()` if available, otherwise
`intent + '_' + new Date().toISOString().replace(/[:.]/g, '')`.

### `timestamp`
UTC ISO 8601 — always `new Date().toISOString()`. Never local time.

### `source`
- `telegram` — came from getUpdates polling
- `bridge` — came from HTTP call to 127.0.0.1:18791
- `cli` — came from direct node script invocation
- `fixture` — came from a test fixture file

### `userText`
The raw message text. Never truncated. Never substituted. Never redacted.
This is what the user typed — it is NOT the classified intent, it is the verbatim input.

### `risk`
Must match exactly one of the 5 allowed values. Derived from brain router output:
- `safe_read` — read-only, no side effects
- `dry_run` — may simulate effects, no real side effects
- `health_sensitive` — contains health emergency signals → **always blocks execution and send**
- `requires_approval` — needs explicit founder approval
- `blocked` — permanently disallowed in this stage

### `allowed` / `blockedReason`
`allowed: false` must always be accompanied by a non-empty `blockedReason`.
`allowed: true` must always have `blockedReason: null`.

### `dryRun` vs `executed`
These are independent:
- `dryRun: true, executed: false` → skipped by design (--dry-run flag, risk gate, or health block)
- `dryRun: true, executed: true` → dry-run that still called the bridge (bridge also ran in dry-run mode)
- `dryRun: false, executed: true` → real execution
- `dryRun: false, executed: false` → blocked before bridge reached

### `sendStatus`
- `not_requested` → `--send` flag was not passed (most common)
- `blocked` → `--send` was requested but blocked (health-sensitive or SEND_ENABLED=0)
- `dry_run` → send was simulated only
- `sent` → message was actually sent (requires SEND_ENABLED=1 AND explicit approval)

### `secretsPresent` / `healthDataPresent`
Always `false` in trace output. If any action would set these to `true`, the action
is blocked before a trace is written. The trace is the clean record — secrets and
health data never enter it.

---

## Example Traces

### 1. Normal dry-run — check everything

```json
{
  "traceVersion": "1",
  "actionId": "check_everything_20260619T142300Z",
  "timestamp": "2026-06-19T14:23:00.000Z",
  "source": "telegram",
  "userText": "check everything",
  "intent": "check_everything",
  "risk": "dry_run",
  "allowed": true,
  "allowedReason": "dry_run capability",
  "blockedReason": null,
  "dryRun": true,
  "executed": false,
  "capabilityId": "chintu.checkEverything",
  "endpoint": null,
  "sequence": ["git_status", "validate_app", "connector_readiness", "release_guard"],
  "resultSummary": "Dry-run: sequence planned, bridge not reached",
  "bridgeResult": null,
  "healthSensitive": false,
  "sendStatus": "not_requested",
  "sendBlockedReason": null,
  "safetyNotes": ["dry_run flag active — no bridge execution"],
  "auditPath": "CHINTU_OUTBOX/telegram_connector_audit.jsonl",
  "secretsPresent": false,
  "healthDataPresent": false
}
```

### 2. Health-sensitive — chest pain

```json
{
  "traceVersion": "1",
  "actionId": "health_emergency_20260619T142310Z",
  "timestamp": "2026-06-19T14:23:10.000Z",
  "source": "telegram",
  "userText": "I have chest pain",
  "intent": "health_emergency",
  "risk": "health_sensitive",
  "allowed": false,
  "allowedReason": null,
  "blockedReason": "Health-sensitive commands never trigger local automation.",
  "dryRun": true,
  "executed": false,
  "capabilityId": "chintu.healthEmergencyAction",
  "endpoint": null,
  "sequence": null,
  "resultSummary": "Blocked: health emergency — urgent care redirect only",
  "bridgeResult": null,
  "healthSensitive": true,
  "sendStatus": "blocked",
  "sendBlockedReason": "health-sensitive commands never send replies via Chintu automation",
  "safetyNotes": [
    "health_sensitive risk detected",
    "bridge execution blocked",
    "send blocked",
    "urgent care language returned to caller for display only"
  ],
  "auditPath": "CHINTU_OUTBOX/telegram_connector_audit.jsonl",
  "secretsPresent": false,
  "healthDataPresent": false
}
```

### 3. Bridge execution — check everything with --execute-local

```json
{
  "traceVersion": "1",
  "actionId": "check_everything_20260619T142320Z",
  "timestamp": "2026-06-19T14:23:20.000Z",
  "source": "telegram",
  "userText": "check everything",
  "intent": "check_everything",
  "risk": "dry_run",
  "allowed": true,
  "allowedReason": "dry_run capability",
  "blockedReason": null,
  "dryRun": true,
  "executed": true,
  "capabilityId": "chintu.checkEverything",
  "endpoint": "/api/chat",
  "sequence": ["git_status", "validate_app", "connector_readiness", "release_guard"],
  "resultSummary": "Bridge executed check_everything: 4 actions, all passed",
  "bridgeResult": {
    "ok": true,
    "port": 18791,
    "resultsCount": 4
  },
  "healthSensitive": false,
  "sendStatus": "not_requested",
  "sendBlockedReason": null,
  "safetyNotes": ["dry_run flag active — bridge ran in dry-run mode"],
  "auditPath": "CHINTU_OUTBOX/telegram_connector_audit.jsonl",
  "secretsPresent": false,
  "healthDataPresent": false
}
```

---

## What the Trace Must NEVER Contain

| Field | Why forbidden |
|-------|--------------|
| `TELEGRAM_BOT_TOKEN` | Security — never log tokens |
| Any token substring | Security |
| Live user health data | Privacy + medical safety |
| Diagnosis, treatment, prediction text | Medical safety |
| `git push` result | Requires approval; trace logged before, not inside execution |
| External IP or host (non-localhost) | Privacy + security |
| User password or secret | Security |

---

## Audit Log Format

Each trace object is written as one JSONL line to:
```
CHINTU_OUTBOX/telegram_connector_audit.jsonl
```

This file is gitignored (confirmed in `.gitignore`).

Write format:
```javascript
const fs = require('fs');
fs.appendFileSync(auditPath, JSON.stringify(trace) + '\n', 'utf8');
```

---

## Stage 34 Extension Points

In Stage 34, the trace will gain:
- `approvalId` — links to `CHINTU_OUTBOX/pending_approvals.jsonl`
- `approvedAt` — ISO timestamp when founder approved
- `approvedByPhrase` — the exact phrase typed to approve
- `rollbackAvailable` — boolean for reversible actions
