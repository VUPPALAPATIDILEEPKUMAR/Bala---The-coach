# Chintu Real Connector + MCP Scan

Chintu is **not** "no connectors." Chintu is **real free connectors with safe
activation**. This scan lists what is active now, what is real but gated, and
what stays parked - with the activation requirements, risks, and the safe next
step for each.

Last updated: Stage 24 (brain runtime live).

---

## 1. Local Bridge + Brain Runtime - ACTIVE NOW

- **Free / practical:** Yes. Node built-ins only, no install, no paid API.
- **Chintu status:** Live. The Allegro UI now talks to the deterministic brain at
  `/api/chat`, named safe sequences at `/api/sequence`, and allowlisted local
  actions through the same loopback bridge on `127.0.0.1:18791`.
- **Activation requirements:** Run `scripts\chintu-allegro-start.ps1`.
- **Safety risks:** Low. Loopback only; cross-site origins rejected; fixed argv,
  no shell; secrets redacted; audit log written; no push from UI.
- **Safe next step:** Use it. Add more read-only actions over time as needed.

## 2. Telegram Bot API - REAL, ENV-GATED

- **Free / practical:** Yes (Telegram Bot API is free).
- **Chintu status:** Adapter exists (`scripts/chintu-connector-send.js`), default
  mode is `dry-run`. No real send has occurred.
- **Activation requirements:** Founder sets `CHINTU_TG_BOT_TOKEN`,
  `CHINTU_TG_CHAT_ID`, `CHINTU_TG_TARGET`, `CHINTU_TG_ALLOWLIST`, the approval
  phrase env, plus a preview and explicit confirm.
- **Safety risks:** Medium - outbound message to a chat. Mitigated by allowlist,
  approval phrase, preview, and audit. No health values are sent.
- **Safe next step:** Keep parked from the bridge. Activate only via the documented
  Telegram runbook with a non-health test message.

## 3. GitHub CLI - REAL, REPO-SCOPED

- **Free / practical:** Yes (`gh` is free).
- **Chintu status:** Planned path. The bridge does **not** push. Push happens only
  through the guarded release flow after the release guard passes.
- **Activation requirements:** `gh auth login` or a repo-scoped `GH_TOKEN` /
  `GITHUB_TOKEN`. Never committed, never printed.
- **Safety risks:** Medium - can write to the remote. Mitigated by the release gate
  and explicit file staging (no `git add -A`).
- **Safe next step:** Use the guarded release flow for pushes. Optionally add a
  read-only `gh` availability check as a future bridge action.

## 4. Filesystem MCP - POSSIBLE, HIGH-RISK

- **Free / practical:** Yes, but broad.
- **Chintu status:** Not installed. Not activated.
- **Activation requirements:** A sandboxed, path-scoped server limited to this repo.
- **Safety risks:** High - broad read/write/delete if unscoped.
- **Safe next step:** Do not add a broad filesystem MCP. The local bridge already
  covers the safe local actions Chintu needs.

## 5. GitHub MCP - POSSIBLE, HIGH-RISK

- **Free / practical:** Yes.
- **Chintu status:** Not installed.
- **Activation requirements:** Repo-scoped token, approval-gated writes.
- **Safety risks:** High if it can act on many repos or push without a gate.
- **Safe next step:** Prefer the gated release script over an MCP for now. Revisit
  only with a single-repo scope and an approval step.

## 6. Browser automation (Playwright) - PARKED

- **Free / practical:** Yes (open source).
- **Chintu status:** Not installed.
- **Activation requirements:** Explicit allowlist of target URLs/actions.
- **Safety risks:** Medium-high - can drive arbitrary sites.
- **Safe next step:** Park until there is a concrete, allowlisted use case.

## 7. Gmail / Google Drive - PARKED

- **Free / practical:** Free tier exists, but OAuth is involved.
- **Chintu status:** Not connected.
- **Activation requirements:** Correct OAuth client, token storage, scope limits.
- **Safety risks:** Medium-high - account access; health data must never be synced.
- **Safe next step:** Park until OAuth is handled correctly and scoped narrowly.

## 8. Phone / watch notifications - FUTURE PARKED

- **Free / practical:** Varies by platform.
- **Chintu status:** Research only.
- **Activation requirements:** Platform-specific; out of scope now.
- **Safety risks:** Medium - device-level reach.
- **Safe next step:** Keep as future research; no action this stage.

---

## Global guarantees

- No secrets are committed or printed. Token/paired files are never read by the UI
  or bridge.
- No real Telegram send during tests. External sends stay in `dry-run` by default.
- No health data leaves the machine by default.
- No MCP servers were activated in this stage.
