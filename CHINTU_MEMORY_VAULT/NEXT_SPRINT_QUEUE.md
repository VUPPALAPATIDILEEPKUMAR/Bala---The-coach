# Next Sprint Queue

Ranked highest priority first. Each sprint must respect Chintu safety, privacy,
and medical-claim rules. memory-wiki plugin stays disabled.

| # | Sprint | Type | Status | Risk |
|---|---|---|---|---|
| 1 | Windows Reporter V1 | tooling | in progress this sprint | Green |
| 2 | iMac Bridge Sync V1 implementation | tooling (iMac side) | next | Green |
| 3 | Memory-Wiki read-only enablement design | design only | needs founder approval | Black to implement |
| 4 | Doctor-ready share polish (Stage 3) | product (BALA) | planned | Orange |
| 5 | Tester feedback loop | tooling / docs | planned | Green |
| 6 | Document-extract local proof | tooling (OpenClaw) | planned | Yellow |
| 7 | Telegram / Discord summary design only | design only | parked | Black to implement |

## 1. Windows Reporter V1

Local-only PowerShell script (`scripts/chintu-windows-reporter.ps1`) that fills
`C:\Users\Chintu\Desktop\CHINTU_BRIDGE_OUTBOX` with the six Markdown files from
`CHINTU_BRIDGE_CONTRACT.md`. No network, no installs, no plugin enables.

## 2. iMac Bridge Sync V1 implementation

Runs on the iMac Control Room. Creates `~/Documents/CHINTU_CONTROL_ROOM/BRIDGE/`
(plus FROM_WINDOWS / TO_WINDOWS / LATEST / ARCHIVE), `scripts/bridge-sync.sh`,
`CHINTU_BRIDGE_SYNC.command`, Omega menu option 11, `BRIDGE_STATUS.html`. Bash
must be Catalina-safe. No installs. No local LLM on iMac.

## 3. Memory-Wiki read-only enablement design

A **design doc only**. Defines the safe enable procedure, the read-only seed
content, the local-only boundary, and the rollback path. No actual enablement
this sprint. memory-wiki plugin stays disabled until founder approval.

## 4. Doctor-ready share polish (Stage 3)

UI / copy polish: clearer share-out copy, "what to bring to your doctor"
section, demo banner when active. No score exposure. No diagnoses. No external
endpoint. Local-only file action.

## 5. Tester feedback loop

Local Markdown intake folder + simple template so a tester can leave structured
feedback without an account. Founder reads at end of day.

## 6. Document-extract local proof

Dry-run proof that the OpenClaw `document-extract` plugin can read a local
non-PHI doc safely and return text. Artifacts only. Never PHI. Loopback only.

## 7. Telegram / Discord summary design only

Design doc only. Defines what a non-health-data status summary would look like,
the transport, the boundary, and the founder approval gate. Implementation is
parked.

## Sprint selection rules

- Always pick the highest unblocked Green or Yellow sprint.
- Never pick an Orange / Red sprint without an explicit prompt that calls for it.
- Never pick a Black sprint without explicit founder approval recorded in
  `OPEN_QUESTIONS.md`.
