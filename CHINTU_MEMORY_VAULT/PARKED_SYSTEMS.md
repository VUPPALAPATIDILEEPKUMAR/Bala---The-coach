# Parked Systems

These systems are intentionally disabled or deferred. Do not implement or enable
them without explicit founder approval.

| System | Status | Reason |
|---|---|---|
| Telegram bot | parked | no implementation yet; future notification channel |
| Discord bot | parked | no implementation yet; future notification channel |
| Webhooks | parked | external send path removed from BALA runtime |
| External health-data APIs | parked | privacy rule: no health data leaves device |
| DuckDuckGo search | disabled | available in OpenClaw but disabled; public non-sensitive queries only |
| memory-wiki plugin | not enabled | available in OpenClaw but requires explicit approval |
| Codex agent | parked | only reactivated when explicitly requested |
| AI/LLM coach endpoint | reserved | design slot exists but not built; coach is deterministic |
| Live wearable sync | future | only Apple Health file import works today |
| Health data in messaging | prohibited | no health data in Telegram/Discord/webhooks/notifications |
| Secrets/tokens in repo | prohibited | never committed; never read by scripts |
