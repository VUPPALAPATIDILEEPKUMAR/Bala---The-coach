# Chintu Local LLM Research (parked)

**Status:** PARKED. Research notes only. Nothing activated.

A holding bay for "what would it mean to run a local LLM as part of
the Chintu OS operator layer." Not BALA-side (see
`BALA_LOCAL_FIRST_AI_COACH_SPEC.md`); this is about whether Claude/Codex
could be replaced or augmented by an on-device model.

---

## 1. Today's reality

The operator layer runs as a hosted Claude or Codex session connecting
to this local repo. There is no on-device LLM. There is no requirement
for one.

---

## 2. Why a local LLM is even a question

- Privacy: the founder may want to keep more of their reasoning on
  device, especially for BALA-adjacent planning conversations.
- Continuity: hosted models change. A local model is a stable fallback.
- Cost: no per-call billing for slow-day exploratory work.

---

## 3. Why a local LLM is hard to justify right now

- The operator layer's work (writing scripts, writing docs, running
  tests, threading the master launcher) is at the frontier of what
  large hosted models do well. Smaller local models drop quality
  significantly on multi-step file editing.
- A local model would still need a harness equivalent to Claude Code
  to interact safely with the repo.
- Power and disk footprint are non-trivial on the founder's machine.

---

## 4. Candidate runtimes to track (no decision)

- llama.cpp / Ollama as a local HTTP-style runner.
- LM Studio for GUI experimentation.
- vLLM for serving (probably overkill on a single workstation).
- WebLLM / MediaPipe LLM as in-browser hosts — relevant if BALA ever
  wants on-device, but irrelevant for operator-layer work.

This list is for orientation only. No pick is implied.

---

## 5. Hard rules if ever activated

- The local model serves the operator layer only, never BALA runtime.
- No model output is auto-committed. The founder reviews every diff.
- No network calls. The model runs offline.
- Model weights are not committed to this repo.
- The model has no special privileges over the existing safety tests.

---

## 6. Trigger to revisit

- The founder asks specifically.
- A capable, locally runnable model exists at a size that fits the
  founder's hardware comfortably.
- The hosted operator layer becomes unreliable for this work.

Until then, parked.

---

## 7. BALA safety footer

BALA is a health-awareness companion. It does not diagnose, treat,
predict, prevent, replace doctors, or provide emergency monitoring.
