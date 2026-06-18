# Chintu Agent Power Roadmap

**Stage:** 19 — Connector Power Layer  
**Purpose:** Define how Chintu's agent system evolves from local orchestration to connector-powered real-world actions.

---

## 1. Current Agent Architecture

Chintu operates as a parent operator dispatching work to specialist agents via packets.

### Working Components

| Component | Status | Script/Location |
|---|---|---|
| Heartbeat loop | Active | `scripts/chintu-heartbeat.ps1` |
| Operator console | Active | `scripts/chintu-operator-console.ps1` |
| Action planner | Active | `scripts/chintu-action-planner.ps1` |
| Approval center | Active | `scripts/chintu-approval-center.ps1` |
| Approval audit | Active | `scripts/chintu-approval-audit.ps1` |
| Agent board | Active | `scripts/chintu-agent-board.ps1` |
| Agent packets | Active | `CHINTU_AGENT_PACKETS/*.packet.md` |
| BALA behavior journal | Active | Local only |
| Connector send (gated) | Active (dry-run) | `scripts/chintu-connector-send.js` |
| Bridge reports | Active | Markdown files |
| Founder message | Active | `CHINTU_FOUNDER_MESSAGE.md` |

### Specialist Agents

| Agent | Packet | Capability |
|---|---|---|
| Research | `research-agent.packet.md` | Read docs, investigate, report |
| Builder | `builder-agent.packet.md` | Write code within scope, stop before push |
| Validator | `validator-agent.packet.md` | Run tests, check safety |
| BALA UX | `bala-ux-agent.packet.md` | Polish BALA interface, enforce disclaimers |
| Connector Safety | `connector-safety-agent.packet.md` | Audit connector code, verify no accidental sends |

---

## 2. Power Roadmap Phases

### Phase 1: Connector CLI Hardening (Current)

**Goal:** Make `chintu-connector-send.js` a complete connector management CLI.

| Task | Status | Details |
|---|---|---|
| `--check` (readiness JSON) | Done | Writes `latest_connector_readiness.json` |
| `--preview` (preview JSON) | Done | Writes `latest_connector_preview.json` |
| `--send` (gated send) | Done | All seven gates enforced |
| `--discover` (list connectors) | Planned | Print all connectors with current stage |
| `--status` (human-readable table) | Planned | Write to `latest_connector_status.txt` |
| `--validate-env` (env var check) | Planned | Structural validation of tokens/URLs |
| Audit logging for previews | Planned | `preview_generated` event in audit JSONL |

### Phase 2: First Real External Send (Telegram)

**Goal:** Founder activates Telegram and Chintu sends its first real message.

| Step | Owner | Action |
|---|---|---|
| Create Telegram bot | Founder | @BotFather → `/newbot` |
| Get chat ID | Founder | Send message to bot → `getUpdates` |
| Set env vars | Founder | `CHINTU_TG_BOT_TOKEN`, `CHINTU_TG_CHAT_ID`, etc. |
| Run `--check` | Agent/Founder | Verify readiness shows "ready" |
| Run `--preview` | Agent | Generate preview JSON |
| Review preview | Founder | Inspect message content |
| Set `CHINTU_CONNECTOR_MODE=active` | Founder | Enable active mode |
| Run `--send` with approval phrase | Founder | First real Telegram message |
| Verify in Telegram | Founder | Message appears in chat |
| Check audit log | Agent/Founder | Verify sent record logged |

### Phase 3: Multi-Connector Expansion

**Goal:** Activate Discord and Slack alongside Telegram.

| Task | Details |
|---|---|
| Discord webhook activation | Founder creates webhook, sets env vars, same ladder |
| Slack webhook activation | Founder creates Slack app, sets env vars, same ladder |
| Connector selector | Chintu chooses connector based on message type (alerts → Telegram, reports → Discord, etc.) |
| Connector fallback | If primary connector fails, log failure, do not auto-fallback (founder decides) |
| Multi-connector preview | Preview shows which connector will be used and why |

### Phase 4: GitHub Self-Reporting

**Goal:** Chintu reports its own status to the GitHub repo.

| Task | Details |
|---|---|
| GitHub connector adapter | Shell out to `gh` CLI for issues, comments, releases |
| Self-status issues | Chintu creates issues summarizing connector status, test results |
| PR commenting | Chintu comments on PRs with validation results |
| Release notes | Chintu drafts release notes from recent commits |
| Safety gate | Same approval ladder — `CHINTU_GH_REPO` + `CHINTU_GH_ALLOWLIST` |

### Phase 5: Scheduled Reports via Connectors

**Goal:** Chintu sends daily/weekly bridge reports through active connectors.

| Task | Details |
|---|---|
| Scheduler integration | Use Claude Code `/schedule` or cron to trigger heartbeat + report + send |
| Daily bridge report | Automatically generate bridge report, preview, queue for send |
| Weekly summary | Aggregate week's reports into a summary message |
| Connector routing | Route daily reports to Telegram, weekly summaries to Discord/Slack |
| Quiet hours | Founder sets `CHINTU_QUIET_START` and `CHINTU_QUIET_END` env vars — no sends during quiet hours |

### Phase 6: Phone Push Notifications

**Goal:** Critical alerts reach founder's phone.

| Task | Details |
|---|---|
| ntfy.sh adapter | Simple HTTPS POST to ntfy.sh topic |
| Alert classification | Categorize alerts: critical (push), important (Telegram), informational (local only) |
| Priority mapping | ntfy.sh supports priority 1-5, map from Chintu alert levels |
| Rate limiting | Max N push notifications per hour to prevent spam |
| Founder phone setup | Install ntfy.sh app, subscribe to topic |

### Phase 7: Gmail Draft Integration

**Goal:** Chintu creates email drafts for founder review.

| Task | Details |
|---|---|
| OAuth2 credential setup | One-time browser flow for Gmail API consent |
| Draft adapter | Use Gmail API `users.drafts.create` |
| Draft-only mode | Chintu creates drafts, founder reviews and sends manually |
| Future: auto-send | Only after founder explicitly enables with additional approval gate |

---

## 3. Agent Board Evolution

### Current Agent Board

The agent board dispatches specialist agents via packets. Each agent has bounded scope, protected files, and stop conditions.

### Planned Agent Board Enhancements

| Enhancement | Purpose |
|---|---|
| **Connector status panel** | Agent board shows which connectors are active, paused, or errored |
| **Send queue panel** | Agent board shows pending previews awaiting approval |
| **Audit summary panel** | Agent board shows recent audit events (last 10 sends/blocks) |
| **Agent health panel** | Agent board shows which agents ran recently and their outcomes |
| **BALA safety panel** | Agent board confirms no health data has been sent externally |

### Operator Console Enhancements

| Enhancement | Purpose |
|---|---|
| **Connector status section** | HTML console shows connector stages as color-coded badges |
| **Quick pause button** | Console includes command to create global/per-connector pause file |
| **Audit viewer** | Console shows recent audit log entries |
| **Env var checklist** | Console shows which env vars are set (values hidden) without revealing secrets |

---

## 4. Safety Invariants (Never Relaxed)

These rules hold across all phases:

1. **Default mode is dry-run.** No connector sends without `CHINTU_CONNECTOR_MODE=active`.
2. **No secrets in repo.** All tokens, URLs, and credentials live in env vars only.
3. **No health data sent externally.** BALA data stays local unless founder explicitly enables and approves per-message.
4. **Founder owns push.** Agents stop before `git push`.
5. **Preview before send.** Every message is previewed and can be inspected before sending.
6. **Approval phrase required.** Active sends require the founder's approval phrase.
7. **Allowlist enforced.** Recipients must be on the allowlist for their connector.
8. **Audit trail.** Every connector event is logged to JSONL.
9. **Pause at any time.** Creating a pause file instantly blocks sends.
10. **No auto-fallback.** If a connector fails, Chintu logs the failure and stops. It does not try another connector without founder decision.

---

## 5. Success Metrics

| Milestone | Metric | Target |
|---|---|---|
| Phase 1 complete | CLI commands all working | `--discover`, `--status`, `--validate-env` pass |
| Phase 2 complete | First real Telegram message sent | Audit log shows `active_send` with HTTP 200 |
| Phase 3 complete | Three connectors active | Telegram + Discord + Slack all showing `active` in status |
| Phase 4 complete | GitHub self-reporting | At least one auto-created issue or PR comment |
| Phase 5 complete | Scheduled daily report | Daily bridge report sent via Telegram for 7 consecutive days |
| Phase 6 complete | Phone push working | ntfy.sh alert received on founder's phone |
| Phase 7 complete | Gmail drafts | Draft created in founder's Gmail inbox |
