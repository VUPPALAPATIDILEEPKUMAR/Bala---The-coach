# Next Sprint Queue

Ranked highest priority first. Each sprint must respect Chintu safety, privacy,
and medical-claim rules. memory-wiki plugin stays disabled.

| # | Sprint | Type | Status | Risk |
|---|---|---|---|---|
| 1 | iMac Option 12 package install | tooling (iMac side) | next operator step | Green |
| 2 | Windows Bridge Command Center | tooling | complete in repo | Green |
| 3 | Shared bridge smooth-loop check | tooling / docs | after Option 12 install | Green |
| 4 | BALA Voice Coach enhancement | product (BALA) | next after bridge loop is smooth | Orange |
| 5 | Memory-Wiki read-only enablement design | design only | needs founder approval | Black to implement |
| 6 | Document-extract local proof | tooling (OpenClaw) | planned | Yellow |
| 7 | Telegram / Discord summary design only | design only | parked | Black to implement |

## 1. iMac Option 12 package install

Copy `CHINTU_IMAC_PACKAGES/OPTION_12_PULL_SHARED/` to the iMac and run
`install-option-12.sh`. This installs `bridge-pull-shared.sh`, creates
`~/Desktop/CHINTU_PULL_SHARED_BRIDGE.command`, and attempts the Omega OS option
12 patch without claiming the iMac is already modified. Manual option 11 remains
the fallback until the iMac install is confirmed.

## 2. Windows Bridge Command Center

Local-only PowerShell script (`scripts/chintu-bridge-command-center.ps1`) that
summarizes repo state, validation state, app safety, shared bridge readiness,
iMac intake readiness, parked systems, and the exact next action. Auto Bridge
Transfer V1 is already live at `a1480d5`, and the command center now turns that
bridge into an operator-facing status report.

## 3. Shared bridge smooth-loop check

After iMac Option 12 is installed, run the full loop once: Windows daily export,
shared bridge mirror refresh, iMac Omega option 12 intake, `bridge-sync.sh`,
and dashboard open. Confirm the command center's next action becomes clear and
stable. No app changes.

## 4. BALA Voice Coach enhancement

This stays behind the bridge work. Once the bridge loop is smooth, the next BALA
sprint candidate is Voice Coach enhancement. Keep it local-first, non-medical,
and app-only when explicitly chosen.

## 5. Memory-Wiki read-only enablement design

A **design doc only**. Defines the safe enable procedure, the read-only seed
content, the local-only boundary, and the rollback path. No actual enablement
this sprint. memory-wiki plugin stays disabled until founder approval.

## 6. Document-extract local proof

Dry-run proof that the OpenClaw `document-extract` plugin can read a local
non-PHI doc safely and return text. Artifacts only. Never PHI. Loopback only.

## 7. Telegram / Discord summary design only

Design doc only. Defines what a non-health-data status summary would look like,
the transport, the boundary, and the founder approval gate. Implementation is
parked.

## Sprint selection rules

- Always pick the highest unblocked Green or Yellow sprint.
- iMac Option 12 install is the current bridge priority.
- Manual iMac option 11 remains the fallback until Option 12 is installed and checked.
- Auto Bridge Transfer V1 is already live at `a1480d5`.
- Never pick an Orange / Red sprint without an explicit prompt that calls for it.
- Never pick a Black sprint without explicit founder approval recorded in
  `OPEN_QUESTIONS.md`.
