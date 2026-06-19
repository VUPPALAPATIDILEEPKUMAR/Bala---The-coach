# Chintu Telegram Status Plan (Stage 30 runtime status)

**Status:** DRY-RUN READY by default. A Telegram runner exists, but live send
stays off unless explicit env gates and the `--send` flag are present.
**Scope:** the first safe phone-command runtime for Chintu OS.

Telegram is never a destination for BALA user data, health metrics, or medical
content — full stop.

---

## 1. Current runtime

- `scripts/chintu-telegram-adapter.js` normalizes Telegram updates into the
  phone command contract.
- `scripts/chintu-telegram-runner.js` supports:
  - fixture mode
  - poll-once dry-run mode
  - approved-send mode
- `scripts/chintu-no-network-egress.test.js` only allowlists network access for
  `scripts/chintu-telegram-runner.js` and the localhost bridge runtime.
- No token is committed to this repo.

See [CHINTU Telegram Connector Runtime](./CHINTU_TELEGRAM_CONNECTOR_RUNTIME.md)
and [Chintu Telegram Setup Safe](./CHINTU_TELEGRAM_SETUP_SAFE.md).

---

## 2. What "Telegram alive" means now

Telegram send is considered "alive" only if all of the following are true:

1. `TELEGRAM_BOT_TOKEN` is set outside the repo.
2. `CHINTU_TELEGRAM_ALLOWED_CHAT_IDS` or
   `CHINTU_TELEGRAM_ALLOWED_SENDER_IDS` is set.
3. `CHINTU_TELEGRAM_SEND_ENABLED=1`.
4. The CLI includes `--send`.
5. The update came from an allowlisted sender.
6. The command is not health-sensitive.
7. The runner writes `CHINTU_OUTBOX/telegram_connector_audit.jsonl`.

Until all seven hold, Telegram stays preview-only.

---

## 3. Safe default

- Default mode is fixture or dry-run.
- No daemon.
- No infinite polling.
- No webhook.
- No browser token input.
- No health data transfer.

---

## 4. Safe smoke commands

```bash
node scripts/chintu-telegram-runner.js --fixture scripts\fixtures\telegram-hi.json --dry-run
node scripts/chintu-telegram-runner.js --poll-once --dry-run
node scripts/chintu-telegram-runner.js --poll-once --send
```

## 5. What must never be sent over Telegram (ever)

- BALA user notes, scores, trends, or coach text.
- Any health-data field, even abstracted.
- Photos, screenshots, files, or attachments.
- Anything matching the medical-claims test patterns.

These prohibitions remain even if Telegram is later activated for
Chintu-OS-only heartbeats.

---

## 6. Trigger to expand

Founder explicitly opens the next lane: webhook or daemon support. Until then,
poll-once only.

---

## 9. BALA safety footer

BALA is a health-awareness companion. It does not diagnose, treat,
predict, prevent, replace doctors, or provide emergency monitoring.
