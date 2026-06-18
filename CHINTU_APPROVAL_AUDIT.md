# Chintu Approval Audit

Tracked, append-only local record of founder approvals for planner
actions. This file is never sent anywhere. It records the exact
`approve <id>` phrase after the founder approves a queued action by
hand.

## Schema

| Timestamp | Action id | Approval phrase | Branch | HEAD | Notes |
|---|---|---|---|---|---|

## How to append

```powershell
powershell -ExecutionPolicy Bypass -File scripts\chintu-approval-audit.ps1 -ApprovalPhrase "approve A6-flip-telegram-dry-run"
```

The helper validates the phrase shape, reads only local git metadata,
and appends one row to the entries table below.

## Entries

| Timestamp | Action id | Approval phrase | Branch | HEAD | Notes |
|---|---|---|---|---|---|

## BALA safety footer

BALA is a health-awareness companion. It does not diagnose, treat,
predict, prevent, replace doctors, or provide emergency monitoring.
