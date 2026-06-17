# Chintu Multi-Brain Review Protocol V1

## 1. Purpose

Future BALA and Chintu work uses a deliberate multi-brain workflow: Claude builds, Codex independently reviews and applies only focused patches, Chintu validates and judges release readiness, ChatGPT shapes strategy and prompts, OpenClaw provides the local runtime and tool layer, and the human founder remains the final gate.

## 2. Roles

- **ChatGPT Strategy Brain:** Defines product direction, decomposes work, and writes focused prompts with explicit safety boundaries.
- **Claude Builder Brain:** Implements the primary sprint and prepares clear reports and handoffs.
- **Codex Reviewer Brain:** Audits independently, hunts regressions, adds tests, and makes small approved patches without taking over the builder role.
- **Chintu Local Judge:** Runs repeatable local validation, privacy and safety checks, release guard, and agent-board recommendations.
- **OpenClaw Tool Runtime:** Supplies approved local runtime and tool capabilities without independently enabling plugins or sending data away.
- **Human Founder Gate:** Chooses priorities, approves risk, authorizes pushes, and makes the final release decision.

## 3. Standard Sprint Flow

1. ChatGPT creates the strategy and focused prompt.
2. Claude implements the focused sprint.
3. Chintu runs validation and the release guard.
4. Codex performs a read-only independent audit.
5. Codex patches only small, focused issues when needed and authorized.
6. Chintu validates again.
7. The human founder approves the push.
8. A handoff report records the outcome and next safe step.

## 4. Risk Levels

- **Green — docs/scripts only:** Claude or Codex may implement within the approved scope.
- **Yellow — UI, copy, or local app behavior:** Claude is primary; Codex audits independently.
- **Orange — data model, history, or privacy logic:** Requires Claude implementation or review plus a Codex cross-check before release.
- **Red — external APIs, messaging, authentication, secrets, or medical claims:** Remains parked unless the human founder explicitly approves a tightly scoped plan.

Risk level does not override validation, review, privacy, or human approval requirements.

## 5. Push Rules

Do not push when:

- validation fails;
- the release guard fails;
- unexpected dirty files exist;
- changed app behavior has not been reviewed;
- secrets, network access, or health-data egress risk appears; or
- more than one unintended commit is pending.

Push only after the tree is clean, exactly one intended commit is pending, validation passes, the release guard passes, and the human founder explicitly approves the push.

## 6. Required Checks

Run for every sprint:

```powershell
node --check app.js
node --check sw.js
node scripts/chintu-snapshot-consistency.test.js
powershell -ExecutionPolicy Bypass -File scripts/chintu-validate.ps1
powershell -ExecutionPolicy Bypass -File scripts/chintu-release-guard.ps1
powershell -ExecutionPolicy Bypass -File scripts/chintu-agent-board.ps1
```

For OpenClaw-related work, also run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/chintu-openclaw-readiness.ps1
```

## 7. Medical Safety Rules

- No prediction claims.
- No prevention claims.
- No diagnosis.
- No treatment.
- No emergency monitoring.
- No claim that BALA replaces a doctor or healthcare professional.
- Prefer calm terms such as awareness, body signals, recovery, balance, check-in, and guide.

## 8. Privacy Rules

- Keep BALA local-first by default.
- No health-data POST or webhook path.
- No hidden network calls.
- Do not read secrets.
- Never place health data in Telegram or Discord.
- Sharing and export must be explicit, visible, and user-controlled.

## 9. Codex Usage Rules

Use Codex for:

- independent audits;
- regression tests;
- small focused patches;
- validator hardening; and
- documentation and process improvements.

Do not use Codex for:

- large unsupervised rewrites;
- medical claims;
- external integrations;
- secret or authentication work; or
- multi-file app changes without Claude review.

## 10. Claude Usage Rules

Use Claude for larger implementation sprints, UI/UX and product improvements, app architecture changes, local-first behavior, and reports and handoffs. Claude remains responsible for keeping each builder sprint focused, reviewable, and compatible with BALA safety and privacy rules.

## 11. Chintu Agent Board Role

Chintu is the repeatable local judge for repository state, validation, privacy, safety, release guard status, and next-sprint recommendations. Its output supports human judgment; it does not push, release, or expand scope by itself.

## 12. Next Recommended Sprint

**CHINTU MEMORY-WIKI SEED VAULT V1** is the next recommended sprint, but only after this protocol is committed and the repository remains green. It must remain local-first, avoid health data and secrets, and require explicit approval before any plugin enablement.
