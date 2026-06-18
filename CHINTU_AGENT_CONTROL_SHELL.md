# Chintu Agent Control Shell

**Stage:** 10
**Mode:** local-first, founder-driven, safety-first
**Status:** static control shell; no external automation

## What Chintu Agent is

Chintu Agent is the local operator shell around Chintu OS reports. It turns
repository state, validator output, bridge state, operator notes, parked-system
rules, and handoffs into one factual briefing with one exact next action.

The Stage 10 shell consists of:

- `CHINTU_AGENT_DASHBOARD.html`: generated static snapshot.
- `scripts/chintu-agent-dashboard.ps1`: local dashboard generator.
- `CHINTU_CLAUDE_OVERNIGHT_PROMPT.md`: bounded Claude continuation package.
- `scripts/chintu-claude-overnight-package.ps1`: local prompt generator.
- `BALA_SAFE_TOUCHPOINTS.md`: the boundary between Chintu OS and BALA.
- `CHINTU_STAGE_11_QUEUE.md`: planned next stages, not active work.
- `CHINTU_FREE_POWER_LANES.md`: parked free/local research lanes.

## What it is not

It is not a live daemon, autonomous worker, backend, health-data processor,
voice assistant, message bot, or cloud service. The HTML cannot read local files
live. It only shows the snapshot written by the generator. It never claims that
parked capabilities are active.

## Local report inputs

The dashboard generator reads only local project state:

- local Git branch, status, latest commits, and commits ahead of `origin/main`;
- `CHINTU_OPERATOR_STATUS.md`, when present;
- `CHINTU_TOMORROW_START.md`, when present;
- `CHINTU_CLAUDE_HANDOFF.md`, when present;
- `chintu-bridge-command-center-report.md`, when present;
- `CHINTU_MEMORY_VAULT/PARKED_SYSTEMS.md`, when present.

All report text is HTML-escaped before it enters the dashboard. The generator
does not read secrets, browser state, BALA health records, cookies, tokens, or
paired-device files. It makes no network call.

## Operator flow

1. Existing Chintu scripts refresh local reports.
2. `scripts/chintu-agent-dashboard.ps1` reads those reports and Git metadata.
3. The script regenerates `CHINTU_AGENT_DASHBOARD.html` as a static snapshot.
4. The founder opens the file locally and reviews facts, blockers, parked work,
   and the next exact action.
5. Codex or Claude receives a bounded handoff, validates changes, commits only
   if safe, and stops before push. The founder owns every push.

Run locally:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/chintu-agent-dashboard.ps1
powershell -ExecutionPolicy Bypass -File scripts/chintu-claude-overnight-package.ps1
```

## Safe BALA support

Chintu OS may summarize BALA product status, repeat the approved safety footer,
identify a documentation or testing need, and prepare a future sprint plan. It
must not change BALA app behavior during a Chintu OS stage, interpret personal
health data, produce medical conclusions, or send health information anywhere.
The complete boundary is in `BALA_SAFE_TOUCHPOINTS.md`.

## Claude and Codex preparation

The shell gives both builders the same source-of-truth files, protected BALA
file list, validation commands, parked systems, and stop-before-push rule.
Prompts are generated as reviewable Markdown, never dispatched automatically.

## Parked future voice layer

Browser speech APIs, local transcription, and local text-to-speech may be
researched later. No speech tool is installed or activated in Stage 10. Voice
cloning, real-person imitation, external voice APIs, audio generation, phone
calls, and founder-identity claims are prohibited.

## Hard safety rules

- Local files only; no network egress, backend, trackers, or remote assets.
- No secrets, paid APIs, health-data transfer, or medical claims.
- No Telegram, Discord, webhooks, phone notifications, calls, or cloud sync
  automation.
- No BALA app-file or service-worker changes.
- No activation of parked tools or plugins without explicit founder approval.
- No auto-commit, auto-push, or irreversible action hidden behind a report.

BALA is a health-awareness companion. It does not diagnose, treat, predict,
prevent, replace doctors, or provide emergency monitoring.
