# Release History

Recent important commits (newest first):

| Hash | Message | Type | What it changed |
|---|---|---|---|
| `258b949` | docs: define Chintu bridge sync contract | docs | Defined Windows -> iMac bridge file contract, folder layout, safety rules. |
| `aa88dc9` | docs: seed Chintu memory vault | docs | Created the 9-file memory vault (product state, safety, agent arch, releases, sprints, parked, founder prefs, open questions, README). |
| `435a4a3` | chore: add Chintu pre-memory gate | tooling | Added `chintu-pre-memory-gate.ps1` to gate Memory-Wiki Seed Vault V1 enablement. |
| `86b9e05` | docs: add multi-brain review protocol | docs | Added the safe collaboration flow (ChatGPT / Claude / Codex / Chintu / OpenClaw / founder). |
| `901e7ca` | fix: keep latest snapshot aligned with history | bug fix | Top-level dashboard snapshot now resyncs from newest history entry after add/edit/remove/past-date. Added regression test. |
| `6c4393e` | fix: disable webhook health-data egress | safety | Removed hidden external-send UI, endpoint storage, payload, runtime path. Validator FAILs on outbound app-data patterns. |
| `20b27e0` | chore: add OpenClaw readiness dashboard | tooling | Added `chintu-openclaw-readiness.ps1` to merge plugin runtime status with static safety assessment. |
| `e3d2500` | docs: map OpenClaw integrations for Chintu | docs | OpenClaw direction: memory-core active, memory-wiki parked, document-extract/file-transfer enabled, Telegram/Discord parked. |
| `3baf5aa` | chore: enhance Chintu agent board daily briefing | tooling | Morning brief, next-sprint recommender, paste-ready Claude prompt, Go/Review/Stop decision. |
| `0400339` | chore: add Chintu agent board runner | tooling | First version of the agent board (8 sections + next-3-sprints + Go/Stop). |
| `6e13d0a` | feat: log a check-in for a past date | feature (BALA) | Stage 2 complete. Capture form gains optional date, future blocked, dedupe overwrite confirm. |
| `7c015d1` | docs: add end-of-usage handoff for BALA Chintu | docs | Universal session-starter handoff document. |
| `a40776a` | chore: add Chintu release guard runner | tooling | Read-only push / do-not-push guard wrapping the validator. |
| `c423bb4` | feat: download doctor-ready summary as txt | feature (BALA) | Stage 3 started. Doctor-ready timeline `.txt` download. |
| `088cc19` | docs: add Chintu release guard report | docs | Initial release guard design notes. |

## Milestones

- **Stage 2 complete** (2026-06-17): view more, edit, remove, past-date check-in.
- **Stage 3 started** (2026-06-17): doctor-ready `.txt` download.
- **Privacy fix** (2026-06-17): webhook health-data egress removed (`6c4393e`).
- **Snapshot fix** (2026-06-17): latest snapshot resyncs after every history
  mutation; regression test in place (`901e7ca`).
- **Chintu tooling V1** (2026-06-17): validate, release guard, agent board,
  OpenClaw readiness, pre-memory gate.
- **Multi-brain protocol** (2026-06-17): documented in
  `CHINTU_MULTI_BRAIN_REVIEW_PROTOCOL.md`.
- **Memory vault** (2026-06-17): 9-file seed vault created (`aa88dc9`).
- **Bridge contract** (2026-06-17): file contract defined (`258b949`).
- **Memory vault hardening** (2026-06-17): vault docs strengthened with Claude/Codex usage rules, push gates, ranked sprints, safe father story.

## Snapshot at last sprint

- Branch: `main`.
- HEAD: `258b949`.
- origin/main: `258b949` (caught up).
- Unpushed commits: 0.
- SW cache: `bala-shell-v43`.
- Validate / release-guard / agent-board: PASS (1 known-safe disclaimer WARN).
- Snapshot regression test: PASS.
