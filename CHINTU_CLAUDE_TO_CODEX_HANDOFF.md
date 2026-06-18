# Chintu Claude → Codex Handoff (Stage 13)

**Reason for handoff:** usage guard. Claude built and committed Stage
13A cleanly. Stage 13B follow-ups are scoped here for Codex.

**Date:** 2026-06-18.

---

## Repo state at handoff

- **Branch:** `main`
- **Latest commit (about to land):** `chore: add Chintu action planner core` (Stage 13A)
- **Last pushed commit:** `e870608` (origin/main)
- **Working tree:** clean after the Stage 13A commit.
- **Unpushed commits since e870608:** every cycle 5–7 + 12 + 13A commit. Founder pushes by hand.

---

## What Codex should do first (in order)

1. **Inspect, do not rebuild.**
   ```bash
   git status --short
   git log --oneline -10
   ls scripts/chintu-action-*
   ```
2. **Run the planner to see its outputs.**
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\chintu-action-planner.ps1
   ```
   Open `CHINTU_ACTION_QUEUE.md`, `CHINTU_APPROVAL_CENTER.md`,
   `CHINTU_NEXT_OPERATOR_PROMPT.md`. Confirm they read true.
3. **Run the integrity test.**
   ```bash
   node scripts/chintu-action-planner.test.js
   ```
4. **Read [CHINTU_STAGE_13_PROGRESS.md](CHINTU_STAGE_13_PROGRESS.md).** It lists Stage 13B work items in priority order.

---

## Files Claude created/changed in Stage 13A

Created (tracked):

- `scripts/chintu-action-planner.ps1`
- `scripts/chintu-action-planner.test.js`
- `CHINTU_STAGE_13_PROGRESS.md`
- `CHINTU_CLAUDE_TO_CODEX_HANDOFF.md` (this file)
- `CHINTU_NEXT_CODEX_PROMPT.md`

Edited (tracked):

- `scripts/chintu-release-guard.ps1` — wires the new test in.
- `CHINTU_FOUNDER_COMMAND_MAP.md` — adds planner script + test rows.
- `CHINTU_GENERATED_FILES_MAP.md` — adds 4 new generated entries.
- `.gitignore` — covers 4 new generated outputs.

Created (gitignored, regenerated each run):

- `CHINTU_ACTION_QUEUE.md`
- `CHINTU_APPROVAL_CENTER.md`
- `CHINTU_NEXT_OPERATOR_PROMPT.md`
- `CHINTU_OUTBOX/latest_action_plan.json`

---

## Validation Claude already ran (all PASS)

- `chintu-action-planner.test.js`
- `chintu-dry-run-adapter.test.js`
- `chintu-connector-policy.test.js`
- `chintu-outbox-shape.test.js`
- `chintu-medical-claims.test.js`
- `chintu-no-network-egress.test.js`
- `chintu-doc-link-integrity.test.js`
- `chintu-generated-files-map.test.js`
- `chintu-command-map.test.js`
- `chintu-safety-boundary.test.js`
- `chintu-release-guard.ps1` → verdict: **PASS** (2 WARN for human glance).

---

## Validation Codex should run before its own commit

```powershell
git status --short
node scripts/chintu-action-planner.test.js
node scripts/chintu-snapshot-consistency.test.js
node scripts/chintu-doc-link-integrity.test.js
node scripts/chintu-medical-claims.test.js
node scripts/chintu-no-network-egress.test.js
node scripts/chintu-command-map.test.js
node scripts/chintu-generated-files-map.test.js
powershell -ExecutionPolicy Bypass -File scripts\chintu-release-guard.ps1
powershell -ExecutionPolicy Bypass -File scripts\chintu-bridge-loop-reality-check.ps1
```

---

## Stage 13B remaining work (priority order)

See `CHINTU_STAGE_13_PROGRESS.md` for the full description. Summary:

1. Tracked snapshot of the queue (so dashboard can link to a stable file).
2. Categoriser unit tests (fixture-driven, guards the heuristic).
3. Approval audit log (`CHINTU_APPROVAL_AUDIT.md`, tracked, append-only).
4. Control-room generator update — add a "Chintu Planner" section.
5. `CHINTU_OPEN_FIRST.md` polish — "Run the planner" section.
6. `CHINTU_CLAUDE_SURVIVAL_HANDOFF.md` — add cycle-8 section.

Suggested Stage 13B commit subject (Codex should use this if it
finishes the slice cleanly):

```
chore: add Chintu planner snapshot, audit log, and dashboard surface (Stage 13B)
```

---

## Protected files (DO NOT EDIT)

- `app.js`
- `index.html`
- `styles.css`
- `sw.js`
- `coach.js`
- `manifest.webmanifest`
- `privacy.html`
- `functions/api/coach.js`

`chintu-safety-boundary.test.js` enforces this list. Don't modify it
to "let yourself" edit a BALA file — that's the regression we're
preventing.

---

## Parked items (DO NOT activate)

Telegram, Discord, webhooks, cloud sync, phone notifications, voice
calling, voice cloning, paid APIs, external automation, network
egress, memory-wiki, health-data transfer. Each has a `*_PARKED.md`
research note. Lifting a park requires the connector flip-commit
chain documented in `CHINTU_CONNECTOR_POLICY.md` §5–§6.

---

## Connector activation rules (recap)

```
parked -> dry-run -> ready -> active
```

Cannot skip a stage. Each step is an explicit founder commit. Real
sending requires:

- `chore: flip <connector> from dry-run to ready` commit, then
- `chore: activate <connector> for Chintu OS heartbeats` commit.

Codex must not author either of those commits.

---

## What Codex should NOT touch

- BALA app files (see Protected files above).
- `sw.js` `CACHE_NAME`.
- Tokens or secrets (nowhere in repo).
- The Telegram API URL or any other connector URL in any `.ps1`.
- `CHINTU_MEMORY_VAULT/PARKED_SYSTEMS.md` activation status.
- The shared bridge folder on Windows or the iMac control room.
- Push (founder-only).

---

## Exact next safe action for Codex

Once Stage 13A is pushed by the founder, Codex starts at item 1 of
Stage 13B and walks through `CHINTU_STAGE_13_PROGRESS.md` until it
hits a stopping condition. Stop signals:

- Any integrity test fails and the cause is not obvious from the
  output.
- A safety boundary would be crossed.
- A real send or push would be required.

---

## BALA safety footer

BALA is a health-awareness companion. It does not diagnose, treat,
predict, prevent, replace doctors, or provide emergency monitoring.
