# BALA Privacy & Trust Polish Plan (planning only)

**Status:** planning. No `privacy.html` edits without founder approval.
**Scope:** ways to make the privacy / trust posture of BALA more
*legible* without changing what the app actually does.

The app already does the right thing technically: local-first, no
network egress, no analytics, no diagnosis. This plan is about making
that *visible* to a first-time user.

---

## 1. What is already good

- `privacy.html` exists and is short and plain.
- No external scripts loaded by `index.html`.
- Service worker is offline-only.
- BALA does not display medical claims, condition names, or treatment
  recommendations.

These are the foundation. Everything below is polish on top.

---

## 2. Candidate polish slices (each is one BALA commit, all require founder approval)

### Slice P1 — first-run trust card

A non-dismissable card on first launch (clears once acknowledged) that
says, in three lines:

- BALA stays on your device.
- BALA is a companion, not a doctor.
- You can clear everything at any time.

No code changes here yet. Wireframe-only:

```
+----------------------------------+
| Hi. Before we start.             |
|                                  |
| BALA stays on your device.       |
| BALA is a companion, not a       |
| doctor.                          |
| You can clear everything anytime.|
|                                  |
| [ Got it ]                       |
+----------------------------------+
```

### Slice P2 — "what BALA never does" link in footer

A small text link in the existing footer or settings area:
`What BALA never does →` opens `privacy.html` jumped to a new section
that explicitly lists the non-goals: no diagnosis, no prediction, no
emergency monitoring, no data leaving the device.

### Slice P3 — clear-everything affordance

If a "Clear my data" button does not already exist in settings, plan
it as a single visible affordance that wipes the local storage BALA
uses, with a confirm step. Implementation requires the founder to
edit `app.js` directly — not builder scope.

### Slice P4 — privacy page footer audit

Re-read `privacy.html` and confirm the safety footer is consistent
with `CHINTU_FOUNDER_COMMAND_MAP.md`. This is the only slice that can
be done as a docs read; no edit is proposed.

---

## 3. Anti-polish (what we will not do)

- No badges, scores, or "trust signals" implying medical authority.
- No "verified by" or "endorsed by" copy.
- No "share with your doctor" CTA — referrals are out of scope.
- No backend-required features ("export to cloud", "sync across
  devices") — these break local-first.
- No identity capture (email, phone, login).

---

## 4. Sequencing

If the founder green-lights this lane, the order is P4 → P1 → P2 → P3.
P4 is read-only. P1 and P2 are UI copy slices. P3 is the only one that
touches local storage semantics.

Nothing here ships until the founder explicitly approves the slice by
name.

---

## 5. BALA safety footer

BALA is a health-awareness companion. It does not diagnose, treat,
predict, prevent, replace doctors, or provide emergency monitoring.
