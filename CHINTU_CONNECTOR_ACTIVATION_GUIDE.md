# Chintu Connector Activation Guide

This guide documents how activation would work later. It does not activate anything now.

## Stage 16 status

- Real connector architecture: present
- Real connector activation: off
- Default mode: `dry-run`
- Network send in this stage: prohibited

## Required sequence later

1. Set local env vars from `CHINTU_CONNECTOR_ENV.example`.
2. Keep `CHINTU_CONNECTOR_MODE=dry-run`.
3. Run:

```powershell
node scripts\chintu-connector-send.js --check
```

4. Generate a preview:

```powershell
node scripts\chintu-connector-send.js --preview --connector telegram --body "Chintu build is clean. Next action: review queue."
```

5. Review `CHINTU_OUTBOX/latest_connector_preview.json`.
6. Confirm the recipient is allowlisted and no health data is present.
7. Flip local mode to `CHINTU_CONNECTOR_MODE=active`.
8. Provide the exact approval phrase through `--approval`.
9. Only then attempt `--send`.

## Hard stop conditions

- Missing env vars
- Missing preview file
- Approval phrase missing or wrong
- Recipient not in allowlist
- Global pause file present
- Per-connector pause file present
- Payload contains health data
- Payload contains unsafe medical claim language

## Gmail note

Gmail is documented as draft/send architecture only because auth is heavier. It is not active send-capable in this stage.

## BALA safety footer

BALA is a health-awareness companion. It does not diagnose, treat, predict, prevent, replace doctors, or provide emergency monitoring.
