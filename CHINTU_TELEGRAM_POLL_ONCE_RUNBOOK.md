# Chintu Telegram Poll-Once Runbook - Stage 31

This runbook is the safe manual path for the founder to activate Telegram
poll-once without opening real send by accident.

## Exact safe steps

1. Create a Telegram bot with BotFather.

2. Put the token only in your local shell environment:

```powershell
$env:TELEGRAM_BOT_TOKEN="..."
```

3. Send a message to the bot from your phone.

4. First discover chat and sender IDs using poll-once dry-run discovery mode:

```powershell
node scripts\chintu-telegram-runner.js --poll-once --dry-run --discover-ids
```

5. Set the allowlist in your local shell:

```powershell
$env:CHINTU_TELEGRAM_ALLOWED_CHAT_IDS="..."
$env:CHINTU_TELEGRAM_ALLOWED_SENDER_IDS="..."
```

6. Run one safe dry-run intake:

```powershell
node scripts\chintu-telegram-runner.js --poll-once --dry-run
```

7. Start the local bridge:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\chintu-allegro-start.ps1
```

8. Run one safe execute-local pass:

```powershell
node scripts\chintu-telegram-runner.js --poll-once --dry-run --execute-local
```

9. Only later, if you are ready for explicitly gated send:

```powershell
$env:CHINTU_TELEGRAM_SEND_ENABLED="1"
node scripts\chintu-telegram-runner.js --poll-once --send
```

## Warnings

- Do not store Telegram tokens in repo files.
- Do not take screenshots that show the token.
- Do not use real send unless you are intentionally ready.
- Do not send health data to Telegram.
- Do not remove the sender allowlist.
- Do not run infinite polling. Poll-once only.

## Recommended preflight

Run this first:

```powershell
node scripts\chintu-telegram-runner.js --setup-check
```

It confirms:

- token missing or configured
- allowlist missing or configured
- dry-run default mode
- send disabled or enabled gate state
- bridge offline or connected

No token value is printed.
