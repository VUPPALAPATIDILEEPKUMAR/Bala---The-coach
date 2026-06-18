# Chintu Claude Survival Handoff

**Stage:** 11 (cycle 6b — iMac Option 12 SHA-parse fix landed)
**Date:** 2026-06-18
**Mode:** local-first, founder-driven, push-pending-human-approval

## 0a-2. What cycle 6b added (real-bug fix)

Founder ran iMac Option 12 manually. The first install + pull failed
with a **false** SHA-256 mismatch. Root cause: the iMac
`bridge-pull-shared.sh` (emitted as a heredoc by
`install-option-12.sh`) parsed `MANIFEST.txt` with `awk -F': '`, which
mis-handles multi-space alignment after the colon, and used a
case-sensitive compare against an uppercase manifest hash vs the
lowercase `shasum -a 256` output.

Fix in `CHINTU_IMAC_PACKAGES/OPTION_12_PULL_SHARED/install-option-12.sh`:

- `EXPECTED_SHA=$(sed -n 's/^ZIP_SHA256:[[:space:]]*//p' "$MANIFEST_PATH" | head -n 1 | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')`
- `ACTUAL_SHA=$(compute_sha256 "$ZIP_PATH" | tr '[:upper:]' '[:lower:]') || { ... }`

Regression guard:

- `scripts/chintu-imac-option-12-sha-parse.test.js` — asserts both
  the sed-based parse and the lowercase compare are present, and
  that the old `awk -F': '` pattern has not returned. Wired into the
  release guard and the founder command map.

Docs updated to mention the false-mismatch root cause and the verified
successful run after the patch:
`CHINTU_IMAC_OPTION_12_INSTALL_NOW.md` (status block + failure table
row), `CHINTU_BRIDGE_LOOP_TEST_LOG.md` (first-run record),
`CHINTU_IMAC_PACKAGES/OPTION_12_PULL_SHARED/README.md` (SHA-parse note
section), `CHINTU_IMAC_PACKAGES/OPTION_12_PULL_SHARED/IMAC_TEST_PLAN.md`
(historical note in §4).

## 0a. What cycle 6 added (read first)

Real bridge-loop reality test. Confirms the Windows -> shared bridge
-> iMac Option 12 path is ready *today*. Read-only on iMac side (no
iMac modification). No external automation activated.

New script:

- `scripts/chintu-bridge-loop-reality-check.ps1` ->
  `CHINTU_BRIDGE_LOOP_REALITY_CHECK.md` (GREEN/YELLOW/RED).
  Verifies the shared bridge folder, `CHINTU_BRIDGE_LATEST.zip`,
  `MANIFEST.txt` (with SHA-256 hash check against the zip),
  `LATEST_FLAT/` + 7 expected flat files, bridge command center
  report, and the iMac Option 12 package contents.

New founder-facing docs:

- `CHINTU_IMAC_OPTION_12_INSTALL_NOW.md` (step-by-step install + run + rollback + Option 11 fallback)
- `CHINTU_BRIDGE_LOOP_TEST_LOG.md` (founder-fill template covering
  Windows export, shared folder, iMac copy, install, first pull,
  hash check, bridge-status, notes).

New integrity test (wired into release guard + command map):

- `chintu-bridge-loop-reality-check.test.js` (script + docs carry
  footer, no forbidden URLs or secret-shaped values).

Bridge first command after restart:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\chintu-bridge-loop-reality-check.ps1
```

If GREEN, walk `CHINTU_IMAC_OPTION_12_INSTALL_NOW.md` and fill
`CHINTU_BRIDGE_LOOP_TEST_LOG.md`.

## 0a. What cycle 5 added (read first)

Runtime reliability layer. Three new local scripts and four planning
docs. No BALA app edits. No push. Telegram still parked.

New scripts (read-only, no network):

- `scripts/chintu-runtime-health.ps1` → `CHINTU_RUNTIME_HEALTH.md`
  (GREEN/YELLOW/RED "is Chintu alive?" report)
- `scripts/chintu-heartbeat.ps1` → `CHINTU_HEARTBEAT.md`
  (timestamped local proof Chintu ran; never sends)
- `scripts/chintu-restart-recovery.ps1` → `CHINTU_RESTART_RECOVERY.md`
  (one-command re-orient after laptop restart / Claude drop)

New planning docs:

- `CHINTU_RUNTIME_PLAYBOOK.md` (reliability model)
- `CHINTU_TELEGRAM_STATUS_PLAN.md` (parked, founder-gated)
- `CHINTU_ALIVE_NEXT_LEVEL_PLAN.md` (ladder A→H)

Four new tests, wired into release guard + command map:

- `chintu-runtime-health.test.js`
- `chintu-heartbeat.test.js`
- `chintu-restart-recovery.test.js`
- `chintu-telegram-status-plan.test.js`

Founder one-liner after a restart:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\chintu-restart-recovery.ps1
```

## 0. What cycle 4 added (read first)

Six self-generated safe backlogs were planned, built, validated, and
committed in this run. No push. No protected BALA file edits.
No service-worker bump. No network egress. All safety tests green.

Cycle 4 commits (newest first):

```
9210ddf chore: add Chintu BALA-safe-docs, parked-systems, continuation-prompts integrity tests
00a8fd5 docs: add Chintu codex review, claude continuation, next-thread, push checklist
0496544 docs: park future agent architecture and local LLM/voice/phone research notes
4426990 docs: add BALA safe planning specs (voice, tester feedback, privacy, doctor summary, local AI)
7e62ce5 chore: add Chintu generated-files map, hygiene report, control-room troubleshooting
```

Cycle 4 also added `CHINTU_SAFETY_INVARIANTS.md` (canonical safety list)
and `CHINTU_OPERATOR_FAQ.md` as a follow-up consolidation slice.

New tests (all wired into release guard + command map):

- `scripts/chintu-generated-files-map.test.js`
- `scripts/chintu-bala-safe-docs.test.js`
- `scripts/chintu-parked-systems.test.js`
- `scripts/chintu-continuation-prompts.test.js`

New control-room / operator docs:

- `CHINTU_GENERATED_FILES_MAP.md`
- `CHINTU_REPO_HYGIENE_REPORT.md`
- `CHINTU_CONTROL_ROOM_TROUBLESHOOTING.md`
- `CHINTU_SAFETY_INVARIANTS.md`
- `CHINTU_OPERATOR_FAQ.md`

New BALA safe planning specs (all parked, founder-approval gated):

- `BALA_VOICE_COACH_SAFE_SPEC.md`
- `BALA_TESTER_FEEDBACK_PLAN.md`
- `BALA_PRIVACY_TRUST_POLISH_PLAN.md`
- `BALA_DOCTOR_SUMMARY_POLISH_SPEC.md`
- `BALA_LOCAL_FIRST_AI_COACH_SPEC.md`

New parked architecture research:

- `CHINTU_FUTURE_AGENT_ARCHITECTURE.md`
- `CHINTU_LOCAL_LLM_RESEARCH_PARKED.md`
- `CHINTU_VOICE_LAYER_RESEARCH_PARKED.md`
- `CHINTU_PHONE_LAYER_RESEARCH_PARKED.md`

New review/continuation layer:

- `CHINTU_CODEX_REVIEW_PROMPT.md`
- `CHINTU_CLAUDE_CONTINUATION_PROMPT.md`
- `CHINTU_NEXT_THREAD_STARTER_DETAILED.md`
- `CHINTU_PUSH_REVIEW_CHECKLIST.md`

Validation at end of cycle 4: all 12 Chintu integrity tests PASS
individually. Master launcher halts at step 15/16 on the OS health
check with "RED — 1 critical issue: unpushed commits" — that is the
**expected** founder-push-reminder signal, not a safety failure. The
preceding 14 steps (syntax, snapshot, command map, memory vault,
agent control shell, no-network-egress, medical-claims, safety
boundary, doc-link, validate, release-guard with all 12 tests) are
green.

Founder action when ready: review the unpushed range (likely 14+
commits) using `CHINTU_PUSH_REVIEW_CHECKLIST.md`, then push by hand.

Cycle 3 commits (kept for reference):

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
