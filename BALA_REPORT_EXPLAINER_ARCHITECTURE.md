# BALA Report Explainer — Architecture

**Stage:** 21
**Status:** planning — parked. No BALA app code changes in this file.
**Mode:** architecture and safety boundaries only. Build requires explicit founder approval.

---

## Feature Name

**BALA Report Explainer**

Never: "AI Doctor", "AI Lab Analysis", "Smart Diagnosis", "AI Radiologist", "BALA Doctor Bot".

---

## What This Is

A future optional module that helps users understand their own health reports — blood panels, lipid profiles, HbA1c, thyroid, CBC, basic metabolic panel, vitamin levels — in plain, calm language.

It does **not** replace the doctor. It helps the user arrive at the appointment prepared.

---

## Safe Copy (Required in UI)

> "I can help explain this report in simpler language and prepare questions for your doctor.
> I cannot diagnose conditions or tell you what treatment to take."

This copy must appear before the user interacts with any report data.

---

## Allowed Behavior (When Built)

| Action | Allowed | Notes |
|---|---|---|
| User pastes or uploads their own report text/PDF | Yes | In-browser only. No server upload. |
| Extract metric names, values, units from the report | Yes | Parse only what the report shows |
| Identify values outside the reference range on the report | Yes | Use the report's own stated range only |
| Explain common lab terms in plain language | Yes | Pre-built explanations, no LLM required for basics |
| Generate doctor-ready questions | Yes | Based only on flagged values in the report |
| Create a visit-prep summary | Yes | "What to ask at your appointment" style |
| Remind user not to change medications without clinician guidance | Yes | Required reminder in the output |
| Tell user that interpretation depends on full clinical context | Yes | Required disclaimer |

---

## Not Allowed (Hard Stops — Non-Negotiable)

| Action | Not Allowed | Reason |
|---|---|---|
| Diagnose any condition | Never | Not a clinician |
| Recommend starting, stopping, or changing medication | Never | Medical decision — clinician only |
| Say "you have disease X" | Never | Diagnosis |
| Say "you should take medicine Y" | Never | Treatment recommendation |
| Interpret X-rays, MRIs, CT scans, or ultrasounds as a radiologist | Never | Specialist interpretation |
| Tell user it is safe to ignore a flagged value | Never | Could cause harm |
| Act as emergency monitoring | Never | BALA is awareness-only |
| Claim to predict outcomes from lab values | Never | Health prediction claim |
| Process reports without explicit per-session user consent | Never | Privacy requirement |
| Send report data through any connector or external service | Never | Health data stays local |
| Store report data beyond the session without explicit user action | Never | Default local-only |

---

## Safe Language Requirements

All copy in this module must use:

- "This value appears outside the reference range shown on your report."
- "You might want to ask your doctor: what does this mean for me?"
- "This is for awareness only. Your clinician can interpret this in your full context."
- "BALA cannot diagnose. This is not a medical opinion."
- "Please do not change your medication based on this."
- "If you feel unwell, contact your doctor or seek care."

Never use:
- "abnormal" without explaining it means outside the report's own range
- "dangerous", "critical", "at risk" — use the report's own language if flagging
- "you have", "you are", "your condition" with a disease name
- "this means you have low X" as a diagnosis

---

## UX Architecture (Planned)

```
Screen 1: Consent Gate
  "BALA Report Explainer helps you understand your own report values.
   Your report stays on your device. Nothing is uploaded or shared.
   This is for awareness only — not a diagnosis."
  [I understand — continue] [Cancel]

Screen 2: Report Input
  Option A: Paste report text into a textarea
  Option B: Upload PDF (processed in-browser only, using pdf.js or fflate)
  [Process my report]

Screen 3: Explainer Output
  - Table: Metric | Your Value | Reference Range | Status | Plain-Language Note
  - Section: Terms Explained
  - Section: Questions to Ask Your Doctor
  - Section: Visit-Prep Summary
  - Persistent banner: "This is awareness only. Not a diagnosis. Not medical advice."
  [Download my summary] [Clear report]

No auto-save. No connector send. User controls all export.
```

---

## Technical Approach (Planned)

**PDF parsing (in-browser):**
- Use `pdf.js` (Mozilla, open source, already bundled in many browsers) loaded from vendor/ or CDN fallback
- Alternative: `fflate` (already in vendor/) for decompression if needed
- All parsing runs in the user's browser — no data leaves the device

**Metric extraction:**
- Regex + heuristic parser for common lab report formats
- Extract: metric name, value, unit, reference range, flagged indicator
- No LLM call required for extraction — deterministic parser
- Fallback: if format not recognized, ask user to paste values manually

**Term explanation:**
- Pre-built local dictionary of ~50–100 common lab terms
- No API call. No external lookup. Fully local.
- Plain-language explanations reviewed for accuracy and safety

**Doctor-ready questions:**
- Template-based question generator per flagged value
- Examples: "My HbA1c shows X. What does this mean for me at my age?"
- Founder reviews question templates before launch

---

## Data Privacy Rules

1. **No upload.** PDF/text processed entirely in-browser. Zero bytes leave the device.
2. **No storage by default.** Report data is in memory only during the session.
3. **Explicit export only.** User must click "Download my summary" to save anything.
4. **No connector payloads.** Report data must never flow into Telegram, GitHub, outbox, or any other connector.
5. **No analytics.** No usage tracking. No event logging of report content.
6. **Session-scoped.** Data cleared when user closes or refreshes the page.
7. **Per-session consent.** User confirms the data stays local before processing starts.
8. **No cross-device sync.** This feature is deliberately offline.

---

## Safety Checklist (Required Before Building)

- [ ] Founder explicitly approves scope and boundaries
- [ ] In-browser PDF parsing approach validated (pdf.js test in isolation)
- [ ] Pre-built term dictionary written and reviewed
- [ ] Doctor-ready question templates reviewed by founder
- [ ] Medical safety copy reviewed and approved
- [ ] BALA UX Agent packet written
- [ ] Release guard passes before any commit
- [ ] Consent gate UX reviewed by founder
- [ ] No-diagnosis language confirmed in all UI strings
- [ ] No-connector-send confirmed in code (connector payload scanner)

---

## Implementation Conditions Before Building

1. Founder explicitly approves scope in a Stage 22+ prompt
2. In-browser PDF parser approach validated in isolation
3. Medical safety copy reviewed and approved
4. BALA UX Agent packet written
5. Release guard green before any commit

---

## What Remains Parked

Everything. This is a planning and architecture doc only.
No code exists for this feature yet. No BALA app files are modified here.

The existing `BALA_REPORT_EXPLAINER_SAFETY_PLAN.md` (Stage 20) and this file together form the complete pre-build specification.

---

## Relationship to Existing Safety Plan

This file extends `BALA_REPORT_EXPLAINER_SAFETY_PLAN.md` (Stage 20) with:
- Full UX architecture sketch
- Technical approach (PDF parsing, term extraction, question generation)
- Expanded safe/not-safe language requirements
- Data privacy rules
- Implementation checklist

Both files should be read together before beginning any implementation.

---

*BALA is a health-awareness companion. It does not diagnose, treat, predict, prevent, replace doctors, or provide emergency monitoring.*
