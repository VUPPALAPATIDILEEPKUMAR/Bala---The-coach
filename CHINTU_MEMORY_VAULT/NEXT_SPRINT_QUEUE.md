# Next Sprint Queue

Ranked highest priority first. Each sprint must respect Chintu safety, privacy,
and medical-claim rules. memory-wiki plugin stays disabled.

| # | Sprint | Type | Status | Risk |
|---|---|---|---|---|
| 1 | Alive Daily Operator Layer | tooling | complete in repo (Stage 9A baseline) | Green |
| 2 | iMac Option 12 install + test | tooling (iMac side) | current founder/operator action | Green |
| 3 | Shared bridge smooth-loop check | tooling / docs | after Option 12 test | Green |
| 4 | Daily operator shakeout | tooling / docs | after first live morning/end-day runs | Green |
| 5 | BALA Voice Coach enhancement | product (BALA) | next after Stage 9 stability | Orange |
| 6 | Memory-Wiki read-only enablement design | design only | needs founder approval | Black to implement |
| 7 | Document-extract local proof | tooling (OpenClaw) | planned | Yellow |
| 8 | Telegram / Discord summary design only | design only | parked | Black to implement |

## 1. Alive Daily Operator Layer

Stage 9A adds:

- `scripts/chintu-daily-operator.ps1`
- `scripts/chintu-next-action.ps1`
- `scripts/chintu-endday-operator.ps1`
- `CHINTU_OPERATOR_STATUS.md`
- `CHINTU_TOMORROW_START.md`
- `CHINTU_MEMORY_VAULT/DAILY_LOGS/`
- `CHINTU_MEMORY_VAULT/DECISIONS.md`
- `CHINTU_MEMORY_VAULT/BLOCKERS.md`

This layer keeps Chintu local-first, file-based, validation-first, and founder
approved. BALA app files remain unchanged. External automation stays parked.

## 2. iMac Option 12 install + test

Copy `CHINTU_IMAC_PACKAGES/OPTION_12_PULL_SHARED/` to the iMac and run
`install-option-12.sh`. Then complete the checks in
`CHINTU_IMAC_PACKAGES/OPTION_12_PULL_SHARED/IMAC_TEST_PLAN.md`. Manual option
11 remains the fallback until Option 12 is confirmed working.

## 3. Shared bridge smooth-loop check

After iMac Option 12 is installed, run one full loop: Windows daily export,
shared bridge mirror refresh, iMac Omega option 12 intake, `bridge-sync.sh`,
and dashboard open. Confirm the bridge command center and daily operator both
report a stable next action. No app changes.

## 4. Daily operator shakeout

Run the new morning and end-day operator scripts through a real founder day,
review the generated status/handoff/log wording, and tighten only the scripts
or docs if something feels noisy or unclear.

## 5. BALA Voice Coach enhancement

This stays behind Stage 9 stability work. Once the bridge loop is smooth and
the operator layer feels reliable, the next BALA sprint candidate is Voice
Coach enhancement. Keep it local-first, non-medical, and app-only when
explicitly chosen.

## 6. Memory-Wiki read-only enablement design

A design doc only. Defines the safe enable procedure, the read-only seed
content, the local-only boundary, and the rollback path. No actual enablement
this sprint. memory-wiki plugin stays disabled until founder approval.

## 7. Document-extract local proof

Dry-run proof that the OpenClaw `document-extract` plugin can read a local
non-PHI doc safely and return text. Artifacts only. Never PHI. Loopback only.

## 8. Telegram / Discord summary design only

Design doc only. Defines what a non-health-data status summary would look like,
the transport, the boundary, and the founder approval gate. Implementation is
parked.

## Sprint selection rules

- Always pick the highest unblocked Green or Yellow sprint.
- Stage 9A is now in repo; the live operator action is iMac Option 12 install + test.
- Manual iMac option 11 remains the fallback until Option 12 is installed and checked.
- Auto Bridge Transfer V1 is already live at `a1480d5`.
- Chintu Agent voice/personality work stays parked as future direction only.
- Never pick an Orange / Red sprint without an explicit prompt that calls for it.
- Never pick a Black sprint without explicit founder approval recorded in
  `OPEN_QUESTIONS.md`.
