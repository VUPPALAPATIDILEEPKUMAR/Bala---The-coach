# Chintu Skills Map — Stage 33

> Created: 2026-06-19
> Purpose: Define what each Chintu skill can and cannot do, what tools it uses,
>          and what it is permanently blocked from doing.

---

## Skill 1: Chintu Core Skill

**Capabilities:** `chintu.status`, `chintu.repoSummary`, `chintu.checkEverything`

**Can do:**
- Report bridge health (127.0.0.1:18791)
- Run git status, git log (read-only)
- Run the check_everything sequence (validate_app, connector_readiness, release_guard)
- Summarize what stage Chintu is at and what's next

**Cannot do:**
- Push to git
- Delete files
- Write to any file outside CHINTU_OUTBOX
- Send any external messages
- Run any action not in the bridge action map

**Allowed tools:**
- Local Node scripts
- Git CLI (read-only: `git status`, `git log`, `git diff --stat`)
- Local bridge at 127.0.0.1:18791

**Blocked actions:**
- `git push`
- `git add -A`
- Any write to repo files except audit log
- External HTTP beyond localhost

**Tests:** `scripts/chintu-brain-router.test.js`, `scripts/chintu-local-bridge.test.js`

---

## Skill 2: Telegram Connector Skill

**Capabilities:** `telegram.discoverIds`, `telegram.tokenCheck`, `telegram.deleteWebhook` (dry-run default)

**Can do:**
- Call getMe and getWebhookInfo to verify token and bot identity
- Call getUpdates (once, no offset set) to discover chat/sender IDs
- Show webhook status
- Delete webhook in dry-run (report only)

**Cannot do:**
- Send Telegram messages unless `CHINTU_TELEGRAM_SEND_ENABLED=1` and explicitly requested
- Set a webhook
- Poll continuously (poll-once only)
- Print or log `TELEGRAM_BOT_TOKEN`
- Execute local actions from discovery mode

**Allowed tools:**
- Telegram Bot API: `getMe`, `getWebhookInfo`, `getUpdates` (once), `deleteWebhook`
- `scripts/chintu-telegram-runner.js`

**Blocked actions:**
- `setWebhook`
- Infinite polling
- `--send` without `CHINTU_TELEGRAM_SEND_ENABLED=1`
- Logging or printing the token

**Tests:** `scripts/chintu-telegram-runner.test.js`, `scripts/chintu-telegram-adapter.test.js`

---

## Skill 3: GitHub Dry-Run Skill

**Capabilities:** `chintu.githubStatusDryRun`

**Can do:**
- Read repo status via `gh` CLI
- Show recent commits, open PRs (read-only)
- Check CI status (read-only)

**Cannot do:**
- Push commits
- Merge PRs
- Create releases
- Modify any file

**Allowed tools:**
- `gh repo view`
- `gh pr list --state open`
- `gh run list` (CI status read)

**Blocked actions:**
- `gh pr merge`
- `gh release create`
- Any `git push`

**Tests:** `scripts/chintu-github-connector.test.js`

---

## Skill 4: BALA Health-Awareness Skill

**Capabilities:** `bala.localHealthSummaryReadOnly`, `bala.doctorSummaryPreview`

**Can do:**
- Read BALA local repo state (test results, app.js syntax, sw.js syntax)
- Run BALA test suite locally
- Summarize BALA app status for the founder
- Generate a doctor-ready summary preview from **demo/fixture data only**
- Scan BALA copy for unsafe medical claim language
- Detect patterns like "diagnose", "treat", "prevent", "predict", "monitor your heart"
- Prepare BALA release notes
- Suggest safe UX copy improvements

**Cannot do:**
- Diagnose any user
- Interpret live user health data as medical advice
- Send health data externally
- Perform emergency health monitoring
- Make prediction or prevention claims about user health
- Send automatic messages to doctors
- Upload or store user health data anywhere

**Safe language Chintu must use for BALA:**
- guide, signals, awareness, recovery, balance, check-in, care,
  listen to your body, daily health companion

**Blocked language Chintu must never generate for BALA:**
- diagnose, treat, cure, prevent, predict, emergency monitor,
  replace your doctor, guarantee outcomes

**Tests:** `scripts/chintu-bala-safe-docs.test.js`, `scripts/chintu-medical-claims.test.js`

---

## Skill 5: Release Guard Skill

**Capabilities:** `chintu.checkEverything` (via release_guard action)

**Can do:**
- Run `powershell -ExecutionPolicy Bypass -File scripts\chintu-release-guard.ps1`
- Run syntax checks on all key JS files
- Run all safety/integrity test suite
- Report what would be committed vs what is blocked

**Cannot do:**
- Commit anything
- Push anything
- Stage files with `git add -A`
- Override a failed gate

**Allowed tools:**
- PowerShell scripts (local only)
- Node syntax check
- Git diff (read-only)

**Blocked actions:**
- `git commit` (humans only, via release script)
- `git push` (humans only, via release script)
- `git add -A`

**Tests:** `scripts/chintu-safety-boundary.test.js`

---

## Skill 6: Safety Reviewer Skill

**Capabilities:** built on top of medical claims scan + no-network egress test

**Can do:**
- Scan all JS/MD/HTML files for unsafe medical claim patterns
- Scan all scripts for forbidden network egress patterns
- Report violations with file + line
- Summarize safety boundary status

**Cannot do:**
- Auto-fix violations (report only)
- Whitelist patterns permanently without founder review
- Generate any content that violates its own scan rules

**Allowed tools:**
- `scripts/chintu-medical-claims.test.js`
- `scripts/chintu-no-network-egress.test.js`
- `scripts/chintu-safety-boundary.test.js`

**Tests:** `scripts/chintu-medical-claims.test.js`, `scripts/chintu-no-network-egress.test.js`

---

## Allowed Free Tools (Stage 33 Inventory)

| Tool | Use | Status |
|------|-----|--------|
| Telegram Bot API (poll-once) | getUpdates, getMe, getWebhookInfo | ✅ Allowed |
| GitHub CLI (`gh`) | read-only repo checks | ✅ Allowed |
| local Node.js scripts | all runtime logic | ✅ Allowed |
| local PowerShell scripts | release guards, Windows task runner | ✅ Allowed |
| local JSONL audit logs | CHINTU_OUTBOX (gitignored) | ✅ Allowed |
| browser SpeechRecognition/Synthesis | BALA voice UX (frontend only) | ✅ Allowed |
| Windows Task Scheduler | optional local scheduled checks | ✅ Allowed (doc only) |
| Git hooks | local validation only (pre-commit) | ✅ Allowed |
| self-hosted n8n Community | optional future automation | 📝 Doc only, not set up |

**NOT allowed without founder approval:**

| Tool | Reason |
|------|--------|
| Paid APIs | Privacy + cost |
| Hosted automation (Zapier, Make) | Secrets exposure risk |
| Cloud health data storage | User privacy |
| External health APIs | Medical safety |
| Background daemon polling | Silent network risk |
| Webhook activation | Exposes bridge publicly |

---

## BALA ↔ Chintu Boundary Summary

```
ALLOWED (Chintu → BALA)          BLOCKED (Chintu for BALA)
─────────────────────────────     ──────────────────────────
read local repo status            diagnose users
run BALA tests                    interpret live health data
summarize app state               send health data externally
generate demo summary preview     emergency monitoring
scan copy for unsafe language     prediction/prevention claims
prepare release notes             auto-message doctors
suggest safe UX copy              upload private health data
```
