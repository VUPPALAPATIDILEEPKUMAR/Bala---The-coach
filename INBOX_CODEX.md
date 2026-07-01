# INBOX_CODEX.md — Codex Pickup Prompt
_Updated by Claude · 2026-06-29 · C74 stage_

---

## 2026-07-01 Operator Note

Before acting, read `CHINTU_BRO_SYNC_REPORT.md`.

Chintu asked the agents to make status easy to verify. After each substantial run,
write/update:

- `CHINTU_OUTBOX/latest_bro_status.md`
- `CHINTU_OUTBOX/latest_bro_status.json`

Use `running`, `pass`, `fail`, or `blocked`. Keep it small. No secrets, no giant logs.

---

## What you are

You are **Codex Pro** — the implementer brain. Claude = planner, Chintu = local operator.
One task → one receipt → stop.

---

## Current state (updated 2026-06-29)

- GitHub `main` now includes C69 at `779560d`
- Local working tree is AHEAD: C72 + C73 + C74 changes ready to push
- All files pass: `node --check` + egress test (60 scripts, 13 patterns)

## What Claude built while you were away

### C72 (ready to push — push-c73.ps1 commits these too)
- `scripts/chintu-local-bridge.js`: `POST /bala-snapshot` endpoint
  - BALA PWA auto-pushes health snapshot → `~/bala-daily-snapshot.json`
  - `originAllowedForSnapshot()` permits GitHub Pages CORS for this route only
  - CORS OPTIONS preflight handled
- `app.js` (B72): auto-POSTs snapshot to bridge 3s after page load, silent fail if offline

### C73 (ready to push — push-c73.ps1)
- `scripts/chintu-telegram-poll.js`:
  - `chintu_status` intent: 'bros', 'whats happening', 'how are you', 'system status', 'sup', etc.
  - Reply: OS report card — git status, last commit, BALA snapshot age, Groq key, script count
  - `bala_check` intent: 'check health', 'score', 'bala score', 'how am i doing', etc.
  - Updated HELP_TEXT to C73 with health check + system status sections

### C74 (ready to push — push-c74.ps1, run AFTER push-c73.ps1)
- `scripts/chintu-health-brief.js`:
  - Fetches top 5 Hacker News stories (free API, no auth, silent fail if offline)
  - Appends "🔥 Tech Pulse (Hacker News)" section to morning brief
  - SpO2 now included in Groq prompt context
  - Runs BALA snapshot + HN fetch in parallel

---

## BALA STATUS — CONFIRMED LIVE
**https://vuppalapatidileepkumar.github.io/Bala---The-coach/**

---

## TASK-001 — DONE · 00c700c
## TASK-002 — DONE · f6b91ce
## TASK-003 — DONE (flash fix)
## TASK-004 — PENDING (push-c71.ps1 — Admin PS, register Task Scheduler)
## TASK-005 — PENDING (proof test: send 'hi' to @Chintu_surya_bot)

---

## TASK-006 — Run push-c73.ps1 (commits C72 + C73)

**Standard PowerShell (no Admin needed):**

```powershell
cd C:\Users\Chintu\Desktop\test
.\push-c73.ps1
```

This commits:
- `scripts/chintu-telegram-poll.js` (C73 status command + C72 bala_check)
- `scripts/chintu-local-bridge.js` (C72 /bala-snapshot endpoint)
- `app.js` (C72 B72 auto-push)

**Receipt format:**
```
TASK-006 RECEIPT
Status: PASS / FAIL
Commit: <hash>
Notes: <any issues>
```

---

## TASK-007 — Proof test C72+C73 (AFTER TASK-006)

1. Open BALA in browser (auto-pushes snapshot)
2. Text to @Chintu_surya_bot:
   ```
   check health
   ```
   Should reply with score + signals within 5 seconds.

3. Also test:
   ```
   bros
   ```
   Should reply with OS status report (git, BALA snapshot age, Groq, script count).

   ```
   whats happening
   ```
   Same status report.

**Receipt:**
```
TASK-007 RECEIPT
'check health' response: yes/no (score shown?)
'bros' response: yes/no (OS report shown?)
Notes: <snapshot freshness shown?>
```

---

## TASK-008 — Run push-c74.ps1 (C74: HN Tech Pulse in morning brief)

**Standard PowerShell (no Admin needed, run AFTER TASK-006):**

```powershell
cd C:\Users\Chintu\Desktop\test
.\push-c74.ps1
```

Commits `scripts/chintu-health-brief.js` with HN headlines.

**Receipt:**
```
TASK-008 RECEIPT
Status: PASS / FAIL
Commit: <hash>
```

---

## TASK-009 — Proof test C74 (AFTER TASK-008)

Text to @Chintu_surya_bot:
```
morning
```
or
```
digest
```

Morning brief should include BALA score AND 5 Hacker News headlines at the bottom.

**Receipt:**
```
TASK-009 RECEIPT
HN headlines shown: yes/no
BALA score in brief: yes/no
```

---

## Hard rules

- Read file before editing
- One task → one receipt → stop
- Never echo API keys or tokens
- Never write outside C:\Users\Chintu\Desktop\test\
- Never modify .env or SECURITY_POLICY.md
- BALA health language: no diagnose / treat / predict / prevent
- No batching tasks

---

_End of INBOX_CODEX.md_
