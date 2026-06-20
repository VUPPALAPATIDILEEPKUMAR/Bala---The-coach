# Chintu Local Tools And Hooks

Practical inventory captured on June 20, 2026. This file describes what is already available on this machine or in this repo. Nothing new was installed for Stage 41.

| Tool / Hook | Available now | Useful Chintu role | Risk | Founder approval needed | Local / free | Next safe experiment |
| ----------- | ------------- | ------------------ | ---- | ----------------------- | ------------ | -------------------- |
| Node.js (`v24.16.0`) | Yes | Runs bridge, Telegram runner, tests, Allegro support scripts | Low | No | Local / free | Keep using it for localhost bridge and validation sweeps |
| PowerShell | Yes | Launch scripts, release guard, bridge start flow | Low | No | Local / free | Use `scripts/chintu-allegro-start.ps1` for founder demo startup |
| Git (`2.47.1.windows.1`) | Yes | Repo audit, release truth, commit/push when clean | Medium | Pushes need approval | Local / free | Resolve the mixed staged state before any Stage 41 commit |
| GitHub CLI (`gh`) | No | Would support GitHub dry-run and repo inspection | None while absent | No | Local / free if installed later | Keep using git-only flows until founder explicitly asks to add `gh` |
| Ollama (`0.30.10`) | Yes | Optional fully local model provider for future Chintu intelligence lanes | Medium | Yes before wiring into product flows | Local / free | Run provider status only; do not auto-wire it into founder paths yet |
| OpenClaw (`2026.6.6`) | Yes | Optional local provider / tooling lane already present on machine | Medium | Yes before product wiring | Local / free | Limit to readiness checks and document-only planning for now |
| Local HTTP bridge | Yes | Real localhost runtime for Allegro, action traces, and founder demo paths | Medium | No | Local / free | Use the new Reality panel plus `/api/runtime-status` for truth checks |
| Telegram poll-once runtime | Code exists; live env missing | Future phone/channel intake with dry-run first | Medium | Yes for live token setup | Local / free | Follow setup-check -> token-check -> discover-ids -> dry-run poll-once |
| Browser `SpeechRecognition` / `SpeechSynthesis` | Code present; browser-dependent | Voice input and spoken replies in Allegro | Medium | No | Local / free | Open Allegro in Chrome or Edge and verify voice support manually |
| Windows Task Scheduler (`schtasks`) | Yes | Future scheduled check-ins or local maintenance jobs | Medium | Yes | Local / free | Keep as a future-only note; do not schedule anything in Stage 41 |
| Local JSON / Markdown memory (`CHINTU_MEMORY_VAULT`, `CHINTU_OUTBOX`) | Yes | Local-first memory, reports, traces, outbox state | Medium | No for read-only use | Local / free | Keep state local and avoid committing generated artifacts |
| Git hooks | Sample hooks only | Could enforce validation before push later | Low | Yes before enabling custom hooks | Local / free | Leave hooks untouched for now; decide after founder sees the demo |
| Self-hosted n8n Community Edition | No | Possible future automation hub | Medium | Yes | Local / free if self-hosted later | Leave as future-only note; do not install in Stage 41 |

## Notes

- The current repo already has the local-first building blocks needed for a truthful founder demo without adding any paid services.
- The bridge, Reality panel, tests, and Markdown inventory are enough to show actual progress now.
- The safest next experiments remain local and read-only until the founder explicitly approves live Telegram setup or any push/send path.
