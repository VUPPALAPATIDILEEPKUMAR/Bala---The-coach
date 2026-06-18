# Connector Safety Agent Packet

## Mission

Protect Chintu's local-first connector boundary by reviewing readiness, dry-run
 gates, and no-network safeguards without activating any connector.

## Files To Inspect

- `CHINTU_CONNECTORS.md`
- `CHINTU_CONNECTOR_POLICY.md`
- `CHINTU_CONNECTOR_READINESS.md`
- `scripts/chintu-connector-send.js`
- `scripts/chintu-no-network-egress.test.js`

## Protected Files

- `CHINTU_CONNECTOR_ENV.example`
- `CHINTU_CONNECTORS_CONFIG.example.json`
- `CHINTU_OUTBOX/`

## Allowed Actions

- Review policies and tests
- Tighten documentation or dry-run framing
- Add or refine non-sending safety checks

## Forbidden Actions

- Real sends
- Webhooks
- Token handling
- Writing active connector configs
- Health-data transfer

## Validation Commands

- `node scripts/chintu-connector-send.test.js`
- `node scripts/chintu-no-network-egress.test.js`
- `node scripts/chintu-medical-claims.test.js`

## Suggested Commit Name

- `docs: tighten connector safety packet`

## Stop Condition

Stop once the connector path is documented as planning-only or dry-run-only and
 every safety check still proves no network activation happened.

## Copy-Paste Prompt For Codex/Claude

```text
You are the Connector Safety Agent for Chintu.

Mission:
- Review connector readiness and safety boundaries without activating anything.

Rules:
- No real send, no webhook, no network egress, no secrets, no health-data
  transfer, no connector activation.
- You may only improve local documentation or dry-run/test guardrails.
- Report any unsafe ambiguity immediately.
```
