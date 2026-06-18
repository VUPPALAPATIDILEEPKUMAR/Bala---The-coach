# Chintu Bridge Loop Test Log

A founder-fill template. Copy this file (or just edit it in place) as
you walk through `CHINTU_IMAC_OPTION_12_INSTALL_NOW.md`. Capture what
happened, what worked, and what to retry tomorrow.

---

## First verified end-to-end run — 2026-06-18

**Outcome:** PASS after one in-place patch.

What happened: install completed, shared bridge package was present
on iMac, but `bridge-pull-shared.sh` stopped with a SHA-256 mismatch
that turned out to be a *false* mismatch. The script parsed
`MANIFEST.txt` with `awk -F': '`, which truncated/misread the
`ZIP_SHA256` value when the manifest had variable spacing after the
colon. The manifest also stored the hash uppercase while
`shasum -a 256` returned lowercase.

Manual iMac patch that worked:

```bash
# In bridge-pull-shared.sh, robust parse + case normalize:
EXPECTED_SHA=$(sed -n 's/^ZIP_SHA256:[[:space:]]*//p' "$MANIFEST_PATH" \
  | head -n 1 | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')
ACTUAL_SHA=$(compute_sha256 "$ZIP_PATH" | tr '[:upper:]' '[:lower:]') || {
```

After the patch the pull succeeded: SHA-256 verified, `FROM_WINDOWS/`
refreshed from `CHINTU_BRIDGE_LATEST.zip`, bridge sync processed 7/7,
`BRIDGE_STATUS.html` opened.

The source package (`CHINTU_IMAC_PACKAGES/OPTION_12_PULL_SHARED/install-option-12.sh`)
has been updated with the same fix, so future iMac installs are
correct from the start. Reinstall on the iMac with
`bash install-option-12.sh` to pick up the fix without manual patching.

---

## Clean GitHub-ZIP reinstall — 2026-06-18 (post-9392346)

**Outcome:** PASS on first try. No manual patching needed.

After commit `9392346` (the SHA-parse fix) was pushed to `origin/main`,
the founder downloaded a fresh GitHub ZIP of the repo on the iMac,
copied the `OPTION_12_PULL_SHARED` folder out of it, and ran the
installer cleanly.

Inspected the installed live script on the iMac
(`~/Documents/CHINTU_CONTROL_ROOM/scripts/bridge-pull-shared.sh`) and
confirmed:

- `EXPECTED_SHA` uses `sed -n 's/^ZIP_SHA256:[[:space:]]*//p'` with
  the whitespace strip and `tr '[:upper:]' '[:lower:]'` normalization.
- `ACTUAL_SHA` pipes `compute_sha256` through
  `tr '[:upper:]' '[:lower:]'`.
- No `awk -F': '` regression.

Final pull from the fresh package reported:

- Verified SHA-256 and refreshed `FROM_WINDOWS/` from
  `CHINTU_BRIDGE_LATEST.zip`.
- Bridge Sync complete.
- Processed: 7 / 7.
- `BRIDGE_STATUS.html` opened.
- Shared bridge pull complete.

The end-to-end Windows -> shared bridge -> iMac Option 12 loop is
verified clean from a fresh GitHub install on this date.

---

---

## Run metadata

- **Date / time:** ___________
- **Windows commit at test:** `___________`
- **iMac control-room path:** `___________`
- **Shared folder path (Windows side):** `___________`
- **Shared folder path (iMac side):** `___________`
- **Transport (iCloud / Dropbox / USB / network share):** ___________

---

## 1. Windows export result

Ran on Windows before the test:

- `scripts\chintu-bridge-daily-export.ps1` exit: __________
- `scripts\chintu-bridge-command-center.ps1` exit: __________
- `scripts\chintu-bridge-loop-reality-check.ps1` overall: GREEN / YELLOW / RED
- Latest zip name: `CHINTU_BRIDGE_PACKAGE_______________.zip`
- Latest zip SHA-256 (from `MANIFEST.txt`): `___________`

Notes:

> ___________

---

## 2. Shared folder result

- `CHINTU_BRIDGE_LATEST.zip` visible on iMac side: yes / no
- `MANIFEST.txt` visible on iMac side: yes / no
- `LATEST_FLAT/` visible on iMac side: yes / no
- All 7 flat files visible: yes / no
- iCloud sync indicator (if applicable) settled: yes / no

Notes:

> ___________

---

## 3. iMac package copy result

- Copied `OPTION_12_PULL_SHARED/` to iMac at: `___________`
- All three files present (`install-option-12.sh`, `README.md`,
  `IMAC_TEST_PLAN.md`): yes / no

Notes:

> ___________

---

## 4. Option 12 install result

- `bash install-option-12.sh` exit code: __________
- `~/Documents/CHINTU_CONTROL_ROOM/scripts/bridge-pull-shared.sh` created: yes / no
- `~/Desktop/CHINTU_PULL_SHARED_BRIDGE.command` created: yes / no
- Omega patch reported: success / fallback / not attempted
- Option 12 visible in Omega menu: yes / no

Notes:

> ___________

---

## 5. First pull result

- Triggered via: Desktop `.command` / Omega Option 12
- Shared-folder path prompt: appeared / used saved
- Path entered: `___________`
- Pull exit code: __________
- Files refreshed under `BRIDGE/FROM_WINDOWS/`: yes / no

Notes:

> ___________

---

## 6. Hash check result

- Reported zip SHA-256 on iMac matched `MANIFEST.txt`: yes / no
- Reported expected: `___________`
- Reported actual:   `___________`

Notes:

> ___________

---

## 7. Bridge status opened?

- `BRIDGE_STATUS.html` opened automatically: yes / no
- If no, opened manually from: `___________`
- Status legible: yes / no

Notes:

> ___________

---

## 8. Pull log

- `~/Documents/CHINTU_CONTROL_ROOM/logs/bridge-pull-shared.log` line
  appended: yes / no
- Last log line:

```
___________
```

---

## 9. Notes / followups

- What surprised me:

  > ___________

- What I'd change in `CHINTU_IMAC_OPTION_12_INSTALL_NOW.md`:

  > ___________

- Anything to add to `CHINTU_MEMORY_VAULT/BLOCKERS.md` or
  `OPEN_QUESTIONS.md`:

  > ___________

---

## 10. Outcome

- Overall: PASS / PARTIAL / FAIL
- Used fallback Option 11: yes / no
- Safe to repeat tomorrow: yes / no

---

## 11. BALA safety footer

BALA is a health-awareness companion. It does not diagnose, treat,
predict, prevent, replace doctors, or provide emergency monitoring.
