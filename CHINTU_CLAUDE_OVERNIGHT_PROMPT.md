# Chintu Claude Overnight Prompt

**Package:** Stage 10 local-only continuation
**State rule:** Resolve the latest pushed and locally committed state at session start; do not rely on a hard-coded commit hash.

## Role

Enter Operator Mode. Continue from the latest pushed or locally committed state. Inspect, decide, execute, validate, commit if safe, and stop before push.

## First inspection

1. Inspect all Chintu OS Stage 8/9/10 files and recent commits before editing.
2. Read CHINTU_HANDOFF.md, CHINTU_AGENT_CONTROL_SHELL.md, CHINTU_AGENT_DASHBOARD.html, BALA_SAFE_TOUCHPOINTS.md, CHINTU_STAGE_11_QUEUE.md, CHINTU_FREE_POWER_LANES.md, and the Chintu Memory Vault.
3. Run the existing local validators and Stage 10 generator test to establish a baseline.
4. Treat generated reports as local snapshots. Do not claim live reading, automation, or capabilities that do not exist.

## Authorized overnight lane

- Improve Chintu OS reliability, documentation, tests, and control-shell readability.
- Harden the two Stage 10 generators while keeping them local-only and deterministic.
- Prepare the BALA Voice Coach enhancement plan only as the next sprint. Do not implement BALA Voice Coach code unless the founder explicitly instructs it in a later task.
- Keep BALA local-first and non-medical.
- Preserve the exact BALA safety footer: BALA is a health-awareness companion. It does not diagnose, treat, predict, prevent, replace doctors, or provide emergency monitoring.

## Protected BALA app files

Do not edit, rewrite, format, regenerate, or stage:

- app.js
- index.html
- styles.css
- sw.js
- coach.js
- manifest.webmanifest
- privacy.html
- functions/api/coach.js

If any proposed work requires one of these files, stop that lane and record it as a future plan requiring explicit founder approval.

## Hard boundaries

- Do not activate external automation.
- No network egress, webhooks, Telegram, Discord, phone notifications, phone calling, cloud sync automation, backend services, or paid APIs.
- No secrets, tokens, credentials, cookies, sessions, or paired-device data.
- No health data transfer or default export from local storage.
- No medical claims, diagnosis, treatment, prediction, prevention, or emergency monitoring.
- No voice cloning, real-person voice imitation, external voice APIs, or audio generation.
- Do not install or enable local LLM, speech, automation, desktop-wrapper, or memory-wiki tools. Those lanes remain parked research.
- Do not push. The founder owns every push.

## Validation and finish

1. Validate and commit if safe.
2. Prove the protected BALA app files are unchanged against the starting commit.
3. Review the diff for network/send behavior, secrets, health-data transfer, medical claims, and external activation.
4. Use a clear local commit message if the work is safe.
5. Stop before push and report the exact next human action.

## Low-usage failover

If Claude usage becomes low before completion, save progress and create a handoff before stopping. The handoff must list completed files, unfinished work, validation status, the current commit/tree state, protected files, and the exact continuation command. Preserve or refresh:

- CHINTU_CLAUDE_OVERNIGHT_PROMPT.md
- CHINTU_STAGE_10_PARTIAL_HANDOFF.md
- CHINTU_STAGE_11_QUEUE.md
- BALA_SAFE_TOUCHPOINTS.md

Do not push during failover.
