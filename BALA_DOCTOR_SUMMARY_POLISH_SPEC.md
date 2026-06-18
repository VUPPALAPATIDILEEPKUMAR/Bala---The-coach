# BALA Doctor-Summary Polish Spec (planning only, parked)

**Status:** PARKED. Specification only. Do NOT implement without
founder approval.
**Scope:** if BALA ever produces a "summary you can show your doctor"
view, what the safe shape of that view looks like.

This is sensitive territory. The default answer is "no such feature."
This spec exists so that if the founder ever revisits the idea, the
guardrails are pre-written.

---

## 1. Default position

BALA does not generate a doctor-facing summary. The companion framing
breaks the moment the app starts producing artifacts intended for a
clinician. Until the founder explicitly asks otherwise, this lane is
parked.

---

## 2. If revisited, the only acceptable shape

A doctor-summary view, if it ever ships, must:

- **Be user-driven.** The user taps a button to assemble it from
  notes they already wrote. BALA does not infer anything.
- **Be transcript-style.** Date + user's own words, copy-pasted from
  their own local notes. No model-generated prose.
- **Carry the non-medical footer prominently** at the top, not the
  bottom. The doctor must see immediately that BALA is not making any
  clinical claim.
- **Stay local.** No upload, no email integration, no fax, no PDF
  emailing service. The user copies or screenshots it.
- **Name no conditions.** The summary text never says "anxiety",
  "depression", "ADHD", or any diagnostic term, even if the user wrote
  one in their own note. (Open question: redact or pass through? See
  §4.) The default is pass-through with a header banner stating these
  are the user's own words.
- **Be opt-in per session.** No always-on summary view.

---

## 3. Wireframe sketch (no code)

```
+--------------------------------------------------+
| BALA is a companion, not a doctor.               |
| This is a copy of your own notes. No claims      |
| about diagnosis, treatment, or condition are     |
| made by BALA.                                    |
+--------------------------------------------------+
|                                                  |
| 2026-06-12  "felt foggy after lunch, walked it   |
|              off"                                |
| 2026-06-13  "slept 5h, woke at 4am"              |
| 2026-06-14  "good day, no notes"                 |
|                                                  |
+--------------------------------------------------+
| [ Copy to clipboard ]   [ Close ]                |
+--------------------------------------------------+
```

No automatic summarization. No "BALA thinks you may be ___." No charts
labeled with clinical terms.

---

## 4. Open questions for the founder

These are unresolved and must be answered before any implementation:

1. **Redaction policy.** If the user's own note names a condition,
   does BALA pass it through (user's own words) or redact it (avoid
   reinforcing self-diagnosis)? Default-safe: pass through with the
   banner; revisit if a tester is harmed by either choice.
2. **Time window.** Last 30 days? All-time? User-selected? Default:
   user-selected with a max of 90 days.
3. **Export format.** Plain text only, or also a printable view?
   Default: clipboard text. Printable view is a separate slice.
4. **Audit trail.** Should BALA record that a summary was generated?
   Default: no. The user knows; nothing else needs to.

---

## 5. Anti-patterns (do NOT build)

- "AI doctor letter generator."
- "Symptom timeline" inferred from notes.
- "Possible conditions" panel.
- "Severity score."
- Anything that looks like a clinical chart row.
- Anything that emails, faxes, or uploads to a portal.

---

## 6. Gate

Even if the founder approves this lane, implementation requires:

- A clean BALA branch.
- A privacy page update explicitly covering the summary view.
- A tester cycle per `BALA_TESTER_FEEDBACK_PLAN.md`.
- A founder sign-off on the redaction policy decision in §4.

Until all of those land, this stays parked.

---

## 7. BALA safety footer

BALA is a health-awareness companion. It does not diagnose, treat,
predict, prevent, replace doctors, or provide emergency monitoring.
