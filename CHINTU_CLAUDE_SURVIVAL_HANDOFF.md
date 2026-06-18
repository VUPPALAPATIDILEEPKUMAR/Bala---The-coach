# Chintu Claude Survival Handoff

**Stage:** 11 (overnight builder cycle 3 — autonomous, self-expanding backlog)
**Date:** 2026-06-18
**Mode:** local-first, founder-driven, push-pending-human-approval

## 0. What cycle 3 added (read first)

Two self-generated safe backlogs were planned, built, validated, and
committed in this run. No push. No protected BALA file edits.

Cycle 3 commits (newest first):

```
29445a2 chore: add Chintu doc-link integrity test and handoff/bridge docs
ef0fa22 docs: add Chintu start-here, when-stuck, artifact-policy
bd34e4d chore: add Chintu safety integrity tests (egress, claims, boundary)
```

New scripts (all read-only, all wired into release guard + launcher):

- `scripts/chintu-no-network-egress.test.js`
- `scripts/chintu-medical-claims.test.js`
- `scripts/chintu-safety-boundary.test.js`
- `scripts/chintu-doc-link-integrity.test.js`

New operator docs:

- `CHINTU_START_HERE.md` — single founder entry point
- `CHINTU_WHEN_STUCK.md` — troubleshooting playbook
- `CHINTU_ARTIFACT_POLICY.md` — generated vs. source map
- `CHINTU_NEXT_THREAD_STARTER.md` — cold-start prompt for a fresh thread
- `CHINTU_IMAC_BRIDGE_TROUBLESHOOTING.md` — Option 11/12 failure modes
- `CHINTU_BRIDGE_ROLLBACK.md` — clean revert for both sides of the bridge

`CHINTU_FOUNDER_COMMAND_MAP.md` was updated to list every new test.

Validation: each new test was run individually and PASSED. The full
master-launcher sweep was not re-run after the final commit — the next
thread should run it as the first thing it does (see §3).

If the next thread wants to keep going, the angles in the master prompt
that have NOT been heavily used yet are: Control Room UX (Angle C),
Future architecture parked (Angle H), BALA safe planning (Angle F),
Repo hygiene generated-files-map (Angle G).

This document is the cold-start brief for any future Claude/Codex session
that picks up Chintu OS work. Read it end-to-end before any tool call.

## 1. What this repo is

`C:\Users\Chintu\Desktop\test` is the founder's local Chintu OS + BALA PWA
workspace. BALA is a local-first health-awareness PWA. Chintu OS is the
operator layer of scripts, validators, dashboards, and memory vault that
keeps BALA shippable and safe.

## 2. Hard safety rules — do not violate

Protected BALA app files. **Never edit** in builder mode:

- `app.js`
- `index.html`
- `styles.css`
- `sw.js`
- `coach.js`
- `manifest.webmanifest`
- `privacy.html`
- `functions/api/coach.js`

**Never activate**: Telegram, Discord, webhooks, cloud sync, phone
notifications, voice calling, voice cloning, backend, paid APIs, external
automation, health-data transfer, network egress, memory-wiki.

**Never** bump the service worker `CACHE_NAME`, commit secrets, or push.
Push is a founder-only act.

BALA must stay local-first and non-medical. Mandatory footer whenever
BALA is mentioned:

> BALA is a health-awareness companion. It does not diagnose, treat,
> predict, prevent, replace doctors, or provide emergency monitoring.

## 3. How to orient in under 60 seconds

Run these in order. They are all read-only.

```powershell
powershell -ExecutionPolicy Bypass -File scripts\chintu-master-launcher.ps1 -SkipReports
powershell -ExecutionPolicy Bypass -File scripts\chintu-alive-briefing.ps1
powershell -ExecutionPolicy Bypass -File scripts\chintu-next-action.ps1
```

Then read, in order:

1. `CHINTU_FOUNDER_COMMAND_MAP.md` — every safe command, single source.
2. `CHINTU_HANDOFF.md` — founder-facing handoff.
3. `CHINTU_OPERATOR_STATUS.md` — current operator status.
4. `CHINTU_MEMORY_VAULT/README.md` and the rest of the vault.
5. `CHINTU_AGENT_CONTROL_SHELL.md` — shell contract for agents.
6. `docs/BALA_SECURITY_RULES.md` — BALA copy / safety rules.
7. `CHINTU_STAGE_11_QUEUE.md` — current stage queue.

## 4. What "safe slice" means

A safe slice is a change that satisfies every one of these:

- Touches only scripts, docs, memory vault, control-room generators, or
  the static dashboards they produce.
- Does **not** touch any protected BALA file.
- Does **not** bump `CACHE_NAME` in `sw.js`.
- Does **not** introduce a `fetch(`, `XMLHttpRequest`, `sendBeacon`,
  webhook, `POST`, or any other outbound app-data path.
- Does **not** introduce secrets or `.env` references.
- Does **not** activate parked systems (`CHINTU_MEMORY_VAULT/PARKED_SYSTEMS.md`).
- Passes `scripts\chintu-master-launcher.ps1` end to end.

## 5. The single validation gate

After any meaningful change, run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\chintu-master-launcher.ps1
```

It runs syntax checks, the command-map integrity test, the memory-vault
integrity test, the snapshot consistency test, the agent-control-shell
contract test, the validator, the release guard, the OS health check,
the alive briefing, the control-room index regen, and the agent
dashboard regen. It halts on the first fatal step.

If `chintu-master-launcher.ps1` is green, you are clear to commit. If
red, fix the failing step before any further work.

## 6. Commit etiquette

- One safe slice per commit.
- Subject prefix `chore:` for Chintu OS infra; `docs:` for docs-only;
  reserve `feat:` / `fix:` for BALA work the founder explicitly asked for.
- Always include the BALA safety footer in the commit body if BALA is
  mentioned.
- Never push. Push is the founder's call.

## 7. The architecture queue

These slices are the parked or in-flight builder lanes. Pick the
highest-priority unblocked slice and ship it as a safe commit.

- **SLICE A — Control Room UX hardening**: improve the static HTML
  generators (index, dashboard). Surface new scripts and docs.
- **SLICE B — Master launcher layer**: `scripts\chintu-master-launcher.ps1`
  is the spine. Add new safe steps here when you add new validation.
- **SLICE C — Test coverage hardening**: prefer adding a `chintu-*.test.js`
  for any new architecture file. Wire the test into the master launcher.
- **SLICE D — Founder command map**: `CHINTU_FOUNDER_COMMAND_MAP.md` is
  the single canonical command list. Update it when you add or remove a
  script. The command-map integrity test enforces this.
- **SLICE E — iMac continuation lane**: `CHINTU_IMAC_PACKAGES/` is the
  cross-machine relay; treat as docs-only until founder reactivates.
- **SLICE F — BALA safe product lane**: planning docs only
  (`BALA_NEXT_SAFE_SPRINT_PLAN.md`, `BALA_SAFE_TOUCHPOINTS.md`). No app
  edits without explicit founder approval.
- **SLICE G — Claude/Codex resilience**: this file. Keep it current.
- **SLICE H — Memory vault cleanup**: vault is now indexed by README
  and guarded by `chintu-memory-vault.test.js`. Add new vault files via
  the README contents table.

## 8. What requires founder approval (do NOT do unprompted)

- `git push`
- Any edit to protected BALA files
- Service worker bump
- Telegram, Discord, webhooks, cloud sync, phone notifications, voice
- Any external network call
- Any health-data transfer
- Any change to `PARKED_SYSTEMS.md` activation status
- Any change to `BALA_MEDICAL_SAFETY_RULES.md` rules
- Any new dependency, paid API, or secret

## 9. When to stop

Stop the builder cycle when any of these is true:

1. Usage is low. Save state cleanly and write this handoff updated.
2. Validation fails and cannot be safely fixed.
3. You hit a safety boundary (any item in §2 or §8).
4. No safe scripts/docs/control-room work remains.
5. The founder must approve push, secrets, external automation, cloud
   sync, health-data transfer, or BALA app behavior changes.

## 10. Final reminder

BALA is a health-awareness companion. It does not diagnose, treat,
predict, prevent, replace doctors, or provide emergency monitoring.
