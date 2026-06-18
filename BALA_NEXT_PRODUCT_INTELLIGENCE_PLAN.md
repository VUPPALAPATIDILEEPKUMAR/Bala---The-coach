# BALA Next Product Intelligence Plan

**Date:** 2026-06-18  
**Status:** Architecture — handoff to Codex  
**Base:** BALA is a local-first health-awareness PWA. All data stays on device.

---

## Current BALA State (What Exists)

| Feature | State | Notes |
|---|---|---|
| BALA Score | Live | Weighted: sleep 32%, HRV 23%, RHR 20%, activity 20%, SpO2 5% |
| Today's Guide | Live | Rule-based, deterministic |
| Symptom check-in | Live | Urgent-symptom safety cap |
| Coach | Live | Regex Q&A, 10 languages |
| Apple Health import | Live | ZIP/XML, in-browser, no CDN |
| Doctor-ready timeline | Live | Copyable + .txt download |
| Daily Factors journal | Live (Stage 17) | localStorage, user-entered: alcohol, caffeine, late meal, stress, soreness, travel, low movement, exercise, hydration + note |
| Behavior Journal Plan | Planned | Weekly reflection, factor history — NOT YET BUILT |
| Voice input/output | Live | Web Speech API with capability guard |
| PWA | Live | Install prompt, offline shell |

---

## Safety Rules (Absolute, Non-Negotiable)

BALA is a **health-awareness companion**. It does not:
- Diagnose
- Treat
- Predict
- Prevent any medical event
- Replace doctors
- Provide emergency monitoring
- Claim cardiac-event prediction or prevention
- Imply live wearable sync unless the feature is implemented

**The story:** BALA is named in memory of the founder's father, Balaji. The safe version: "I built BALA in memory of my father, Balaji. His name inspired this app. BALA is my attempt to help people listen to their body signals earlier and take small steps toward better health awareness." No cause-of-death language. No medical detail.

**Safe vocabulary:** awareness, guide, signals, body signals, recovery, balance, check-in, patterns, baseline, recent trend, listen to your body, daily health companion.

---

## Next Layer: Weekly Reflection

### What it is
A simple view of the last 7 days of daily factor entries, grouped by factor type. No scoring. No medical framing. No AI inference.

### What it shows
For each factor (alcohol, caffeine, late meal, stress, soreness, travel, low movement, exercise, hydration):
- How many times it was noted in the last 7 days
- A simple bar or dot indicator (optional UI)
- The user's notes for that week (collapsed, expandable)

### Copy framing (safe)
- "Here's what you noted this week"
- "You logged stress 4 times this week — your reflection, not an assessment"
- "These are patterns from your own notes"

### What it never says
- "You are stressed" (it says "you noted stress")
- "This may cause..." (no causal claims)
- "We detected..." (user-entered, not detected)
- Any diagnostic or predictive language

### Implementation
- Reads existing `BALA_BEHAVIOR_JOURNAL` localStorage data (already saved by Stage 17)
- Pure client-side logic — no new API, no network call
- Weekly Reflection is a new tab or section in the BALA app
- Filter: last 7 calendar days based on entry timestamps
- `sw.js` cache version bump required when shipping UI changes

---

## Next Layer: Factor History Beside Timeline

### What it is
Show daily factor entries in the same view as check-in history (the main BALA timeline).

### How it works
- When the user views "History", factor entries for the same date as a check-in appear as a collapsible row below that check-in
- Small icons or labels for each active factor (stress, caffeine, etc.)
- Optional note shown in full on tap/click

### Copy framing (safe)
- "Daily notes for {date}"
- "Factors you logged"

### What it never says
- "Your factors may explain your score" — no causal connection between factors and BALA Score is stated

---

## Next Layer: Today's Guide Enhancement (Factor Awareness)

### Current behavior
Today's Guide is fully rule-based: it looks at BALA Score, sleep, HRV, RHR, SpO2, and shows a safe daily suggestion.

### Enhancement: Reference recent factor entries
If the user noted stress yesterday or in the last 2 days, Today's Guide can safely say:
- "You noted stress recently — here are some awareness tips for today"

If the user noted late meal, the guide can say:
- "You noted a late meal recently — gentle movement today might feel supportive"

### What this requires
- Read last 2 days of factor entries from localStorage
- Map factor types to safe guide messages (a lookup table, not AI inference)
- Rules are deterministic: `if (stress within 2 days) → show stress-awareness message`
- No scoring of factors. No weighting. No model.

### Copy framing (safe)
All factor-aware guide messages use:
- "You noted {factor} recently"
- "Here's something that may feel supportive today"
- "Listen to your body"
- "Not medical advice — check in with a healthcare professional if needed"

---

## Next Layer: Doctor-Ready Factor Summary

### Current behavior
Doctor-ready summary exports the last 30/60/90 days of check-ins as a plain .txt file. It contains no scores and no interpretations.

### Enhancement: Append factor section
Add a section at the bottom of the .txt export:

```
DAILY NOTES (self-entered)
These are notes I entered myself. They are personal reflections, not medical observations.

2026-06-17: Stress, Late meal. Note: "Busy project day"
2026-06-16: Exercise, Caffeine.
2026-06-15: Soreness, Low movement. Note: "Rest day"
...
```

### Framing requirements
- Section header must include: "self-entered"
- Preamble must say: "These are notes I entered myself. They are personal reflections, not medical observations."
- No scores derived from factors
- No interpretation of what the factors mean
- No connection between factors and BALA Score

---

## Next Layer: Coach Grounding with Factor Signals

### Current coach behavior
The BALA coach answers regex-matched questions with pre-written safe responses. It does not use AI.

### Enhancement: Factor-aware grounding
When the user asks about stress, sleep, or recovery in the coach, the coach can reference recent factor entries as grounding context:

**User asks:** "Why might I feel tired today?"  
**Current coach:** Generic safe response about sleep and recovery.  
**Enhanced coach:** "You noted late meal and stress in your recent daily notes — these are things that can relate to how rested you feel. This isn't a diagnosis, just something you may want to reflect on."

### Implementation
- Add a lightweight factor context function: reads the last 3 days of factor entries
- Pass factor names as a safe context string into relevant coach answer templates
- Deterministic rule: if factor X appears in context AND question matches category Y, show factor-aware variant of the answer
- No AI call. No LLM. No network.

### Safety guard
Every factor-aware coach message must end with a variant of: "These are reflections from your own daily notes, not medical advice. If you're concerned about how you feel, talk to a healthcare professional."

---

## Apple Watch / Apple Health — Honest Current State

**What BALA has today:** Apple Health ZIP/XML file import. The user exports their Health data from the iPhone Health app as a zip archive, and BALA imports it locally in the browser. No live sync. No Apple Watch API. No background reads.

**What to say in product copy:** "Import your Apple Health export to get started" — not "sync with Apple Watch" and not "real-time Apple Health connection."

**Future path (not implemented, not promised):**
- Apple Watch / HealthKit live sync requires a native app (Swift, iOS) or a Shortcuts-based file export bridge
- This is a future lane, not a current feature
- Do not claim this feature is live. Do not imply it is coming soon unless a specific sprint is planned and approved.

---

## Implementation Priority Order

1. **Weekly Reflection** — reads existing data, new view only, highest user value
2. **Doctor-ready factor summary section** — low risk, high trust signal for users
3. **Factor history beside timeline** — moderate complexity, good discoverability
4. **Today's Guide factor awareness** — deterministic rules only, careful copy review required
5. **Coach grounding with factor signals** — lowest priority, requires copy review pass

---

## sw.js Note

Any UI change that ships new JavaScript or HTML requires a `sw.js` cache version bump. The version string is `bala-shell-v{N}` — increment N. Do not edit `sw.js` for doc-only changes.

---

## BALA Safety Footer

**BALA is a health-awareness companion. It does not diagnose, treat, predict, prevent, replace doctors, or provide emergency monitoring.**

This footer appears in every generated BALA document, every doctor-ready export, and every connector payload (health data is blocked from connectors regardless).
