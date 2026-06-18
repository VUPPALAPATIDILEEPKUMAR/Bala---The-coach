# Chintu Allegro — App Plan

**Stage:** 22
**Status:** active — implemented in CHINTU_ALLEGRO.html
**Product name:** Chintu Allegro
**Meaning:** Fast, live, voice/text operator interface for Chintu OS + BALA

---

## What Is Chintu Allegro?

Chintu Allegro is the app-like local operator shell for Chintu OS.

It feels like:
- A local-first desktop app (installable via browser PWA)
- A founder-controlled command centre
- A voice/text operator interface
- A prompt generator and action planner
- A connector status dashboard
- An agent orchestration starting point

It does NOT:
- Execute shell commands from the browser
- Send external messages without approval
- Expose secrets or tokens
- Replace the terminal (it complements it)
- Fake AI autonomy

---

## Architecture

```
CHINTU_ALLEGRO.html
├── Top bar (logo, badges, install hint)
├── Sidebar
│   ├── Status cards (7 system checks)
│   └── Quick action grid (11 actions)
└── Main area (tabbed)
    ├── Operator tab
    │   ├── Command input (text + voice)
    │   ├── Intent mapper (JavaScript)
    │   ├── Packet generators (11 functions)
    │   └── Response panel (structured output)
    ├── Command Center tab
    │   ├── Connector readiness commands (copy-only)
    │   ├── Agent dry run commands (copy-only)
    │   ├── Prompt engine commands (copy-only)
    │   └── Release guard / validation (copy-only)
    └── Action Packet tab
        ├── Structured packet view
        └── Export as JSON (local download)
```

---

## Status Cards

| Card | Dot Color | What It Shows |
|---|---|---|
| Local Mode | Green | No cloud sync, data stays local |
| Voice Input | Green/Gray | Browser speech recognition availability |
| Connector Mode | Amber | Dry-run only, real send needs env + approval |
| Telegram | Amber | First activation parked, check readiness cmd |
| Prompt Engine | Green | scripts/chintu-prompt-engine.js ready |
| Agent Runner | Blue | Dry-run mode active |
| Approval Gate | Purple | All external sends require phrase approval |

---

## Quick Action Grid (11 Actions)

| Action | Intent Keyword | Packet Type |
|---|---|---|
| Build BALA sprint | bala sprint, next bala | bala-sprint |
| Claude prompt | claude prompt | claude-prompt |
| Codex prompt | codex prompt, codex | codex-prompt |
| Validator dry run | validator, dry run | validator-dry-run |
| Connector check | connector readiness | connector-readiness |
| Telegram setup | telegram, first test | telegram-setup |
| Founder brief | founder brief, daily brief | founder-brief |
| BALA scoring | scoring, score model | bala-scoring |
| Report explainer | report explainer, report mvp | report-explainer |
| Language lock | language lock, language mvp | language-lock |
| App-builder prompt | app-builder, app builder | app-builder |

---

## One-Prompt Operator Workflow

When the founder types/speaks a command:

1. Intent mapper parses keywords
2. Correct packet generator selected
3. Response rendered in Operator tab:
   - What I understood
   - Suggested lane
   - Safety gates
   - Files likely involved
   - Copy-paste prompt for Claude/Codex
   - Validation commands (copy-only)
   - Parked items
   - Next human action
4. Action Packet populated in Packet tab
5. Packet can be exported as JSON

---

## Voice Input Behavior

- Uses Web Speech API (SpeechRecognition)
- Checks browser support on load → updates status card
- Visual pulse indicator while listening
- Auto-submits after recognition
- Read-aloud toggle uses SpeechSynthesis (local OS voices)
- Graceful fallback if not supported: text input still works fully

---

## Install Experience

See CHINTU_ALLEGRO_INSTALL_GUIDE.md for full steps.

Short version:
- Chrome/Edge desktop: address bar install icon → Install app
- iPhone: Safari Share → Add to Home Screen
- Android: Chrome menu → Add to Home screen
- Local server: `python -m http.server 8080` → http://localhost:8080/CHINTU_ALLEGRO.html

The BALA manifest.webmanifest is NOT modified for Stage 22.

---

## Safety Architecture

| Boundary | Implementation |
|---|---|
| No shell execution from browser | Commands are display + copy only |
| No secrets in UI | Status cards show mode only, not values |
| No health data in packets | Packet schema has no health data fields |
| No external send without approval | Telegram packets require approvalPhrase |
| No medical claims | BALA safety rules embedded in all BALA prompts |
| No yolo execution | All agent commands are copy-paste only |

---

## Files Created in Stage 22

| File | Purpose |
|---|---|
| CHINTU_ALLEGRO.html | Main operator shell |
| CHINTU_ALLEGRO_APP_PLAN.md | This file — architecture plan |
| CHINTU_ALLEGRO_INSTALL_GUIDE.md | Install steps for all platforms |
| CHINTU_ALLEGRO_TONE_RULES.md | Founder-tone rules for Allegro |
| CHINTU_ACTION_PACKET_SPEC.md | Action packet schema and rules |
| scripts/chintu-action-packet.js | Packet generator CLI script |
| BALA_SCORE_MODEL_REVIEW_PLAN.md | BALA scoring model review (parked) |
| BALA_REPORT_METRIC_EXPLAINER_PLAN.md | Report explainer MVP plan (parked) |
| CHINTU_TONE_PROFILE.md | Updated to Stage 22 |
| CHINTU_VOICE_OPERATOR.html | Updated with Stage 22 redirect note |

---

## Stage 23 Planning (Not Committed)

Possible next steps:
- Chintu Allegro: persistent command history (session localStorage with no health data)
- Chintu Allegro: dark/light mode toggle
- Chintu Allegro: chintu-manifest.webmanifest for true standalone PWA
- Chintu OS: local bridge script for spawning PowerShell from a Node server (localhost bridge)
- Chintu OS: GitHub CLI connector (second planned connector after Telegram)
- BALA: implement BALA Score Model from BALA_SCORE_MODEL_REVIEW_PLAN.md
- BALA: Report Metric Explainer MVP build (from BALA_REPORT_METRIC_EXPLAINER_PLAN.md)
