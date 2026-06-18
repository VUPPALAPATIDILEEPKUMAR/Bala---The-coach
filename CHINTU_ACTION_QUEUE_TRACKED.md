# Chintu Action Queue Tracked Snapshot

Tracked reference snapshot for the planner workflow. This file is safe to commit and review in git. It is **not** the live queue.

## Latest known planner queue shape

- Top 5 ids: `A1-refresh-founder-message, A2-render-dry-run-payloads, A3-bridge-reality-check, A5-bala-tier1-audit, A4-push-pending-commits`
- Categories in the top 5: `safe-now, safe-now, safe-now, safe-now, needs-approval`
- Highest-ranked safe-now action: `A1-refresh-founder-message`
- Approval cards generated for top-5 actions: `A4-push-pending-commits`

## Current top 5 snapshot

| # | Action id | Category | Approval needed | Why |
|---|---|---|---|---|
| 1 | `A1-refresh-founder-message` | safe-now | no | Stage 12 voice. One quick read of what is working, what needs attention, the best next move. |
| 2 | `A2-render-dry-run-payloads` | safe-now | no | Make the Telegram/Slack/Discord shape visible without sending. Useful evidence for any future flip-to-ready decision. |
| 3 | `A3-bridge-reality-check` | safe-now | no | Confirms Windows -> shared bridge -> iMac Option 12 is still GREEN before any iMac pull. |
| 4 | `A5-bala-tier1-audit` | safe-now | no | Catch any drift toward predictive/clinical phrasing before the next BALA commit. Zero risk - reading only. |
| 5 | `A4-push-pending-commits` | needs-approval | yes | Ship the work that has already passed every safety test. |

## Top action categories

- `safe-now`: 4 action(s). Examples: A1-refresh-founder-message, A2-render-dry-run-payloads, A3-bridge-reality-check
- `needs-approval`: 2 action(s). Examples: A4-push-pending-commits, A6-flip-telegram-dry-run
- `research`: 1 action(s). Examples: A7-voice-coach-spec-reread

## Approval-needed examples

- `A4-push-pending-commits` (medium) -> phrase: `approve A4-push-pending-commits`
- `A6-flip-telegram-dry-run` (medium) -> phrase: `approve A6-flip-telegram-dry-run`

## Parked and research examples

- Parked connector example: `A6-flip-telegram-dry-run` remains approval-gated and does not send anything.
- Research example: `A7-voice-coach-spec-reread` stays awareness-only and does not touch runtime state.

## Regenerate live planner output

```powershell
powershell -ExecutionPolicy Bypass -File scripts\chintu-action-planner.ps1
```

## Where live generated files live

- `CHINTU_ACTION_QUEUE.md` -> live top-5 queue (gitignored)
- `CHINTU_APPROVAL_CENTER.md` -> live approval cards (gitignored)
- `CHINTU_NEXT_OPERATOR_PROMPT.md` -> live next safe action prompt (gitignored)
- `CHINTU_OUTBOX/latest_action_plan.json` -> machine-readable mirror (gitignored)
- `CHINTU_APPROVAL_AUDIT.md` -> tracked append-only founder approval log

## What this file is and is not

- This file is a tracked reference for control-room linking and code review.
- This file is not the live queue; always open `CHINTU_ACTION_QUEUE.md` for current runtime state.
- This file never means anything was sent or activated.

## BALA safety footer

BALA is a health-awareness companion. It does not diagnose, treat, predict, prevent, replace doctors, or provide emergency monitoring.