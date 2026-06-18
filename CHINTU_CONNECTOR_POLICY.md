# Chintu Connector Policy

The single rulebook every connector — local or future external —
must obey. Read this before activating anything.

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
   to `active` without an explicit founder commit message naming the
   connector by name.
4. **Logs after action.** Every real send writes a line to
   `CHINTU_OUTBOX/sent.log` with timestamp, connector, recipient
   handle, and the message body's SHA-256. No message body in the
   log (so the log doesn't become a leak).
5. **Off-switch.** Every active connector reads a flag file
   (`CHINTU_OUTBOX/CONNECTOR_<name>_PAUSE` for that connector or
   `CHINTU_OUTBOX/CONNECTORS_GLOBAL_PAUSE` for everything). Presence
   of the flag means the connector no-ops.
6. **Secret storage.** Tokens, webhook URLs, app passwords never
   live in the repo. They live in the Windows User env vars or
   Credential Manager. Adapter scripts read them by name only.
7. **Allowlist.** Real sending recipients are listed by name in an
   `allowlist:` field in `CHINTU_CONNECTORS_CONFIG.example.json`
   (or its non-example sibling that lives outside the repo). No
   recipient outside the allowlist is ever a valid destination.
8. **No health data, ever.** No connector — local outbox included —
   may carry BALA user data, mood notes, health metrics, medical
   content, or anything matching the medical-claims test patterns.
9. **No emergency framing.** No connector message may imply Chintu
   is monitoring for emergencies, predicting outcomes, or replacing
   a clinician.
10. **No mass send.** Recipients are personal. No broadcast lists,
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

That's it. Everything else needs a per-message exception.

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

- Add the adapter script under `scripts/chintu-connector-<name>.ps1` or `.js`.
- Add a `chintu-connector-<name>.test.js` that asserts:
  - The adapter reads its token via env var, not from disk in the repo.
  - The adapter respects the off-switch flag file.
  - The adapter refuses to run if the dry-run preview is missing.
- Amend `chintu-no-network-egress.test.js`'s allowlist to permit the
  one outbound URL pattern the adapter needs.
- Leave the connector at `ready` status, not `active`.

---

## 6. The flip-to-active commit

A connector cannot become `active` until the founder writes a commit
with the subject:

```
chore: activate <connector> for Chintu OS heartbeats
```

That commit must:

- Document the allowlist of recipients in
  `CHINTU_CONNECTORS_CONFIG.example.json`.
- Confirm the off-switch flag file is documented in
  `CHINTU_OUTBOX/README.md`.
- Confirm the secret lives outside the repo and the adapter reads
  it correctly.

Until those commits exist, every connector stays at `dry-run` at
best.

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
