# Chintu Runtime Playbook

How Chintu survives real life. What to do when the laptop sleeps, the
Claude session drops, or Telegram is quiet. Read this once; come back
to it when something feels off.

---

## 1. The reliability model in one line

Chintu OS is **file-first**. Its truth lives on disk in this repo.
If a tool stops, the files stay. Restart the tool; re-read the files.

That's the whole model. The scripts below give you a fast way to
confirm it.

---

## 2. If the laptop sleeps or restarts

Nothing in Chintu OS depends on a daemon, watcher, or background
service. Everything is a one-shot script.

After a restart:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\chintu-restart-recovery.ps1
```

That prints one exact resume action and writes
`CHINTU_RESTART_RECOVERY.md`. Then run the master launcher to confirm
the safety tests still pass:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\chintu-master-launcher.ps1
```

If the master launcher is green (apart from the expected unpushed-
commit RED on the health check), you are fully back online.

---

## 3. If the Claude session stops

The cycle handoff lives in
[CHINTU_CLAUDE_SURVIVAL_HANDOFF.md](CHINTU_CLAUDE_SURVIVAL_HANDOFF.md).
Any fresh Claude Code session can resume from it.

Two starter prompts are versioned in the repo:

- [CHINTU_CLAUDE_CONTINUATION_PROMPT.md](CHINTU_CLAUDE_CONTINUATION_PROMPT.md)
  — paste into a fresh Claude session to continue builder work.
- [CHINTU_NEXT_THREAD_STARTER_DETAILED.md](CHINTU_NEXT_THREAD_STARTER_DETAILED.md)
  — longer cold-start brief for any thread.

There is no cross-session memory inside Claude itself; the handoff
file is the only source of truth.

---

## 4. If Telegram is "alive" but silent

Right now Telegram is **parked**. No Chintu OS script sends Telegram
messages. So Telegram being silent is the *expected* state.

If you previously configured a personal Telegram channel and expect
status updates: those updates are not currently being produced by
this repo. See
[CHINTU_TELEGRAM_STATUS_PLAN.md](CHINTU_TELEGRAM_STATUS_PLAN.md) for
what a safe heartbeat channel would look like and what you'd need to
approve before any message goes out.

---

## 5. The first command after restart

```powershell
powershell -ExecutionPolicy Bypass -File scripts\chintu-restart-recovery.ps1
```

It tells you whether the working tree is clean, how many commits are
unpushed, and the one exact next thing to do. Pair with:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\chintu-runtime-health.ps1
```

for the longer report (`CHINTU_RUNTIME_HEALTH.md`).

---

## 6. How to confirm Chintu is alive

Three signals, in order:

1. `scripts\chintu-runtime-health.ps1` writes a status of GREEN /
   YELLOW / RED.
2. `scripts\chintu-heartbeat.ps1` writes `CHINTU_HEARTBEAT.md` with
   the current timestamp.
3. `scripts\chintu-master-launcher.ps1` runs every safety test and
   regenerates the dashboards.

If all three succeed, Chintu is alive.

---

## 7. How to push safely

Push is the only action no script does for you. Walk the green-gate
list in
[CHINTU_PUSH_REVIEW_CHECKLIST.md](CHINTU_PUSH_REVIEW_CHECKLIST.md),
then `git push` by hand.

---

## 8. What stays manual (founder-only)

- `git push`
- Any edit to protected BALA app files
- Service worker `CACHE_NAME` bump
- Lifting any parked surface (Telegram, Discord, webhooks, cloud
  sync, phone, voice, etc.)
- Secret rotation
- Approving any new external service

---

## 9. What stays parked

Telegram, Discord, webhooks, cloud sync, phone notifications, voice
calling, voice cloning, paid APIs, external automation, network
egress, memory-wiki, health-data transfer. Each has its own
`*_PARKED.md` research note. No activation without founder sign-off.

---

## 10. The one rule that makes the rest work

The repo on disk is the truth. Scripts produce reports. Reports are
read by humans (or the next thread). Nothing in the operator layer
depends on a persistent process. If anything claims it does — stop
and treat that as a failure.

---

## 11. BALA safety footer

BALA is a health-awareness companion. It does not diagnose, treat,
predict, prevent, replace doctors, or provide emergency monitoring.
