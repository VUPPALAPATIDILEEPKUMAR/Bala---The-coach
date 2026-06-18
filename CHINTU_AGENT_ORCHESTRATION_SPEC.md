# Chintu Agent Orchestration Spec

**Stage:** 18 planning  
**Purpose:** Define how Chintu operates as a parent agent orchestrating specialist agents with connector, validation, and approval gates.

---

## 1. Parent Operator Model

Chintu is the **parent operator**. It does not pretend to be multiple independent agents. It is one system that dispatches bounded work to specialist lanes, validates results, and gates all external actions through approval.

```
┌──────────────────────────────────────────┐
│            CHINTU (Parent Operator)       │
│                                          │
│  heartbeat → planner → approval center   │
│                                          │
│  ┌─────────┐ ┌─────────┐ ┌───────────┐  │
│  │Research │ │Builder  │ │Validator  │  │
│  │Agent    │ │Agent    │ │Agent      │  │
│  └─────────┘ └─────────┘ └───────────┘  │
│  ┌─────────┐ ┌───────────────────────┐   │
│  │BALA UX  │ │Connector Safety Agent│   │
│  │Agent    │ │                       │   │
│  └─────────┘ └───────────────────────┘   │
│                                          │
│  connector gates → approval gates → send │
└──────────────────────────────────────────┘
```

---

## 2. Specialist Agents

Each specialist agent is a **packet** — a bounded prompt with explicit scope, protected files, and stop conditions. Packets live in `CHINTU_AGENT_PACKETS/`.

| Agent | Packet File | Purpose |
|---|---|---|
| Research | `research-agent.packet.md` | Investigate questions, read docs, report findings |
| Builder | `builder-agent.packet.md` | Write code within scoped files, stop before push |
| Validator | `validator-agent.packet.md` | Run tests, check safety, report pass/fail |
| BALA UX | `bala-ux-agent.packet.md` | Polish BALA UI/copy, enforce safety disclaimers |
| Connector Safety | `connector-safety-agent.packet.md` | Audit connector code, verify no accidental sends |

### Packet Shape Requirements

Every packet must include:

- **mission** — one sentence, what the agent does
- **files to inspect** — explicit file list
- **protected files** — files the agent must not modify
- **allowed actions** — what the agent can do
- **forbidden actions** — what the agent must never do
- **validation commands** — tests to run before done
- **suggested commit name** — conventional commit message
- **stop condition** — when the agent stops and hands back
- **copy-paste prompt** — ready to paste into Codex or Claude

---

## 3. Agent Runner

The agent runner is the founder using Codex or Claude with a packet prompt. There is no autonomous agent scheduler.

### Run Flow

1. Founder runs `scripts/chintu-agent-board.ps1` to see the board.
2. Founder picks a packet and copies the prompt into Codex or Claude.
3. Agent (Codex/Claude) works within packet scope.
4. Agent runs validation commands from the packet.
5. Agent stops. Founder reviews output.
6. Founder commits if green. Founder owns push.

### Run Folders (future)

When agent orchestration matures, each run will produce artifacts in:

```
CHINTU_AGENT_RUNS/
  {agent}-{timestamp}/
    input.json        # packet snapshot + parameters
    output.md         # agent's work product
    validation.json   # test results
    audit.json        # what the agent did
```

Not yet implemented. The folder structure is reserved.

---

## 4. Validation Gates

Before any agent output is accepted:

| Gate | Check | Script |
|---|---|---|
| Syntax | `node --check app.js && node --check sw.js` | Node built-in |
| No network egress | Scan all scripts for fetch/http/webhook patterns | `scripts/chintu-no-network-egress.test.js` |
| No medical claims | Scan all files for diagnostic/treatment language | `scripts/chintu-medical-claims.test.js` |
| Doc link integrity | Verify all internal doc links resolve | `scripts/chintu-doc-link-integrity.test.js` |
| Agent board | Verify packet shapes | `scripts/chintu-agent-board.test.js` |
| Connector send | Verify dry-run default, no accidental sends | `scripts/chintu-connector-send.test.js` |
| Connector policy | Verify connector policies | `scripts/chintu-connector-policy.test.js` |
| Release guard | Full pre-push validation | `scripts/chintu-release-guard.ps1` |

---

## 5. Connector Gates

Before any connector send:

| Gate | Requirement | Checked by |
|---|---|---|
| Env vars present | All required env vars set | `connectorState()` in `chintu-connector-send.js` |
| Recipient allowlisted | Target in allowlist CSV | `connectorState()` |
| Mode is active | `CHINTU_CONNECTOR_MODE=active` | `attemptSend()` |
| Approval phrase matches | Founder's phrase matches env var | `attemptSend()` |
| No pause file | No global or per-connector pause | `connectorState()` |
| No health data | Body passes health-data pattern scan | `validateMessageBody()` |
| No medical claims | Body passes medical claims scan | `validateMessageBody()` |
| Preview exists | Preview JSON was generated and reviewed | `attemptSend()` |
| Connector is send-capable | Adapter mode is `send-capable` not `architecture-only` | `attemptSend()` |

---

## 6. Approval Gates

| Gate | Mechanism |
|---|---|
| Connector activation | Founder sets `CHINTU_CONNECTOR_MODE=active` |
| Individual send | Founder provides approval phrase via `--approval` flag |
| Push | Founder runs `git push` manually |
| Agent dispatch | Founder copies packet prompt manually |
| Pause/revoke | Founder creates pause file or clears env vars |

---

## 7. Audit Trail

| Event | Log Location | Format |
|---|---|---|
| Connector send (success) | `CHINTU_OUTBOX/connector_sent.log.jsonl` | JSON lines |
| Connector send (blocked) | `CHINTU_OUTBOX/connector_audit.log.jsonl` | JSON lines |
| Connector readiness check | `CHINTU_OUTBOX/latest_connector_readiness.json` | JSON |
| Connector preview | `CHINTU_OUTBOX/latest_connector_preview.json` | JSON |
| Heartbeat | `CHINTU_OUTBOX/latest_heartbeat.json` | JSON |
| Approval decisions | `CHINTU_APPROVAL_AUDIT.md` | Markdown table |

### Audit Record Fields

Every audit entry includes:
- `timestamp` — ISO 8601
- `event` — `blocked_send`, `active_send`, etc.
- `connector` — which connector
- `connector_mode` — `dry-run` or `active`
- `recipient` — target label
- `recipient_allowlisted` — boolean
- `approval_phrase_present` — boolean (never logs the phrase itself)
- `preview_sha256` — hash of the previewed body
- `outcome` — `blocked` or `sent`
- `reason` — why blocked, or HTTP status

---

## 8. No-Fake-Agent Rule

- Packets are planning prompts. They are not proof an agent executed.
- No script may claim an agent ran unless it actually ran.
- Agent board status reflects packet readiness, not execution history.
- No simulated agent outputs. No placeholder "agent said X" text.
- The founder is the only entity that dispatches agents (by pasting prompts).

---

## 9. Free Tool Strategy

| Tool | Cost | Status | Notes |
|---|---|---|---|
| Telegram Bot API | Free | Send-capable code exists | Bot creation is free via @BotFather |
| Discord Webhooks | Free | Send-capable code exists | Webhook creation is free in Discord server settings |
| Slack Incoming Webhooks | Free | Send-capable code exists | Requires workspace admin to enable |
| Gmail API | Free | Architecture-only | Requires OAuth2 setup, heavier lift |
| Local outbox/dashboard | Free | Active | Always available, no config needed |
| GitHub CLI (`gh`) | Free | Future | Already installed on most dev machines |
| ntfy.sh | Free | Future | Open-source push notifications |
| Node.js scripts | Free | Active | All Chintu automation runs on Node + PowerShell |

---

## 10. BALA Safety Integration

BALA data never flows through connectors by default:

- BALA Behavior Journal → local only
- BALA daily factors → local only
- BALA safe copy → reviewed locally, connector-safe copy stripped of health data
- Health data patterns → blocked at `validateMessageBody()` level
- Medical claims language → blocked at `validateMessageBody()` level

If the founder wants BALA-related messages sent through connectors, they must:

1. Create a new reviewed data-export path with its own approval gate.
2. Strip all health data patterns from the message body.
3. Include only awareness-level, non-clinical summaries.
4. Never include raw biometric values.
