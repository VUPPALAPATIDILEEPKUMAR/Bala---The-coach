# Chintu Stage 13 Progress

**Stage 13A status:** SHIPPED.
**Stage 13B status:** PARTIAL — visibility slice landed (item 4).
Remaining items (1, 2, 3, 5, 6) still open for Codex.
**Date:** 2026-06-18.

---

## What Stage 13A delivered

Action planner core. Chintu now reads the local truth and decides
what to do next, with explicit approval boundaries.

- `scripts/chintu-action-planner.ps1` — reads bridge + runtime + git
  + Stage 12 founder message, ranks candidate actions, writes four
  outputs.
- `CHINTU_ACTION_QUEUE.md` — top 5 next actions with id, why, risk,
  approval flag, files touched, validation, suggested commit subject,
  BALA-touched flag, connector-activation flag, category, command.
- `CHINTU_APPROVAL_CENTER.md` — one approval card per needs-approval
  action with "what will happen / what will NOT happen / rollback /
  exact approval phrase / exact next command".
- `CHINTU_NEXT_OPERATOR_PROMPT.md` — copy-paste-ready prompt for the
  highest-ranked safe-now action.
- `CHINTU_OUTBOX/latest_action_plan.json` — machine-readable mirror,
  written UTF-8 no-BOM, marked `_dry_run: true` and `_label: "DRY RUN ONLY"`.
- `scripts/chintu-action-planner.test.js` — integrity test: script
  has no network/send patterns; queue has parked listing; approval
  center has either an `approve <id>` phrase or an explicit
  "no approval needed" header; JSON has the dry-run + safety markers.

Wired into release guard, founder command map, generated-files map,
and `.gitignore` (all four outputs are gitignored).

---

## What Stage 13B should add (Codex continuation)

In priority order:

1. **Tracked snapshot of the queue.** A small generator that writes a
   stable, tracked Markdown summary of the latest action queue
   (timestamp removed) so the control-room HTML index can link to a
   stable file. Without this, the dashboard can only link to the
   gitignored generated artifact.

2. **Categoriser unit tests.** A separate test file that takes a
   small fixture set of `(git state, runtime status, bridge status)`
   inputs and asserts which action `id`s end up in the top 5. This
   guards the heuristic in `scripts/chintu-action-planner.ps1`.

3. **Approval audit log.** Append a tracked `CHINTU_APPROVAL_AUDIT.md`
   row every time the founder runs an `approve <id>` action by hand.
   Tracked, append-only, no auto-edits.

4. ~~**Control-room generator update.** Surface the action queue,
   approval center, and next-operator prompt under a new
   "Chintu Planner" section in
   `scripts/chintu-control-room-index.ps1`.~~ **DONE 2026-06-18** —
   "Chintu Planner" section added (action queue + approval center +
   next operator prompt + JSON mirror + generator + test).

5. **`CHINTU_OPEN_FIRST.md` polish.** Add a "Run the planner" section
   pointing at the new script.

6. **Survival handoff section.** Add a cycle-8 section to
   `CHINTU_CLAUDE_SURVIVAL_HANDOFF.md`.

Stage 13B should NOT:

- Edit any BALA app file.
- Activate any external connector.
- Add network egress.
- Bump the service worker.
- Push.

---

## Files changed/created in Stage 13A

| Path | Tracked? | Role |
|---|---|---|
| `scripts/chintu-action-planner.ps1` | yes | planner generator |
| `scripts/chintu-action-planner.test.js` | yes | integrity test |
| `scripts/chintu-release-guard.ps1` | yes (edited) | runs the new test |
| `CHINTU_FOUNDER_COMMAND_MAP.md` | yes (edited) | adds script + test rows |
| `CHINTU_GENERATED_FILES_MAP.md` | yes (edited) | adds 4 new generated entries |
| `.gitignore` | yes (edited) | covers 4 new generated outputs |
| `CHINTU_STAGE_13_PROGRESS.md` | yes | this file |
| `CHINTU_CLAUDE_TO_CODEX_HANDOFF.md` | yes | Codex handoff |
| `CHINTU_NEXT_CODEX_PROMPT.md` | yes | Codex prompt |
| `CHINTU_ACTION_QUEUE.md` | no (gitignored) | generated each run |
| `CHINTU_APPROVAL_CENTER.md` | no (gitignored) | generated each run |
| `CHINTU_NEXT_OPERATOR_PROMPT.md` | no (gitignored) | generated each run |
| `CHINTU_OUTBOX/latest_action_plan.json` | no (gitignored) | generated each run |

---

## Validation already run

- `scripts/chintu-action-planner.ps1` — produces all four outputs.
- `scripts/chintu-action-planner.test.js` — PASS.
- `scripts/chintu-dry-run-adapter.test.js` — PASS.
- `scripts/chintu-connector-policy.test.js` — PASS.
- `scripts/chintu-outbox-shape.test.js` — PASS.
- `scripts/chintu-medical-claims.test.js` — PASS (86 files).
- `scripts/chintu-no-network-egress.test.js` — PASS (23 scripts).
- `scripts/chintu-doc-link-integrity.test.js` — PASS (63 docs, 65 links).
- `scripts/chintu-generated-files-map.test.js` — PASS (22 gitignored + 4 tracked).
- `scripts/chintu-command-map.test.js` — PASS (46 references, 23 shipped).
- `scripts/chintu-safety-boundary.test.js` — PASS (7 protected files).
- `scripts/chintu-release-guard.ps1` — verdict: PASS.

## Validation still recommended after Stage 13B lands

- Full sweep: `scripts/chintu-master-launcher.ps1`.
- Reality check: `scripts/chintu-bridge-loop-reality-check.ps1` (expected GREEN).

---

## BALA safety footer

BALA is a health-awareness companion. It does not diagnose, treat,
predict, prevent, replace doctors, or provide emergency monitoring.
