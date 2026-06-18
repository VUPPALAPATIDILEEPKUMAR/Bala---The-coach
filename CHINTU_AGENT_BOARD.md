# Chintu Agent Board

**Stage:** 17  
**Mode:** local-first agent operating system scaffold  
**Status:** planning packets only; no real agents dispatched

## Purpose

This board lets the founder split work into bounded specialist packets that can
be run in parallel by Codex or Claude without pretending any agent already ran.
Each packet is local-only, reviewable, and built around protected-file rules.

## Specialist Lanes

1. Research Agent
2. Builder Agent
3. Validator Agent
4. BALA UX Agent
5. Connector Safety Agent

## Packet Location

- Packet folder: `CHINTU_AGENT_PACKETS/`
- Board script: `scripts/chintu-agent-board.ps1`
- Optional packet validator: `scripts/chintu-agent-board.test.js`

## Founder Flow

1. Run `powershell -ExecutionPolicy Bypass -File scripts\chintu-agent-board.ps1`.
2. Read the generated board report and confirm each packet is still bounded.
3. Copy one packet prompt into Codex or Claude.
4. Let that builder work only inside the packet rules.
5. Re-run validation before any local commit.
6. Stop before push. The founder owns push.

## Safety Rules

- Packets are planning prompts only; they are not proof an agent executed.
- No external messaging, webhooks, live connectors, or secret handling.
- No network egress, no health-data transfer, and no connector activation.
- Protected files listed inside each packet must stay untouched unless a human
  deliberately opens a new packet that allows them.
- BALA remains a health-awareness companion. It does not diagnose, treat,
  predict, prevent, replace doctors, or provide emergency monitoring.

## Expected Packet Shape

Every packet in `CHINTU_AGENT_PACKETS/` must include:

- mission
- files to inspect
- protected files
- allowed actions
- forbidden actions
- validation commands
- suggested commit name
- stop condition
- copy-paste prompt for Codex/Claude
