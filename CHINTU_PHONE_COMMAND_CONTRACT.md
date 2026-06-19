# Chintu Phone Command Payload Contract

Stage 29 exists so we can define the local contract for phone and Telegram-shaped
commands before any real Telegram connector is activated. This keeps the payload
shape, sender allowlist, command classification, and reply envelope deterministic
while polling, webhooks, and real sends remain fully parked.

Nothing in this stage sends a Telegram message, stores a token, calls a bot API,
or transfers health data. It is local-only contract work.

---

## 1. Why this exists before Telegram activation

- Phone commands need a stable input shape before a connector is allowed to call
  into Chintu.
- Sender identity must be normalized before allowlist checks.
- Classification must stay behind the same Chintu brain router and localhost
  bridge allowlists already used by Allegro.
- External send requests must be parked now, not accidentally activated later.

This stage gives us a safe boundary:

Phone / Telegram-shaped message
-> payload normalization
-> sender allowlist check
-> command classification
-> future bridge handoff summary
-> reply envelope preview

---

## 2. Supported payloads

Generic shape:

```json
{
  "source": "telegram",
  "chatId": "12345",
  "senderId": "67890",
  "senderName": "Chintu",
  "text": "check everything",
  "timestamp": "2026-06-18T23:00:00Z"
}
```

Telegram-like update shape:

```json
{
  "message": {
    "chat": { "id": 12345 },
    "from": { "id": 67890, "first_name": "Chintu" },
    "text": "validate Bala",
    "date": 1780000000
  }
}
```

The contract normalizes both shapes into a stable local object with:

- `channel`
- `source`
- `chatId`
- `senderId`
- `senderName`
- `text`
- `textNormalized`
- `timestamp`
- `issues`

Missing fields are reported as issues. They do not trigger any network or local
execution.

---

## 3. Allowlist model

- Deny by default.
- Require `allowedSenderIds` or `allowedChatIds` from options.
- Match by exact sender ID or exact chat ID.
- Never allow all by default.
- Unknown sender means no action handoff, no bypass, no fake execution.

`isAllowedPhoneSender()` returns:

```json
{
  "ok": true,
  "allowed": false,
  "reason": "allowlist_required",
  "normalized": { "...": "..." }
}
```

This keeps sender trust separate from command intent.

---

## 4. Approval model

- Read-only and local-safe commands may classify as safe to hand off.
- External-send style commands are always parked in this stage.
- External-send style commands set `requiresApproval: true`.
- Stage 29 still does not send even with `requiresApproval: true`.
- Health-sensitive text never triggers local actions.

This means approval is represented in the contract now, but not activated.

---

## 5. Blocked cases

- Invalid payload shape
- Missing command text
- Unknown sender
- External-send style requests
- Health-emergency text
- Unknown text with no confident action

Blocked does not mean silent. The contract returns a deterministic reply for
each case, but never claims that work was executed when it was not.

---

## 6. Command classification behavior

Where practical, classification uses `scripts/chintu-brain-router.js` so the
phone lane stays aligned with the Allegro and bridge lane.

Examples:

- `hi` -> greeting reply only
- `check everything` -> `check_everything` sequence summary
- `validate Bala` -> `bala_health_check` sequence summary
- `run validator` -> `run_validator_dry_run`
- `check connectors` -> `connector_readiness`
- unknown text -> guiding reply, no fake execution
- emergency text -> urgent-care reply, no local actions

No command in this stage can bypass the bridge allowlists.

---

## 7. Reply envelope behavior

`buildPhoneReplyEnvelope()` returns a local preview object only:

```json
{
  "ok": true,
  "channel": "telegram",
  "chatId": "12345",
  "text": "Running the full safe sweep...",
  "actionSummary": "Would hand off the \"check_everything\" sequence to the localhost bridge allowlist.",
  "requiresApproval": false,
  "auditHint": "Stage 29 local-only preview. No Telegram send was performed."
}
```

The envelope must not contain:

- Telegram bot tokens
- API URLs
- secrets
- webhook URLs
- health data
- medical content

---

## 8. Safety boundaries

- No real sends
- No polling
- No webhook
- No Bot API call
- No secrets
- No token handling
- No external network
- No broad connector access
- No health data transfer
- No paid APIs

Everything remains local-first and founder-controlled.

---

## 9. Future Stage 30 path

Stage 30 can build the Telegram connector only after this contract is stable and
after founder approval for the real connector lane. That future stage should:

- consume this normalized payload contract
- preserve sender allowlist checks
- keep bridge execution behind existing allowlisted actions
- keep external sends approval-gated
- preserve no-health-data rules
- add connector-specific dry-run and activation tests

Until then, this contract is preparation only.

---

## 10. BALA safety footer

BALA is a health-awareness companion. It does not diagnose, treat, predict,
prevent, replace doctors, or provide emergency monitoring.
