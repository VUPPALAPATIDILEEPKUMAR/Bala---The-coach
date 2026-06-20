# BALA + Chintu OS — Stage 43 Vision Validation

**Date:** 2026-06-20
**Framework:** COSTAR (Context · Objective · Style · Tone · Audience · Response)
**Method:** Direct code inspection — grep, Read, bash, test runs.
Not memory. Not assumption. Every claim below is backed by file evidence.

---

## COSTAR Frame

| Axis | Value |
|---|---|
| **Context** | BALA PWA + Chintu OS, Stage 42 complete. 173+250+brain router tests green. |
| **Objective** | Map real gaps between vision docs and production code. Build what's missing. |
| **Style** | Senior product engineer — systematic, evidenced, no cargo-cult claims |
| **Tone** | Direct, founder-empowering, zero fluff |
| **Audience** | Dileep (founder/operator), future Claude/Codex sessions |
| **Response** | Gap table → confirmed builds → next sprint plan |

---

## What Is Actually Confirmed Built (production code evidence)

### BALA Track

| Feature | Evidence | Status |
|---|---|---|
| BALA Score Engine | `bala-score-engine.js` 173/173 tests | ✅ Live |
| BALA Coach Engine | `bala-coach-engine.js` 250/250 tests | ✅ Live |
| Daily Factors Journal | `BEHAVIOR_KEY` localStorage, 9 factors, Stage 17 | ✅ Live |
| Weekly Reflection | `app.js` lines 490–582, DOM + CSS, called at line 1818 + 1897 | ✅ Live |
| Today's Guide factor awareness | `app.js` line 1787–1794 injects recentBehavior into guide | ✅ Live |
| Coach grounding with factors | `app.js` line 1787–1810, factor text in coachResponse() | ✅ Live |
| Behavior history in export | `getBehaviorHistory()` called at line 768 in exportBalaData() | ✅ Live |
| Apple Health ZIP import | In-browser, no CDN, no network egress | ✅ Live |
| Voice coach | Web Speech API, 10 languages, capability guard | ✅ Live |
| Medical safety test | `chintu-medical-claims.test.js`, `chintu-bala-safe-docs.test.js` | ✅ Live |
| No-network-egress test | `chintu-no-network-egress.test.js` — confirms BALA sends nothing | ✅ Live |
| BALA Score in ALLEGRO | Inline IIFE in CHINTU_ALLEGRO.html, demo mode | ✅ Live |

### Chintu OS Track

| Feature | Evidence | Status |
|---|---|---|
| Brain Router | `chintu-brain-router.js` — deterministic, 16-intent map | ✅ Live |
| Local Bridge | `chintu-local-bridge.js` — 127.0.0.1, /api/chat, /api/sequence | ✅ Live |
| Telegram Runner | `chintu-telegram-runner.js` — inbound-only, Stage 42 proof path | ✅ Live |
| Action Trace Contract | `CHINTU_ACTION_TRACE_CONTRACT.md` Stage 33 | ✅ Designed |
| Approval Queue | `CHINTU_APPROVAL_QUEUE_DESIGN.md` Stage 33 | ✅ Designed |
| Connector Send | `chintu-connector-send.js` — 7 gates, dry-run default | ✅ Live |
| CHINTU_ALLEGRO UI | Full operator UI — Stage 42 proof panel, BALA Score live view | ✅ Live |
| Master Prompt Library | `CHINTU_MASTER_PROMPT_LIBRARY.md` — POSTER+XML+COSTAR+ACR | ✅ Live |
| Agent orchestrator | `chintu-agent-orchestrator.js` + capability registry | ✅ Live |

---

## Real Gaps (Stage 43 Targets)

### Gap 1 — Factor History Beside Timeline
**Vision:** When the user views check-in history, factor journal entries for
the same date appear as a "Daily notes" row below that check-in.

**Code before Stage 43:** `renderBaselineAndTimeline()` renders health entries
only. No code joins behavior journal dates to timeline dates.

**Code after Stage 43:** `getBehaviorHistory()` filtered by `entry.date` is
called inside the timeline forEach. Factor pills + note rendered per date.
CSS: `.fh-row`, `.fh-pill`, `.fh-label`, `.fh-note` in styles.css.

**Safety check:** "Daily notes" label — no causal claims, no scoring of factors.

---

### Gap 2 — Doctor-ready factor section framing
**Vision:** Header = "DAILY NOTES (self-entered)", preamble = "These are notes
I entered myself. They are personal reflections, not medical observations.",
show up to 30 entries (not just last 5).

**Code before Stage 43:** Both `buildDoctorReadySummary()` and
`timelineSummary()` said "RECENT DAILY FACTORS" with no self-entered preamble.
`buildDoctorReadySummary()` showed last 5. `timelineSummary()` showed only the
single most recent entry.

**Code after Stage 43:** Both functions updated. Header and preamble match the
vision spec exactly. `buildDoctorReadySummary()` shows up to 30 entries.
`timelineSummary()` shows up to 15 entries.

---

### Gap 3 — sw.js cache version
**Before:** `bala-shell-v44`
**After:** `bala-shell-v45` — required for browsers to pick up new app.js +
styles.css changes.

---

## Architectural Observation (parked — no build required today)

**bala-score-engine.js vs app.js scoreBreakdown():**
The 173-test score engine and the production `scoreBreakdown()` in app.js are
parallel implementations. `bala-score-engine.js` is used in ALLEGRO (demo mode)
and tests only. The production BALA app uses `scoreBreakdown()`.

This is not a bug — both are medically safe and produce awareness-only output.
They will naturally converge when a dedicated score engine wiring sprint is
approved. Until then: two separate, tested implementations is acceptable.

Do NOT merge them without a dedicated sprint and founder approval.

---

## Parked Correctly (not missing — intentionally deferred)

| Item | Why Parked |
|---|---|
| Safe Telegram heartbeat (Level C) | Requires `CHINTU_TELEGRAM_SEND_ENABLED=1` — blocked until founder approves |
| On-device AI coach | Requires browser Prompt API in stable channel — not there yet |
| Voice coach (Level E) | Founder must write the BALA-side commit themselves |
| iMac Option 12 | Founder must install on iMac — builder-side work done |
| Doctor-ready Summary (full) | Parked — founder approval required before implementing |
| Approval Queue bridge wiring | Design done, implementation deferred |
| Connector CLI `--discover`/`--status` | Phase 1 planned, not yet built |

---

## Stage 43 Build Summary

Three changes shipped:

1. **Factor History Beside Timeline** — `app.js` renderBaselineAndTimeline(),
   `styles.css` (4 new CSS rules). Zero network. Zero medical claims.
   Reads existing localStorage behavior journal data.

2. **Doctor-ready factor framing** — both `buildDoctorReadySummary()` and
   `timelineSummary()` in `app.js`. "Self-entered" preamble added. History
   depth increased to 30 and 15 entries respectively.

3. **sw.js v44 → v45** — cache version bump for new UI changes.

All 173+250 engine tests still passing. Medical safety scan clean.

---

## Next Sprint Candidates (Stage 44)

By priority (impact/risk ratio):

1. **Connector CLI `--discover` + `--status` flags** — read-only, zero risk,
   makes Chintu's connector power visible to the founder from the terminal

2. **BALA Score engine production wiring** — wire `bala-score-engine.js` into
   `app.js` to replace or supplement `scoreBreakdown()`. Needs dedicated sprint.

3. **Safe Telegram heartbeat (Level C)** — send one status message on founder
   demand. Requires founder approval for `CHINTU_TELEGRAM_SEND_ENABLED=1`.

4. **Approval Queue bridge wiring** — `pending_approvals.jsonl` writes for
   code_change/external_send intents.

---

## Safety Footer (non-negotiable)

BALA is a health-awareness companion. It does not diagnose, treat, predict,
prevent, replace doctors, or provide emergency monitoring.

Founder story (safe version only): "I built BALA in memory of my father,
Balaji. His name inspired this app. BALA is my attempt to help people listen
to their body signals earlier and take small steps toward better health
awareness." — No cause-of-death language. No medical detail.

Chintu OS safety: `CHINTU_TELEGRAM_SEND_ENABLED=0` always. Dry-run default.
No secrets committed. No health data in connectors. Preview-before-send always.
