# Parked Systems

These systems are intentionally disabled or deferred. Do not implement, enable,
install, or call them without explicit founder approval.

| System | Status | Reason |
|---|---|---|
| Telegram bot | parked | No implementation. Future notification channel for non-health status only. |
| Discord bot | parked | No implementation. Future notification channel for non-health status only. |
| Webhooks | parked | External send path removed from BALA runtime. Validator FAILs on outbound app-data patterns. |
| External health-data APIs | parked | Privacy rule: no health data leaves the device. |
| DuckDuckGo plugin | disabled | Available in OpenClaw but disabled. If later enabled, public non-sensitive queries only. Never a health query. |
| memory-wiki plugin | not enabled | Available in OpenClaw but requires explicit founder approval. Vault stays plain Markdown until then. |
| Codex agent | parked | Only reactivated when explicitly requested by the founder. |
| AI / LLM coach endpoint | reserved | Design slot only. Coach is deterministic today. |
| Live wearable sync | future | Apple Health file import works today. No live API. |
| Native iOS HealthKit bridge | stub | `native/ios/` Swift stub exists but is not built or wired. |
| Health data in Telegram / Discord / webhooks / notifications | prohibited | Hard rule. Never. |
| Secrets / tokens in repo | prohibited | Never committed. Never read by Chintu scripts. |
| Browser sessions / cookies / paired-device files | prohibited | Never read. Never logged. Never bridged. |
| Auto-push by any brain | prohibited | Only the human founder pushes. |
| `openclaw.json` reads | prohibited | Never read by Chintu scripts. |
| Automatic plugin install or enable | prohibited | Requires explicit founder approval. |
| Memory vault edits during a FAILed gate | prohibited | Vault edits wait until the next clean validation. |

## Parked-to-active path

If a parked system is to be reactivated, the path is:

1. Founder records the intent and approval in `OPEN_QUESTIONS.md`.
2. ChatGPT writes a design-only doc (no implementation).
3. Chintu runs validate, release-guard, agent-board, pre-memory-gate on the
   current repo state.
4. Founder signs off in writing in `OPEN_QUESTIONS.md`.
5. Claude implements behind the appropriate risk-level push gate.
6. Codex reviews when activated.
7. Founder pushes.

Skip any step => the system stays parked.
