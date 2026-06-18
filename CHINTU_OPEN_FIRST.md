# Chintu — Open First

**One page. Read top to bottom. Then act.**

If you only have 60 seconds in this repo, this is the file.

---

## 1. What Chintu is right now

- **Chintu OS** = the local-first operator layer (scripts, validators,
  dashboards, planning docs, memory vault) around your product work.
- **BALA** = a separate local-first health-awareness PWA. Protected.
  Only you edit it.
- Both live in this repo. They are kept apart by design.

---

## 2. The first command to run

```powershell
powershell -ExecutionPolicy Bypass -File scripts\chintu-master-launcher.ps1
```

That one command runs every safety test, the validator, the release
guard, the health check, the alive briefing, and regenerates the
dashboards. It stops on the first FAIL.

Expected today: every safety test green, the OS health check shows
**RED** only because of unpushed commits. That RED is the *push
reminder*, not a safety failure. See `CHINTU_SAFETY_INVARIANTS.md` §5.

---

## 2a. Run the planner

```powershell
powershell -ExecutionPolicy Bypass -File scripts\chintu-action-planner.ps1
```

Then open `CHINTU_ACTION_QUEUE.md`, `CHINTU_APPROVAL_CENTER.md`, and
`CHINTU_NEXT_OPERATOR_PROMPT.md`. They tell you the top 5 safe next
actions, any founder approvals required, and the one best safe-now
command.

If you approve a queued item by hand, record it locally in
[CHINTU_APPROVAL_AUDIT.md](CHINTU_APPROVAL_AUDIT.md):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\chintu-approval-audit.ps1 -ApprovalPhrase "approve <id>"
```

---

## 3. The first file to open after the launcher

[CHINTU_TOMORROW_MORNING_BRIEF.md](CHINTU_TOMORROW_MORNING_BRIEF.md) —
the single page that tells you what changed overnight, what is safe
to push, and where the next safe step lives.

If that brief is missing or stale, fall back to
[CHINTU_CLAUDE_SURVIVAL_HANDOFF.md](CHINTU_CLAUDE_SURVIVAL_HANDOFF.md).

---

## 4. Before you push

Open [CHINTU_PUSH_REVIEW_CHECKLIST.md](CHINTU_PUSH_REVIEW_CHECKLIST.md)
and walk every box. Push only after every green-gate item is ticked.
Push is the one action no agent ever takes for you.

---

## 5. What is safe (operator scope)

- Edit `CHINTU_*.md` and `BALA_*.md` planning docs.
- Add / edit `scripts/chintu-*.ps1` and `scripts/chintu-*.test.js`.
- Regenerate tracked dashboards (`CHINTU_AGENT_DASHBOARD.html`,
  `CHINTU_CONTROL_ROOM_INDEX.html`, `CHINTU_OS_HEALTH_CHECK.md`,
  `CHINTU_ALIVE_BRIEFING.md`).
- Commit one safe slice per concept with `chore:` or `docs:` prefix.

Full canonical safety list:
[CHINTU_SAFETY_INVARIANTS.md](CHINTU_SAFETY_INVARIANTS.md).

---

## 6. What is parked (do NOT activate)

Telegram, Discord, webhooks, cloud sync, phone notifications, voice
calling, voice cloning, paid APIs, external automation, network
egress, memory-wiki, health-data transfer.

See:
- [CHINTU_PHONE_LAYER_RESEARCH_PARKED.md](CHINTU_PHONE_LAYER_RESEARCH_PARKED.md)
- [CHINTU_VOICE_LAYER_RESEARCH_PARKED.md](CHINTU_VOICE_LAYER_RESEARCH_PARKED.md)
- [CHINTU_LOCAL_LLM_RESEARCH_PARKED.md](CHINTU_LOCAL_LLM_RESEARCH_PARKED.md)
- [CHINTU_FUTURE_AGENT_ARCHITECTURE.md](CHINTU_FUTURE_AGENT_ARCHITECTURE.md)
- `CHINTU_MEMORY_VAULT/PARKED_SYSTEMS.md`

---

## 7. The BALA lane next

Five parked specs are ready for review when you want a BALA-side
slice:

- [BALA_VOICE_COACH_SAFE_SPEC.md](BALA_VOICE_COACH_SAFE_SPEC.md)
- [BALA_PRIVACY_TRUST_POLISH_PLAN.md](BALA_PRIVACY_TRUST_POLISH_PLAN.md)
- [BALA_TESTER_FEEDBACK_PLAN.md](BALA_TESTER_FEEDBACK_PLAN.md)
- [BALA_DOCTOR_SUMMARY_POLISH_SPEC.md](BALA_DOCTOR_SUMMARY_POLISH_SPEC.md)
- [BALA_LOCAL_FIRST_AI_COACH_SPEC.md](BALA_LOCAL_FIRST_AI_COACH_SPEC.md)

Each one is a planning doc that explicitly requires your sign-off
before any code lands. Open the smallest first
(`BALA_PRIVACY_TRUST_POLISH_PLAN.md` slice P4 is read-only).

---

## 8. What NOT to touch

Protected BALA app files. Never edited in operator mode:

```
app.js  index.html  styles.css  sw.js  coach.js
manifest.webmanifest  privacy.html  functions/api/coach.js
```

The `chintu-safety-boundary.test.js` test keeps this list canonical.

---

## 9. How to continue with Codex or Claude

- **Continue with Claude** → paste
  [CHINTU_CLAUDE_CONTINUATION_PROMPT.md](CHINTU_CLAUDE_CONTINUATION_PROMPT.md)
  into a fresh Claude Code session.
- **Get a second opinion with Codex** → paste
  [CHINTU_CODEX_REVIEW_PROMPT.md](CHINTU_CODEX_REVIEW_PROMPT.md)
  into a fresh Codex session. Codex is read-only by design.
- **Cold start for any thread** →
  [CHINTU_NEXT_THREAD_STARTER_DETAILED.md](CHINTU_NEXT_THREAD_STARTER_DETAILED.md).

---

## 10. If something feels off

Open [CHINTU_WHEN_STUCK.md](CHINTU_WHEN_STUCK.md) or
[CHINTU_CONTROL_ROOM_TROUBLESHOOTING.md](CHINTU_CONTROL_ROOM_TROUBLESHOOTING.md).
Then re-run the launcher. If a safety test stays red, stop and ask.

---

## 11. Chintu's daily message to you

```powershell
powershell -ExecutionPolicy Bypass -File scripts\chintu-founder-message.ps1
node scripts/chintu-message-dry-run.js
```

The first writes [CHINTU_DAILY_BRIEF.md](CHINTU_DAILY_BRIEF.md) and
`CHINTU_OUTBOX/latest_founder_message.md` (a natural-language read of
the system). The second renders dry-run previews of what Telegram /
Slack / Discord *would* look like — without sending. See
[CHINTU_CONNECTORS.md](CHINTU_CONNECTORS.md) and
[CHINTU_CONNECTOR_POLICY.md](CHINTU_CONNECTOR_POLICY.md) for the
ladder from parked → dry-run → ready → active.

---

## 12. Bridge to the iMac (when you want it)

Before walking through Option 12:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\chintu-bridge-loop-reality-check.ps1
```

If GREEN, follow
[CHINTU_IMAC_OPTION_12_INSTALL_NOW.md](CHINTU_IMAC_OPTION_12_INSTALL_NOW.md)
and fill
[CHINTU_BRIDGE_LOOP_TEST_LOG.md](CHINTU_BRIDGE_LOOP_TEST_LOG.md) as you
go.

---

## 13. After laptop restart or Claude drop

```powershell
powershell -ExecutionPolicy Bypass -File scripts\chintu-restart-recovery.ps1
```

Prints one exact resume action and writes
[CHINTU_RESTART_RECOVERY.md](CHINTU_RESTART_RECOVERY.md). For the
longer "is Chintu alive?" report run
`scripts\chintu-runtime-health.ps1` →
[CHINTU_RUNTIME_HEALTH.md](CHINTU_RUNTIME_HEALTH.md). Full reliability
model: [CHINTU_RUNTIME_PLAYBOOK.md](CHINTU_RUNTIME_PLAYBOOK.md).

---

## BALA safety footer

BALA is a health-awareness companion. It does not diagnose, treat,
predict, prevent, replace doctors, or provide emergency monitoring.
