# Chintu OS — Live Runtime State
_Last updated: 2026-06-23 — Sprint C46_

---

## Identity

- **System:** Chintu Agent OS — local-first personal agent operator
- **Principle:** No yolo mode. No hidden network calls. No secrets in reports. Dry-run before live. Approval required for any external write.
- **Primary UI:** `CHINTU_ALLEGRO.html` (opens in browser, port-free, file:// safe)
- **Local bridge:** `scripts/chintu-local-bridge.js` — Node.js HTTP on `127.0.0.1:18791`

---

## Shipped Stages

| Stage | Feature | Commit | Status |
|-------|---------|--------|--------|
| C42 | CHINTU_ALLEGRO.html shell | `f987892` | ✅ Shipped |
| C42.2 | Allegro upgrade (full operator shell) | `aa6a527` | ✅ Shipped |
| C43 | ntfy / WhatsApp / Telegram / Discord connector guides | `9b517c7` | ✅ Shipped, unpushed |
| C44 | BALA morning digest script (`chintu-bala-morning-digest.js`) | `52067f1` | ✅ Shipped, unpushed |
| **C45** | **Alert ladder: Level 1 (Alert Status panel) + Level 2 (browser notification)** | this sprint | ✅ Shipped |
| **C46** | **Skill contracts: 11 named skills with input/output contracts + UI table** | this sprint | ✅ Shipped |

---

## Core Scripts

| File | Purpose | Check |
|------|---------|-------|
| `scripts/chintu-local-bridge.js` | HTTP server, port 18791, intent routing | `node --check` ✅ |
| `scripts/chintu-brain-router.js` | Pure deterministic intent router | `node --check` ✅ |
| `scripts/chintu-capability-registry.js` | 17 capabilities, risk levels | `node --check` ✅ |
| `scripts/chintu-skill-contracts.js` | 11 named skill contracts, validated at require() | `node --check` ✅ |
| `scripts/chintu-bala-morning-digest.js` | Morning digest → ntfy.sh (dry-run default) | `node --check` ✅ |
| `scripts/chintu-connector-send.js` | Connector sender, approval-gated | `node --check` ✅ |
| `scripts/chintu-telegram-runner.js` | Telegram runner, explicit env gates | `node --check` ✅ |

---

## Skill Contracts (C46)

11 named skills declared in `scripts/chintu-skill-contracts.js`. Validated at `require()` time.

| Skill ID | Safety Class | Route Type |
|----------|-------------|------------|
| hi_check_in | safe_read | brain_chat |
| check_everything | safe_read | brain_chat (→sequence) |
| git_status | safe_read | brain_chat |
| validate_app | safe_read | brain_chat |
| connector_readiness | safe_read | brain_chat |
| release_guard | safe_read | brain_chat |
| morning_digest | safe_read | brain_chat |
| build_bala_sprint | safe_read | brain_chat |
| show_capabilities | safe_read | brain_chat |
| chest_pain_emergency | emergency_gate | emergency_gate |
| delete_all_blocked | blocked | auto_block |

**Safety invariants (enforced at require() time):**
- `blocked` → routeType must be `auto_block`
- `emergency_gate` → routeType must be `emergency_gate`
- Unique IDs, at least one trigger per skill, all required fields present

---

## Alert Ladder (C45)

| Level | Mechanism | Status |
|-------|-----------|--------|
| 1 | Alert Status panel in CHINTU_ALLEGRO.html (OFF / READY / ENABLED) | ✅ Active |
| 2 | Browser Notification API (no health values in payload) | ✅ Active |
| 3 | ntfy.sh push notification | C47 — Next |

**Safety:** Level 2 notifications contain NO health data values. Status label only.

---

## Test Suite (All Must Pass Before Commit)

| Test | Command | Status |
|------|---------|--------|
| Medical claims scan | `node scripts/chintu-medical-claims.test.js` | ✅ PASS |
| No-network-egress | `node scripts/chintu-no-network-egress.test.js` | ✅ PASS |
| app.js syntax | `node --check app.js` | ✅ PASS |
| sw.js syntax | `node --check sw.js` | ✅ PASS |
| Skill contracts | `node -e "require('./scripts/chintu-skill-contracts.js')"` | ✅ PASS |

---

## Security Invariants (Always Active)

Chintu must never:
- Print, store, or commit secrets, tokens, Telegram IDs, ntfy topics, or personal data in reports
- Enable Telegram sending autonomously
- Create or delete Telegram webhooks without explicit founder action
- Run infinite polling
- Silently perform external writes
- Upload BALA health data externally
- Delete unknown files
- Use `git reset --hard`, `git clean`, rebase, force-push, or `git add -A`
- Claim an action ran when it did not

Files never committed: health exports, root-level `bala-export.json`, audit JSONL, logs, queues, screenshots, tokens, personal records.

---

## Unpushed Commits (Push When Ready)

```
52067f1  B62+C44: JSON export + BALA morning digest script
954bc31  B61: Garmin Connect CSV + Samsung Health ZIP free importers
d33fd00  B60: Score completeness feedback (source-specific gap cards after import)
9b517c7  C43: ntfy.sh + WhatsApp + Telegram + Discord connector guides (ALLEGRO)
```

**Command:** run `push-b60-b61-b62-c44.ps1` (exists in repo root)

---

## Next Stage

| Stage | Feature |
|-------|---------|
| C47 | ntfy.sh live push (Level 3 alert, opt-in, dry-run default) |
