# Chintu Agent Architecture

## Multi-brain roles

| Brain | Role |
|---|---|
| **ChatGPT** | Strategy, prompt architecture, product design, roadmap |
| **Claude Code** | Main builder. Writes code, scripts, docs. Runs validation. Commits. |
| **Codex** | Reviewer, bug hunter, focused patcher. Parked unless explicitly reactivated. |
| **Chintu** | Local judge. Runs validation board, release guard, pre-memory gate. |
| **OpenClaw** | Local runtime and plugin layer. Gateway on loopback. |

## Machine roles

| Machine | Role |
|---|---|
| **Windows** | AI/build machine. Claude Code, Codex, OpenClaw run here. Repo lives here. |
| **iMac** | Control room / dashboard wall. Reads reports, displays status. Not the AI brain. |
| **Phone** | Future notification and live interface. Not implemented yet. |

## Multi-brain sprint flow

```text
1. ChatGPT designs the sprint prompt (strategy + safety rules + task).
2. Claude Code receives the prompt and builds (code, scripts, docs).
3. Chintu local scripts validate (syntax, privacy, safety, consistency).
4. Codex reviews if activated (focused patches, bug hunts).
5. Claude commits locally after validation PASS.
6. Human founder reviews and pushes.
7. iMac Control Room reads the latest reports (bridge sync).
8. Phone gets summary notification (future).
```

## OpenClaw plugin direction

- memory-core: active
- memory-wiki: available but disabled (needs explicit approval to enable)
- document-extract: enabled (local docs, artifacts only, dry-run)
- file-transfer: enabled (local only)
- ollama provider: enabled
- duckduckgo: available but disabled (public non-sensitive queries only)
- Telegram/Discord: parked
- No external APIs for health data
- No plugin install/enable without explicit founder approval
- Never read openclaw.json, tokens, or secrets
