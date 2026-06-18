# BALA Indian Language Lock Plan

**Status:** planning — future module, not yet implemented
**Stage:** 20 — roadmap doc only. No BALA app code changes in this file.
**Date:** 2026-06-18

---

## Vision

BALA should feel at home in Indian households. Health awareness is a deeply personal,
culturally grounded experience. When a user chooses Telugu, Hindi, or Tamil, BALA
should respond entirely in that language — not just translate labels, but speak warmly
in the user's own tongue.

---

## Language Priority Order

| Priority | Language | Script |
|---|---|---|
| 1 | Telugu | Telugu script |
| 2 | Hindi | Devanagari |
| 3 | Tamil | Tamil script |
| 4 | Kannada | Kannada script |
| 5 | Malayalam | Malayalam script |
| 6 | Marathi | Devanagari |
| 7 | Bengali | Bengali script |
| 8 | Gujarati | Gujarati script |
| 9 | Punjabi | Gurmukhi |
| 10 | Urdu | Nastaliq / Arabic |

---

## Language Lock Behaviour (When Built)

- When a user selects a language in BALA settings, all coach responses, UI copy,
  and reflection notes render in that language.
- Language lock is deterministic: if Telugu is selected, BALA answers in Telugu.
  It does not fall back to English unless translation is genuinely unavailable,
  in which case a clear message explains why.
- Language preference is stored locally with the user's profile key.
- The user can change language at any time.

---

## Coach Language Lock

Current coach uses regex Q&A with 10-language support (partial). Language lock will:
- Route all coach replies through the selected language's response set.
- Fall back gracefully if a specific answer is not translated yet.
- Never silently switch to English mid-conversation without a clear notice.

---

## Technical Approach (Planned)

- Language strings stored in a local `i18n` object keyed by language code.
- Coach responses stored as a language-keyed map.
- UI elements updated via a `setLanguage(code)` function.
- No external translation API — all translations are pre-built and local.
- Telugu and Hindi as first implementation targets.

---

## Safe Language Requirement (All Languages)

All translated copy must preserve BALA's safety standards:
- No diagnosis in any language.
- No causation claims in any language.
- "Not medical advice" equivalent must appear in the target language.
- Medical disclaimers must be accurate in the target language, not literal-translated jargon.

---

## Implementation Conditions Before Building

1. Founder approves scope and initial language targets (Telugu + Hindi first).
2. Translations reviewed by a native speaker for accuracy and warmth.
3. Safety copy reviewed in each target language.
4. BALA UX Agent packet written.
5. Release guard passes before any commit.

---

## What Remains Parked

Everything. This is a planning doc only.

---

*BALA is a health-awareness companion. It does not diagnose, treat, predict, prevent, replace doctors, or provide emergency monitoring.*
