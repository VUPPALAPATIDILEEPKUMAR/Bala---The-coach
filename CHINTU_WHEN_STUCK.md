# Chintu — When Stuck

Quick-reference for the most common failure modes. Every step here is
local and read-only unless it explicitly says otherwise.

---

## "I don't know where I am in the project"

Run, in order:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\chintu-os-health-check.ps1
powershell -ExecutionPolicy Bypass -File scripts\chintu-alive-briefing.ps1
powershell -ExecutionPolicy Bypass -File scripts\chintu-next-action.ps1
```

Then open `CHINTU_ALIVE_BRIEFING.md` and `CHINTU_OS_HEALTH_CHECK.md`.

---

## "Validation is failing"

1. Run `powershell -ExecutionPolicy Bypass -File scripts\chintu-validate.ps1`
2. Open `last-validation.txt` (gitignored) — verdict and details are there.
3. If the verdict is FAIL, do not push and do not commit. Fix first.
4. If only WARN, glance at the lines flagged. Disclaimer / awareness copy
   commonly trips WARN — that is intentional and non-blocking.

---

## "Release guard is FAILing"

```powershell
powershell -ExecutionPolicy Bypass -File scripts\chintu-release-guard.ps1
```

Open `release-guard-report.md`. The "Integrity tests" block shows which
test failed. Run that test directly to see its full output:

```powershell
node scripts\chintu-command-map.test.js
node scripts\chintu-memory-vault.test.js
node scripts\chintu-agent-control-shell.test.js
node scripts\chintu-no-network-egress.test.js
node scripts\chintu-medical-claims.test.js
node scripts\chintu-safety-boundary.test.js
node scripts\chintu-snapshot-consistency.test.js
```

---

## "An integrity test says a referenced file is missing"

That usually means:

- A script was renamed but `CHINTU_FOUNDER_COMMAND_MAP.md` still points at the old name, or
- A vault file was deleted but `CHINTU_MEMORY_VAULT/README.md` still lists it.

Fix the doc to match reality, or restore the file. Either is safe.

---

## "Working tree is dirty and I don't know why"

```powershell
git status --short
git diff
```

The dashboards and briefing files (`CHINTU_AGENT_DASHBOARD.html`,
`CHINTU_ALIVE_BRIEFING.md`, `CHINTU_OS_HEALTH_CHECK.md`) are regenerated
every time you run the scripts — small diffs there are normal. See
[CHINTU_ARTIFACT_POLICY.md](CHINTU_ARTIFACT_POLICY.md) for the full
generated-vs-source list.

---

## "I want to push but I'm not sure it's safe"

Always run the release guard first:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\chintu-release-guard.ps1
```

The bottom of `release-guard-report.md` gives an explicit recommendation:
`READY FOR HUMAN PUSH`, `DO NOT PUSH`, or `NOTHING TO PUSH`. Pushing is
always a founder-only keystroke — no script does it for you.

---

## "Something is asking me to do a founder-only action"

Founder-only actions live outside the script surface:

- `git push`
- BALA app file edits
- Service worker cache bump
- Telegram / Discord / webhooks / cloud sync activation
- Secret rotation
- Approving anything in `CHINTU_MEMORY_VAULT/PARKED_SYSTEMS.md`

If a script seems to need one of these to proceed, that is the stop
condition — do it yourself, or leave it parked.

---

## "Claude / Codex stopped mid-task"

Open `CHINTU_CLAUDE_SURVIVAL_HANDOFF.md`. It contains the latest
commits, what was parked, and the exact continuation prompt to paste
into the next thread.

---

## BALA safety footer

BALA is a health-awareness companion. It does not diagnose, treat,
predict, prevent, replace doctors, or provide emergency monitoring.
