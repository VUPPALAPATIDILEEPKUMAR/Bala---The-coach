# Chintu Plugin / Connector Registry — Stage 30

Deny by default. A connector is "active" only when it is local-and-safe, or when
it has been explicitly activated with env vars, an allowlist, and an approval
phrase. Tool metadata is never trusted blindly.

| # | Connector / plugin | Status | Why |
| --- | --- | --- | --- |
| 1 | Local bridge (127.0.0.1) | ACTIVE | Localhost only, fixed allowlist, audited |
| 2 | Local filesystem / outbox | ACTIVE (safe) | Repo-scoped writes (audit, packets, runs) |
| 3 | Phone command contract | ACTIVE | Deterministic normalize + allowlist + reply envelope |
| 4 | Telegram adapter | DRY-RUN READY | Text-only updates, deny by default, no send |
| 5 | Telegram runner | ENV-GATED | Fixture mode default, poll-once optional, send gated |
| 6 | GitHub CLI | PARKED until activated | Repo-scoped token, release-gated, next connector lane |
| 7 | Ollama (local model) | DETECTED only | Status shown if running on 127.0.0.1:11434 |
| 8 | OpenClaw gateway | DETECTED only | Status shown if running on 127.0.0.1:18789 |
| 9 | Browser automation / Playwright | PARKED | Powerful; needs allowlist before use |
| 10 | MCP filesystem | PARKED | High risk; repo-scoped + read-only first |
| 11 | MCP GitHub | PARKED | Later, with repo-scoped token + tool allowlist |
| 12 | Gmail / Drive | PARKED | Needs OAuth + safe scope rules |
| 13 | Phone / watch notifications | FUTURE | Telegram / ntfy / Gotify evaluated later |

## Activation rules

- Deny by default; activation is explicit and reversible.
- Version pinning and a tool allowlist for any MCP.
- Read-only first; writes only after a dry run.
- Every action is written to the audit log.
- No third-party MCP server is connected automatically.
- Telegram live send requires all of:
  - `TELEGRAM_BOT_TOKEN`
  - `CHINTU_TELEGRAM_ALLOWED_CHAT_IDS` or `CHINTU_TELEGRAM_ALLOWED_SENDER_IDS`
  - `CHINTU_TELEGRAM_SEND_ENABLED=1`
  - CLI `--send`
  - an allowlisted sender
  - a written audit line

See `CHINTU_MCP_SECURITY_GATE.md` for the per-tool gate and
`CHINTU_REAL_CONNECTOR_MCP_SCAN.md` for the live scan.
