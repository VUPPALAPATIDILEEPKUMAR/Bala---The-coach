# Chintu Telegram Connector Runtime - Stage 31

This is the controlled Telegram phone-command runtime for Chintu. It is
operational for fixture runs, one-shot Telegram intake, and localhost bridge
handoff, but it still defaults to safe preview mode.

## Runtime files

- `scripts/chintu-telegram-adapter.js`
- `scripts/chintu-telegram-runner.js`
- `scripts/chintu-phone-command-contract.js`
- `scripts/chintu-brain-router.js`
- `scripts/chintu-local-bridge.js`

## Commands

1. Setup check
   - Prints a safe checklist only.
   - No token printing.
   - Example:
     - `node scripts/chintu-telegram-runner.js --setup-check`

2. Fixture dry-run
   - Reads local JSON only.
   - Example:
     - `node scripts/chintu-telegram-runner.js --fixture scripts\fixtures\telegram-check-everything.json --dry-run`

3. Poll-once dry-run
   - Requires `TELEGRAM_BOT_TOKEN`.
   - Requires `CHINTU_TELEGRAM_ALLOWED_CHAT_IDS` or `CHINTU_TELEGRAM_ALLOWED_SENDER_IDS`.
   - Reads `getUpdates` once only when `--poll-once` is passed.
   - Does not send any reply.
   - Example:
     - `node scripts/chintu-telegram-runner.js --poll-once --dry-run`

4. Poll-once ID discovery mode
   - Requires `TELEGRAM_BOT_TOKEN`.
   - Does not require an allowlist.
   - Prints masked chat/sender IDs so the founder can set the allowlist safely.
   - Never sends and never executes locally.
   - Example:
     - `node scripts/chintu-telegram-runner.js --poll-once --dry-run --discover-ids`

5. Local bridge handoff
   - Requires an allowlisted, safe, non-health-sensitive command.
   - Requires `--execute-local`.
   - Requires the bridge to be healthy on `127.0.0.1`.
   - Example:
     - `node scripts/chintu-telegram-runner.js --poll-once --dry-run --execute-local`

6. Approved-send mode
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

## Setup-check output

`--setup-check` reports:

- token missing or configured
- allowlist missing or configured
- default dry-run mode
- send disabled or enabled gate state
- bridge offline or connected
- next safe human step

It never prints the Telegram token value.

## Audit log

Every actionable run appends one line to:

- `CHINTU_OUTBOX/telegram_connector_audit.jsonl`

The audit log stores update ids, sender/chat ids, text SHA-256, intent, risk,
would-run sequence/action, discovery-mode state, bridge execution status, and
send status. It does not store tokens.

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
- [Chintu Telegram Poll-Once Runbook](./CHINTU_TELEGRAM_POLL_ONCE_RUNBOOK.md)
- [Chintu Telegram Status Plan](./CHINTU_TELEGRAM_STATUS_PLAN.md)
- [Chintu Connector Policy](./CHINTU_CONNECTOR_POLICY.md)
