# Chintu OS Stage 11 Queue

Stage 10 prepares these lanes; it does not implement them. Every lane starts
only after explicit founder selection and a fresh safety/scope check.

| Stage | Lane | Current state | Activation gate |
|---|---|---|---|
| 11A | Chintu Agent Desktop Control UI polish | planned | Founder selects; local static shell first |
| 11B | iMac Option 12 install/test hardening | actionable on iMac | Founder runs and confirms the test plan |
| 11C | BALA Voice Coach safe enhancement | parked product work | Separate explicit BALA instruction |
| 11D | BALA tester feedback and demo polish | parked product work | Real feedback plus explicit BALA instruction |
| 11E | Future local speech input/output research | parked research | Design review; no cloning or external voice API |
| 11F | Telegram/Discord/cloud/webhooks | parked external systems | Explicit written approval and separate threat/privacy review |

## 11A - Chintu Agent Desktop Control UI polish

Improve dashboard readability, report grouping, deterministic generation, and
local open/run ergonomics. Keep the snapshot honest: no fake live state and no
backend. Electron, Tauri, and PWA wrappers remain later design choices.

## 11B - iMac Option 12 install/test hardening

Run the existing `CHINTU_IMAC_PACKAGES/OPTION_12_PULL_SHARED/IMAC_TEST_PLAN.md`
on the iMac, record the result, and harden only observed failures. Manual option
11 remains the fallback until the full shared-loop test passes.

## 11C - BALA Voice Coach safe enhancement

Start with a dedicated BALA design and tests. Preserve local-first behavior,
the non-medical boundary, and honest browser capability detection. No voice
cloning, real-person imitation, phone calls, or external voice API.

## 11D - BALA tester feedback and demo polish

Collect concrete friction, rank it by user impact and safety risk, then ship the
smallest reversible improvements with BALA validation and manual demo checks.

## 11E - Future local speech input/output research

Research browser speech APIs, local Whisper-style transcription, and local
Piper-style text-to-speech. Document platform support, privacy, install cost,
and fallback behavior. Do not install or activate anything in Stage 10.

## 11F - External channels remain parked

Telegram, Discord, cloud sync automation, and webhooks are not a default Chintu
direction. They remain parked until the founder explicitly approves a bounded,
non-health-data use case and its security/privacy review.

## Selection rule

Choose one lane at a time. The safest current human-run lane is 11B. Product
lanes 11C/11D and research lanes 11E/11F do not inherit approval from Stage 10.
