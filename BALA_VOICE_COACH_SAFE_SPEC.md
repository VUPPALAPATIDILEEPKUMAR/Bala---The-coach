# BALA Voice Coach — Safe Spec (planning only, parked)

**Status:** PARKED. Specification only. Do NOT implement without
explicit founder approval.
**Scope:** what a future local-only voice coach for BALA *could* look
like under Chintu OS safety rules.

This document exists so that if and when the founder asks for a voice
layer, the implementation can begin from a vetted spec rather than
from scratch. It is not a roadmap.

---

## 1. Core constraints (non-negotiable)

A voice layer for BALA is only acceptable if it satisfies every one of:

- **Local-first.** All audio capture and synthesis runs on the user's
  device. No streaming to a cloud TTS or STT vendor.
- **Opt-in.** No microphone access without an explicit per-session
  consent action by the user. Default state: voice OFF.
- **Non-medical.** Voice output never says "you have", "you should
  take", "this is a symptom of", or names a condition. It mirrors the
  existing BALA copy safety rules.
- **No telephony.** No call placement, no SMS, no phone-number
  collection. Phone integration is parked indefinitely.
- **No voice cloning.** No synthesis of any real person's voice.
- **No recording persistence.** Audio is processed in memory and
  discarded. Transcripts, if generated, are stored only with the same
  local-only rules that govern existing BALA text storage.

If any of these cannot hold, the feature does not ship.

---

## 2. Three candidate slices (smallest first)

### Slice V1 — text-to-speech of existing coach text

The Web Speech API `speechSynthesis` is built into modern browsers and
runs entirely on-device. Tap a "Play" button on a coach card → the
existing card text is spoken aloud.

- New BALA code: a tiny play-button affordance in the coach card.
- No new permissions beyond what the browser provides.
- No new data captured.
- Failure modes: browser without Web Speech support → button hidden.

### Slice V2 — wake-on-tap voice note

User taps a mic button, speaks a sentence, BALA transcribes it locally
(Web Speech API `SpeechRecognition` where supported) into a memory
note. No streaming.

- Adds a transient mic-active UI state.
- Transcript joins the existing local note storage.
- No remote model. No audio file kept.
- Failure modes: missing API → mic button hidden. Failed transcription
  → user gets a "tap to type instead" fallback.

### Slice V3 — guided breathing audio cue

Pre-recorded short audio cue (a single inhale/exhale tone) shipped as
a static asset, played on tap. No model, no streaming.

- Adds one short `.mp3` or `.ogg` asset to the PWA cache.
- Requires a service-worker cache update — that is a founder-only call
  and must happen in a separate, explicitly-approved BALA commit.

---

## 3. What this spec is NOT

- Not a commitment to ship any of these slices.
- Not an authorization to edit `app.js`, `index.html`, `styles.css`,
  `sw.js`, `coach.js`, `manifest.webmanifest`, `privacy.html`, or
  `functions/api/coach.js`.
- Not an authorization to call any external STT/TTS service.
- Not a voice-cloning project.
- Not a call/telephony project.

---

## 4. Acceptance signals (when the founder is ready to consider V1)

- A clean BALA branch with no other in-flight work.
- A founder note explicitly approving Slice V1 by name.
- A test plan covering the button being hidden on unsupported browsers.
- A privacy-page update covering the new feature, reviewed by the
  founder, that preserves the existing non-medical framing.

Only then does Slice V1 enter the BALA implementation queue. Until
then, this spec stays parked.

---

## 5. BALA safety footer

BALA is a health-awareness companion. It does not diagnose, treat,
predict, prevent, replace doctors, or provide emergency monitoring.
