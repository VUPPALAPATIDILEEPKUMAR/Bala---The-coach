# Chintu Outbox

Local-only. Nothing in this folder is ever sent.

The outbox is Chintu's local "before the wire" surface. Every founder
message Chintu generates lands here first, as a file. If — and only
if — a connector is later activated by the founder, that connector
will read from this folder, not from anywhere else.

---

## Files

| Path | What | Tracked in git? |
|---|---|---|
| `latest_founder_message.md` | The most recent natural-language founder message. Overwritten each run. | No (gitignored). |
| `founder_message_history.md` | Append-only log of every founder message Chintu has generated. | No (gitignored). |
| `latest_heartbeat.json` | Machine-readable mirror of the latest local heartbeat loop. Marked DRY RUN ONLY. | No. |
| `dry_run_payloads/telegram_preview.json` | What a future Telegram heartbeat *would* look like. Marked DRY RUN ONLY. | No. |
| `dry_run_payloads/slack_preview.json` | Same idea, Slack-shaped. | No. |
| `dry_run_payloads/discord_preview.json` | Same idea, Discord-shaped. | No. |
| `dry_run_payloads/README.md` | Explains the dry-run-payloads folder. | No. |
| `sent.log` | If and only if any connector is later activated, real sends append here (timestamp, connector, recipient handle, SHA-256 of body). | No. |
| `CONNECTOR_<name>_PAUSE` | Optional flag file. If present, that connector no-ops. | Founder-managed. |
| `CONNECTORS_GLOBAL_PAUSE` | Optional flag file. If present, every connector no-ops. | Founder-managed. |

This README is the only tracked file inside `CHINTU_OUTBOX/`. It acts
as the folder sentinel.

---

## How a message gets here

```powershell
powershell -ExecutionPolicy Bypass -File scripts\chintu-founder-message.ps1
```

Then, to render the dry-run payloads:

```bash
node scripts/chintu-message-dry-run.js
```

Neither command sends. Both write local files only.

---

## Promises this folder keeps

- Never carries BALA user data.
- Never carries health metrics, medical content, or condition names.
- Never carries secrets or tokens.
- Never carries vault paths.
- Never carries attachments.

If any file under this folder ever violates one of those, treat that
as a safety incident: stop, delete the file, and open a vault note.

---

## BALA safety footer

BALA is a health-awareness companion. It does not diagnose, treat,
predict, prevent, replace doctors, or provide emergency monitoring.
