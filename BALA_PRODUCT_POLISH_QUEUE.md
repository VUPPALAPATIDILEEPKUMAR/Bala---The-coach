# BALA Product Polish Queue

**Status:** planning. Every item below is founder-only to implement.
Operator-mode builder sessions do not edit BALA app files.

A small, ordered list of mobile-first BALA improvements. Smallest and
safest first. Each one is a single slice you (founder) can pick up in
a focused 30-minute session.

---

## Tier 1 — read-only audits (zero risk)

1. **Re-read `privacy.html`.** Confirm the non-medical companion footer
   reads as intended. No edit needed; just a sanity pass.
2. **Re-read `coach.js` copy** for any leftover phrasing that drifts
   toward "predicts" / "diagnoses" / "treats". The medical-claims test
   guards Chintu docs; BALA app code is harder to police automatically,
   so a human pass is worth one cycle.
3. **Open the app on a phone.** Walk the home → daily guide → coach
   card flow as if it's your first time. Note three friction points.

---

## Tier 2 — copy polish (founder-only edits)

4. **Hero hook line.** Try `"Your daily health guide from your own
   body signals."` as the home-screen subtitle. Soft, ownership-
   centered, no clinical framing.
5. **BALA Score explanation card.** One line max. Suggested:
   `"A simple read of today, from the signals you logged."` No promise
   of accuracy, no risk score.
6. **Health Signal Cards label tone.** Replace any "alert" /
   "warning" wording with "notice" / "worth a look".
7. **Ask BALA Coach grounding.** Add a single-line prefix to the
   coach response area: `"This is a companion, not a clinician."`
8. **Doctor-Ready Summary header.** If a summary view exists, lead
   with `"Your own notes in your own words. BALA makes no claims."`
9. **Demo Mode banner.** Make demo state visually unambiguous (a
   strip across the top reading `"Demo data. Not your numbers."`).
10. **Import flow clarity.** One sentence on what import does and does
    not do, before the file picker.

---

## Tier 3 — UX shape (still founder-only)

11. **First-run trust card.** Per
    [BALA_PRIVACY_TRUST_POLISH_PLAN.md](BALA_PRIVACY_TRUST_POLISH_PLAN.md)
    slice P1. Three lines, single dismiss.
12. **PWA install guidance.** A short, calm, OS-aware tip ("Add to
    Home Screen") that appears once and never nags.
13. **Footer disclaimer position.** Confirm the safety footer is
    visible from any screen, not buried two screens deep.
14. **Tester feedback loop.** Per
    [BALA_TESTER_FEEDBACK_PLAN.md](BALA_TESTER_FEEDBACK_PLAN.md).
    Markdown notes in the vault, no telemetry.

---

## Tier 4 — feature-shape ideas (parked unless approved)

15. **Voice coach slice V1.** Per
    [BALA_VOICE_COACH_SAFE_SPEC.md](BALA_VOICE_COACH_SAFE_SPEC.md).
    Web Speech API only. Local. Single play button.
16. **Doctor-summary view.** Per
    [BALA_DOCTOR_SUMMARY_POLISH_SPEC.md](BALA_DOCTOR_SUMMARY_POLISH_SPEC.md).
    User-driven, transcript-style, no inference.
17. **Local-first AI coach.** Per
    [BALA_LOCAL_FIRST_AI_COACH_SPEC.md](BALA_LOCAL_FIRST_AI_COACH_SPEC.md).
    Research only. Not on the roadmap.

---

## What is NOT in this queue

- Cloud sync.
- Wearable live integration (current state is import-based; do not
  claim "live").
- Diagnosis, prediction, prevention, treatment, emergency monitoring,
  or doctor replacement.
- Cardiac-arrest or heart-attack prediction. Never.
- Cross-device sync via a backend.
- Paid APIs.

---

## How to pick the next slice

Open this list. Pick the smallest unticked item. Do that one slice
end-to-end (read → change → test on a real phone → commit). Do not
batch tiers.

---

## BALA safety footer

BALA is a health-awareness companion. It does not diagnose, treat,
predict, prevent, replace doctors, or provide emergency monitoring.
