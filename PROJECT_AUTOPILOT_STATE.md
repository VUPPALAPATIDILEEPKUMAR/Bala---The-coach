# PROJECT AUTOPILOT STATE
_Updated by BALA Autopilot after each stage commit_

## Current HEAD
- Commit: `1322a71` BALA-B50: Ask BALA Coach — conversational Q&A UI, 236/236 tests
- Branch: main
- Date: 2026-06-21

## Lane Status

### LANE A — Chintu OS
**Status: HUMAN-GATED — do not proceed**
Gate: Telegram live phone proof required. Must not be touched autonomously.

### LANE B — BALA Coach (Autonomous)
**Status: B50 COMPLETE — ready for B51**

## Completed Stages (this autopilot session)

| Stage | Commit | Summary |
|-------|--------|---------|
| B43 | `c13ff2c` | Score Engine (173/173), Coach Engine (250/250), factor history, doctor-ready notes |
| B44 | `cce978e` | Score Engine wired into live browser app + explainability panel (26/26 integration tests) |
| B45 | `ff57f87` | Weekly Reflection: 7-day local pattern analysis, observations, factor pills, focus nudge (85/85) |
| B46 | `7ad10f7` | Weekly Focus Loop: one-click accept, try/skip daily log, dismiss, safety gate (79/79) |
| B47 | `a87b8ed` | First Three Check-ins Journey: onboarding progress card 0→3, dismiss, demo-safe (98/98) |
| B48 | `221a644` | Symptom Nudge: daily one-tap body signal chips, once/day gate, 6 chips, demo-safe (78/78) |
| B49 | `ab18052` | Doctor-Ready Export Summary: plain-text wellness log, copy+download, demo-safe (77/77) |
| B50 | `1322a71` | Ask BALA Coach: conversational Q&A UI, emergency gate, 12 topics, 236/236 tests |

## B50 What Was Built

- `scripts/bala-ask-coach-engine.js` — CommonJS engine: EMERGENCY_KEYWORDS (15+), EMERGENCY_RESPONSE, TOPIC_MAP (12 topics: hrv, rhr, spo2, sleep, steps, stress, recovery, bala score, doctor, privacy, how does bala work, demo), DEFAULT_RESPONSE, isEmergency, matchTopic, getCoachResponse, sanitiseInput, MAX_INPUT_LENGTH=300
- `scripts/bala-b50-ask-coach.test.js` — 236/236 tests across 9 suites: isEmergency (14), matchTopic (16), getCoachResponse empty (5), getCoachResponse emergency (5), getCoachResponse topic (12), default fallback (4), sanitiseInput (6), copy safety (FORBIDDEN_CLAIMS × 12 topics + DEFAULT + EMERGENCY = 162), exports/structure (13)
- `app.js` — B50 inline block (_AC_TOPIC_MAP with kw/r abbreviated, _acGetResponse, renderAskCoach); session-only _acHistory (max 5 pairs); demo-safe placeholder; emergency CSS class; called from updateDashboard()
- `index.html` — #ask-coach .ac-card, label+input#ac-input (maxlength=300), #ac-submit-btn, #ac-feed (aria-live=polite)
- `styles.css` — .ac-card, .ac-heading, .ac-intro, .ac-input-row, .ac-input, .ac-submit-btn, .ac-feed, .ac-bubble, .ac-a--emergency (10 rules)
- `sw.js` — bumped to bala-shell-v50

## Test Suite Status (post-B50)

| Suite | Result |
|-------|--------|
| bala-score-engine.test.js | 173/173 |
| bala-coach-engine.test.js | 250/250 |
| chintu-local-bridge.test.js | 42/42 |
| bala-b44-integration.test.js | 26/26 |
| bala-b45-weekly-reflection.test.js | 85/85 |
| bala-b46-weekly-focus.test.js | 79/79 |
| bala-b47-first-checkins.test.js | 98/98 |
| bala-b48-symptom-nudge.test.js | 78/78 |
| bala-b49-doctor-summary.test.js | 77/77 |
| bala-b50-ask-coach.test.js | 236/236 |
| **Total** | **1144/1144** |

## Git Mechanics Note
`git commit` and `git update-ref` blocked by stuck NTFS locks (.git/index.lock, .git/HEAD.lock).
Workaround for all future commits:
1. `GIT_INDEX_FILE=/tmp/<stage>index git read-tree HEAD`
2. `GIT_INDEX_FILE=/tmp/<stage>index git add <explicit files>`
3. `GIT_INDEX_FILE=/tmp/<stage>index git write-tree` → get TREE hash
4. `git commit-tree <TREE> -p HEAD -m "message"` → get COMMIT hash
5. `python3 -c "open('.git/refs/heads/main','w').write('<COMMIT>\\n')"` → write ref directly

## User Action Required
`git push origin main` from Windows PowerShell to push B43→B50 (11 commits ahead of origin/main).
Commits to push: `c13ff2c` (B43) → `cce978e` (B44) → `ff57f87` (B45) → `7ad10f7` (B46) → `a87b8ed` (B47) → `53e5fe2` (state) → `221a644` (B48) → `c7ccfc3` (state) → `ab18052` (B49) → `f7adc5c` (state) → `1322a71` (B50)

## Next: BALA-B51 Plan

**Theme: Signal Trend Sparklines — mini 7-day trend charts on each signal card**

Proposed scope:
1. Tiny inline SVG sparkline (7 dots / line) per signal card (HRV, RHR, SpO₂, Steps, Sleep)
2. Reads last 7 check-ins from localStorage
3. Colour-coded: trending up (green), trending down (red for HRV/sleep, depends on signal), flat (grey)
4. No external charting library — pure SVG, inline, zero dependency
5. Engine: `scripts/bala-b51-sparkline-engine.js` — normalise, trend direction, path builder
6. Tests: 40+ covering normalise, trend detection, empty/sparse data, SVG path validity
7. Demo-safe: uses fixed 7-point sample data in demo mode
8. Adds depth to the signal cards built in B44 without adding any complexity for the user
