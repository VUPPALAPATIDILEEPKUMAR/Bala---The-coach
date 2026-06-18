# Chintu Agent Architecture

## Multi-brain roles

| Brain | Role |
|---|---|
| **ChatGPT** | Strategy, prompt architecture, product design, roadmap. Does not edit code directly. |
| **Claude Code** | Main builder. Writes code, scripts, docs. Runs local validation. Commits. Never pushes without founder approval. |
| **Codex** | Reviewer, bug hunter, focused patcher. Parked unless explicitly reactivated. |
| **Chintu** | Local judge. Runs validate / release guard / agent board / pre-memory gate / OpenClaw readiness. |
| **OpenClaw** | Local runtime + plugin layer (loopback only). |
| **iMac Control Room** | Lightweight dashboard / report wall. Reads bridge reports. Not the build brain. |
| **Phone** | Future calm notification surface. Not implemented yet. |

## Machine roles

| Machine | Role |
|---|---|
| **Windows** | AI / build machine. Claude Code, Codex, OpenClaw, repo all live here. |
| **iMac (Late 2013, Catalina)** | Read-only control room. Bridge receiver. No AI brain. No local LLM. |
| **Phone** | Future notifier and voice interface. Today: not implemented. |

## Standard multi-brain sprint flow

```text
1. ChatGPT designs the sprint prompt (strategy + safety + task).
2. Claude Code receives the prompt and builds (code / scripts / docs).
3. node --check + chintu-snapshot-consistency.test.js (syntax + sync test).
4. chintu-validate.ps1 (PASS/WARN/FAIL on git/syntax/SW/manifest/medical/privacy/handoff).
5. chintu-release-guard.ps1 (push / do-not-push recommendation).
6. chintu-agent-board.ps1 (daily brief + Go / Review / Stop).
7. (Memory-Wiki Seed sprints only) chintu-pre-memory-gate.ps1.
8. Codex reviews if explicitly activated.
9. Claude commits locally after PASS.
10. Human founder reviews and pushes.
11. Windows reporter writes bridge files to CHINTU_BRIDGE_OUTBOX.
12. iMac bridge-sync.sh ingests, mirrors, archives, regenerates BRIDGE_STATUS.html.
13. (Future) Phone gets a summary notification.
```

## Risk levels and push gates

| Risk | Examples | Required gates before push |
|---|---|---|
| **Green** (docs/scripts only) | Memory vault edits, design reports, Chintu PowerShell scripts, .gitignore | `chintu-validate` PASS + `chintu-release-guard` PASS |
| **Yellow** (small app patch, no copy change) | Snapshot helper, syntax cleanup, bug fix | All Green gates + `node --check` PASS + snapshot test PASS + manual phone check |
| **Orange** (user-visible UI/copy change) | New feature, button, tab, copy | All Yellow gates + medical-safety copy review + service-worker bump + manual phone test |
| **Red** (privacy / safety surface) | Egress changes, share path, doctor-ready content, voice copy, urgent-symptom path | All Orange gates + explicit founder sign-off + Codex review |
| **Black** (parked) | Telegram / Discord / memory-wiki enable / external health API | DO NOT ship without explicit founder approval recorded in `OPEN_QUESTIONS.md` |

## OpenClaw plugin direction

- `memory-core` — enabled (foundation for memory).
- `memory-wiki` — **available but disabled.** Requires explicit founder approval to enable.
- `document-extract` — enabled (local docs, dry-run; never PHI).
- `file-transfer` — enabled (local only).
- `ollama` provider — enabled (for future local-LLM coach).
- `duckduckgo` — **disabled.** When enabled later, public non-sensitive queries only.
- Telegram / Discord — **parked.**

## OpenClaw hard rules

- Never install a plugin.
- Never enable a plugin without explicit founder approval.
- Never read `openclaw.json`, tokens, cookies, sessions, paired-device files.
- Never send health data to any plugin.
- Never call an external URL for health data.

## Codex reactivation conditions

Codex may be reactivated only when:

- A specific patch or review is named by the founder.
- The scope is small and self-contained.
- The Chintu gates are PASS or the failure mode is exactly what Codex is meant
  to fix.
- The risk level is Yellow or Orange (not Red without founder sign-off).

## Stop conditions

Any brain must stop and report instead of guessing when:

- Validation FAILs.
- Snapshot consistency test FAILs.
- A privacy or medical-claim rule is at risk.
- A parked system is implicated.
- A secret, token, or paired-device file is involved.
- The founder has not approved an irreversible action.
