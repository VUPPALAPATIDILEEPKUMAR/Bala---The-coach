# BALA Safe Touchpoints

**Stage:** 10 planning boundary
**Rule:** BALA remains a separate local-first product.

## Separation boundary

Chintu OS may organize work around BALA, but it is not BALA and does not own
BALA runtime behavior. A Chintu OS shell stage may create reports, queues,
validation notes, and future plans. It may not silently cross into BALA app
files, personal health records, service-worker behavior, or data flows.

## What Chintu OS may say about BALA

- Factual repository and validation state.
- Which BALA files were or were not changed.
- Whether approved privacy and safety copy is present.
- Which product sprint is proposed, blocked, parked, or awaiting approval.
- Which manual tests are still needed.
- That BALA is local-first, non-medical, and a health-awareness companion.
- A future enhancement plan clearly labeled as planning only.

## What Chintu OS must never claim

- That BALA diagnoses, treats, predicts, or prevents a condition.
- That BALA replaces a doctor or provides emergency monitoring.
- That a score, trend, symptom, or signal is a medical conclusion.
- That local data was uploaded, synced, shared, or reviewed when it was not.
- That automation, speech, calling, notifications, or live monitoring is active
  when it is parked.
- That Chintu is the founder, a clinician, or a clone of a real person.

## Protected app boundary

During Stage 10, do not edit `app.js`, `index.html`, `styles.css`, `sw.js`,
`coach.js`, `manifest.webmanifest`, `privacy.html`, or
`functions/api/coach.js`. No service-worker cache bump is needed for shell/docs
work.

## Safe future BALA enhancement queue

These lanes require a separate explicit founder instruction before app work:

1. **BALA Voice Coach:** improve clarity and accessibility using a local-first,
   non-medical design. No voice cloning, real-person imitation, external voice
   service, or unsupported capability claim.
2. **Doctor-ready summary polish:** improve readability and user framing. Keep
   the summary user-controlled and informational, not diagnostic.
3. **Privacy and trust polish:** make local storage, export, deletion, and
   sharing boundaries easier to understand.
4. **Tester feedback and demo polish:** convert observed tester friction into
   small, reversible, validated changes.

Planning these lanes is allowed. Implementing them in Stage 10 is not.

## Health-data boundary

Health data stays in local storage by default. Chintu OS does not read it,
transfer it, bridge it, add it to prompts, put it in logs, or send it through
Telegram, Discord, webhooks, notifications, cloud sync, voice services, or any
backend. Any future user-controlled export requires its own privacy and product
review.

## Approved safety footer

BALA is a health-awareness companion. It does not diagnose, treat, predict,
prevent, replace doctors, or provide emergency monitoring.
