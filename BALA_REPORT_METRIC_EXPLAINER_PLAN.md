# BALA Report Metric Explainer — Plan

**Stage:** 22
**Status:** planning — parked implementation. No BALA app code changes in this file.
**Mode:** product and safety plan only. Build requires explicit founder approval.

---

## Feature Name

**BALA Report Explainer**

Never: "AI Doctor", "AI Lab Analyser", "Smart Diagnosis", "AI Radiologist", "BALA Doctor Bot".

---

## What This Is

A future optional module that helps users understand their own health reports — blood panels, lipid profiles, HbA1c, thyroid, CBC, basic metabolic panel, vitamin levels — in plain, calm language.

It does not replace the doctor. It helps the user arrive at the appointment prepared.

---

## Required Safety Copy (Non-Negotiable)

This copy must appear before any user interaction with report data:

> "I can help explain this report in simpler language and prepare questions for your doctor.
> I cannot diagnose conditions or tell you what treatment to take."

This is not optional. It is not behind a toggle. It shows every time.

---

## Allowed Behavior

| Action | Allowed | Notes |
|---|---|---|
| User pastes or manually enters report text | Yes | In-browser only. No server upload. |
| User uploads PDF in-browser | Yes (future) | Parse locally — no external upload |
| Extract metric name, value, unit from report | Yes | Parse only what the report shows |
| Identify values outside the reference range on the report | Yes | Use the report's own stated range — not external norms |
| Explain what a metric generally measures | Yes | 2–3 calm, plain sentences |
| Note that the report flags something high/low | Yes | "Your report notes this as above the reference range." |
| Generate doctor-ready questions | Yes | 2–3 questions per flagged metric |
| Create a visit-prep summary | Yes | Plain language, not a diagnostic summary |
| Say "this is worth discussing with your clinician" | Yes | Standard response for flagged values |

---

## Not Allowed

| Action | Status |
|---|---|
| "You have [disease]" | ❌ Never |
| "This indicates [diagnosis]" | ❌ Never |
| "You should take [medication]" | ❌ Never |
| "Avoid [food/drug]" | ❌ Never |
| "This is normal for you" | ❌ Never (only doctors know the person's full history) |
| X-ray/MRI interpretation as clinical fact | ❌ Never |
| Uploading report to external server by default | ❌ Never |
| Including report data in BALA score | ❌ Never (separate track only) |
| Emergency monitoring via lab values | ❌ Never |
| "Your risk of [disease] is X%" | ❌ Never |

---

## MVP Flow

```
User enters report data (text/manual entry)
       ↓
Required safe copy displayed
       ↓
BALA parses: metric name + value + unit + reference range + flag
       ↓
BALA explains what the metric generally measures (2–3 sentences)
       ↓
BALA notes the report's own flag: "Your report notes this as above/below the reference range."
       ↓
BALA generates 2–3 doctor-ready questions
       ↓
BALA creates visit-prep summary (all flagged metrics + questions)
       ↓
User can copy summary / print / save locally
       ↓
Option: "Add to Doctor-Ready Summary in BALA"
```

---

## Metric Explainer Template (Safe Copy Pattern)

```
[Metric Name]: [Value] [Unit]
Reference range on your report: [Range]
Your report notes this as: [High / Low / Within range]

What this measures:
[2–3 sentences explaining what this metric generally is. 
Calm, plain language. No diagnosis. No alarm.]

Worth discussing with your doctor:
• "[Question 1 — about this metric specifically]"
• "[Question 2 — about trend or context]"
• "[Question 3 — about what to watch]"
```

### Example — HbA1c

```
HbA1c: 6.4%
Reference range on your report: 4.0–5.6%
Your report notes this as: Above the reference range

What this measures:
HbA1c reflects your average blood sugar levels over roughly the past 2–3 months. It's commonly used to understand how blood sugar has been trending. A single reading shows a snapshot — your doctor will consider this alongside your history and other results.

Worth discussing with your doctor:
• "My HbA1c is 6.4% — what does this mean for me specifically?"
• "Is there anything I should monitor or change while we watch this?"
• "Would you recommend a follow-up test or any lifestyle check-in?"
```

### Example — LDL Cholesterol

```
LDL Cholesterol: 145 mg/dL
Reference range on your report: <100 mg/dL
Your report notes this as: Above the reference range

What this measures:
LDL is often called "bad" cholesterol because higher levels are associated with more cholesterol in the bloodstream. What the right level is for any individual depends on their full health picture — age, family history, other conditions. Your doctor is the best person to interpret this in your context.

Worth discussing with your doctor:
• "My LDL is 145 — does that need attention given my overall health?"
• "Should I make any changes before the next test?"
• "When would you want to recheck this?"
```

---

## Visit-Prep Summary Template

```
BALA Visit-Prep Summary
Generated: [date]
Note: This is a personal awareness summary, not a medical report.

Metrics your report flagged:
1. [Metric] — [Value] — [Flag direction]
   → Question: "[Question]"

2. [Metric] — [Value] — [Flag direction]
   → Question: "[Question]"

[Additional context if user added symptoms or notes]

Reminder:
I can help explain reports and prepare questions, but I cannot diagnose conditions or recommend treatment.
Please bring this to your doctor and let them give you the full picture.
```

---

## Metrics to Support in Phase 1

| Category | Metrics |
|---|---|
| Blood sugar | HbA1c, Fasting glucose |
| Lipids | Total cholesterol, LDL, HDL, Triglycerides |
| Thyroid | TSH, T3, T4 |
| Complete blood count | WBC, RBC, Haemoglobin, Haematocrit, Platelets |
| Basic metabolic | Sodium, Potassium, Creatinine, BUN, eGFR |
| Liver | ALT, AST, Bilirubin, Albumin |
| Vitamins | Vitamin D, B12, Iron / Ferritin |
| Inflammation | CRP, ESR |

---

## Metrics to NOT Support in Phase 1 (Parked)

| Category | Reason |
|---|---|
| Genetic markers | Too complex; diagnosis risk too high |
| Tumour markers (CEA, PSA, CA-125) | Requires clinical framing only; never DIY explanation |
| Cardiac enzyme panels (Troponin) | Emergency context only — BALA must redirect immediately |
| Drug/toxicology screens | Not within BALA scope |
| Pathology slides / biopsies | Never |
| X-ray / CT / MRI reports | Never interpret as clinical fact |

---

## Emergency Flag

If any report value triggers known emergency thresholds (e.g. Troponin, K+ extreme, glucose extreme):

BALA must:
1. Show the emergency card: "Some report values may need urgent medical attention. Please contact your doctor or emergency services now."
2. Not attempt to explain or contextualise the value
3. Not show BALA score

---

## Privacy Rules

- Report data is processed in-browser only — no server upload by default
- Report text is not stored in BALA's local storage unless user explicitly opts in
- Report data is never sent to Telegram, GitHub, or any connector
- No analytics or tracking on report interactions

---

## UI Safety Requirements

- Safe copy disclaimer visible at all times during report interaction
- Clear "clear report" button so data is not retained
- Export to local file only — no cloud share default
- "Doctor-Ready Summary" is clearly framed as a visit-prep tool, not a diagnosis document
- On any value with a high or critical flag: "Please discuss this with your doctor — this is worth a conversation."

---

## Implementation Checklist (When Approved)

- [ ] UI: Report entry screen (text paste + manual entry fields)
- [ ] Parser: Extract metric / value / unit / range / flag
- [ ] Explainer: Safe copy generation per metric
- [ ] Question generator: 2–3 doctor-ready questions per flagged metric
- [ ] Visit-prep summary generator
- [ ] Emergency flag detector
- [ ] Privacy: no-storage by default, clear-data button
- [ ] Safety tests: chintu-medical-claims.test.js must pass
- [ ] Release guard must pass before commit

**All items above are parked until founder approves this plan and assigns it to a sprint.**

---

> BALA is a health-awareness companion — not a medical device, diagnostic tool, or treatment provider.
> This plan must never be implemented in a way that diagnoses conditions, recommends treatment, or replaces clinical judgement.

---

## Stage 23 decision — PARKED (not built this stage)

The Report Explainer is intentionally **not** implemented as live UI in Stage 23. A
real report-text parser (metric, value, unit, flag extraction) is too large to add
safely alongside the live-bridge work, and it is safety-sensitive. It stays parked.

When it is built, it must stay inside these rails:

- User pastes report text manually. No file upload until that path is proven safe.
- BALA extracts only obvious rows (e.g. `A1c 5.8 % High`) — metric, value, unit, flag.
- BALA shows a neutral "question for your doctor" per row.
- No diagnosis. No treatment advice. No medication advice. No X-ray interpretation.
- Required on-screen copy: "I can help organize report values and prepare questions for
  your doctor. I cannot diagnose conditions or tell you what treatment to take."
- All processing stays local. No report text leaves the device.

Next actionable step: prototype the paste-and-parse function in isolation with unit
tests over sample report strings, behind a feature flag, before any UI is shipped.
