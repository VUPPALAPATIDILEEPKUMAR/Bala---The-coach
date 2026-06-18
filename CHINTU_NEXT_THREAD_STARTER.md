# Chintu — Next Thread Starter

Paste the prompt at the bottom of this file into a fresh Claude or
Codex thread to continue Chintu OS work from a cold start. This file
keeps that prompt versioned next to the repo, separate from the longer
master autonomous builder prompt.

If you want the long, self-expanding-backlog flavor instead, use
`CHINTU_OS_MASTER_AUTONOMOUS_BUILDER_PROMPT.md` (lives in Downloads).
This file is the short, no-frills "pick up where we left off" version.

---

## What the new thread needs to know in one minute

- The repo is **local-first**. Push is founder-only. Do not push.
- BALA app files are **protected**. See [CHINTU_START_HERE.md](CHINTU_START_HERE.md)
  for the protected list. Do not edit them.
- The full safe command surface is [CHINTU_FOUNDER_COMMAND_MAP.md](CHINTU_FOUNDER_COMMAND_MAP.md).
- Anything outside that map is parked until the founder approves it.
- If anything is unclear, [CHINTU_WHEN_STUCK.md](CHINTU_WHEN_STUCK.md)
  is the troubleshooting playbook.

---

## The cold-start prompt to paste

```text
You are continuing Chintu OS work in a fresh thread.

Read in this order:
1. CHINTU_START_HERE.md
2. CHINTU_FOUNDER_COMMAND_MAP.md
3. CHINTU_WHEN_STUCK.md
4. CHINTU_ARTIFACT_POLICY.md
5. CHINTU_CLAUDE_SURVIVAL_HANDOFF.md

Then run, in order, the safe morning loop:
- scripts\chintu-os-health-check.ps1
- scripts\chintu-validate.ps1
- scripts\chintu-alive-briefing.ps1
- scripts\chintu-next-action.ps1

Rules:
- Do not push.
- Do not edit protected BALA app files (app.js, index.html, styles.css,
  sw.js, coach.js, manifest.webmanifest, privacy.html,
  functions/api/coach.js).
- Do not add network egress, secrets, webhook calls, Telegram, Discord,
  cloud sync, or voice activation.
- Do not add medical claims. Keep the BALA safety footer wherever BALA
  is discussed.
- If a step requires a founder-only action (push, secret rotation,
  external automation activation, BALA app edits), stop and surface it.

Then either:
(a) Continue the next safe slice from CHINTU_CLAUDE_SURVIVAL_HANDOFF.md, or
(b) If that handoff is exhausted, inspect the repo and generate a new
    safe backlog yourself before continuing.

Work in cycles: backlog -> build -> validate -> commit -> next backlog.
Stop only on a real stop condition (usage low, validation fails and
cannot be safely fixed, safety boundary hit, founder-only action
required, or two new safe backlogs are exhausted).

Before stopping, update CHINTU_CLAUDE_SURVIVAL_HANDOFF.md with the
latest commits, what changed, what validation passed, and the exact
continuation prompt for the next thread.
```

---

## BALA safety footer

BALA is a health-awareness companion. It does not diagnose, treat,
predict, prevent, replace doctors, or provide emergency monitoring.
