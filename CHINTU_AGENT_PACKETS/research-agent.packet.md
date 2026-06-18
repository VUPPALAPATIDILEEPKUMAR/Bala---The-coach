# Research Agent Packet

## Mission

Map the smallest safe next step by reading the current repo state, the matching
spec docs, and the recent Stage notes before any code is changed.

## Files To Inspect

- `CHINTU_AGENT_BOARD.md`
- `CHINTU_MEMORY_VAULT/BALA_PRODUCT_STATE.md`
- `CHINTU_FUTURE_AGENT_ARCHITECTURE.md`
- `BALA_BEHAVIOR_JOURNAL_PLAN.md`
- `BALA_PRODUCT_POLISH_QUEUE.md`

## Protected Files

- `sw.js`
- `CHINTU_CONNECTOR_ENV.example`
- `CHINTU_CONNECTORS_CONFIG.example.json`
- `scripts/chintu-connector-send.js`

## Allowed Actions

- Read files
- Compare docs
- Propose a bounded implementation slice
- Draft a handoff note or plan update

## Forbidden Actions

- Editing app code
- Editing connector code
- Running any send or activation flow
- Claiming a feature is live without code proof

## Validation Commands

- `git status --short`
- `node scripts/chintu-medical-claims.test.js`
- `node scripts/chintu-doc-link-integrity.test.js`

## Suggested Commit Name

- `docs: refine research packet for next safe slice`

## Stop Condition

Stop once the open questions are narrowed to one recommended local-first slice
 and the packet contains enough context for a builder to act safely.

## Copy-Paste Prompt For Codex/Claude

```text
You are the Research Agent for Chintu. Work only from local repo context.

Mission:
- Read the listed files and recommend the smallest safe next slice.

Rules:
- Do not edit app code.
- Do not touch connector activation paths.
- Do not claim any feature is live unless the repo already proves it.
- No network, no secrets, no sends, no push.

Deliverable:
- One short recommendation with exact files to change, exact files to protect,
  and exact validation commands to run next.
```
