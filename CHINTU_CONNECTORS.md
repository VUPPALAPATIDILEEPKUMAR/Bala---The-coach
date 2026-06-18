# Chintu Connectors — Registry

**Status:** planning + dry-run. **No connector in this repo sends
externally.**

A connector is any channel Chintu *could* one day deliver a founder
message through. This file is the registry. For each connector we
track status, requirements, safety gates, what Chintu may send, and
what Chintu must never send.

Activation of any connector is a separate, explicit founder decision.
The safety gates here are the contract.

---

## Status legend

| Status | Meaning |
|---|---|
| `parked` | No code, no scaffolding. Awaiting a founder decision. |
| `dry-run` | Adapter exists and writes a local preview file. Never sends. |
| `ready` | Adapter is sending-capable but disabled by default. Awaiting allowlist + token + explicit founder flip. |
| `active` | Founder has explicitly enabled real sending. Logged. |

No connector is `ready` or `active` in this repo today. The highest
status anywhere below is `dry-run`.

---

## Connectors

### Local file outbox

- **Status:** `dry-run` (effectively the active local channel)
- **Where:** `CHINTU_OUTBOX/`
- **What:** `latest_founder_message.md`, `founder_message_history.md`,
  `dry_run_payloads/*.json`.
- **Sends externally?** No. Files only.
- **Safety gates:** none required — it is just files on disk.
- **May contain:** Chintu OS status, branch, commit, next action.
- **Must never contain:** BALA user data, health metrics, medical
  content, secrets, tokens.

### Local desktop dashboard

- **Status:** `dry-run` (rendered as static HTML; no live read)
- **Where:** `CHINTU_CONTROL_ROOM_INDEX.html`, `CHINTU_AGENT_DASHBOARD.html`.
- **Sends externally?** No.
- **Safety gates:** none required.

### Telegram

- **Status:** `parked`
- **Reason parked:** see [CHINTU_TELEGRAM_STATUS_PLAN.md](CHINTU_TELEGRAM_STATUS_PLAN.md).
- **Requirements before `dry-run`:** founder creates a dedicated
  Chintu-OS-only channel; the chat ID lives outside this repo.
- **Requirements before `ready`:** allowlist amendment in
  `chintu-no-network-egress.test.js`; one dedicated adapter script
  whose diff is reviewed; off-switch flag file documented.
- **Requirements before `active`:** founder flips the off-switch on
  in the local environment.
- **May contain:** timestamp, branch, tree state, unpushed count, one
  short next-action sentence.
- **Must never contain:** BALA user data, any health metric, any
  medical content, secrets, paths under `CHINTU_MEMORY_VAULT/`,
  commit message bodies.

### Slack

- **Status:** `parked`
- **Requirements before `dry-run`:** founder names a personal Slack
  workspace + channel; an incoming-webhook URL would be stored
  outside the repo.
- **Requirements before `ready`:** same gates as Telegram: allowlist,
  reviewed adapter, off-switch.
- **May contain:** same as Telegram.
- **Must never contain:** same prohibitions as Telegram.

### Discord

- **Status:** `parked`
- **Requirements before `dry-run`:** dedicated Chintu-OS-only server,
  channel ID outside the repo, no role mentions in messages.
- **Requirements before `ready`:** allowlist, reviewed adapter,
  off-switch.
- **May contain:** same as Telegram.
- **Must never contain:** same prohibitions as Telegram, plus no `@`
  mentions of any user.

### Gmail / email

- **Status:** `parked`
- **Reason parked:** SMTP secrets and provider lock-in are heavier
  than the value of "email me my own commit status."
- **Requirements before `dry-run`:** a local mail-stub that writes
  `.eml` files to `CHINTU_OUTBOX/dry_run_payloads/` instead of
  sending.
- **Requirements before `ready`:** founder names a dedicated
  recipient, app-password lives outside repo, off-switch flag file.
- **Must never contain:** BALA user data, health metrics, medical
  content, attachments.

### GitHub (status / comments)

- **Status:** `parked`
- **Where would `gh` live:** founder's local `gh` CLI; no token in
  repo.
- **Requirements before `dry-run`:** a local script that *prints* the
  `gh` command it *would* run, instead of running it.
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
   adapter writes    allowlist     founder
   preview only      + token in    flips
                     User env      flag
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
