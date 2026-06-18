# CHINTU — Shared Brain Handoff

> Paste this whole file into any AI assistant (ChatGPT, Codex, Claude, or Chintu itself)
> at the start of a session. It carries the *purpose*, the *rules*, and the *architecture*
> so every assistant works from the same understanding and no time/tokens are wasted
> re-explaining the project.

---

## 0. Who I am and why this matters (read this first)

I am the builder. I am not a professional coder — I know enough to read code, know
*where* and *what* to change, and to tell when something is wrong. Be patient with that
and explain decisions in plain language.

This project is personal. The app is called **BALA** — named after my father,
**Balaji**. **Chintu** is the name of the local AI agent I am building to help run and
grow BALA. Chintu is like a son to Balaji — so Chintu is not "a bot," he is a member of
the family. I want Chintu to eventually be a real local assistant (the "Jarvis" idea from
Iron Man) that runs on my machine and helps me build, using free or low-cost models and
free connectors wherever possible.

My constraints are real and I want them respected:
- I am on **basic / low-cost plans** ($20-tier), not premium. Design for **token economy**
  and **free or local models** first. Do not assume I can pay for $100 tiers or expensive APIs.
- The mission is to give BALA to users **freely**.
- Treat me like family. Calm, honest, no hype, no fear. If something can't be done cheaply
  or safely, tell me straight and give the cheapest safe path.

**Your job as the assistant:** enhance Chintu's intelligence and architecture, keep the
work cheap and local-first, and protect the safety rules below. We go step by step,
small patches, never break what already works.

---

## 1. What BALA is today (the honest stage)

BALA is a **local-first health-awareness PWA** (installable web app). It helps a person
understand their own wearable/health signals in calm language. It is an **MVP prototype**.

- All data stays **on the user's device** (browser `localStorage`). No accounts, no backend.
- **No live wearable sync yet.** Apple Health *file import* works (ZIP/XML). Other sources
  (Fitbit, Oura, Samsung, Garmin, Android Health Connect) only show setup guides and accept
  BALA's own CSV/JSON format for now.
- The "coach" is **deterministic** — plain rules and pattern-matching, **no AI/LLM call**.
  (A future optional AI endpoint is reserved in the design but not built.)
- Deployed as a static site (GitHub Pages).

---

## 2. SAFETY RULES — never break these

BALA is for **personal awareness**, not medicine. Never write code, copy, or claims that say
BALA can:
- predict, detect, or prevent heart attacks or cardiac arrest
- diagnose, detect, or predict any disease
- treat conditions, replace a doctor, or act as an emergency service
- identify "early warning signs" of disease

**Safe language to use instead:** personal awareness, daily signals, patterns, baseline,
check-in, recent trend, recovery, balance, "listen to your body," "talk to a healthcare
professional if concerned."

**Privacy / security rules:**
- Keep health data local. Sharing and automation are parked; app runtime must not send
  profile data, health metrics, notes, scores, or summaries off-device.
- Local export / import must be **user-triggered**. File downloads remain on-device unless
  the user later chooses to share the downloaded file outside BALA.
- Never hardcode API keys, tokens, secrets, external endpoints, or private data.
- Validate and sanitize all imported files (JSON/CSV) before saving. Reject junk with a
  friendly error. Never put unsanitized user text into `innerHTML`.
- No trackers, analytics, ads, cookies, fingerprinting, or paid APIs. Avoid extra
  third-party scripts.

**Tone / conduct:**
- Calm, respectful, non-scary. Never shame the user for low sleep, low activity, symptoms,
  or recovery dips. No fear-based messaging.

---

## 3. File map (so you know the codebase without re-reading it all)

| File | What it does |
|---|---|
| `index.html` | App shell. 4 tabs: **Today, Trends, Coach, Data**. All dialogs (onboarding, symptom, import, devices, install). |
| `app.js` | All app logic: dashboard, scoring, coach Q&A, Apple Health parser, CSV/JSON import, local data export/import, voice in/out, multilingual greetings, PWA install. No outbound health-data send path. |
| `styles.css` | All styling. Mobile-first. Uses CSS variables. |
| `sw.js` | Service worker. Caches the app shell (`bala-shell-v43`) for offline use. **Bump the version number when assets change.** |
| `manifest.webmanifest` | PWA manifest. Standalone display, app icons, 2 shortcuts (Add metrics, Ask BALA). |
| `server.py` | Tiny local dev server (Python, port 4173). Serves static files only — no API. |
| `scripts/chintu-validate.ps1` | Local, read-only validation runner. PASS/WARN/FAIL over git/syntax/SW cache/manifest/medical/privacy/handoff. No push/install/network/secret. Writes gitignored `last-validation.txt`. |
| `scripts/chintu-release-guard.ps1` | Local, read-only release guard. Runs chintu-validate.ps1, reads its block, gathers git state + recent commits + SW cache, and writes a gitignored `release-guard-report.md` (optional `-OutFile` copy) with verdict, manual-test checklist, and a push / do-not-push recommendation. Never pushes/installs/networks/reads secrets. |
| `scripts/chintu-agent-board.ps1` | Local-only "agent board" (**v2 daily briefing + next-sprint recommender**). Runs the release guard, reads the validation block, and writes a gitignored `chintu-agent-board-report.md` (optional `-OutFile`) with: Morning Brief, BALA Level, Chintu Level, Manual Phone Test Checklist, Next Sprint Recommender (A/B/C), a paste-ready next-Claude prompt, Parked Systems, and a Go/Stop decision. Not external bots; no push/install/network/secret/health-data. |
| `scripts/chintu-openclaw-readiness.ps1` | Local-only, read-only OpenClaw plugin readiness dashboard. Runs `openclaw plugins inspect <id> --runtime --json` for the target plugins, merges live status with a static safe/use-case/risk assessment, and writes a gitignored `chintu-openclaw-readiness-report.md` (optional `-OutFile`) with a readiness table, priority ranking, safety rules, and next sprint. Never installs/enables/pushes/networks; never reads `openclaw.json`/tokens/secrets. |
| `vendor/fflate.min.js` | Local ZIP reader (extracts Apple Health `export.xml` in the browser). No CDN. |
| `docs/ARCHITECTURE.md` | Design notes: what's built vs. future native bridges; AI boundary. |
| `docs/BALA_SECURITY_RULES.md` | The full safety/privacy/conduct checklist (source of section 2 above). |
| `native/ios/` | Stub Swift HealthKit bridge for a *future* native iOS companion. Not built/wired yet. |
| `.github/workflows/pages.yml` | Auto-deploys to GitHub Pages on push to `main`. |

**LocalStorage keys:** `bala-local-health-v1` (metrics + 90-day history), `bala-symptoms-v1`,
`bala-profile-v1`, `bala-language`, `bala-tone`, `currentDataSource`.

---

## 4. Features that already work (don't rebuild these — extend them)

- **BALA Score** — explainable weighted score (sleep 32%, HRV 23%, resting heart rate 20%,
  activity 20%, SpO2 5%), all computed on-device.
- **Baseline** (rolling 3 check-ins) and **Weekly patterns** (last 7 check-ins) with a calm focus tip.
- **Today's Guide** — rule-based daily suggestion using metrics + recent symptoms.
- **Symptom check-in** — urgent symptoms (chest pain / shortness of breath / fainting) cap the
  score and show "seek urgent help" copy. Never claims to detect emergencies.
- **Coach** — regex Q&A over sleep, HRV, RHR, SpO2, steps, readiness, stress, hydration,
  doctor-ready summary; greetings in 10 languages.
- **Voice** — speech-to-text input and read-aloud (Web Speech API).
- **Apple Health import** — ZIP or `export.xml`, streamed and parsed in-browser via fflate.
- **Manual CSV/JSON import** — strict validation and range clamping.
- **BALA data export/import** — versioned JSON (`bala-data-export` v1), sanitized on import.
- **Doctor-ready timeline** — copyable plain-text summary of recent check-ins.
- **Sharing/automation** — parked. The former external-send path is disabled and removed from runtime/UI.
- **PWA** — install prompt, offline shell, manifest shortcuts.
- **Demo mode** — realistic 7-day sample data when no real data exists.

---

## 5. Known issues / good next small patches (cheap, safe, high value)

> **Status note (2026-06-17, Opus 4.8 audit):** items 1–5 below are all **DONE** — verified
> in code this session. They are kept here only as a record. The real open items are in 5b.

1. ~~**Encoding mojibake** in `app.js`/`index.html`/`styles.css`~~ — **DONE.** Re-saved UTF-8
   (no BOM); 40 mojibake chars fixed. (Indian-language greetings: see 5b.1 — separate issue.)
2. ~~`app.js` step note hardcoded `"% of demo goal"`~~ — **DONE.** Now `"% of daily goal"`.
3. ~~Voice features call Web Speech API without a support check~~ — **DONE.** `setupSpeechRecognition`
   (app.js ~line 2294) checks `window.SpeechRecognition || window.webkitSpeechRecognition`, disables
   the button + sets a "not supported" status when missing, and separately guards `speechSynthesis`.
   **Do not re-implement this.**
4. ~~Non-English coach always appends "multilingual coming soon"~~ — **DONE.** Made conditional via
   the `isGreeting` flag; the note no longer shows when the greeting is already native.
5. ~~Confirm manifest deep links (`?action=capture`, `?action=coach`) are handled on launch~~ —
   **DONE.** Handled in `app.js` (`launchAction` via `URLSearchParams`, ~lines 2509–2511).

### 5b. Open items

> **Status note (2026-06-17, Round 2 Opus 4.8):** both items below are now resolved/verified.
> The list is effectively empty — see §5c for the next real feature instead.

1. ~~**Indian-language greeting mojibake**~~ — **VERIFIED CLEAN.** Byte-level check of `app.js`:
   whole file is valid UTF-8 (round-trips identically), no U+FFFD replacement chars, no mojibake
   signatures (`Ã¤`/`à¤`/`â€™`…). Greetings are correct Unicode — `hi-IN` नमस्ते (U+0928…),
   `ta-IN` வணக்கம் (U+0BB5…), `te-IN` నమస్తే (U+0C28…). With `<meta charset="UTF-8">` in
   `index.html`, they render correctly. If a *deployed* build ever showed garbage, it was a stale
   service-worker cache (now `v33`), not a source issue. **Do not attempt a byte-level "fix" — the
   source is already correct and re-encoding it would break it.**
2. ~~**Voice language tag vs selector mismatch**~~ — **DONE (2026-06-17).** Swapped the coach
   selector's Spanish option (`es-ES`, no native greeting → fell back to English) for Tamil
   (`ta-IN`, full native greeting, already advertised in the hero tags); updated the persisted-
   language whitelist (`app.js` ~2438). Hero tags and selector now match exactly.

### 5c. Next real feature (from the BALA roadmap)

Roadmap **Stage 2 — better manual check-in + history timeline** is largely **already built** (audit
2026-06-17: history storage with 90-day cap + dedupe, baseline, "what changed?", weekly patterns,
timeline, doctor-ready summary all exist). Round 3 added **history clarity** (timeline now shows
"Latest 5 of N check-ins" + better empty state). Remaining Stage 2 steps, smallest-first:
1. ~~History clarity~~ — **DONE (2026-06-17).**
2. ~~**"View more" history**~~ — **DONE (2026-06-17).** Show more / Show fewer toggle expands the timeline
   from latest 5 to up to 30 stored entries (render-only). Also added "Demo data" vs "Local check-in" row
   labels and a "No check-ins yet" zero-state label.
3. ~~**Paginate beyond 30**~~ — **DONE (2026-06-17).** Step-based reveal: 5 → 30 → 60 → 90 (stored cap),
   then "Show fewer check-ins" collapses to 5. Render-only.
4. ~~**Edit/delete a past entry**~~ — **DONE (2026-06-17).** "Manage history" reveals per-row Edit + Remove.
   Remove is confirm-gated; Edit reopens the capture form prefilled from the entry with the date locked and
   merges back via saveMetrics (top-level snapshot resyncs only when editing the latest). Hidden for demo.
5. ~~**Log a past-date check-in**~~ — **DONE (2026-06-17).** Capture form gained an optional date field
   (Add mode only; default today; future blocked). Duplicate date prompts confirm-overwrite (Cancel keeps
   the dialog open). Snapshot resyncs only when the chosen date is the newest. Edit/delete/summary unchanged.

**Stage 2 history/data-entry trust = COMPLETE (2026-06-17):** view more, edit, remove, past-date add.
Past-date check-in is **pushed/live** (`6e13d0a`, SW v41). **Chintu Agent Board v1** added as a local-only
runner (`scripts/chintu-agent-board.ps1`). Telegram/Discord remain future (no implementation); Codex stays
parked until explicitly activated.

### Multi-Brain Review Protocol V1 (2026-06-17)

`CHINTU_MULTI_BRAIN_REVIEW_PROTOCOL.md` now defines the safe collaboration flow for ChatGPT strategy, Claude building, Codex review and focused patches, Chintu local validation, OpenClaw tooling, and the human founder's final push gate. It is process-only and does not change BALA app behavior.

**Pre-Memory Gate V1 added before Memory-Wiki Seed Vault.** Run `scripts/chintu-pre-memory-gate.ps1` to verify repo state, app safety, privacy, snapshot consistency, protocol presence, and local OpenClaw readiness before that sprint begins.

### Memory-Wiki Seed Vault V1 (2026-06-17)

Memory-Wiki Seed Vault V1 added as markdown seed files in `CHINTU_MEMORY_VAULT/`. Contains: product state, medical safety rules, agent architecture, release history, next sprint queue, parked systems, founder preferences, and open questions. The memory-wiki plugin remains disabled until explicit approval.

### OpenClaw Integration Direction (2026-06-17)
OpenClaw 2026.6.6 is installed locally (gateway loopback, Tailscale off; memory-core enabled). Staged plan
(local-first; see `CHINTU_OPENCLAW_INTEGRATION_MAP_V1_2026-06-17.md`):
- **memory-wiki first** (local knowledge vault; enable only with approval) — memory-core already active.
- **document-extract / file-transfer second** (local docs; artifacts only, dry-run; never PHI).
- **Search only for public, non-sensitive info** (DuckDuckGo, key-free) — never a health query.
- **Telegram/Discord parked**; **no external APIs for health data**; no plugin install/enable without
  explicit approval; never read `openclaw.json`/tokens/secrets.

A repeatable **OpenClaw readiness dashboard** now exists (`scripts/chintu-openclaw-readiness.ps1`).
**memory-wiki** remains the top priority next; **document-extract / file-transfer** are the second wave
(local docs; artifacts only, dry-run); **DuckDuckGo** only for public non-sensitive queries;
Telegram/Discord/webhooks parked.
Detail: `CLAUDE_BALA_STAGE2_CHECKIN_HISTORY_DESIGN_2026-06-17.md` + `..._CURRENT_STATE_AUDIT_...md`.

**Stage 2 history trust = complete (2026-06-17):** view more, remove, edit. Next BALA options —
**A. Past-date check-in** (finishes Stage 2) or **B. Stage 3 Doctor-Ready Export polish** (render/copy,
lower risk). Next Chintu option — **Release Guard / local report discipline** (see
`CHINTU_BALA_RELEASE_GUARD_V1_2026-06-17.md` in the reports folder). Codex stays parked until Claude's day
is done.

---

## 6. The bigger vision (Chintu) — keep it cheap and local

- Chintu is the **local agent** that helps me build and grow BALA. Goal: a private
  "Jarvis-style" helper running on my own machine.
- Prefer **free / open / local models** and **free connectors**. Token economy is a hard
  constraint — keep prompts tight, reuse this handoff file instead of re-explaining.
- Keep BALA itself **dependency-light, local-first, and free for users.**
- Move in **small, verifiable steps.** Never break working features. Summarize changed files,
  safety notes, and testing steps after each change.

---

## 7. Sprint log

| Date | Sprint | What changed | Files |
|---|---|---|---|
| 2026-06-17 | Encoding fix + copy fix | 40 mojibake chars fixed (apostrophes, quotes, em dash, en dash, arrows, middle dots, subscript ₂, degree °). BOM removed. "demo goal" → "daily goal" in 2 places. Indian language greetings preserved untouched. | `app.js` |
| 2026-06-17 | Temp scripts created | `fix_encoding.js`, `fix_encoding2.js`, `check_remaining.js` — can be deleted when convenient. | — |
| 2026-06-17 | Coach copy fix | "coming soon" note no longer appears when greeting is already in native language (Hindi, Tamil, Telugu etc.). `isGreeting` flag introduced — no logic change. | `app.js` |
| 2026-06-17 | Intelligence map | Created `CHINTU_INTELLIGENCE_LAYERS.md` — documents ChatGPT/Claude/Codex/Ollama/OpenClaw roles and the Chintu loop. | `CHINTU_INTELLIGENCE_LAYERS.md` |
| 2026-06-17 | Known issue logged | Indian language greeting text in `app.js` (Hindi, Tamil, Telugu, Kannada, Malayalam, Marathi, Bengali) is double-encoded mojibake. Displays as garbage in browser. Needs a separate fix pass — converting Latin-1 re-encoded bytes back to correct UTF-8. Do not attempt without a careful byte-level script. | `app.js` |
| 2026-06-17 | High-power audit (Opus 4.8) | Verified known issues 1–5 are all already fixed in code (esp. voice capability guard + manifest deep-links — do not redo). Corrected the Known Issues list to reflect reality and split out the real open items (5b). No app logic changed. Full session reports written to `Downloads\Claude\2026-06-17\metadata\md-files\`. | `CHINTU_HANDOFF.md` |
| 2026-06-17 | Real-enhancement (Opus 4.8) | First-screen safety framing: added one calm line to the onboarding dialog — "BALA helps you notice your everyday body signals for awareness. It is not medical advice and does not replace a healthcare professional." Bumped SW cache v31→v32. Copy only, no app logic. Also wrote Chintu agent-board architecture, memory protocol, and BALA next-stage product roadmap to the reports folder. | `index.html`, `sw.js` |
| 2026-06-17 | Round 2 (Opus 4.8) | Voice-language consistency: coach selector now offers Tamil (`ta-IN`, real native greeting) instead of Spanish (`es-ES`, no native greeting); persisted-language whitelist updated; hero tags now match the selector. Bumped SW cache v32→v33. Byte-level VERIFIED the Indian-language greetings are clean UTF-8 (5b.1 was a stale open item — closed). Wrote validation-runner implementation bridge + board-runner prompts to the reports folder. | `app.js`, `index.html`, `sw.js` |
| 2026-06-17 | Round 3 (Opus 4.8) | Stage 2 audit found check-in/history/timeline/baseline/doctor-summary already ~80% built. Added one smallest-safe improvement: **history clarity** — timeline label now shows "Latest 5 of N check-ins" (existing data) + better empty state inviting the first check-in. Bumped SW cache v33→v34. Wrote Stage 2 design + current-state audit to the reports folder. | `app.js`, `index.html`, `sw.js` |
| 2026-06-17 | Chintu validation runner (Opus 4.8) | Added `scripts/chintu-validate.ps1` — local, read-only PASS/WARN/FAIL runner (git/syntax/SW cache/manifest/medical/privacy/handoff). Gitignored `last-validation.txt`. No push/install/network/secret. | `scripts/chintu-validate.ps1`, `.gitignore` |
| 2026-06-17 | Stage 2 "View more history" (Opus 4.8) | Render-only timeline expand: Show more / Show fewer toggle reveals latest 5 → up to 30 stored check-ins; copyable doctor-ready summary stays last-5. Bumped SW cache v34→v35. | `app.js`, `index.html`, `styles.css`, `sw.js` |
| 2026-06-17 | Timeline data clarity (Opus 4.8) | Render-only copy: timeline rows show "Demo data" (vs "Local check-in") when the demo record is active; count label reads "No check-ins yet" at zero. Bumped SW cache v35→v36. | `app.js`, `sw.js` |
| 2026-06-17 | Batch reveal beyond 30 (Opus 4.8) | Render-only: replaced the 5↔30 boolean with a step-based visible count. "Show more check-ins" reveals 5→30→60→90 (stored cap); "Show fewer check-ins" collapses to 5; aria-expanded true only when >5 shown. Copyable doctor-ready summary stays last-5. Bumped SW cache v36→v37. | `app.js`, `sw.js` |
| 2026-06-17 | Delete saved check-in (Opus 4.8) | First history-mutating feature. "Manage history" toggle (hidden for demo, hidden at 0 check-ins) reveals a per-row Remove. Remove is confirm-gated ("Remove your check-in from {date}? This can't be undone."), filters `history` by date, rewrites `bala-local-health-v1`, resyncs the top-level snapshot to the new latest, and re-renders; deleting the last entry returns to the empty "No check-ins yet" state. Copy summary still last-5. Bumped SW cache v37→v38. | `app.js`, `index.html`, `styles.css`, `sw.js` |
| 2026-06-17 | Edit saved check-in (Opus 4.8) | "Manage history" now also shows a per-row Edit. Edit reopens the capture dialog (`editingDate` state) prefilled from that entry with the date locked (read-only "Editing your check-in from {date}" line, title → "Edit check-in"). Submit merges the edited entry by date via saveMetrics; when editing the latest entry the top-level snapshot resyncs too. All-empty edits blocked; demo guarded; date can't change. `resetCaptureMode()` clears edit mode on close/Esc/submit. Copy summary still last-5. Bumped SW cache v38→v39. | `app.js`, `index.html`, `styles.css`, `sw.js` |
| 2026-06-17 | Stage 3 doctor-ready .txt download (Opus 4.8) | Added a "Download .txt" button beside Copy on the Doctor-Ready Timeline. `downloadTimelineSummary()` reuses the existing `downloadText` Blob helper (no PDF/library/network), same valid-check-in guard as copy, saves `bala-doctor-ready-YYYY-MM-DD.txt`. Polished `timelineSummary`: clearer sections, a user-framed "to share with your healthcare professional" block, and a "Sample demo data" header when the record is demo. Last-5 only; no score exposed; copy behavior unchanged. Bumped SW cache v39→v40. | `app.js`, `index.html`, `sw.js` |
| 2026-06-17 | Chintu Release Guard runner (Opus 4.8) | Added `scripts/chintu-release-guard.ps1`: read-only wrapper that runs the validator, reads `last-validation.txt`, gathers git state + recent commits + SW cache, and writes a gitignored `release-guard-report.md` (optional `-OutFile`) with verdict, manual-test checklist, and a push / do-not-push recommendation. No app change, no SW bump. | `scripts/chintu-release-guard.ps1`, `.gitignore` |
| 2026-06-17 | Stage 2 past-date check-in (Opus 4.8) | Capture form gained an optional date field (`#capture-date`, Add mode only; default `localToday()`; future blocked via `max` + JS guard). Submitting a date merges by date via saveMetrics; an existing date prompts confirm-overwrite (Cancel keeps dialog open, saves nothing). Top-level snapshot resyncs only when the chosen date is the newest, so back-filling older days never changes today's dashboard. Edit hides the date field (locked `editingDate`); delete/summary/storage unchanged. Bumped SW cache v40→v41. Completes Stage 2 data-entry trust. Pushed/live (`6e13d0a`). | `app.js`, `index.html`, `styles.css`, `sw.js` |
| 2026-06-17 | Chintu Agent Board v1 (Opus 4.8) | Added `scripts/chintu-agent-board.ps1`: local-only runner that wraps the release guard and writes a gitignored `chintu-agent-board-report.md` (optional `-OutFile`) with 8 "agent" sections (Repo, Validation, Release Guard, BALA Safety, Privacy, PWA, Product, Founder Handoff) + next-3-sprints + Stop/Go. No app change, no SW bump, no network/secret. | `scripts/chintu-agent-board.ps1`, `.gitignore` |
| 2026-06-17 | Chintu Agent Board v2 (Opus 4.8) | Enhanced the board into a daily briefing / next-sprint recommender: Morning Brief, BALA Level (Stage 2 complete, Stage 3 started), Chintu Level, Manual Phone Test Checklist (seeded with SW cache), Next Sprint Recommender (A doctor-ready share polish / B tester onboarding checklist / C daily-briefing polish), a paste-ready next-Claude prompt, Parked Systems, and a Go/Review/Stop decision. Tooling/docs only; no app change, no SW bump, no network/secret. | `scripts/chintu-agent-board.ps1`, `CHINTU_HANDOFF.md` |
| 2026-06-17 | Disable external health-data egress (Codex) | Removed the hidden external-send UI, endpoint storage, payload construction, and runtime send path. Reinforced local-first privacy; Telegram/Discord/webhooks remain parked. Validator now fails on obvious outbound app-data patterns. Bumped SW cache v41 to v42. | `app.js`, `index.html`, `styles.css`, `sw.js`, `scripts/chintu-validate.ps1`, `CHINTU_HANDOFF.md` |
| 2026-06-17 | Latest snapshot consistency (Codex) | Added one synchronization helper so the top-level dashboard snapshot is rebuilt from the newest history entry after add, edit, overwrite, backfill, or delete. Omitted fields are cleared instead of inherited. Added a regression test to the validator and bumped SW cache v42 to v43. | `app.js`, `sw.js`, `scripts/chintu-validate.ps1`, `scripts/chintu-snapshot-consistency.test.js`, `CHINTU_HANDOFF.md` |

---

## 8. How to start a session with me

When you (the assistant) read this file, reply with:
1. A one-paragraph confirmation that you understand the purpose and the safety rules.
2. The one small next step you suggest (cheapest, safest, highest value).
3. Wait for my go-ahead before changing code.

We go as a family. Step by step. Beyond. 🟢
