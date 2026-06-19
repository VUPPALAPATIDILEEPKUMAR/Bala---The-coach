# Chintu Plugin / Connector Registry — Stage 24

Deny by default. A connector is "active" only when it is local-and-safe, or when
it has been explicitly activated with env vars, an allowlist, and an approval
phrase. Tool metadata is never trusted blindly.

| # | Connector / plugin | Status | Why |
| --- | --- | --- | --- |
| 1 | Local bridge (127.0.0.1) | ACTIVE | Localhost only, fixed allowlist, audited |
| 2 | Local filesystem / outbox | ACTIVE (safe) | Repo-scoped writes (audit, packets, runs) |
| 3 | Telegram Bot API | PARKED until activated | Real/free, env-gated, allowlist + approval phrase |
| 4 | GitHub CLI | PARKED until activated | Real/free, repo-scoped token, release-gated |
| 5 | Ollama (local model) | DETECTED only | Status shown if running on 127.0.0.1:11434 |
| 6 | OpenClaw gateway | DETECTED only | Status shown if running on 127.0.0.1:18789 |
| 7 | Browser automation / Playwright | PARKED | Powerful; needs allowlist before use |
| 8 | MCP filesystem | PARKED | High risk; repo-scoped + read-only first |
| 9 | MCP GitHub | PARKED | Later, with repo-scoped token + tool allowlist |
| 10 | Gmail / Drive | PARKED | Needs OAuth + safe scope rules |
| 11 | Phone / watch notifications | FUTURE | Telegram / ntfy / Gotify evaluated later |

## Activation rules

- Deny by default; activation is explicit and reversible.
- Version pinning and a tool allowlist for any MCP.
- Read-only first; writes only after a dry run.
- Every action is written to the audit log.
- No third-party MCP server is connected automatically.

See `CHINTU_MCP_SECURITY_GATE.md` for the per-tool gate and
`CHINTU_REAL_CONNECTOR_MCP_SCAN.md` for the live scan.
