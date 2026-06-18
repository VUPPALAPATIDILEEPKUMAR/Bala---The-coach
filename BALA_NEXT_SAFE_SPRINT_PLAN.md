# BALA Next Safe Sprint Plan

**Stage:** planning only (not active work)
**Rule:** No BALA app code changes without explicit founder instruction.

## Purpose

This document plans safe future BALA improvements. It does not implement
them. Every item requires a separate explicit founder instruction and its
own validation cycle before any app file is edited.

## Sprint candidates

### 1. BALA Voice Coach enhancement

**Goal:** Improve clarity and accessibility of the voice coach interaction.

Safe scope:
- Polish coach response text for warmth and readability.
- Improve browser speech detection and fallback messaging.
- Add honest capability detection (what the browser supports vs. not).
- Ensure voice coach responses stay non-medical and non-diagnostic.

Not in scope:
- Voice cloning or real-person imitation.
- External voice APIs or paid services.
- Phone calls, audio generation, or live speech.
- Claims of diagnosis, prediction, prevention, or emergency monitoring.

### 2. Local browser speech input/output

**Goal:** If approved, explore browser-native speech for hands-free input.

Safe scope:
- Use only browser SpeechRecognition and SpeechSynthesis APIs.
- Detect availability honestly; show clear fallback when unsupported.
- Keep all speech processing local to the browser.
- No recording, storage, or transmission of audio.

Not in scope:
- External transcription services (Whisper API, Google STT, etc.).
- Voice cloning or founder-identity claims.
- Any network-based speech processing.

### 3. Coach response safety polish

**Goal:** Review and tighten all coach response text for safety compliance.

Safe scope:
- Audit every coach response for medical-claim risk.
- Ensure the safety footer is consistent across all views.
- Remove or soften any language that could imply diagnosis or treatment.
- Add user-visible "this is not medical advice" context where needed.

### 4. Doctor-ready summary polish

**Goal:** Improve the readability of the user's health summary export.

Safe scope:
- Make the summary easier for a user to print or show a doctor.
- Keep the summary user-controlled, informational, not diagnostic.
- Ensure the summary clearly states it is self-reported awareness data.
- No automatic sharing, upload, or transmission.

### 5. Tester feedback flow

**Goal:** Convert real tester friction into small, reversible improvements.

Safe scope:
- Collect concrete feedback from manual testing.
- Rank issues by user impact and safety risk.
- Ship the smallest reversible fix for each issue.
- Validate each change with a manual demo check.

### 6. Privacy and trust polish

**Goal:** Make data handling boundaries clearer to users.

Safe scope:
- Improve local storage explanation in the UI.
- Make export, deletion, and data boundaries visible.
- Ensure no user data leaves the device without explicit action.
- Review and tighten the privacy page copy.

### 7. Demo mode polish

**Goal:** Make BALA presentable for demos without fake data.

Safe scope:
- Ensure demo flow works smoothly on fresh install.
- Add clear "demo" labeling if sample data is used.
- Make onboarding clear and honest about what BALA does.

## Hard rules for all sprints

- No prediction, diagnosis, prevention, or emergency monitoring.
- No health-data egress or default export.
- No paid API unless explicitly approved by founder.
- No backend services.
- No voice cloning, real-person imitation, or external voice API.
- No Telegram, Discord, webhooks, cloud sync, or phone notifications.
- Every sprint starts with a fresh safety and scope check.
- Every sprint ends with manual validation and founder review.

## Activation gate

No sprint begins until the founder explicitly selects it. Selection of
one sprint does not activate any other sprint, external channel, or
automation.

## Safety footer

BALA is a health-awareness companion. It does not diagnose, treat, predict, prevent, replace doctors, or provide emergency monitoring.
