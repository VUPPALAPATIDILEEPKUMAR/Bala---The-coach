# Founder Preferences

Known collaboration preferences for the builder. Any AI assistant should follow
these unless an autonomous sprint is explicitly requested.

## Operating style

- **Step-by-step by default.** Walk through decisions in plain language. Do not
  jump to autonomous multi-phase work unless the prompt explicitly says so.
- **Copy-paste prompts wanted.** When suggesting a next move that needs another
  brain, give a paste-ready prompt block.
- **Practical, founder-friendly action.** Prefer one useful change over five
  aspirational sketches. Real, verifiable steps.
- **Keep BALA and Chintu tracks separate.** Never mix a BALA app change with a
  Chintu tooling/docs change in the same commit.
- **Local-first, free, safe.** Default to free / local / open. Avoid paid APIs,
  paid plans, paid LLMs, and anything that adds a subscription.
- **Small, verifiable steps.** Never break what already works. Summarize changed
  files, safety notes, and testing steps after each change.

## Communication style

- Plain language, no jargon dump.
- Calm and honest. No hype. No fear.
- Warm, human voice. Treat Chintu as family.
- Be direct about risk and tradeoffs.
- Prefer Markdown over slides.

## Tool preferences

- **Claude Code** for the main build work (code, scripts, docs, commits).
- **Codex** for review and focused patches (only when explicitly activated).
- **ChatGPT** for strategy, prompts, product design.
- **Chintu** scripts for validation and safety gates.
- Concise, self-contained prompts for Codex tasks.

## Project rules

- BALA and any "BALA 2.0" track are separate. Do not confuse them.
- Token economy is a hard constraint. Keep prompts tight.
- Prefer free / open / local models. Design for $20-tier plans.
- The mission is to give BALA to users **freely**.
- Commit locally after validation PASS. Push only with founder approval.
- Never claim to predict, prevent, diagnose, treat, or replace doctors.

## Father story

The only public version that may appear in copy, screenshots, or interviews:

> I built BALA in memory of my father, Balaji. His name inspired this app.
> BALA is my attempt to help people listen to their body signals earlier and
> take small steps toward better health awareness.

Do not say or imply details about cause of death, hospitals, medical history, or
any private detail in public BALA copy.

## Autonomous sprint behavior (when explicitly requested)

When the founder explicitly asks for an autonomous multi-phase sprint:

- Run Phase 0 recovery first, summarize state, then proceed.
- Respect every gate. If a gate FAILs, stop and write the report.
- Never enable plugins or push without explicit approval.
- Always produce the final results report at the end.

## Default behavior (when NOT explicitly requested)

- Recommend the smallest next step.
- Ask one clarifying question if the path is ambiguous.
- Wait for go-ahead before changing code.
