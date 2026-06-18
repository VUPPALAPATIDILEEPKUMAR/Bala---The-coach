# Chintu Prompt Engine Plan

**Stage:** 20
**Status:** planning — active implementation slice
**Mode:** local-first, no network, no secrets

---

## Purpose

The Chintu Prompt Engine generates copy-paste-ready structured prompts for use with
Codex, Claude, or any LLM. It removes the manual overhead of crafting XML/COSTAR/ACR
prompt skeletons every time the founder starts a new implementation session.

---

## Frameworks Supported

### XML Framework
Best for: Implementation tasks with clear file scope, safety rules, and output format.
Structure:
```
<role> ... </role>
<context> ... </context>
<project_state> ... </project_state>
<task> ... </task>
<rules> ... </rules>
<validation_commands> ... </validation_commands>
<output_format> ... </output_format>
```

### COSTAR Framework
Best for: Tasks requiring a clear persona, audience, and style.
Structure: Context → Objective → Style → Tone → Audience → Response format

### ACR Framework
Best for: Tight, fast implementation slices where brevity matters.
Structure: Action → Context → Result

---

## CLI Interface

```bash
node scripts/chintu-prompt-engine.js --framework xml   --track bala   --task "Add alcohol calculator"
node scripts/chintu-prompt-engine.js --framework costar --track chintu --task "Improve agent runner"
node scripts/chintu-prompt-engine.js --framework acr   --track both   --task "Plan next sprint"
```

Options:
- `--framework` : xml | costar | acr (default: xml)
- `--track`     : bala | chintu | both (default: both)
- `--task`      : free-text description of the task
- `--out`       : optional output file path

---

## Output Behavior

- Prints the generated prompt to stdout
- Optionally writes to a file with --out
- Includes safety reminders for BALA tracks
- Includes Chintu connector/approval rules for Chintu tracks
- Includes validation checklist and output format section
- No network calls. No secrets. Fully local.

---

## Tests

`scripts/chintu-prompt-engine.test.js` covers:
- XML skeleton contains required tags
- COSTAR skeleton contains all 6 sections
- ACR skeleton contains all 3 sections
- BALA track includes safety footer
- Chintu track includes dry-run reminder
- No network calls are made
- Accepts custom task string

---

## Future Extensions

- Load project state from git log / last-validation.txt
- Include agent board state in prompt context
- Generate multi-agent coordination prompts
- Output to CHINTU_AGENT_PACKETS/ automatically

---

*BALA is a health-awareness companion. It does not diagnose, treat, predict, prevent, replace doctors, or provide emergency monitoring.*
