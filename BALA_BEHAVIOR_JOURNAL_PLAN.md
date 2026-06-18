# BALA Behavior Journal Plan

**Status:** planning. Stage 17 shipped a lightweight local-first daily factors journal.

## Goal

Help people reflect on everyday context that may relate to body signals without
 turning BALA into a diagnosis, treatment, prediction, or emergency product.

## Stage 17 Slice

- Local-only `Daily Factors` journal in the web app
- Factors:
  - alcohol
  - caffeine
  - late meal
  - stress
  - soreness
  - travel
  - low movement / long sitting
  - exercise
  - hydration
- One short optional note
- Latest factor summary visible in the app
- Included in local BALA export/restore
- Included in doctor-ready summaries as reflection context

## Safe Copy Rules

- Use: `may relate to`, `notice patterns`, `daily awareness`, `reflect`,
  `body signals`, `not medical advice`
- Do not say:
  - diagnose
  - treat
  - predict
  - prevent
  - replace doctors
  - emergency monitoring
- Do not claim alcohol causes a specific outcome for the user
- Do not claim automatic Apple Watch movement detection is live

## Current Product Behavior

- Daily factors are saved only in local browser storage
- No connector, webhook, or health-data transfer is added
- The journal is optional and user-entered
- BALA may mention that recent daily factors may relate to body signals and can
  help the user notice patterns

## Parked Next Steps

1. Show factor history beside timeline entries
2. Add a one-week reflection view for repeated factors
3. Let coach answers reference repeated factors more directly
4. Add founder-reviewed language polish after phone testing

## Safety Footer

BALA is a health-awareness companion. It does not diagnose, treat, predict,
prevent, replace doctors, or provide emergency monitoring.
