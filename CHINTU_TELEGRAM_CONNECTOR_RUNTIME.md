# Chintu Telegram Connector Runtime — Stage 30

This is the first real phone-command runtime for Chintu. It is real enough to
read Telegram updates and generate founder-tone replies, but still defaults to
safe preview mode.

## Runtime files

- `scripts/chintu-telegram-adapter.js`
- `scripts/chintu-telegram-runner.js`
- `scripts/chintu-phone-command-contract.js`
- `scripts/chintu-brain-router.js`
- `scripts/chintu-local-bridge.js`

## Modes

1. Fixture mode
   - Reads local JSON only.
   - Example:
     - `node scripts/chintu-telegram-runner.js --fixture scripts\fixtures\telegram-check-everything.json --dry-run`

2. Dry-run live-intake mode
   - Requires `TELEGRAM_BOT_TOKEN`.
   - Reads `getUpdates` once only when `--poll-once` is passed.
   - Does not send any reply.
   - Example:
     - `node scripts/chintu-telegram-runner.js --poll-once --dry-run`

3. Approved-send mode
   - Requires all of:
     - `TELEGRAM_BOT_TOKEN`
     - `CHINTU_TELEGRAM_ALLOWED_CHAT_IDS` or `CHINTU_TELEGRAM_ALLOWED_SENDER_IDS`
     - `CHINTU_TELEGRAM_SEND_ENABLED=1`
     - CLI `--send`
     - allowlisted sender
     - non-health-sensitive command
     - written audit log
   - Example:
     - `node scripts/chintu-telegram-runner.js --poll-once --send`

## Supported Telegram update types

- `message`
- `edited_message`

## Parked Telegram update types

- `callback_query`
- `channel_post`
- `edited_channel_post`
- `inline_query`
- non-text messages

These return a safe preview reply and never trigger bridge execution or send.

## Local bridge handoff

The runner can call the local bridge only when all of the following are true:

- `--execute-local` was passed
- the sender is allowlisted
- the command is safe to run
- the command is not health-sensitive
- the bridge is healthy on `127.0.0.1`

The runner never shells out. It only talks to the local bridge HTTP API on
loopback.

## Audit log

Every run appends one line to:

- `CHINTU_OUTBOX/telegram_connector_audit.jsonl`

The audit log stores update ids, sender/chat ids, text SHA-256, intent, risk,
would-run sequence/action, bridge execution status, and send status. It does
not store tokens.

## Safety boundary

- Default dry-run
- No infinite polling
- No webhook
- No browser token input
- No health data transfer
- No token printing
- Deny sender by default
- Bridge remains localhost-only

## Related docs

- [Chintu Telegram Setup Safe](./CHINTU_TELEGRAM_SETUP_SAFE.md)
- [Chintu Telegram Status Plan](./CHINTU_TELEGRAM_STATUS_PLAN.md)
- [Chintu Connector Policy](./CHINTU_CONNECTOR_POLICY.md)
