# Chintu Voice Layer Research (parked)

**Status:** PARKED. Research notes only. No activation.

A holding bay for "what would a voice layer for the *operator* mean
under Chintu OS." This is distinct from `BALA_VOICE_COACH_SAFE_SPEC.md`
(which is about a voice affordance for end users of BALA).

---

## 1. What we mean by "operator voice layer"

A founder-facing voice surface that would let the founder ask Chintu
OS for a status update without typing — e.g. "what's the next safe
action?" → spoken or typed response.

This does not exist. There is no plan to build it.

---

## 2. Why parked

- Voice introduces a microphone permission and an always-listening
  surface. Both are high-stakes for a single-user local-first system
  with health-adjacent context.
- Any cloud-backed STT/TTS would break local-first.
- Local STT is feasible (Vosk, Whisper.cpp, browser Web Speech) but
  brittle on mid-tier hardware.
- The existing typed surface (alive briefing, next-action script) is
  already faster than voice for the kind of orientation the founder
  needs.

---

## 3. If revisited, hard rules

- **Push-to-talk only.** No always-on mic.
- **Local STT only.** No cloud transcription.
- **No telephony.** No call placement. No SMS.
- **No voice cloning.** Synthesis uses the system TTS or none.
- **No persistent recording.** Audio is processed in memory.
- **Output deterministic.** Voice asks invoke existing scripts; the
  voice layer does not synthesize plans on the fly.

---

## 4. Smallest plausible slice

A push-to-talk button in a local web page that runs `chintu-next-action.ps1`
and reads the first paragraph of the result aloud through the browser's
system TTS. No transcription needed — only synthesis. This is the
voice equivalent of clicking a refresh button.

Even this trivial slice is parked because the underlying need
(faster orientation) is already met by the typed dashboard and the
alive briefing.

---

## 5. Trigger to revisit

- The founder explicitly asks.
- Hands-free use becomes necessary (e.g. injury, accessibility).
- A stable, local-only voice runtime ships in a major browser at zero
  cost and zero permission surprise.

Until then, parked.

---

## 6. BALA safety footer

BALA is a health-awareness companion. It does not diagnose, treat,
predict, prevent, replace doctors, or provide emergency monitoring.
