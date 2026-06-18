# Chintu Connectors - Registry

**Status:** planning + dry-run. **No connector in this repo sends
externally.**

A connector is any channel Chintu could one day deliver a founder
message through. This file is the registry. For each connector we
track status, requirements, safety gates, what Chintu may send, and
what Chintu must never send.

Activation of any connector is a separate, explicit founder decision.
The safety gates here are the contract. Stage 16 adds a real-ready
env-var activation scaffold in `scripts/chintu-connector-send.js`,
but activation stays OFF by default.

---

## Status legend

| Status | Meaning |
|---|---|
| `parked` | No code, no scaffolding. Awaiting a founder decision. |
| `dry-run` | Adapter exists and writes a local preview file. Never sends. |
| `ready` | Adapter is sending-capable but disabled by default. Awaiting env vars + allowlist + approval phrase + explicit founder flip. |
| `active` | Founder has explicitly enabled real sending. Logged. |

No connector is `active` in this repo today. The highest effective
status anywhere below is `dry-run`.

---

## Connectors

### Local file outbox

- **Status:** `dry-run` (effectively the active local channel)
- **Where:** `CHINTU_OUTBOX/`
- **What:** `latest_founder_message.md`, `founder_message_history.md`,
  `dry_run_payloads/*.json`, `latest_connector_readiness.json`.
- **Sends externally?** No. Files only.
- **Safety gates:** none required - it is just files on disk.
- **May contain:** Chintu OS status, branch, commit, next action.
- **Must never contain:** BALA user data, health metrics, medical
  content, secrets, tokens.

### Local desktop dashboard

- **Status:** `dry-run` (rendered as static HTML; no live read)
- **Where:** `CHINTU_CONTROL_ROOM_INDEX.html`,
  `CHINTU_AGENT_DASHBOARD.html`, `CHINTU_OPERATOR_CONSOLE.html`.
- **Sends externally?** No.
- **Safety gates:** none required.

### Telegram

- **Status:** `dry-run` for previews, `ready` foundation present,
  `active` off by default
- **Readiness scaffold:** `scripts/chintu-connector-send.js`
- **Requirements before `active`:**
  `CHINTU_CONNECTOR_MODE=active`, exact approval phrase, allowlist
  match, preview file, token outside repo, no pause file.
- **May contain:** timestamp, branch, tree state, unpushed count, one
  short next-action sentence.
- **Must never contain:** BALA user data, any health metric, any
  medical content, secrets, paths under `CHINTU_MEMORY_VAULT/`,
  commit message bodies.

### Discord

- **Status:** `dry-run` for previews, `ready` foundation present,
  `active` off by default
- **Requirements before `active`:** same hard gates as Telegram, plus
  no mentions.
- **May contain:** same as Telegram.
- **Must never contain:** same prohibitions as Telegram, plus no `@`
  mentions of any user.

### Slack

- **Status:** `dry-run` for previews, `ready` foundation present,
  `active` off by default
- **Requirements before `active`:** same hard gates as Telegram.
- **May contain:** same as Telegram.
- **Must never contain:** same prohibitions as Telegram.

### Gmail / email

- **Status:** `parked` for real sends, architecture-only for Stage 16
- **Reason:** auth is heavier, so this stage only documents the env
  model and local preview path.
- **Must never contain:** BALA user data, health metrics, medical
  content, attachments.

### GitHub (status / comments)

- **Status:** `parked`
- **Where would `gh` live:** founder's local `gh` CLI; no token in
  repo.
- **May contain:** commit hash, branch, public-safe summary.
- **Must never contain:** BALA user data, internal vault paths.

### Phone notification layer

- **Status:** `parked indefinitely`. See
  [CHINTU_PHONE_LAYER_RESEARCH_PARKED.md](CHINTU_PHONE_LAYER_RESEARCH_PARKED.md).

---

## How a connector moves up the ladder

```
parked  ->  dry-run  ->  ready  ->  active
            |            |          |
   preview files    env vars +    founder
   only             allowlist +   flips local
                    approval      mode on
```

Every step is an explicit founder decision.

---

## What this registry will never claim

- That a connector is `ready` when it is not.
- That a connector is `active` when it is not.
- That secrets are stored in the repo.
- That any connector may carry BALA user data, health metrics, or
  medical content.

---

## BALA safety footer

BALA is a health-awareness companion. It does not diagnose, treat,
predict, prevent, replace doctors, or provide emergency monitoring.
