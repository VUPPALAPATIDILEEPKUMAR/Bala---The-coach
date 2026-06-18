# Chintu Action Packet — Specification

**Stage:** 22
**Status:** active — spec approved. Script: scripts/chintu-action-packet.js
**Mode:** local-first, generate-only, no execution

---

## What Is an Action Packet?

An Action Packet is a structured JSON document that Chintu generates when a founder gives a broad command.

It turns a natural-language intent into a structured, safe, auditable work unit — ready for review, approval, and implementation.

**It prepares work. It does not execute work.**

---

## When Is a Packet Generated?

- When the founder types or speaks a command in Chintu Allegro
- When a quick action is clicked
- When the prompt engine generates output for a task
- When an agent dry-run result is reviewed

---

## Packet Schema

```json
{
  "id": "CA-<base36-timestamp>",
  "timestamp": "2026-06-18T21:30:00Z",
  "source": "chintu-allegro-ui | prompt-engine | agent-runner",
  "intent": "Build next BALA sprint",
  "understood": "Human-readable interpretation of the command",
  "track": "bala | chintu | both",
  "lane": "BALA Your Coach — Sprint Planning",
  "riskLevel": "low | medium | high",
  "connectorRequired": "none | telegram | github | local-fs",
  "approvalRequired": true,
  "approvalPhrase": "approve <packet-id>",
  "filesLikelyInvolved": [
    "BALA_NEXT_SAFE_SPRINT_PLAN.md",
    "app.js"
  ],
  "suggestedAgents": [
    "validator-agent",
    "medical-claims-checker"
  ],
  "validationCommands": [
    "node --check app.js",
    "node scripts\\chintu-medical-claims.test.js"
  ],
  "generatedPrompt": "The full XML/COSTAR/ACR prompt for Claude or Codex",
  "safetyGates": [
    "No medical diagnosis copy",
    "Health data stays local"
  ],
  "parkedItems": [
    "Live wearable API integration",
    "Cloud sync"
  ],
  "nextHumanAction": "Copy the prompt → paste into Claude → review and return with approved plan",
  "auditLog": []
}
```

---

## Risk Level Definitions

| Level | Meaning | Examples |
|---|---|---|
| `low` | Read-only, generate-only, or local changes | Sprint planning, prompt generation, dry runs |
| `medium` | External send possible, or significant file changes | Telegram test, first connector activation |
| `high` | Irreversible external action, health data involved | Live send with health data (never allowed without multi-gate) |

---

## Approval Gate Rules

- `approvalRequired: false` — packet can proceed immediately after review
- `approvalRequired: true` — founder must say the `approvalPhrase` explicitly before any live action
- High-risk packets always require approval
- Approval phrase format: `approve <packet-id>` spoken or typed to Chintu Allegro
- Approval is logged in `auditLog` array

---

## What a Packet Can Do

✅ Document the founder's intent  
✅ Show the plan and files  
✅ Generate a ready-to-paste prompt  
✅ List safe validation commands  
✅ Preview connector actions (dry-run shape)  
✅ Be exported to JSON for audit  
✅ Be passed to an agent as input context  

## What a Packet Cannot Do

❌ Execute shell commands from browser  
❌ Send external messages without approval phrase  
❌ Commit or push to git  
❌ Transfer BALA health data externally  
❌ Print secrets or tokens  
❌ Override safety gates  

---

## Local Script: scripts/chintu-action-packet.js

The script generates and validates action packets locally.

### Usage

```bash
# Generate a packet from a command string
node scripts\chintu-action-packet.js --command "Build next BALA sprint"

# Generate a packet from a template
node scripts\chintu-action-packet.js --template bala-sprint

# Validate an existing packet file
node scripts\chintu-action-packet.js --validate chintu-action-packet-1234.json

# Export packet to local outbox (for agent runner input)
node scripts\chintu-action-packet.js --export chintu-action-packet-1234.json
```

### Available templates

| Template key | Track | Description |
|---|---|---|
| `bala-sprint` | BALA | Next sprint planning packet |
| `claude-prompt` | Chintu | Claude XML prompt generator |
| `codex-prompt` | Chintu | Codex implementation prompt |
| `validator-dry-run` | Chintu | Validator agent dry run |
| `connector-readiness` | Chintu | Full connector readiness check |
| `telegram-setup` | Chintu | Telegram first activation (medium risk) |
| `founder-brief` | Chintu | Daily founder status brief |
| `bala-scoring` | BALA | BALA score model review |
| `report-explainer` | BALA | Report metric explainer MVP plan |
| `language-lock` | BALA | Indian language lock MVP plan |
| `app-builder` | Both | App-builder prompt generation |

---

## Outbox Integration

Packets can be written to the local outbox for agent runner consumption:

```
CHINTU_OUTBOX/
  pending/
    CA-<id>.json   ← generated packets awaiting review
  approved/
    CA-<id>.json   ← founder-approved packets
  executed/
    CA-<id>.json   ← completed (with audit log)
  rejected/
    CA-<id>.json   ← declined or superseded
```

The agent runner reads from `CHINTU_OUTBOX/approved/` only.
Nothing runs from `pending/` without explicit move by founder.

---

## Audit Log Format

```json
"auditLog": [
  {
    "event": "generated",
    "timestamp": "2026-06-18T21:30:00Z",
    "source": "chintu-allegro-ui"
  },
  {
    "event": "reviewed",
    "timestamp": "2026-06-18T21:32:00Z",
    "actor": "founder"
  },
  {
    "event": "approved",
    "timestamp": "2026-06-18T21:33:00Z",
    "phrase": "approve CA-abc123"
  }
]
```

---

## Safety Invariants

1. `high` risk packets are never auto-approved.
2. Telegram and connector sends are always `approvalRequired: true`.
3. Health data fields are never included in packet by default.
4. Secrets and tokens are never included in any field.
5. `generatedPrompt` is copy-paste text only — not an executable instruction.
6. Packet export writes to local filesystem only — never to a network endpoint.
