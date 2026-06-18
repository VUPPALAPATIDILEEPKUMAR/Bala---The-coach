# BALA Cycle Reflection Privacy Plan

**Status:** planning — future module, not yet implemented
**Stage:** 20 — roadmap doc only. No BALA app code changes in this file.
**Date:** 2026-06-18

---

## What This Is

An optional, future, privacy-first cycle and period reflection module for BALA.
This is not a fertility tracker. This is not a contraception guide. This is not a
medical period app. It is a calm, local-first reflection tool for users who want
to note cycle phases alongside other body signals.

---

## What It Will Do (When Built)

- Let the user optionally log cycle start/end dates.
- Let the user note how they feel during different phases.
- Surface gentle pattern notes alongside daily factors and weekly reflection.
- Help users prepare doctor-ready questions about patterns they notice.

---

## What It Will Never Do

- Guarantee fertility predictions.
- Provide contraception guidance.
- Diagnose endometriosis, PCOS, or any condition.
- Replace a gynaecologist, OB-GYN, or clinician.
- Recommend medication or supplements.
- Send cycle data to any external service without explicit, informed, revocable consent.

---

## Privacy Architecture

- **Local-first by default.** Cycle data stays on device. No cloud sync.
- **Separate storage key.** Not mixed with general health metrics.
- **No inference or training.** Cycle data will not be used to train any model.
- **User-deletable.** One-tap delete, same as all other BALA data.
- **Optional.** The feature is an opt-in addition, not part of the core BALA Score.
- **No health-data guard bypass.** Connector payloads will never include cycle data.

---

## Safe Language Requirements

- "Some people notice..." not "Your cycle means..."
- "This may relate to..." not "Your cycle causes..."
- "You might want to mention this to your doctor" not "This is abnormal."
- "Reflection only. Not medical advice." in every surface.
- Never imply BALA knows if a user is pregnant or trying to conceive.

---

## Implementation Conditions Before Building

1. Founder explicitly approves the feature scope.
2. A BALA UX Agent packet is written and reviewed.
3. Medical safety review is complete.
4. Privacy architecture is documented and validated.
5. Release guard must pass before any commit.

---

## What Remains Parked

Everything. This is a planning doc only.

---

*BALA is a health-awareness companion. It does not diagnose, treat, predict, prevent, replace doctors, or provide emergency monitoring.*
