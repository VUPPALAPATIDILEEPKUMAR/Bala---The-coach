# Chintu Approval Queue Design — Stage 33

> Created: 2026-06-19
> Status: Documentation-only. Implementation deferred to Stage 34.
> Purpose: Define how Chintu will hold dangerous/irreversible actions for founder approval
>          before they execute.

---

## Problem

Some Chintu capabilities cannot be safe to run without explicit human decision:
- `chintu.gitPush` — irreversible (must revert commit to undo)
- `telegram.sendMessage` — external side effect visible to recipients
- `telegram.deleteWebhook` — disrupts Telegram connectivity

Currently these are permanently blocked (`executionAllowed: false` in capability registry).
The approval queue is the path from "blocked" to "executed with consent" without
removing the safety gate.

---

## Design Goals

1. **No auto-approve** — system never approves on behalf of founder, ever.
2. **No timeout-approve** — pending actions do not become approved by age.
3. **Explicit phrase required** — approval requires the founder to type an exact phrase.
4. **Single action per approval** — one approval unlocks one specific action instance.
5. **Audit trail** — every approval decision (approve or reject) is logged.
6. **Dry-run first** — the pending action stores a dry-run preview, not the real execution.
7. **Reject-safe** — rejection has no side effects; nothing was executed.

---

## Queue File Location

```
CHINTU_OUTBOX/pending_approvals.jsonl
```

This file is gitignored (same as audit log). One JSON object per line.

---

## Pending Action Schema

```json
{
  "approvalId": "string — unique ID (uuid v4)",
  "createdAt": "string — ISO 8601 UTC",
  "capabilityId": "string — e.g. 'chintu.gitPush'",
  "actionDescription": "string — human-readable e.g. 'Push branch main to origin'",
  "riskLabel": "requires_approval | blocked",
  "source": "telegram | cli | bridge",
  "userText": "string — original message that triggered this action request",
  "preview": {
    "dryRunResult": "string — what would happen if approved",
    "estimatedSideEffects": ["array of strings describing irreversible effects"],
    "rollbackPossible": "boolean",
    "rollbackInstructions": "string or null"
  },
  "approvalPhrase": "string — exact phrase founder must type to approve",
  "approvedAt": "string or null — ISO 8601 UTC",
  "rejectedAt": "string or null — ISO 8601 UTC",
  "executedAt": "string or null — ISO 8601 UTC",
  "executionResult": "object or null — result after approval + execution",
  "auditTraceId": "string — links to corresponding entry in telegram_connector_audit.jsonl"
}
```

---

## Approval Phrases (per capability)

Each capability defines its own approval phrase. Founder must type the phrase exactly.

| Capability | Required approval phrase |
|-----------|-------------------------|
| `chintu.gitPush` | `APPROVE GIT PUSH` |
| `telegram.sendMessage` | `APPROVE TELEGRAM SEND` |
| `telegram.deleteWebhook` | `APPROVE DELETE WEBHOOK` |

Phrases are case-sensitive. No partial match. No alias.

---

## Approval CLI (Stage 34 Implementation)

```bash
node scripts/chintu-approve.js <approvalId>
```

Flow:
1. Load `CHINTU_OUTBOX/pending_approvals.jsonl`
2. Find entry with matching `approvalId`
3. Display dry-run preview and approval phrase
4. Wait for founder to type the phrase in the terminal
5. If phrase matches: set `approvedAt`, execute action, set `executedAt`, log result
6. If phrase does not match: print "Approval phrase incorrect. Action rejected." and exit
7. If founder types `REJECT`: set `rejectedAt`, log, exit

The script never executes if the approval phrase is wrong. It never auto-fills the phrase.

---

## Rejection Flow

Any of these trigger rejection (no execution):
- Founder types wrong phrase
- Founder types `REJECT`
- Founder Ctrl+C (process terminated without approval)
- `approvalId` not found in queue

All rejections are logged with `rejectedAt`.

---

## Timeout Behavior

**There is no approval timeout.** Pending actions remain in the queue indefinitely.

Rationale: a timed auto-reject is safer than a timed auto-approve, but even auto-reject
hides state from the founder. The queue is a record. The founder approves when ready,
or the entry stays pending until manually rejected.

---

## What Happens When Approved

```
1. Load pending action
2. Verify approval phrase (exact match)
3. Re-run dry-run to confirm state is still valid
4. Check capability registry again (idempotent safety check)
5. Execute action
6. Write executedAt + executionResult to queue entry
7. Write full action trace to telegram_connector_audit.jsonl
8. Notify founder of result (CLI output only — no auto Telegram send)
```

Step 3 (re-dry-run) ensures that if the repo state changed between enqueue and approval,
the founder sees the updated preview before execution.

---

## Example: git push approval flow

**Step 1 — Chintu detects push intent:**
Founder sends "push to github" via Telegram.
Brain router classifies as `chintu.gitPush`.
Capability registry: `requiresApproval: true`, `executionAllowed: false`.

**Step 2 — Queue entry created:**
```json
{
  "approvalId": "a1b2c3d4-...",
  "createdAt": "2026-06-19T15:00:00.000Z",
  "capabilityId": "chintu.gitPush",
  "actionDescription": "Push branch main to origin",
  "riskLabel": "requires_approval",
  "source": "telegram",
  "userText": "push to github",
  "preview": {
    "dryRunResult": "Would push 3 commits to origin/main: [list of commits]",
    "estimatedSideEffects": ["Remote branch updated", "CI triggered", "Cannot undo without git revert"],
    "rollbackPossible": true,
    "rollbackInstructions": "git revert HEAD~3 && git push"
  },
  "approvalPhrase": "APPROVE GIT PUSH",
  "approvedAt": null,
  "rejectedAt": null,
  "executedAt": null,
  "executionResult": null,
  "auditTraceId": "check_everything_20260619T150000Z"
}
```

**Step 3 — Founder approves (next terminal session):**
```
$ node scripts/chintu-approve.js a1b2c3d4-...

Pending action: chintu.gitPush
  Description: Push branch main to origin
  Dry-run preview: Would push 3 commits to origin/main
  Side effects: Remote branch updated; CI triggered; Cannot undo without git revert
  Rollback: git revert HEAD~3 && git push

Type exactly to approve: APPROVE GIT PUSH
Type REJECT to cancel.

> APPROVE GIT PUSH

Re-running dry-run to confirm state...
  Dry-run OK — 3 commits pending.
Executing git push...
  Push succeeded: 3 commits pushed to origin/main.

Approval logged. Execution logged.
```

**Step 4 — Queue entry updated:**
```json
{
  "approvedAt": "2026-06-19T15:05:00.000Z",
  "executedAt": "2026-06-19T15:05:02.000Z",
  "executionResult": { "ok": true, "commitsPushed": 3, "branch": "main" }
}
```

---

## Stage 33 Status

- ✅ Design documented
- ✅ Queue schema defined
- ✅ Approval phrases defined
- ✅ Example flow documented
- ⏳ `scripts/chintu-approve.js` — Stage 34
- ⏳ Queue writer in capability registry — Stage 34
- ⏳ Queue reader/display in telegram runner — Stage 34

---

## Safety Invariants (enforced in design, implemented in Stage 34)

1. No action with `requiresApproval: true` executes without a matching queue entry AND phrase match.
2. No queue entry is auto-approved by timeout, retry, or any automated mechanism.
3. Approval phrases are per-capability — there is no global "APPROVE ALL".
4. Rejected entries are never re-queued automatically.
5. Health-sensitive actions are **blocked**, not queued — they never reach the approval queue.
6. BALA health data never appears in a queue entry.
7. `TELEGRAM_BOT_TOKEN` never appears in a queue entry.
