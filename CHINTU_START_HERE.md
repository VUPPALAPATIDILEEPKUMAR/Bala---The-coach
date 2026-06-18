# Chintu — Start Here

**Sharper version:** open [CHINTU_OPEN_FIRST.md](CHINTU_OPEN_FIRST.md).
It is the single-page orientation. This file is the longer reference.

Chintu OS is the **local-first operator layer** around your product work.
BALA Your Coach is a **separate** mobile-first health-awareness app.
They share a repo but are kept apart by design.

---

## The one-command path (recommended)

```powershell
powershell -ExecutionPolicy Bypass -File scripts\chintu-master-launcher.ps1
```

Runs every safety test, the validator, the release guard, regenerates
the dashboards. Stops on the first FAIL. Use this unless you have a
specific reason to step through manually.

---

## The four-command morning loop (fallback)

If you want to step through manually, run these in order. Each is
read-only and safe.

| # | Command | Why |
|---|---|---|
| 1 | `powershell -ExecutionPolicy Bypass -File scripts\chintu-os-health-check.ps1` | One-shot status: repo, scripts, reports. |
| 2 | `powershell -ExecutionPolicy Bypass -File scripts\chintu-validate.ps1` | PASS / WARN / FAIL gate. |
| 3 | `powershell -ExecutionPolicy Bypass -File scripts\chintu-alive-briefing.ps1` | Plain-English snapshot of today. |
| 4 | `powershell -ExecutionPolicy Bypass -File scripts\chintu-next-action.ps1` | The next exact action to take. |

---

## When something is wrong

Open [CHINTU_WHEN_STUCK.md](CHINTU_WHEN_STUCK.md). It walks the most
common failure modes and points at the right script or doc for each.

---

## The full command surface

[CHINTU_FOUNDER_COMMAND_MAP.md](CHINTU_FOUNDER_COMMAND_MAP.md) is the
canonical list of every safe local command. If a command is not on
that map, treat it as parked.

---

## What lives where

- `scripts/chintu-*.ps1` — operator scripts (validation, reporting, dashboards)
- `scripts/chintu-*.test.js` — integrity tests (read-only)
- `CHINTU_*.md` — operator documentation
- `CHINTU_MEMORY_VAULT/` — durable founder context (decisions, blockers, parked systems)
- `CHINTU_IMAC_PACKAGES/` — packages prepared for the iMac side
- `app.js`, `index.html`, `sw.js`, `coach.js`, `manifest.webmanifest`, `privacy.html`, `functions/api/coach.js` — **protected BALA app files. Never edited by the operator layer.**

For the full inventory of what is generated vs. checked in by hand, see
[CHINTU_ARTIFACT_POLICY.md](CHINTU_ARTIFACT_POLICY.md).

---

## What the operator layer will never do

- Push to remote
- Edit BALA app files
- Talk to the network
- Touch Telegram / Discord / webhooks / cloud sync
- Send health data anywhere
- Make medical claims

If you ever see a Chintu script asking for a secret, asking to install
something, or trying to reach an external URL — stop and treat that as
a failure.

---

## BALA safety footer

BALA is a health-awareness companion. It does not diagnose, treat,
predict, prevent, replace doctors, or provide emergency monitoring.
