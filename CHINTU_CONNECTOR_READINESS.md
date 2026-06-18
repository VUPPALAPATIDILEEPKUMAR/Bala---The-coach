# Chintu Connector Readiness

Real connector foundation for future founder-approved sends.

Current state: `DRY RUN ONLY`

Nothing in this stage sends anything externally.

## What exists now

- `scripts/chintu-connector-send.js` is the gated activation scaffold.
- `CHINTU_OUTBOX/latest_connector_readiness.json` is the local readiness snapshot.
- `CHINTU_OUTBOX/latest_connector_preview.json` is the local preview artifact.
- `CHINTU_OUTBOX/connector_audit.log.jsonl` is the local audit log shape.
- `CHINTU_OUTBOX/connector_sent.log.jsonl` is the local sent-log shape for future active sends only.

## Connector priority

1. Telegram bot message
2. Discord webhook
3. Slack webhook
4. Gmail draft/send architecture only

## Activation rules

- Config is env-var based only.
- Default mode is `CHINTU_CONNECTOR_MODE=dry-run`.
- No committed secrets, tokens, webhooks, or API keys.
- Every send requires an allowlist match.
- Every send requires a local preview file first.
- Every send requires the exact approval phrase.
- No real send happens unless `CHINTU_CONNECTOR_MODE=active`.
- Global or per-connector pause files block sending immediately.

## Exact env model

- Global mode: `CHINTU_CONNECTOR_MODE`
- Approval phrase source: `CHINTU_CONNECTOR_APPROVAL_PHRASE`
- Telegram: `CHINTU_TG_BOT_TOKEN`, `CHINTU_TG_CHAT_ID`, `CHINTU_TG_TARGET`, `CHINTU_TG_ALLOWLIST`
- Discord: `CHINTU_DISCORD_WEBHOOK_URL`, `CHINTU_DISCORD_TARGET`, `CHINTU_DISCORD_ALLOWLIST`
- Slack: `CHINTU_SLACK_WEBHOOK_URL`, `CHINTU_SLACK_TARGET`, `CHINTU_SLACK_ALLOWLIST`
- Gmail architecture: `CHINTU_GMAIL_FROM`, `CHINTU_GMAIL_TARGET`, `CHINTU_GMAIL_ALLOWLIST`

## Safe local commands

```powershell
node scripts\chintu-connector-send.js --check
node scripts\chintu-connector-send.js --preview --connector telegram --body "Chintu build is clean. Next action: review queue."
```

The `--check` command writes readiness only. The `--preview` command writes preview only.

## Local log shapes

Audit log JSONL:

```json
{"timestamp":"...","event":"blocked_send","connector":"telegram","connector_mode":"dry-run","recipient":"founder-room","recipient_allowlisted":true,"approval_phrase_present":true,"preview_sha256":"...","outcome":"blocked","reason":"CHINTU_CONNECTOR_MODE is not active"}
```

Sent log JSONL:

```json
{"timestamp":"...","connector":"telegram","recipient":"founder-room","preview_sha256":"...","body_sha256":"...","http_status":200,"request_id":null}
```

## Safety boundaries

- No health data in outgoing connector payloads by default.
- No unsafe medical claims.
- No real send in tests.
- No network call during `--check` or `--preview`.
- Gmail remains architecture-only in this stage.

## BALA safety footer

BALA is a health-awareness companion. It does not diagnose, treat, predict, prevent, replace doctors, or provide emergency monitoring.
