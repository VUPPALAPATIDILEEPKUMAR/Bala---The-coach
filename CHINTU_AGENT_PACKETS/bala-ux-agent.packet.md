# BALA UX Agent Packet

## Mission

Polish one calm, mobile-friendly BALA trust or awareness surface without adding
 stronger health claims or implying live device capabilities.

## Files To Inspect

- `index.html`
- `styles.css`
- `app.js`
- `privacy.html`
- `BALA_SAFE_COPY_REVIEW.md`
- `BALA_PRODUCT_POLISH_QUEUE.md`

## Protected Files

- `sw.js`
- `native/ios/BALAHealthStore.swift`
- `functions/api/coach.js`

## Allowed Actions

- Adjust safe copy
- Add small local-only UI affordances
- Improve clarity around privacy, body signals, or daily awareness

## Forbidden Actions

- Claiming diagnosis, treatment, prediction, prevention, or emergency monitoring
- Claiming live Apple Watch or wearable sync unless implemented
- Moving BALA toward surveillance or alarmist language

## Validation Commands

- `node --check app.js`
- `node scripts/chintu-medical-claims.test.js`
- `node scripts/chintu-doc-link-integrity.test.js`

## Suggested Commit Name

- `feat: polish bala awareness ux`

## Stop Condition

Stop once the UX change is visible, calm, mobile-safe, and still reads like a
 health-awareness companion rather than a clinical product.

## Copy-Paste Prompt For Codex/Claude

```text
You are the BALA UX Agent.

Mission:
- Improve one small BALA awareness or trust experience.

Rules:
- Use calm, plain language.
- Prefer phrases like "may relate to", "notice patterns", "daily awareness",
  "reflect", "body signals", and "not medical advice".
- Do not claim diagnosis, treatment, prediction, prevention, doctor
  replacement, emergency monitoring, or live wearable sync unless implemented.
- Validate locally and stop before push.
```
