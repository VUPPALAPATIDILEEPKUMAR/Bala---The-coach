# Chintu Next Thread Starter (detailed)

A longer-form companion to `CHINTU_NEXT_THREAD_STARTER.md`. Use this
when the next thread will be operated by someone (or some session)
that has *no* prior context on Chintu OS, BALA, or the founder's
working style.

The short version (`CHINTU_NEXT_THREAD_STARTER.md`) assumes you've
been around. This version assumes you haven't.

---

## 1. Who you are picking up from

A Claude Code session has been running an autonomous builder cycle on
this local repo. The cycle has been generating safe slices: docs,
tests, scripts, and control-room work. It has not pushed and has not
touched BALA app code.

The cycle has self-paced through multiple backlogs. Each backlog is a
small, themed batch of related slices (e.g. "Control Room UX +
Generated Files Map", "BALA safe planning"). Backlogs are documented
in `CHINTU_CLAUDE_SURVIVAL_HANDOFF.md`.

---

## 2. The shape of the system

- **Chintu OS** = the operator layer. Scripts, validators, dashboards,
  memory vault, planning docs. Lives in `scripts/` and at the repo
  root as `CHINTU_*.md`.
- **BALA** = a local-first health-awareness PWA. Lives in `app.js`,
  `index.html`, `styles.css`, `sw.js`, `coach.js`,
  `manifest.webmanifest`, `privacy.html`, `functions/api/coach.js`.
  **Out of builder scope.** Only the founder edits these.
- **Memory vault** = `CHINTU_MEMORY_VAULT/`. Founder context.
  Read-mostly. Index lives in its `README.md`.

---

## 3. The four invariants

If any of these would be broken by a proposed change, do not do it:

1. No protected BALA file is edited.
2. No script gains a network egress path.
3. No doc gains a medical claim about BALA.
4. No commit pushes.

These are enforced by tests under `scripts/chintu-*.test.js`. The
master launcher runs them all in one sweep.

---

## 4. First 90 seconds in the repo

```powershell
git status --short
git log --oneline -15
powershell -ExecutionPolicy Bypass -File scripts\chintu-master-launcher.ps1 -SkipReports
```

Read, in order:

1. `CHINTU_START_HERE.md`
2. `CHINTU_CLAUDE_SURVIVAL_HANDOFF.md`
3. `CHINTU_FOUNDER_COMMAND_MAP.md`
4. `CHINTU_GENERATED_FILES_MAP.md`
5. `CHINTU_REPO_HYGIENE_REPORT.md`
6. `CHINTU_CONTROL_ROOM_TROUBLESHOOTING.md`

---

## 5. How to decide what to do next

In priority order:

1. **Founder asked for something specific.** Do that.
2. **Validation is red.** Fix the failing step. Do not paper over it.
3. **A safe slice from the parked-angles list is unstarted.** Pick the
   smallest one. Build, validate, commit.
4. **Repo hygiene drift exists** (`CHINTU_REPO_HYGIENE_REPORT.md`
   §3). Pick a slow-day cleanup.
5. **Nothing else?** Stop. Update
   `CHINTU_CLAUDE_SURVIVAL_HANDOFF.md` with the cycle summary.

---

## 6. How to commit

One safe slice per commit. Subject prefix `chore:` for infra, `docs:`
for docs-only. Include the BALA safety footer in the body whenever
BALA is mentioned. Never push.

---

## 7. When to stop and hand back

- Usage budget is low.
- Validation fails and cannot be safely fixed.
- The next step is founder-only (push, BALA edit, parked-system
  activation, secret rotation).
- You hit a hard safety boundary.

When stopping, append a one-paragraph cycle summary to
`CHINTU_CLAUDE_SURVIVAL_HANDOFF.md` so the next session can resume.

---

## 8. BALA safety footer

BALA is a health-awareness companion. It does not diagnose, treat,
predict, prevent, replace doctors, or provide emergency monitoring.
