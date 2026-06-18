# Next Sprint Queue

Ranked highest priority first. Every sprint must respect Chintu safety,
privacy, medical-claim, local-first, and founder-approval rules. The
memory-wiki plugin stays disabled.

| # | Sprint | Type | Status | Risk |
|---|---|---|---|---|
| 1 | iMac Option 12 install + test | tooling (iMac side) | current founder-run action | Green |
| 2 | Shared bridge smooth-loop check | tooling / docs | after Option 12 test | Green |
| 3 | Chintu Agent Desktop Control UI polish | tooling / docs | Stage 11A candidate | Green |
| 4 | BALA Voice Coach safe enhancement | product (BALA) | Stage 11C; explicit founder instruction required | Orange |
| 5 | BALA tester feedback and demo polish | product (BALA) | Stage 11D; explicit founder instruction required | Orange |
| 6 | Local speech input/output research | design only | Stage 11E; parked | Black to activate |
| 7 | Telegram / Discord / cloud / webhooks | external systems | Stage 11F; parked | Black to implement |

## Completed baselines

### Stage 9A - Alive Daily Operator Layer

The daily operator, next-action engine, end-day operator, operator status,
tomorrow start, decisions, blockers, and daily-log archive are in the repo.
The layer is local-first, file-based, validation-first, and founder-approved.

### Stage 10 - Chintu Agent Control Shell

The static dashboard, dashboard generator, Claude overnight package generator,
BALA Safe Touchpoints, Free Power Lanes, and Stage 11 queue are in the repo.
Stage 10 changes scripts/docs/control-shell artifacts only. BALA app files
remain unchanged, and external automation remains parked.

## Current founder-run lane

Copy `CHINTU_IMAC_PACKAGES/OPTION_12_PULL_SHARED/` to the iMac, run
`install-option-12.sh`, and complete `IMAC_TEST_PLAN.md`. Manual option 11
remains the fallback until Option 12 passes on the iMac.

After that test, run one complete Windows export -> shared bridge -> iMac
Option 12 intake -> `bridge-sync.sh` -> dashboard-open loop. Record observed
failures before changing scripts.

## Planned Stage 11 lanes

`CHINTU_STAGE_11_QUEUE.md` defines Stage 11A through 11F. It is the source of
truth for desktop-shell polish, iMac hardening, BALA product candidates, local
speech research, and parked external systems. Planning does not activate any
lane.

## Sprint selection rules

- Pick the highest unblocked Green or Yellow sprint.
- The current action is the founder-run iMac Option 12 install/test.
- Manual iMac option 11 remains the fallback until Option 12 is checked.
- Auto Bridge Transfer V1 is already live at `a1480d5`.
- Chintu Agent voice/personality and local speech stay parked research.
- BALA product work requires a separate explicit founder instruction.
- Never pick an Orange or Red sprint without an explicit prompt for it.
- Never pick a Black sprint without explicit founder approval recorded in
  `OPEN_QUESTIONS.md`.
