# BALA Product State

## Vision

BALA is a local-first health-awareness PWA (installable web app) that helps a
person understand their own wearable and health signals in calm language.

**Main hook:** Your daily health guide from your own body signals.

I built BALA in memory of my father, Balaji. His name inspired this app. BALA is
my attempt to help people listen to their body signals earlier and take small
steps toward better health awareness.

## Privacy posture

- All data stays on the user's device (browser localStorage).
- No accounts, no backend, no trackers, no ads, no paid APIs.
- Sharing and automation paths are parked and removed from runtime.
- Export/import is user-triggered and stays on-device.

## Current features

- BALA Score (weighted: sleep 32%, HRV 23%, RHR 20%, activity 20%, SpO2 5%)
- Baseline (rolling 3 check-ins) and weekly patterns (last 7)
- Today's Guide (rule-based daily suggestion)
- Symptom check-in with urgent-symptom safety cap
- Coach (regex Q&A, greetings in 10 languages)
- Voice input/output (Web Speech API with capability guard)
- Apple Health ZIP/XML import (fflate, in-browser)
- Manual CSV/JSON import with validation
- BALA data export/import (versioned JSON v1)
- Doctor-ready timeline (copyable + downloadable .txt)
- History management: view more (5/30/60/90), edit, remove, past-date add
- PWA: install prompt, offline shell, manifest shortcuts
- Demo mode (7-day sample data)

## Stage progress

- **Stage 2 (history/data-entry trust): COMPLETE**
  - View more history
  - Edit saved check-in
  - Remove saved check-in
  - Past-date check-in
- **Stage 3 (doctor-ready export): STARTED**
  - Doctor-ready .txt download

## Technical state

- SW cache version: bala-shell-v43
- Deployed via GitHub Pages (static site)
- No live wearable sync (Apple Health file import only)
- Coach is deterministic (no AI/LLM call)
