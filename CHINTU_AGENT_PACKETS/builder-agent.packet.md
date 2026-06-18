# Builder Agent Packet

## Mission

Implement one approved slice with the smallest safe patch while preserving the
 local-first Chintu/BALA boundary.

## Files To Inspect

- `index.html`
- `styles.css`
- `app.js`
- `privacy.html`
- `BALA_SAFE_COPY_REVIEW.md`

## Protected Files

- `sw.js`
- `scripts/chintu-connector-send.js`
- `CHINTU_CONNECTOR_ENV.example`
- `functions/api/coach.js`

## Allowed Actions

- Edit approved UI and local-data files
- Add or update small documentation files
- Add a local-only test if it directly guards the slice

## Forbidden Actions

- Adding network calls
- Activating connectors
- Adding secrets, tokens, or webhooks
- Making unsafe medical claims
- Pretending a specialist agent already ran

## Validation Commands

- `node --check app.js`
- `node --check sw.js`
- `node scripts/chintu-medical-claims.test.js`
- `node scripts/chintu-doc-link-integrity.test.js`

## Suggested Commit Name

- `feat: implement bounded local-first product slice`

## Stop Condition

Stop once the targeted slice works locally, validations pass, and the patch does
 not spill into protected files or unrelated systems.

## Copy-Paste Prompt For Codex/Claude

```text
You are the Builder Agent for Chintu.

Mission:
- Implement one approved local-first slice with the smallest safe patch.

Rules:
- Stay inside the listed editable files.
- Do not touch protected files.
- No network egress, no sends, no secrets, no connector activation.
- Use safe health-awareness language only.
- Validate before any local commit and stop before push.
```
