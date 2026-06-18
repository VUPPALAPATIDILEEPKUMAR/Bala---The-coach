# Chintu Bridge Loop Test Log

A founder-fill template. Copy this file (or just edit it in place) as
you walk through `CHINTU_IMAC_OPTION_12_INSTALL_NOW.md`. Capture what
happened, what worked, and what to retry tomorrow.

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
