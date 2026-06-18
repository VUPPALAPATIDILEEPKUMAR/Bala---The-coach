# Chintu Claude Continuation Prompt

Paste this verbatim into a fresh Claude Code session to continue
Chintu OS builder work from where the previous session left off.

This is distinct from `CHINTU_NEXT_THREAD_STARTER.md` (cold start for
any session) and `CHINTU_CODEX_REVIEW_PROMPT.md` (read-only reviewer).
This prompt is specifically for a continuation builder.

---

## The prompt

> You are Claude. You are continuing a Chintu OS builder cycle that a
> previous Claude session paused. The repo is
> `C:\Users\Chintu\Desktop\test`.
>
> Before any tool call, read:
>
> 1. `CHINTU_CLAUDE_SURVIVAL_HANDOFF.md` — cold-start brief.
> 2. `CHINTU_FOUNDER_COMMAND_MAP.md` — every safe command.
> 3. `CHINTU_START_HERE.md` — single founder entry point.
> 4. `CHINTU_WHEN_STUCK.md` — troubleshooting.
> 5. `CHINTU_GENERATED_FILES_MAP.md` — what is regenerated vs hand
>    written.
> 6. `CHINTU_REPO_HYGIENE_REPORT.md` — known drift watch.
>
> Then orient with:
>
> ```powershell
> git log --oneline -25
> git status --short
> powershell -ExecutionPolicy Bypass -File scripts\chintu-master-launcher.ps1 -SkipReports
> ```
>
> Hard rules (do **not** violate):
>
> - Never edit `app.js`, `index.html`, `styles.css`, `sw.js`,
>   `coach.js`, `manifest.webmanifest`, `privacy.html`,
>   `functions/api/coach.js`.
> - Never bump the service-worker `CACHE_NAME`.
> - Never activate Telegram, Discord, webhooks, cloud sync, phone,
>   voice cloning, paid APIs, network egress, memory-wiki.
> - Never push. Push is the founder's call.
> - Never commit secrets.
>
> Loop until usage is low, validation fails and cannot be safely
> fixed, you hit a safety boundary, or the next step requires
> founder-only approval:
>
> 1. Inspect current repo.
> 2. Pick the next safe slice from `CHINTU_STAGE_11_QUEUE.md` or the
>    parked angles documented in
>    `CHINTU_CLAUDE_SURVIVAL_HANDOFF.md` §7.
> 3. Build it as docs / scripts / tests / control-room work only.
> 4. Validate with the master launcher.
> 5. Commit one safe slice per commit. Subject prefix `chore:` for
>    infra or `docs:` for docs-only.
> 6. Repeat.
>
> Before stopping, update `CHINTU_CLAUDE_SURVIVAL_HANDOFF.md` with a
> short cycle summary (which backlogs ran, which commits landed, which
> validation steps passed, what is parked).
>
> Final safety footer whenever BALA is mentioned:
>
> > BALA is a health-awareness companion. It does not diagnose, treat,
> > predict, prevent, replace doctors, or provide emergency monitoring.

---

## What this prompt is for

Resuming Stage 11 builder work in a fresh Claude Code session without
the founder having to re-narrate every safety rule.

## What this prompt is NOT for

- One-off questions (the founder can just ask).
- BALA app code work (founder-driven, not builder).
- Pushing (founder-only).

## BALA safety footer

BALA is a health-awareness companion. It does not diagnose, treat,
predict, prevent, replace doctors, or provide emergency monitoring.
