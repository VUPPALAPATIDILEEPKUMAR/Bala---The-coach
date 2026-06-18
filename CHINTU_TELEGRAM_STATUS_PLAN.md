# Chintu Telegram Status Plan (planning only, parked)

**Status:** PARKED. Nothing in this repo sends Telegram messages.
**Scope:** what a safe Chintu-OS-only Telegram heartbeat *could* look
like, and what you'd need to approve before any byte goes out.

This plan is operator-side only. Telegram is never a destination for
BALA user data, health metrics, or medical content — full stop.

---

## 1. Current known status (from repo only)

- `CHINTU_MEMORY_VAULT/PARKED_SYSTEMS.md` lists "Telegram bot — parked"
  with the note "No implementation. Future notification channel for
  non-health status only."
- It also lists "Health data in Telegram / Discord / webhooks /
  notifications — prohibited. Hard rule. Never."
- No `scripts/chintu-*.ps1` calls Telegram. The
  `chintu-no-network-egress.test.js` test would fail if any did.
- No Telegram token, chat ID, or webhook URL is stored in this repo,
  in `.env`, or in any script.

Conclusion: **Telegram is not currently a destination for anything
Chintu OS does.**

---

## 2. What "Telegram alive" would mean (if ever activated)

A Telegram channel would be considered "alive" for Chintu OS purposes
only if all of the following are true:

1. The founder has personally created a dedicated Chintu-OS-only
   channel.
2. The bot token lives in a place outside this repo (Windows
   Credential Manager or a manually-managed env var).
3. A single dedicated script reads that token, formats one short
   heartbeat message, and sends it. That script is reviewable in a
   diff before approval.
4. The message body never includes BALA user data, health metrics,
   medical content, or secrets.
5. The script has an off-switch: if a `CHINTU_TELEGRAM_PAUSE` flag
   file exists in the repo root, the script no-ops.

Until all five hold, Telegram is silent. That is the safe default.

---

## 3. Why no Telegram message arrives today

Because no script attempts to send one. There is no scheduler, no
webhook, no service. The repo's no-network-egress test enforces this.
If you expected a Telegram notification, the expectation is from a
previous mental model — not from anything in the current code.

---

## 4. A safe smoke test design (NOT executed by any current script)

If and only if §2's five conditions later hold, a smoke test would
look like this:

1. Create a `CHINTU_TELEGRAM_HEARTBEAT.ps1` script (does not exist
   today).
2. Have it read the token from `[Environment]::GetEnvironmentVariable("CHINTU_TG_TOKEN", "User")`.
3. Have it read the chat id from `CHINTU_TG_CHAT_ID` env var.
4. Have it `POST` only the body documented in §6 below.
5. Test in a private dev channel first.

Note: the moment such a script is added, the
`chintu-no-network-egress.test.js` test would block the release guard
unless that script is added to its allowlist. That is the correct
gate.

---

## 5. What founder must approve manually before anything sends

- Creation of the dedicated Chintu-OS-only Telegram channel.
- Storage of the bot token in Credential Manager or a User env var
  (not in repo, not in `.env`, not in any script).
- The exact text of the message body (see §6).
- The exact trigger (manual only, or scheduled — and if scheduled,
  by which OS scheduler).
- An allowlist amendment to `chintu-no-network-egress.test.js`.

---

## 6. The only acceptable message body

```text
Chintu heartbeat
2026-06-18 03:42 -04:00 | branch main
Tree: clean. Unpushed: 0.
Next: run scripts/chintu-master-launcher.ps1.
```

What this message contains:

- A timestamp.
- A branch name.
- A working-tree summary ("clean" or "N uncommitted").
- An unpushed-commit count.
- One short next-action sentence.

What this message MUST NOT contain:

- Any BALA user data.
- Any health metric (heart rate, sleep, steps, BP, glucose, mood,
  symptoms, weight, anything).
- Any medical content.
- Any commit message body (commit messages can contain context the
  founder might not want broadcast).
- Any path under `CHINTU_MEMORY_VAULT/` (vault content stays local).
- Any secret, token, file path, or environment value.

---

## 7. What must never be sent over Telegram (ever)

- BALA user notes, scores, trends, or coach text.
- Any health-data field, even abstracted.
- Photos, screenshots, files, or attachments.
- Anything matching the medical-claims test patterns.

These prohibitions remain even if Telegram is later activated for
Chintu-OS-only heartbeats.

---

## 8. Trigger to revisit

Founder explicitly opens this lane. Until then, parked. The
`chintu-runtime-health.ps1` script will keep reporting Telegram as
"parked (expected)".

---

## 9. BALA safety footer

BALA is a health-awareness companion. It does not diagnose, treat,
predict, prevent, replace doctors, or provide emergency monitoring.
