# Chintu Telegram Setup Safe - Stage 31

This setup guide is for controlled activation only. The default path is still
fixture or dry-run.

## 1. Run setup-check first

```bash
node scripts/chintu-telegram-runner.js --setup-check
```

This prints token, allowlist, send gate, and bridge status without printing the
token value.

## 2. Run the local fixtures first

```bash
node scripts/chintu-telegram-runner.js --fixture scripts\fixtures\telegram-hi.json --dry-run
node scripts/chintu-telegram-runner.js --fixture scripts\fixtures\telegram-check-everything.json --dry-run
node scripts/chintu-telegram-runner.js --fixture scripts\fixtures\telegram-denied-sender.json --dry-run
node scripts/chintu-telegram-runner.js --fixture scripts\fixtures\telegram-emergency.json --dry-run
```

## 3. Discover Telegram IDs safely

Set `TELEGRAM_BOT_TOKEN` outside the repo, then run:

```bash
node scripts/chintu-telegram-runner.js --poll-once --dry-run --discover-ids
```

This reads one `getUpdates` batch and stops. It prints masked chat/sender IDs,
never sends, and never executes locally.

## 4. Enable poll-once dry-run after allowlisting

Set one or both of:

- `CHINTU_TELEGRAM_ALLOWED_CHAT_IDS`
- `CHINTU_TELEGRAM_ALLOWED_SENDER_IDS`

Then run:

```bash
node scripts/chintu-telegram-runner.js --poll-once --dry-run
```

This reads one `getUpdates` batch and stops. No reply is sent.

## 5. Optional local execution

If you want the Telegram runner to hand a safe command to the local bridge, pass
`--execute-local`.

```bash
node scripts/chintu-telegram-runner.js --poll-once --dry-run --execute-local
```

This only works when the bridge is healthy on `127.0.0.1`, the sender is
allowlisted, and the command is safe to run.

## 6. Explicit send gates

Send is off unless every gate below is open:

- `TELEGRAM_BOT_TOKEN` exists
- `CHINTU_TELEGRAM_ALLOWED_CHAT_IDS` or `CHINTU_TELEGRAM_ALLOWED_SENDER_IDS` is set
- `CHINTU_TELEGRAM_SEND_ENABLED=1`
- the CLI includes `--send`
- the sender is allowlisted
- the command is not health-sensitive

Example:

```bash
node scripts/chintu-telegram-runner.js --poll-once --send
```

## 7. What stays prohibited

- No health data in Telegram
- No medical content in Telegram
- No webhook
- No daemon
- No browser token entry
- No sender allow-all mode

## 8. Audit path

Every actionable run writes:

- `CHINTU_OUTBOX/telegram_connector_audit.jsonl`

See [Chintu Telegram Connector Runtime](./CHINTU_TELEGRAM_CONNECTOR_RUNTIME.md)
for the runtime contract and
[Chintu Telegram Poll-Once Runbook](./CHINTU_TELEGRAM_POLL_ONCE_RUNBOOK.md) for
the exact manual phone steps.
