# CHINTU Intelligence Layers

Chintu is the personal local-first agent for the BALA project and Balaji's family.
Each layer has a job. Together they form one brain. No layer needs to be paid or premium.

---

## Layer map

```
User (Bala / Chintu's driver)
        |
        v
  [INTAKE] — What does the user need?
        |
        v
  [PLAN] — Which layer handles this best?
        |
   _____|_______________________
  |         |         |         |
ChatGPT   Claude   Codex    Ollama/Qwen
Strategy  Inspect  Implement  Local fallback
         & Patch
        |
        v
  [VALIDATE] — Did it work? Is it safe?
        |
        v
  [SUMMARIZE] — What changed? What's next?
        |
        v
  [MEMORY] → Update CHINTU_HANDOFF.md
        |
        v
  [NEXT ACTION] → Loop back
```

---

## Layer details

### ChatGPT (OpenAI)
- **Best for:** Strategy, product thinking, prompt design, safety review, planning
- **Use when:** Thinking about what to build next, writing product copy, reviewing BALA safety language, brainstorming Chintu's architecture
- **Token tip:** Use for big-picture sessions. Keep prompts focused. Paste CHINTU_HANDOFF.md to re-seed.

### Claude (Anthropic — this session)
- **Best for:** Repo inspection, codebase understanding, safe text/copy patches, encoding fixes, security/privacy review, architecture maps
- **Use when:** Reading files, searching patterns, fixing visible issues, generating markdown docs, reviewing what's safe
- **Token tip:** Use `/clear` between unrelated tasks. Paste CHINTU_HANDOFF.md at session start.

### Codex (OpenAI)
- **Best for:** Focused implementation, writing small new functions, refactoring single files
- **Use when:** You have a clear spec and want a code block written or an existing function improved
- **Token tip:** Codex has token limits on free plans. Give it one focused task per session.

### Ollama / Qwen (local, free)
- **Best for:** Local fallback when paid usage is exhausted, simple summaries, JSON validation, short Q&A
- **Use when:** You need a quick answer and don't want to spend tokens, or you're offline
- **Setup:** `ollama run qwen2.5:7b` or similar. Runs on your own machine. No cost.

### OpenClaw (local tools / workflow runner)
- **Best for:** Running local tools, bridging Chintu's memory between sessions, workflow automation
- **Role in Chintu:** The "hands" — executes scripts, manages files, runs local models, maintains the CHINTU_HANDOFF.md loop
- **Do not expose:** Gateway secrets, paired.json, or OpenClaw security config to any external AI.

---

## Chintu loop (how a session should run)

```
1. INTAKE       User states the task clearly
2. SEED         Paste CHINTU_HANDOFF.md to re-seed the AI's context
3. PLAN         AI names the one safest next action
4. INSPECT      Read relevant files only (no full repo scan unless needed)
5. PATCH        Make one small safe change at a time
6. VALIDATE     Run syntax check or lightweight test
7. SUMMARIZE    Output: files changed, logic changed yes/no, safety check, privacy check
8. MEMORY       Update CHINTU_HANDOFF.md with what changed
9. NEXT ACTION  Name the next recommended sprint
10. STOP        Wait for user approval before continuing
```

---

## Safety wall (applies to all layers)

BALA is not a medical product. No layer of Chintu should ever output:

- Predictions of heart attacks or cardiac arrest
- Claims of disease detection, prevention, or diagnosis
- Claims of treating conditions or replacing doctors
- Claims of emergency monitoring or early warning
- Any language that overstates what a wearable signal means

Safe language always: awareness, signals, baseline, trend, check-in, recovery, balance,
doctor-ready summary, talk to a healthcare professional.

---

## Memory discipline

- `CHINTU_HANDOFF.md` — the shared brain. Update after every meaningful sprint.
- `CHINTU_INTELLIGENCE_LAYERS.md` — this file. Update when layers change.
- `BALA_*.md` — BALA product context. Update when product changes.
- Do NOT put secrets, tokens, API keys, or gateway credentials in any of these files.

---

## Current Chintu status (2026-06-17)

- Layer 1 (ChatGPT): Active — strategy and product
- Layer 2 (Claude): Active — repo inspection and safe patches
- Layer 3 (Codex): Available — focused implementation on demand
- Layer 4 (Ollama/Qwen): Available locally — free fallback
- Layer 5 (OpenClaw): In development — local workflow runner
- Memory bridge: Manual via CHINTU_HANDOFF.md (automated bridge planned)
