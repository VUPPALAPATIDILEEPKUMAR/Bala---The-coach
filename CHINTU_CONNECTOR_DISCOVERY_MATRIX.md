# Chintu Connector Discovery Matrix

**Stage:** 19 — Connector Power Layer  
**Purpose:** Research-backed matrix of every connector/tool Chintu can use, with real capability assessment, credential requirements, and activation path.

---

## Discovery Matrix

| # | Connector | Free? | Practical? | Code Exists? | Current Stage | API/Protocol | Auth Method | Rate Limits | First Action |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **Telegram Bot API** | Yes | Yes | Yes | dry-run | HTTPS REST | Bot token (@BotFather) | ~30 msg/sec (generous) | Founder creates bot |
| 2 | **Discord Webhooks** | Yes | Yes | Yes | dry-run | HTTPS POST | Webhook URL | 30 req/60sec per webhook | Founder creates webhook |
| 3 | **Slack Incoming Webhooks** | Yes | Yes | Yes | dry-run | HTTPS POST | Webhook URL | 1 msg/sec (burst OK) | Founder creates Slack app |
| 4 | **Gmail API** | Yes | Partial | Architecture | architecture-only | HTTPS REST + OAuth2 | OAuth2 / app password | 250 sends/day | Design draft adapter |
| 5 | **GitHub CLI (`gh`)** | Yes | Yes | No | discovered | CLI / REST API | `gh auth login` | 5000 req/hr authenticated | Write adapter |
| 6 | **Local Outbox** | Yes | Yes | Yes | active | Filesystem | None | Unlimited | Already working |
| 7 | **Claude Code Agents** | Yes | Yes | Yes | active | Local process | Session-based | N/A | Already working |
| 8 | **ntfy.sh (push)** | Yes | Yes | No | discovered | HTTPS POST | Topic name (optional token) | No hard limit (fair use) | Write adapter |
| 9 | **Pushover** | $5 once | Yes | No | discovered | HTTPS POST | User key + app token | 7500 msg/month | Consider after ntfy.sh |
| 10 | **Gotify** | Yes (self-host) | Partial | No | discovered | HTTPS REST | App token | Self-managed | Consider if self-hosting |

---

## Detailed Capability Assessment

### Tier 1 — Ready to Activate (code exists, founder action only)

#### Telegram Bot API

- **What it is:** Free bot platform. @BotFather creates bots in seconds. Bot sends messages to chats/groups via HTTPS.
- **What Chintu can do:** Send text messages, formatted messages (Markdown/HTML), silent messages, message edits.
- **Real capability verified:** `buildRequest()` in `chintu-connector-send.js` constructs valid Telegram `sendMessage` API call.
- **Credential flow:** Founder → @BotFather → `/newbot` → copy token → set `CHINTU_TG_BOT_TOKEN`. Founder → send any message to bot → call `getUpdates` → copy `chat_id` → set `CHINTU_TG_CHAT_ID`.
- **Env vars:** `CHINTU_TG_BOT_TOKEN`, `CHINTU_TG_CHAT_ID`, `CHINTU_TG_TARGET`, `CHINTU_TG_ALLOWLIST`
- **What must never be committed:** Bot token, chat ID
- **Validation rules:** Token matches `/^\d+:[A-Za-z0-9_-]{35,}$/`. Chat ID is integer (positive for users, negative for groups).
- **First safe test:** `--preview` then `--send` with body "Chintu says hello — first real connector test"
- **Rollback:** Create `CONNECTOR_telegram_PAUSE`. Or: revoke token via @BotFather `/revoke`.
- **Logs:** `connector_audit.log.jsonl`, `connector_sent.log.jsonl`
- **BALA guard:** Health-data regex blocks all BALA metrics from message body.

#### Discord Webhooks

- **What it is:** Free webhook endpoint for any Discord channel. No bot hosting, no gateway connection.
- **What Chintu can do:** Post text messages to a channel. Supports embeds (structured cards) in future.
- **Real capability verified:** `buildRequest()` constructs valid Discord webhook POST. `allowed_mentions: { parse: [] }` prevents accidental @everyone.
- **Credential flow:** Founder → Discord server → Channel Settings → Integrations → Webhooks → New Webhook → Copy URL.
- **Env vars:** `CHINTU_DISCORD_WEBHOOK_URL`, `CHINTU_DISCORD_TARGET`, `CHINTU_DISCORD_ALLOWLIST`
- **What must never be committed:** Webhook URL (contains auth token)
- **Validation rules:** URL matches `https://discord.com/api/webhooks/` or `https://discordapp.com/api/webhooks/` prefix.
- **First safe test:** `--preview` then `--send` with body "Chintu Discord connector active"
- **Rollback:** Create `CONNECTOR_discord_PAUSE`. Or: delete webhook in Discord settings.
- **BALA guard:** Same health-data regex.

#### Slack Incoming Webhooks

- **What it is:** Free webhook for posting to a Slack channel. Part of Slack's free tier.
- **What Chintu can do:** Post text messages to a channel. Supports Block Kit (structured messages) in future.
- **Real capability verified:** `buildRequest()` constructs valid Slack webhook POST.
- **Credential flow:** Founder → api.slack.com → Create App → Incoming Webhooks → Add to channel → Copy URL.
- **Env vars:** `CHINTU_SLACK_WEBHOOK_URL`, `CHINTU_SLACK_TARGET`, `CHINTU_SLACK_ALLOWLIST`
- **What must never be committed:** Webhook URL
- **Validation rules:** URL matches `https://hooks.slack.com/services/` prefix.
- **First safe test:** `--preview` then `--send` with body "Chintu Slack connector active"
- **Rollback:** Create `CONNECTOR_slack_PAUSE`. Or: deactivate webhook in Slack app settings.
- **BALA guard:** Same health-data regex.

### Tier 2 — Architecture Exists, Needs Adapter

#### Gmail API (Draft Mode)

- **What it is:** Free Gmail API for creating drafts/sending email. 250 sends/day on personal accounts.
- **What Chintu can do:** Create email drafts that the founder reviews in Gmail before clicking Send. Future: direct send with full OAuth2 flow.
- **Implementation path:** Use `nodemailer` with OAuth2, or use Google API client library to create drafts via `users.drafts.create`.
- **Credential flow:** Google Cloud Console → Create project → Enable Gmail API → Create OAuth2 credentials → Download JSON → Run consent flow → Store refresh token.
- **Complexity:** Higher than webhooks. OAuth2 consent flow requires browser interaction once.
- **Env vars:** `CHINTU_GMAIL_TARGET`, `CHINTU_GMAIL_ALLOWLIST`, `CHINTU_GMAIL_FROM`, `CHINTU_GMAIL_CREDENTIALS_PATH`
- **What must never be committed:** OAuth credentials JSON, refresh tokens
- **First safe test:** Create a draft in founder's Gmail (not send it)
- **BALA guard:** Same health-data regex.

#### GitHub CLI

- **What it is:** `gh` command-line tool for GitHub API. Free, authenticated via `gh auth login`.
- **What Chintu can do:** Create issues (self-reporting), comment on PRs, create releases, post commit statuses.
- **Implementation path:** Shell out to `gh issue create`, `gh pr comment`, etc. Parse JSON output.
- **Credential flow:** `gh auth login` (interactive, one-time). Token stored in OS keychain.
- **Env vars:** `CHINTU_GH_REPO`, `CHINTU_GH_ALLOWLIST`
- **What must never be committed:** GitHub tokens (managed by `gh`)
- **First safe test:** `gh issue create --title "Chintu connector test" --body "..." --repo <repo>` (then close it)
- **BALA guard:** Same health-data regex.

### Tier 3 — Discovered, Needs Research + Adapter

#### ntfy.sh (Phone Push)

- **What it is:** Free, open-source push notification service. HTTP POST to a topic → phone notification.
- **What Chintu can do:** Push critical alerts to founder's phone (heartbeat failure, approval needed, error alerts).
- **Implementation path:** Simple HTTPS POST to `https://ntfy.sh/<topic>`. Body is the notification text. Headers for title, priority, tags.
- **Credential flow:** No signup needed for public topics. For private: `ntfy token create` or use username/password.
- **Env vars:** `CHINTU_PUSH_SERVICE=ntfy`, `CHINTU_PUSH_TOPIC`, `CHINTU_PUSH_TOKEN` (optional for private topics), `CHINTU_PUSH_ALLOWLIST`
- **What must never be committed:** Topic name (if private), access token
- **First safe test:** `curl -d "Chintu push test" ntfy.sh/<topic>` (manual, then automate in adapter)
- **BALA guard:** Same health-data regex.

#### Pushover / Gotify

- **Pushover:** $5 one-time purchase. Well-tested. 7500 msg/month. Good fallback if ntfy.sh is insufficient.
- **Gotify:** Free, self-hosted. Requires running a server. Good for full control but higher setup cost.
- **Recommendation:** Start with ntfy.sh. Move to Pushover or Gotify only if needed.

---

## Connector Stage Summary

| Connector | Stage | Sends Today? | Next Transition | Founder Action Needed |
|---|---|---|---|---|
| Local outbox | **active** | Yes (local) | N/A | None |
| Claude Code agents | **active** | Yes (local) | N/A | None |
| Telegram | **dry-run** | No | configured → ready → active | Create bot, set env vars |
| Discord | **dry-run** | No | configured → ready → active | Create webhook, set env vars |
| Slack | **dry-run** | No | configured → ready → active | Create Slack app, set env vars |
| Gmail | **architecture-only** | No | Write adapter → dry-run | Design decision needed |
| GitHub CLI | **discovered** | No | Write adapter → configured | Check `gh auth status` |
| ntfy.sh | **discovered** | No | Write adapter → configured | Install ntfy app on phone |
| Pushover | **discovered** | No | Purchase → write adapter | $5 purchase decision |
| Gotify | **discovered** | No | Self-host → write adapter | Server hosting decision |

---

## What's NOT in This Matrix

- Paid APIs (Twilio, SendGrid, AWS SNS) — Chintu prioritizes free tools
- Social media posting — out of scope for agent OS
- Anything requiring credit card signup — not free enough

## What IS in This Matrix

- Every free connector Chintu can realistically use today or in the near future
- Real API details, not theoretical
- Real credential flows, not placeholders
- Real validation rules, not aspirational
- Real first tests, not hypothetical
