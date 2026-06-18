# Chintu Operator FAQ

Quick answers to the questions a founder or builder session asks most
often. Each answer points to the canonical doc for more depth.

---

## Q1. Where do I start?

`CHINTU_START_HERE.md` is the single entry point. After that, in
order: `CHINTU_FOUNDER_COMMAND_MAP.md`,
`CHINTU_CLAUDE_SURVIVAL_HANDOFF.md`,
`CHINTU_SAFETY_INVARIANTS.md`.

## Q2. What command should I run first?

```powershell
powershell -ExecutionPolicy Bypass -File scripts\chintu-master-launcher.ps1 -SkipReports
```

That is the read-only fast pass. If it's green, you're oriented.

## Q3. Why is my health check RED with all tests green?

Because there are unpushed commits. The health check treats unpushed
commits as a human-attention signal. That is by design. See
`CHINTU_SAFETY_INVARIANTS.md` §5.

## Q4. Can I push?

Only the founder pushes. A builder session never pushes, never
suggests `--force`, never amends a published commit. See
`CHINTU_PUSH_REVIEW_CHECKLIST.md` for the founder's pre-push gate.

## Q5. Can I edit BALA app code?

Only the founder edits any of `app.js`, `index.html`, `styles.css`,
`sw.js`, `coach.js`, `manifest.webmanifest`, `privacy.html`,
`functions/api/coach.js`. See `CHINTU_SAFETY_INVARIANTS.md` §1.

## Q6. What if a test goes red mid-cycle?

Reproduce the test in isolation (it's just a `node scripts/chintu-*.test.js`
call). Read its failure message — every test prints `FAIL: …` with
context. See `CHINTU_CONTROL_ROOM_TROUBLESHOOTING.md` §B for the
per-test reproduction table.

## Q7. I added a new script. What else has to change?

Three edits in one commit:

1. The script itself.
2. A row in `CHINTU_FOUNDER_COMMAND_MAP.md`.
3. If it produces a generated file, a row in
   `CHINTU_GENERATED_FILES_MAP.md`.

Then run the master launcher. The integrity tests will catch any
mismatch.

## Q8. I added a new BALA-side doc. What else has to change?

It must:

- Have a name matching `BALA_*.md`.
- Carry a planning/parked status marker in its header.
- End with the BALA safety footer.

`chintu-bala-safe-docs.test.js` enforces all three.

## Q9. I want to activate Telegram / cloud sync / voice / phone.

You can't, as a builder session. Those are parked indefinitely. See
`CHINTU_PHONE_LAYER_RESEARCH_PARKED.md`,
`CHINTU_VOICE_LAYER_RESEARCH_PARKED.md`, and the parked-systems list
in `CHINTU_MEMORY_VAULT/PARKED_SYSTEMS.md`. Lifting a park is a
founder-only decision.

## Q10. The dashboards look stale.

Run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\chintu-control-room-index.ps1
powershell -ExecutionPolicy Bypass -File scripts\chintu-agent-dashboard.ps1
```

Or just the master launcher, which regenerates them as its last
steps.

## Q11. How do I stop a cycle cleanly?

1. Confirm the safety tests are all green.
2. Update `CHINTU_CLAUDE_SURVIVAL_HANDOFF.md` with the cycle summary.
3. Commit only if there are unstaged real changes.
4. Do not push.

## Q12. What does "safe slice" actually mean?

A change that:

- Touches only scripts, docs, vault, or tracked control-room
  artifacts.
- Does not touch any protected BALA file.
- Does not add network egress.
- Passes every safety test.

See `CHINTU_SAFETY_INVARIANTS.md` §4.

## Q13. There's a `*-report.md` in my working tree I don't recognize.

It's gitignored and regenerated. See `CHINTU_ARTIFACT_POLICY.md`
section 1 and `CHINTU_GENERATED_FILES_MAP.md` section 1. Safe to
overwrite or ignore.

## Q14. Where do I leave a note for the next session?

`CHINTU_CLAUDE_SURVIVAL_HANDOFF.md`. That doc is the cold-start brief
for whoever picks up next.

---

## BALA safety footer

BALA is a health-awareness companion. It does not diagnose, treat,
predict, prevent, replace doctors, or provide emergency monitoring.
