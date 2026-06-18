# Chintu Connector Activation Matrix

**Stage:** 18 planning  
**Purpose:** Quick-reference matrix showing every connector, its current stage, what it needs to advance, and who owns each transition.

---

## Activation Matrix

| Connector | Current Stage | Cost | Auth Method | Env Vars Needed | Gates Before Send | Next Step |
|---|---|---|---|---|---|---|
| **Telegram** | dry-run (code exists) | Free | Bot token from @BotFather | `CHINTU_TG_BOT_TOKEN`, `CHINTU_TG_CHAT_ID`, `CHINTU_TG_TARGET`, `CHINTU_TG_ALLOWLIST` | env vars + allowlist + preview + approval phrase + active mode + no pause | Founder creates bot, sets env vars |
| **Discord** | dry-run (code exists) | Free | Webhook URL | `CHINTU_DISCORD_WEBHOOK_URL`, `CHINTU_DISCORD_TARGET`, `CHINTU_DISCORD_ALLOWLIST` | env vars + allowlist + preview + approval phrase + active mode + no pause | Founder creates webhook, sets env vars |
| **Slack** | dry-run (code exists) | Free | Incoming webhook URL | `CHINTU_SLACK_WEBHOOK_URL`, `CHINTU_SLACK_TARGET`, `CHINTU_SLACK_ALLOWLIST` | env vars + allowlist + preview + approval phrase + active mode + no pause | Founder creates webhook, sets env vars |
| **Gmail** | architecture-only | Free | OAuth2 / app password | `CHINTU_GMAIL_TARGET`, `CHINTU_GMAIL_ALLOWLIST`, `CHINTU_GMAIL_FROM`, `CHINTU_GMAIL_CREDENTIALS_PATH` | all of above + credential file + draft review | Design draft-create flow |
| **Local outbox** | active (always on) | Free | None | None | None — always local | Already working |
| **GitHub CLI** | future | Free | `gh auth` | None (uses gh login) | gh installed + authenticated | Add connector adapter |
| **Phone push** | future | Free/low-cost | Varies (ntfy.sh, Pushover) | TBD | TBD | Research best free path |

---

## Connector Stage Definitions

| Stage | What happens | Network calls | Founder action needed |
|---|---|---|---|
| **unavailable** | No code path for this connector | None | Builder writes adapter |
| **configured** | Env vars set, code exists | None | Founder sets env vars |
| **dry-run** | Preview JSON generated, no send | None | Default — no action needed |
| **ready** | All gates pass, still dry-run | None | Automatic when config complete |
| **active** | Real sends happen when approved | Yes — gated | `CHINTU_CONNECTOR_MODE=active` |
| **paused** | Pause file blocks sends | None | Create `CONNECTOR_{name}_PAUSE` |
| **revoked** | Env vars cleared, falls to unavailable | None | Unset env vars |

---

## Global Controls

| Control | Mechanism | Effect |
|---|---|---|
| Global pause | Create `CHINTU_OUTBOX/CONNECTORS_GLOBAL_PAUSE` file | All connectors blocked |
| Per-connector pause | Create `CHINTU_OUTBOX/CONNECTOR_{name}_PAUSE` file | That connector blocked |
| Mode override | Set `CHINTU_CONNECTOR_MODE=dry-run` | All connectors dry-run only |
| Approval phrase | `CHINTU_CONNECTOR_APPROVAL_PHRASE` env var | Must match exactly at send time |

---

## Founder Activation Checklist: Telegram (first connector)

1. [ ] Create Telegram bot via @BotFather → get bot token
2. [ ] Get chat ID for target group/user (send message, use getUpdates API)
3. [ ] Set environment variables:
   ```
   CHINTU_TG_BOT_TOKEN=<token>
   CHINTU_TG_CHAT_ID=<chat_id>
   CHINTU_TG_TARGET=founder-room
   CHINTU_TG_ALLOWLIST=founder-room
   CHINTU_CONNECTOR_APPROVAL_PHRASE=<your secret phrase>
   ```
4. [ ] Run `node scripts/chintu-connector-send.js --check` → confirm readiness shows "ready"
5. [ ] Run `node scripts/chintu-connector-send.js --preview --connector telegram --body "Chintu test"` → review preview JSON
6. [ ] When ready for first real send: `set CHINTU_CONNECTOR_MODE=active`
7. [ ] Run `node scripts/chintu-connector-send.js --send --connector telegram --preview-file CHINTU_OUTBOX/latest_connector_preview.json --approval "<your phrase>"`
8. [ ] Check `CHINTU_OUTBOX/connector_sent.log.jsonl` for confirmation
9. [ ] To pause: create `CHINTU_OUTBOX/CONNECTOR_telegram_PAUSE`
10. [ ] To revoke: unset `CHINTU_TG_BOT_TOKEN`

---

## Health Data Blocklist (applies to all connectors)

These patterns in message body will block preview generation and send:

| Pattern | Example blocked text |
|---|---|
| `heart rate` | "heart rate 61 bpm today" |
| `rhr` | "rhr trending down" |
| `hrv` | "hrv was 45ms" |
| `spo2` | "spo2 reading normal" |
| `blood oxygen` | "blood oxygen 98%" |
| `sleep` | "sleep score 85" |
| `steps` | "steps today: 8000" |
| `glucose` | "glucose level stable" |
| `blood pressure` | "blood pressure 120/80" |
| `weight` | "weight 165 lbs" |
| `symptom` | "symptom: headache" |
| `chest pain` | "chest pain reported" |
| `diagnose` / `treat` / `predict` / `prevent` / `emergency monitoring` | Medical claims language |
