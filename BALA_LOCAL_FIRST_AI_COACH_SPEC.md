# BALA Local-First AI Coach Spec (planning only, parked)

**Status:** PARKED. Research spec only. Do NOT implement without
explicit founder approval.
**Scope:** what would have to be true for BALA to use an *on-device*
model for coach text generation, without breaking local-first or
non-medical rules.

The current coach copy is hand-authored (`coach.js`, the static coach
cards). This is the safe baseline and remains the default.

---

## 1. Why on-device only

Sending health-adjacent text to a cloud LLM endpoint would:

- Add a network egress path (violates `chintu-no-network-egress.test.js`).
- Add a paid-API dependency (parked).
- Add a data-leak surface (mood notes, personal context).
- Add a vendor-policy surface (we'd inherit their content rules).

None of those are acceptable under current Chintu OS rules. So either
the model runs on the user's device, or there is no model.

---

## 2. Candidate techniques (research only)

These are technologies that *could* in principle support on-device
inference inside a PWA. None is currently approved for BALA.

| Technique | Maturity | Footprint | Notes |
|---|---|---|---|
| WebLLM (WebGPU-based LLM runtime) | improving | hundreds of MB model download | Requires WebGPU; not all target devices have it. |
| MediaPipe LLM Inference for Web | improving | hundreds of MB | Google-backed; tied to Gemma family. |
| Transformers.js (smaller models, WASM/WebGPU) | usable for small tasks | tens to hundreds of MB | Best for embeddings / small classification. |
| Browser built-in `window.ai` / `Prompt API` | early, behind flags | zero (model is provided by the browser) | Worth tracking; not deployable today. |
| ONNX Runtime Web | mature | varies | Lower-level; we'd ship a custom small model. |

The point is to track these, not to pick one.

---

## 3. Hard constraints any chosen technique must satisfy

- **Zero network at runtime** after first install. The model must be
  fetched at install (PWA cache) or loaded from disk, then never
  again. The no-network-egress test must continue to pass for Chintu
  scripts; BALA's first-run model fetch would need its own carefully
  scoped exception, explicitly approved by the founder.
- **Non-medical output.** The model must be either small enough or
  prompted strictly enough that it cannot produce diagnostic claims.
  This is the main reason the founder may want to skip this lane
  entirely.
- **Graceful absence.** If the model fails to load or the device can't
  run it, BALA degrades to the existing hand-authored coach cards
  with no broken UI.
- **No persistent training.** No local fine-tuning on user notes. The
  model is read-only.
- **Auditability.** The prompt template must be a static asset in the
  repo, reviewable in a diff.

---

## 4. Smallest plausible slice (if ever approved)

The smallest meaningful slice is *not* a chatbot. It is a single
templated rewrite:

> "User wrote: <note>. Suggest one short companion-style line of
>  acknowledgement. Do not give medical advice. Do not name any
>  condition. Reply in under 20 words."

Output is shown next to the user's own note as a single line, clearly
marked as a suggestion the user can dismiss. No conversation history.
No memory across notes.

This slice does not exist. It is not on any roadmap. It is documented
here only so that if the founder ever revisits the question, the
guardrails are pre-written.

---

## 5. What this spec is NOT

- Not a commitment.
- Not a vendor selection.
- Not an authorization to add a network dependency.
- Not an authorization to add a "chat" surface to BALA.
- Not an authorization to edit any protected BALA file.

---

## 6. Trigger to revisit

Revisit this spec if and only if:

- The browser-native Prompt API (or equivalent) ships in a stable
  channel of at least one major browser.
- The founder explicitly asks for an on-device coach lane.
- A tester cycle has surfaced a concrete need that hand-authored copy
  cannot meet.

Until then, parked.

---

## 7. BALA safety footer

BALA is a health-awareness companion. It does not diagnose, treat,
predict, prevent, replace doctors, or provide emergency monitoring.
