# BALA Score Model — Review Plan

**Stage:** 22
**Status:** planning — parked implementation. No BALA app code changes in this file.
**Mode:** architecture and math boundaries. Build requires explicit founder approval and sprint assignment.

---

## Purpose

BALA currently shows a demo-mode score. This plan defines how to make the BALA Score smarter, more transparent, and safely grounded in real daily signal inputs — while staying health-awareness only.

**The score must never claim:** prediction, diagnosis, prevention, treatment, emergency monitoring, or guaranteed health outcomes.

---

## What the BALA Score Is

A daily awareness number (0–100) that reflects how your body signals look today — relative to your own recent baseline.

It is not a medical index. It is not a risk score. It is a starting point for reflection.

---

## Safe Scoring Philosophy

| Principle | Implementation |
|---|---|
| Transparent inputs | Show what data went into today's score |
| Baseline-relative | Compare today vs your recent 7-day average, not population norms |
| Missing-data graceful | Lower confidence, clearly noted — score still shown |
| Warm neutral labels | Not "bad" or "at risk" — use "recovery day", "steady", "high energy" |
| Emergency override | Any emergency symptom bypasses score with urgent-care guidance |
| Reflection not action | "This may be worth reflecting on" — not "do this or else" |

---

## Signal Inputs and Contribution

### Category 1 — Recovery Signals (contributes ~35%)

| Signal | Type | Weight Range | Safe Label |
|---|---|---|---|
| HRV vs 7-day baseline | numeric | 0–15 pts | "Your recovery signal looks [higher / similar / lower] than recent days" |
| Resting heart rate vs baseline | numeric | 0–10 pts | "Resting heart rate is [close to / above / below] your recent pattern" |
| Sleep duration vs goal | numeric | 0–10 pts | "Sleep duration was [on target / shorter / longer] than usual" |
| SpO₂ (if available) | numeric | 0–5 pts | "Blood oxygen looks within normal range" (only if device provides) |

### Category 2 — Sleep Quality Signals (contributes ~25%)

| Signal | Type | Weight Range | Safe Label |
|---|---|---|---|
| Sleep consistency (bedtime variance) | numeric | 0–10 pts | "Sleep timing was [consistent / shifted] compared to your pattern" |
| Sleep score (if device provides) | numeric | 0–10 pts | "Sleep score from your device" |
| Late meal (within 2h of sleep) | boolean | −3 pts | "Late meal may have affected sleep quality" |
| Caffeine timing (PM intake) | boolean | −2 pts | "Afternoon/evening caffeine noted" |

### Category 3 — Activity Signals (contributes ~20%)

| Signal | Type | Weight Range | Safe Label |
|---|---|---|---|
| Steps vs baseline | numeric | 0–8 pts | "Activity was [active / light / rest day]" |
| Weekly cardio % complete | numeric | 0–7 pts | "Weekly cardio progress" |
| Active energy / workout logged | boolean | 0–5 pts | "Workout detected" |

### Category 4 — Lifestyle Context (contributes ~15%)

| Signal | Type | Weight Range | Safe Label |
|---|---|---|---|
| Alcohol (standard drinks) | numeric | −0 to −6 pts | "Alcohol noted — awareness signal, not judgment" |
| Hydration (self-reported) | categorical | −3 to 0 pts | "Hydration level: [low / okay / well hydrated]" |
| Stress (self-reported 1–5) | numeric | −5 to 0 pts | "Stress noted — may affect recovery signals" |
| Travel / time zone shift | boolean | −3 pts | "Travel noted — your baseline may shift" |

### Category 5 — Symptoms (override modifier)

| Signal | Behaviour |
|---|---|
| No symptoms | No modifier |
| Mild (fatigue, soreness) | −5 pts, reflection note |
| Moderate (headache, poor sleep quality) | −10 pts, "may be worth monitoring" |
| **Urgent (chest pain, trouble breathing, fainting, severe weakness, stroke-like)** | **Score hidden. Show emergency guidance only.** |

### Future Signals (parked — not in MVP score)

| Signal | Why Parked |
|---|---|
| Menstrual cycle phase | Requires privacy-gated opt-in (Stage 24+) |
| Lab report values | Report explainer track only — never base score |
| Medication | Outside BALA scope |
| Genetic data | Never |

---

## Score Calculation — Pseudocode (Awareness Only)

```
function computeBALAScore(inputs):
  base = 50                         // neutral starting point

  // Add signal contributions (capped to avoid inflation)
  score = base
    + recovery_contribution(inputs)   // 0–35
    + sleep_contribution(inputs)      // 0–25
    + activity_contribution(inputs)   // 0–20
    + lifestyle_modifier(inputs)      // −14 to 0
    + symptom_modifier(inputs)        // −10 to 0

  score = clamp(score, 0, 100)

  // Confidence: how much data did we have?
  available = count(non-null inputs)
  total = count(all inputs)
  confidence = (available / total) * 100

  return {
    score,
    confidence,
    missing_signals: missing(inputs),
    contributors: top 3 positive contributors,
    warnings: top 2 negative contributors,
  }
```

**Important:** The pseudocode is a planning reference, not a medical algorithm. Final math is subject to UX and safety review before implementation.

---

## Missing Data Handling

| Data available | Behaviour |
|---|---|
| All key signals (HRV, sleep, steps) | Full score shown, confidence HIGH |
| Some signals missing (e.g. no HRV) | Score shown, "Limited data — confidence MEDIUM" note shown |
| Most signals missing | Score shown, "Score based on limited data — add more to improve" |
| Only symptoms | Show symptom reflection only. No numeric score. |

---

## "Why This Changed" Copy

When today's score differs from yesterday's by ≥5 points, show a brief explanation.

Examples:
- "Your HRV was higher than your recent average — recovery signal improved."
- "Sleep was shorter than usual and your resting heart rate was slightly elevated."
- "Less activity today — this may reflect a planned rest day."
- "Stress noted — this often shows up in recovery signals."

Copy rules:
- Max 2 sentences
- Warm, not clinical
- "May reflect" or "often shows" — not causation claims
- No "this means you are..."

---

## "What to Watch" Copy

A single optional signal worth monitoring over the next 1–3 days.

Examples:
- "Your sleep timing shifted tonight — watching consistency over the next few days."
- "HRV has been below your baseline for 3 days — a rest day may help."
- "Alcohol noted two nights in a row — your body signals may reflect this."

Rules:
- One signal only — no pile-on
- "Worth watching" not "you must fix this"
- No shame-based alcohol copy

---

## Emergency Override

**Triggered by:** chest pain, chest pressure, trouble breathing, fainting, severe weakness, stroke-like symptoms, persistent palpitations.

**Behaviour:**
1. Hide the BALA score — do not show any number
2. Show full-screen safety card:
   > "This sounds like something to take seriously. Please contact emergency services or go to your nearest emergency room now. Do not rely on BALA for emergency decisions."
3. Offer: "Tell me more about your symptoms" (for doctor-visit prep only)

This override takes priority over all scoring logic.

---

## Score Display Labels (Awareness Language)

| Score Range | Label | Feeling |
|---|---|---|
| 80–100 | High energy day | Warm green |
| 60–79 | Steady day | Blue |
| 40–59 | Recovery day | Amber |
| 20–39 | Rest and listen | Soft amber |
| 0–19 | Low signals — take it easy | Muted |

Labels never say: "Good", "Bad", "Healthy", "Unhealthy", "At risk", "Normal".

---

## Doctor-Ready Context

When the user taps "Doctor-Ready Summary":
- Score for the last 7 days (awareness, not diagnosis)
- Average sleep, steps, HRV note
- Symptoms logged in the period
- Lifestyle context flagged
- "This is a personal awareness log — not a medical report"

---

## Implementation Checklist (When Approved)

- [ ] Replace demo chartData with live input schema
- [ ] Implement score function in app.js (pseudocode above)
- [ ] Add confidence display to score card
- [ ] Add "Why this changed" text to Today's Guide
- [ ] Add emergency override card
- [ ] Add missing-data note to score display
- [ ] Run full safety test suite after implementation
- [ ] Run chintu-medical-claims.test.js — must pass
- [ ] Run chintu-release-guard.ps1 — must pass

**All items above are parked until founder approves this plan and assigns it to a sprint.**

---

> BALA is a health-awareness companion — not a medical device, diagnostic tool, or treatment provider.
> This plan must never be implemented in a way that claims to predict, prevent, diagnose, or treat any health condition.
