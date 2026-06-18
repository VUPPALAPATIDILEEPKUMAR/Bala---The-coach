# Chintu iMac Option 12 — Install Now

A founder step-by-step for today. Read top to bottom. Pair with
`CHINTU_BRIDGE_LOOP_TEST_LOG.md` so you can fill the log as you go.

**Precondition:** `scripts\chintu-bridge-loop-reality-check.ps1`
reports **GREEN**. If it reports YELLOW or RED, fix that before
installing.

**Status:** verified end-to-end on 2026-06-18. The first manual run
surfaced a parsing bug in `bridge-pull-shared.sh` that caused a *false*
SHA-256 mismatch. Root cause: `awk -F': '` mis-parsed `MANIFEST.txt`
when the colon had multiple spaces after it, and the hashes weren't
case-normalized. The package in this repo now uses
`sed -n 's/^ZIP_SHA256:[[:space:]]*//p'` and lowercases both sides.
A fresh `bash install-option-12.sh` on the iMac picks up the fix.

---

## 1. Where the package lives on Windows

```
C:\Users\Chintu\Desktop\test\CHINTU_IMAC_PACKAGES\OPTION_12_PULL_SHARED\
```

Three files:

- `install-option-12.sh`
- `README.md`
- `IMAC_TEST_PLAN.md`

---

## 2. Where the shared bridge sits on Windows

```
C:\Users\Chintu\<your-user>\Desktop\CHINTU_SHARED_BRIDGE\
```

Inside it you should see (the reality check confirms each):

- `CHINTU_BRIDGE_LATEST.zip`
- `MANIFEST.txt` (carries the SHA-256 of the latest zip)
- `LATEST_FLAT/` (the 7 flat files Omega reads)

The iMac side will read the *same* shared folder, either through
iCloud Drive, Dropbox, a USB stick, or whatever transport you chose
in `CHINTU_BRIDGE_CONTRACT.md`.

---

## 3. What to copy to the iMac

Copy the entire `OPTION_12_PULL_SHARED` folder from Windows to the
iMac. Anywhere convenient — Desktop or Downloads is fine. Keep all
three files together.

Also make sure the shared bridge folder (with `CHINTU_BRIDGE_LATEST.zip`
+ `MANIFEST.txt`) is reachable on the iMac side. If you use iCloud
Drive, wait for the sync indicator to clear before installing.

---

## 4. Where to run the installer (iMac)

Open Terminal on the iMac.

```bash
cd ~/Desktop/OPTION_12_PULL_SHARED   # or wherever you copied it
bash install-option-12.sh
```

The installer:

- writes `~/Documents/CHINTU_CONTROL_ROOM/scripts/bridge-pull-shared.sh`
- writes `~/Desktop/CHINTU_PULL_SHARED_BRIDGE.command`
- attempts to patch `~/Documents/CHINTU_CONTROL_ROOM/scripts/chintu-omega-os.sh`
  to add an Option 12 menu entry (idempotent)

Safe to rerun. It does not duplicate the menu entry.

---

## 5. How to choose the shared folder path

The first time you trigger Option 12 (or run the Desktop command),
it asks for the iMac path that contains
`CHINTU_BRIDGE_LATEST.zip` and `MANIFEST.txt`.

Type the absolute path on the iMac side. Example for iCloud Drive:

```
/Users/<you>/Library/Mobile Documents/com~apple~CloudDocs/CHINTU_SHARED_BRIDGE
```

It saves that path for reuse, so you only type it once.

---

## 6. How to run Omega Option 12

After install, two paths:

- Run `~/Desktop/CHINTU_PULL_SHARED_BRIDGE.command` (double-click in
  Finder if you prefer).
- Or open Omega OS and pick option `12. Pull from Shared Bridge Folder`.

---

## 7. What success looks like

- Hash check against `MANIFEST.txt` passes.
- `~/Documents/CHINTU_CONTROL_ROOM/BRIDGE/FROM_WINDOWS/` is refreshed
  with the latest flat files.
- `bridge-sync.sh` runs and copies into the daily snapshot folder.
- `BRIDGE_STATUS.html` opens in your default browser.
- A line is appended to `~/Documents/CHINTU_CONTROL_ROOM/logs/bridge-pull-shared.log`.

Fill `CHINTU_BRIDGE_LOOP_TEST_LOG.md` as you go.

---

## 8. What failure looks like

| Symptom | Likely cause | Fix |
|---|---|---|
| Installer says "Omega could not be patched" | Older Omega script shape | Keep using the Desktop `.command`; review Omega manually later. |
| Hash mismatch on first pull (real) | Zip mid-sync from cloud | Wait for sync to complete on iMac, retry. |
| Hash mismatch on first pull (false) | Pre-fix `bridge-pull-shared.sh` with `awk -F': '` parsing | Rerun `bash install-option-12.sh` from this repo's package — it overwrites the pull script with the sed-based, lowercase-normalized version. |
| "shared folder path not found" | iCloud not signed in or wrong path | Confirm Finder can open the folder, then re-enter the path. |
| Option 12 missing from Omega menu | Patch step skipped | Use the Desktop `.command`; or rerun the installer. |
| `bridge-sync.sh` fails | iMac control room scripts moved | Re-clone iMac control room from your last known good state. |

If anything else goes wrong, switch to Option 11 (manual fallback;
see §10).

---

## 9. Rollback

Option 12's installer is additive. To roll back:

```bash
rm ~/Documents/CHINTU_CONTROL_ROOM/scripts/bridge-pull-shared.sh
rm ~/Desktop/CHINTU_PULL_SHARED_BRIDGE.command
```

If Omega was patched, open
`~/Documents/CHINTU_CONTROL_ROOM/scripts/chintu-omega-os.sh` and
remove the inserted Option 12 entry by hand. No other files are
touched.

The Windows side is untouched by this entire flow.

---

## 10. Manual Option 11 fallback

If Option 12 cannot install or run, the manual path still works:

1. On Windows, run `scripts\chintu-bridge-daily-export.ps1` and
   `scripts\chintu-bridge-command-center.ps1`.
2. Copy the entire `CHINTU_SHARED_BRIDGE` folder to the iMac (USB
   stick is fine).
3. On the iMac, manually unzip `CHINTU_BRIDGE_LATEST.zip` into
   `~/Documents/CHINTU_CONTROL_ROOM/BRIDGE/FROM_WINDOWS/`.
4. Run `bridge-sync.sh` from the iMac control room scripts folder.
5. Open `BRIDGE_STATUS.html`.

This is slower but does not depend on Option 12 at all.

---

## 11. What this guide does NOT activate

- No Telegram, Discord, webhooks, cloud sync automation, phone
  notifications, voice, paid APIs.
- No health-data transfer. The bridge carries Chintu status only —
  see `CHINTU_BRIDGE_CONTRACT.md` for the file contract.
- No edits to BALA app files on either machine.

---

## 12. BALA safety footer

BALA is a health-awareness companion. It does not diagnose, treat,
predict, prevent, replace doctors, or provide emergency monitoring.
