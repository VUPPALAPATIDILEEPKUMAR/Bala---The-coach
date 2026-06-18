# Chintu Alive Next Level Plan

The ladder from "Chintu OS is alive on this laptop" to "Chintu OS is
alive across the founder's whole working surface, with BALA still
local-first and non-medical."

Each level is a separate, founder-approvable step. Higher levels are
parked until the lower levels are durable.

---

## Level A — Local runtime heartbeat *(shipped, this cycle)*

What it gives you:

- A one-shot "is Chintu alive?" answer (`scripts/chintu-runtime-health.ps1` → `CHINTU_RUNTIME_HEALTH.md`).
- A timestamped heartbeat file (`scripts/chintu-heartbeat.ps1` → `CHINTU_HEARTBEAT.md`).
- A canonical "no health data sent" footer on the heartbeat.

Risk surface: none. Local files only.

---

## Level B — Restart recovery *(shipped, this cycle)*

What it gives you:

- One command after laptop restart or Claude drop
  (`scripts/chintu-restart-recovery.ps1`) prints the exact resume
  action and writes `CHINTU_RESTART_RECOVERY.md`.

Risk surface: none. Read-only.

---

## Level C — Safe Telegram heartbeat *(parked, planning)*

Spec: [CHINTU_TELEGRAM_STATUS_PLAN.md](CHINTU_TELEGRAM_STATUS_PLAN.md).

What it would add:

- A single message body, sent on founder demand only, containing
  exactly: timestamp, branch, tree state, unpushed count, next
  action.
- Never any BALA data. Never any health metric. Never any medical
  content. Never any secret.

Gate to ship: every condition in `CHINTU_TELEGRAM_STATUS_PLAN.md` §2
and §5 satisfied by the founder. Until then, parked.

---

## Level D — iMac Option 12 install/test *(parked, partially shipped)*

The iMac side has packages in `CHINTU_IMAC_PACKAGES/`. The next safe
step is for the founder to install one package on the iMac and run
the matching validation script. Builder-side work here is
docs-and-package-prep only; the install itself is founder action.

Until the founder has actually exercised the iMac side, this level
is "documented but not validated end-to-end."

---

## Level E — BALA safe voice coach *(parked, founder-only to ship)*

Spec: [BALA_VOICE_COACH_SAFE_SPEC.md](BALA_VOICE_COACH_SAFE_SPEC.md).

What it would add:

- Slice V1 (text-to-speech of existing coach text using Web Speech
  API) shipped behind a feature flag in BALA.
- Local-only. No streaming. No voice cloning.

Gate to ship: the founder writes a BALA-side commit themselves. The
operator layer never touches `coach.js`, `app.js`, `index.html`, or
`styles.css`.

---

## Level F — Chintu Agent desktop shell/UI *(parked, planning)*

Long-term: a desktop UI that surfaces `CHINTU_OPEN_FIRST.md`,
runtime health, heartbeat, and the next action without requiring the
founder to open PowerShell.

Risk surface: medium. A desktop shell is a new install surface, may
need an installer, and would need its own safety tests. Parked until
the founder explicitly asks.

---

## Level G — Local LLM research *(parked, research only)*

Spec: [CHINTU_LOCAL_LLM_RESEARCH_PARKED.md](CHINTU_LOCAL_LLM_RESEARCH_PARKED.md).

Watching browser-native Prompt API, MediaPipe, and similar. No
activation. No vendor pick. Tracked only.

---

## Level H — Phone / voice layer *(parked indefinitely)*

Specs: [CHINTU_PHONE_LAYER_RESEARCH_PARKED.md](CHINTU_PHONE_LAYER_RESEARCH_PARKED.md),
[CHINTU_VOICE_LAYER_RESEARCH_PARKED.md](CHINTU_VOICE_LAYER_RESEARCH_PARKED.md).

Phone is parked indefinitely (network egress, vendor lock-in, PII
magnetism, emergency-monitoring framing risk). Voice-for-operator is
parked because the typed surface is already faster.

---

## Reading order across the ladder

If you want to move up the ladder, read in this order:

1. Confirm Level A and Level B work after a real restart cycle.
2. Decide whether Level C is worth activating; if yes, walk
   `CHINTU_TELEGRAM_STATUS_PLAN.md`.
3. Exercise Level D from the iMac side once.
4. Only then consider Level E — and Level E requires a founder-only
   BALA commit, by name.

Levels F, G, H stay parked unless and until the founder explicitly
opens them.

---

## BALA safety footer

BALA is a health-awareness companion. It does not diagnose, treat,
predict, prevent, replace doctors, or provide emergency monitoring.
