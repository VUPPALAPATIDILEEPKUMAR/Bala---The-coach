# Chintu Push Review Checklist

**Audience:** founder, about to consider `git push`.
**Mode:** human-only. Do not let any agent run through this list and
auto-push.

Push is the one action a Claude/Codex builder session is not allowed
to take. This checklist is the founder's go/no-go before running
`git push` by hand.

---

## 1. Green-gate (must all be true)

- [ ] `git status --short` shows only generated artifacts or
      intended diffs.
- [ ] `powershell -ExecutionPolicy Bypass -File scripts\chintu-master-launcher.ps1`
      ran from a clean prompt and exited 0.
- [ ] The release-guard report's final verdict is PASS.
- [ ] None of the protected BALA files were edited unintentionally
      (`git diff origin/main -- app.js index.html styles.css sw.js coach.js manifest.webmanifest privacy.html functions/api/coach.js`).
- [ ] The service worker `CACHE_NAME` was not bumped (unless this
      push is *specifically* a BALA bump the founder planned).
- [ ] No secrets or `.env` references in the diff
      (`git diff origin/main | findstr /I "secret token api_key password .env"`).
- [ ] No `fetch(`, `XMLHttpRequest`, `sendBeacon`, webhook URL, or
      Telegram/Discord/Twilio reference added.
- [ ] Every new script is in `CHINTU_FOUNDER_COMMAND_MAP.md`.
- [ ] Every new generated file is in `CHINTU_GENERATED_FILES_MAP.md`.
- [ ] Every new doc with cross-links passes
      `chintu-doc-link-integrity.test.js`.

---

## 2. Read the diff yourself

The tests catch syntactic violations. They do not catch a wrong
*idea*. Skim `git diff origin/main` and ask:

- Does the change match what I asked for?
- Is anything snuck in that I would not have approved?
- Does the commit subject for each new commit honestly describe the
  diff?

---

## 3. Branch sanity

- [ ] You are on the branch you intended (`git rev-parse --abbrev-ref HEAD`).
- [ ] The remote is the one you intended (`git remote -v`).
- [ ] You are not about to force-push (`git push` without `--force`).
- [ ] If pushing to `main`, you reviewed the full commit list with
      `git log origin/main..HEAD --oneline`.

---

## 4. BALA-specific extra checks (if any BALA file changed)

- [ ] `privacy.html` still includes the non-medical companion footer.
- [ ] No new copy uses "diagnose", "treat", "cure", "prevent",
      "predict", or a condition name about the user.
- [ ] If `sw.js` changed, the `CACHE_NAME` bump is intentional and
      the new assets are listed in `CACHE_FILES`.
- [ ] If `manifest.webmanifest` changed, the icons / colors are still
      consistent with the existing brand.

---

## 5. Stop signals (do not push)

- The launcher or release guard exited non-zero.
- The diff contains anything you don't recognize.
- You are tired. Push is irreversible by you alone — sleep on it.
- A parked system shows signs of activation (Telegram, Discord,
  cloud sync, webhooks, etc.).

---

## 6. After push

- [ ] Note the pushed commit range in
      `CHINTU_MEMORY_VAULT/DECISIONS.md` or a daily log.
- [ ] Update `CHINTU_HANDOFF.md` if the push includes a milestone.
- [ ] Re-run the master launcher locally to confirm the working tree
      still passes.

---

## 7. BALA safety footer

BALA is a health-awareness companion. It does not diagnose, treat,
predict, prevent, replace doctors, or provide emergency monitoring.
