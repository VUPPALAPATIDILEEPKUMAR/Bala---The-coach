# Chintu Memory Vault

This is Chintu's local seed vault -- the foundational knowledge layer for the
BALA + Chintu multi-brain operating system.

## What this is

- A set of plain-Markdown files that capture product state, architecture,
  medical-safety rules, release history, sprint queue, founder preferences,
  parked systems, and open questions.
- Markdown-first and safe for human review at any time.
- Designed so any AI assistant (ChatGPT, Claude Code, Codex, or Chintu itself)
  can read these files and resume work with full context.

## What this is NOT

- This is **not** the OpenClaw memory-wiki plugin. memory-wiki is **disabled**.
- No secrets, tokens, credentials, cookies, sessions, or paired-device files.
- No private health data; no scores, no symptoms, no exports.
- No automated sync; no external push; nothing leaves the device on its own.

## Contents

| File | Purpose |
|---|---|
| `BALA_PRODUCT_STATE.md` | Current BALA features, stages, technical state |
| `BALA_MEDICAL_SAFETY_RULES.md` | Prohibited claims, safe wording, father story, copy review |
| `CHINTU_AGENT_ARCHITECTURE.md` | Multi-brain roles, sprint flow, risk levels, push gates |
| `RELEASE_HISTORY.md` | Important commits and what each release changed |
| `NEXT_SPRINT_QUEUE.md` | Ranked queue of upcoming work |
| `PARKED_SYSTEMS.md` | Systems intentionally disabled or deferred |
| `FOUNDER_PREFERENCES.md` | Collaboration style, founder constraints, father story |
| `OPEN_QUESTIONS.md` | Decisions awaiting founder input |
| `BLOCKERS.md` | Active blockers that gate release or sprint progress |
| `DECISIONS.md` | Decisions taken, with date and rationale |
| `DAILY_LOGS/` | Plain-Markdown daily log per session (YYYY-MM-DD.md) |

## How Claude should use this vault

- Read the entire vault at the start of a sprint.
- Treat `BALA_MEDICAL_SAFETY_RULES.md` as canonical. Any copy that conflicts
  with it must be changed, not shipped.
- Treat `FOUNDER_PREFERENCES.md` as the source of truth for collaboration style.
- Treat `NEXT_SPRINT_QUEUE.md` as the ranked backlog. Pick the highest-priority
  unblocked item, unless the founder names a different one.
- Update `RELEASE_HISTORY.md`, `NEXT_SPRINT_QUEUE.md`, and `BALA_PRODUCT_STATE.md`
  at the end of any sprint that shipped meaningful work.
- Never put health data, tokens, or secrets into any vault file.
- Never edit the vault during a release-blocked state (e.g. validation FAIL).

## How Codex should use this vault

- Treat the vault as read-only context for review.
- Use `CHINTU_AGENT_ARCHITECTURE.md` to confirm Codex's role (reviewer / small
  patches / parked unless reactivated).
- Use `BALA_MEDICAL_SAFETY_RULES.md` to verify copy safety in any proposed patch.
- Use `RELEASE_HISTORY.md` to avoid re-doing work already done.
- Use `PARKED_SYSTEMS.md` to avoid implementing parked surfaces.
- Update the vault only when the founder explicitly approves a doc patch.

## How ChatGPT should use this vault

- Read the vault before designing a sprint prompt.
- Use `NEXT_SPRINT_QUEUE.md` and `OPEN_QUESTIONS.md` to pick the next move.
- Use `FOUNDER_PREFERENCES.md` to keep prompts cheap, calm, and step-by-step.

## What not to store

- Health data (BALA scores, symptoms, exports, raw vitals).
- Secrets, tokens, credentials.
- `.env`, `openclaw.json`, cookies, browser sessions, paired-device files.
- Personally identifying info beyond the founder's existing public mention.
- Anything that should never appear in a public log.

## Rules

- Plain Markdown only. No executables in the vault folder.
- Vault edits are docs-only commits; never combined with app changes.
- Validation must PASS before any vault commit.
- memory-wiki plugin stays disabled until explicit founder approval.
