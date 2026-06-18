# Chintu Connector Policy

The single rulebook every connector, local or future external, must
obey. Read this before activating anything.

---

## 1. The four-stage ladder (recap)

```
parked -> dry-run -> ready -> active
```

A connector cannot skip a stage. Each step is an explicit founder
decision.

---

## 2. Hard rules (apply to every connector)

1. **Preview before send.** Every message must exist as a local file
   in `CHINTU_OUTBOX/` before any external transmission is even
   considered.
2. **Dry-run before activation.** No connector flips from `dry-run`
   to `ready` without at least one full local dry-run pass and a
   reviewable diff of the proposed adapter script.
3. **Approval before real action.** No connector flips from `ready`
   to `active` without an explicit founder decision naming the
   connector.
4. **Logs after action.** Every real send writes a local audit line
   and a local sent-log line with timestamp, connector, recipient,
   and message SHA-256. No message body in the sent log.
5. **Off-switch.** Every active connector reads a flag file
   (`CHINTU_OUTBOX/CONNECTOR_<name>_PAUSE` for that connector or
   `CHINTU_OUTBOX/CONNECTORS_GLOBAL_PAUSE` for everything). Presence
   of the flag means the connector no-ops.
6. **Secret storage.** Tokens, webhook URLs, and app passwords never
   live in the repo. They live in Windows User env vars or another
   local secret store. Adapter scripts read them by name only.
7. **Env-var only activation config.** Real connector activation is
   configured through local env vars only. No committed local config
   file is used for activation.
8. **Allowlist.** Real sending recipients are listed in per-connector
   env vars such as `CHINTU_TG_ALLOWLIST`,
   `CHINTU_DISCORD_ALLOWLIST`, `CHINTU_SLACK_ALLOWLIST`, and
   `CHINTU_GMAIL_ALLOWLIST`. No recipient outside the allowlist is
   ever a valid destination.
9. **Approval phrase gate.** Real sending requires the exact founder
   phrase stored outside the repo in
   `CHINTU_CONNECTOR_APPROVAL_PHRASE`, and that same phrase must be
   explicitly provided at send time.
10. **No health data, ever.** No connector, local outbox included,
    may carry BALA user data, mood notes, health metrics, medical
    content, or anything matching the medical-claims test patterns.
11. **No emergency framing.** No connector message may imply Chintu
    is monitoring for emergencies, predicting outcomes, or replacing
    a clinician.
12. **No mass send.** Recipients are personal. No broadcast lists,
    no fan-out, no auto-forward chains.

---

## 3. What a connector message MAY contain

- Timestamp.
- Repo branch.
- Latest commit hash (short).
- Working tree state ("clean" or "N uncommitted").
- Unpushed commit count.
- One short next-action sentence.
- Bridge / runtime status word (GREEN / YELLOW / RED).

That is the safe default envelope. Everything else needs a per-message
exception.

---

## 4. What a connector message MUST NOT contain

- BALA user data of any kind.
- Health metrics (HR, sleep, steps, BP, glucose, mood, symptoms,
  weight, anything).
- Medical content, condition names, treatment advice, predictions.
- Secrets, tokens, file paths under `CHINTU_MEMORY_VAULT/`.
- Full commit messages (subject only).
- Photos, screenshots, files, attachments.
- @mentions.
- Anything matching `chintu-medical-claims.test.js` patterns.

---

## 5. The flip-to-ready commit

A connector cannot become `ready` until the founder writes a commit
with the subject:

```
chore: flip <connector> from dry-run to ready
```

That commit must:

- Add the adapter script under `scripts/chintu-connector-<name>.ps1`
  or `.js`, or expand `scripts/chintu-connector-send.js` with the
  reviewed connector adapter.
- Add a connector test that asserts:
  - The adapter reads secrets via env var, not from disk in the repo.
  - The adapter requires `CHINTU_CONNECTOR_MODE=active` plus the
    exact founder approval phrase before a real send is possible.
  - The adapter respects the off-switch flag file.
  - The adapter refuses to run if the dry-run preview is missing.
- Keep the connector at `ready` status, not `active`.

---

## 6. The flip-to-active commit

A connector cannot become `active` until the founder writes a commit
with the subject:

```
chore: activate <connector> for Chintu OS heartbeats
```

That commit must:

- Document the env vars and allowlist entries used locally.
- Confirm the off-switch flag file is documented in
  `CHINTU_OUTBOX/README.md`.
- Confirm the secret lives outside the repo and the adapter reads it
  correctly.

Until those conditions exist, every connector stays at `dry-run` or
`ready` at best.

---

## 7. Revocation

Any connector can be moved back to `parked` at any time by:

1. Creating `CHINTU_OUTBOX/CONNECTOR_<name>_PAUSE` (immediate effect).
2. Then later, a `chore: park <connector>` commit removing the
   adapter script.

The founder owns this. No agent decides.

---

## 8. BALA safety footer

BALA is a health-awareness companion. It does not diagnose, treat,
predict, prevent, replace doctors, or provide emergency monitoring.
