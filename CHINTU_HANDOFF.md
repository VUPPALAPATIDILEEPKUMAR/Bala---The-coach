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
- Keep health data local by default. Never auto-send it anywhere.
- Any export / import / webhook / share must be **user-triggered** and show a clear
  confirmation before anything leaves the device.
- Never hardcode API keys, tokens, secrets, webhook URLs, or private data.
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
| `index.html` | App shell. 4 tabs: **Today, Trends, Coach, Data**. All dialogs (onboarding, symptom, import, devices, install, webhook). |
| `app.js` | ~2,200 lines, all the logic: dashboard, scoring, coach Q&A, Apple Health parser, CSV/JSON import, data export/import, webhook send, voice in/out, multilingual greetings, PWA install. |
| `styles.css` | All styling. Mobile-first. Uses CSS variables. |
| `sw.js` | Service worker. Caches the app shell (`bala-shell-v30`) for offline use. **Bump the version number when assets change.** |
| `manifest.webmanifest` | PWA manifest. Standalone display, app icons, 2 shortcuts (Add metrics, Ask BALA). |
| `server.py` | Tiny local dev server (Python, port 4173). Serves static files only — no API. |
| `vendor/fflate.min.js` | Local ZIP reader (extracts Apple Health `export.xml` in the browser). No CDN. |
| `docs/ARCHITECTURE.md` | Design notes: what's built vs. future native bridges; AI boundary. |
| `docs/BALA_SECURITY_RULES.md` | The full safety/privacy/conduct checklist (source of section 2 above). |
| `native/ios/` | Stub Swift HealthKit bridge for a *future* native iOS companion. Not built/wired yet. |
| `.github/workflows/pages.yml` | Auto-deploys to GitHub Pages on push to `main`. |

**LocalStorage keys:** `bala-local-health-v1` (metrics + 90-day history), `bala-symptoms-v1`,
`bala-profile-v1`, `bala-webhook-v2`, `bala-language`, `bala-tone`, `currentDataSource`.

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
- **Webhook** — optional, user-triggered POST, gated behind a confirm dialog.
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

### 5b. Actual open items (small, optional)

1. **Indian-language greeting mojibake** — Hindi/Tamil/Telugu/Kannada/Malayalam/Marathi/Bengali
   greeting strings in `app.js` are double-encoded and display as garbage. Needs a careful
   byte-level fix (Latin-1 re-encoded bytes → correct UTF-8). Do not attempt casually.
2. **Voice language tag vs selector mismatch** (cosmetic) — hero voice tags show
   En/Hindi/Telugu/Tamil; the coach language selector offers En/Hindi/Telugu/Spanish. Reconcile
   the copy so the two lists agree. Pure copy, no logic.

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

---

## 8. How to start a session with me

When you (the assistant) read this file, reply with:
1. A one-paragraph confirmation that you understand the purpose and the safety rules.
2. The one small next step you suggest (cheapest, safest, highest value).
3. Wait for my go-ahead before changing code.

We go as a family. Step by step. Beyond. 🟢
