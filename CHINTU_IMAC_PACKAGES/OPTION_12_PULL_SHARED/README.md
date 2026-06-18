# iMac Option 12 Pull Shared Package

## What Option 12 does

Option 12 is a portable iMac-side installer for the shared bridge flow. It
creates:

- `~/Documents/CHINTU_CONTROL_ROOM/scripts/bridge-pull-shared.sh`
- `~/Desktop/CHINTU_PULL_SHARED_BRIDGE.command`

It also attempts an idempotent patch to:

- `~/Documents/CHINTU_CONTROL_ROOM/scripts/chintu-omega-os.sh`

When Option 12 is installed, the iMac can ask for the local shared-folder path,
save that path for reuse, verify `CHINTU_BRIDGE_LATEST.zip` against
`MANIFEST.txt`, refresh `~/Documents/CHINTU_CONTROL_ROOM/BRIDGE/FROM_WINDOWS/`,
run the existing `bridge-sync.sh`, open `BRIDGE_STATUS.html`, and log to
`~/Documents/CHINTU_CONTROL_ROOM/logs/bridge-pull-shared.log`.

This package does not claim the iMac was already modified. Installation happens
only when the founder copies this folder to the iMac and runs the installer.

## How to copy the package to the iMac

1. Copy the full `OPTION_12_PULL_SHARED` folder from Windows to the iMac.
2. Place it anywhere convenient on the iMac, such as the Desktop or Downloads.
3. Keep the three files together:
   `install-option-12.sh`, `README.md`, and `IMAC_TEST_PLAN.md`.

## How to run install-option-12.sh

1. Open Terminal on the iMac.
2. Change into the copied package folder.
3. Run:

```bash
bash install-option-12.sh
```

4. If the installer reports that Omega could not be patched automatically, keep
   using the new desktop command and review the Omega script manually before
   trying again.

The installer is safe to rerun. It does not duplicate Option 12 if the menu
entry already exists.

## How to use Option 12 from Omega OS

After install, use either:

- Omega OS option `12. Pull from Shared Bridge Folder`, or
- `~/Desktop/CHINTU_PULL_SHARED_BRIDGE.command`

On first run, Option 12 asks for the local iMac folder that contains:

- `CHINTU_BRIDGE_LATEST.zip`
- `MANIFEST.txt`

It saves that folder path to:

- `~/Documents/CHINTU_CONTROL_ROOM/BRIDGE/shared-folder-path.txt`

Later runs reuse the saved path unless the founder types a new one.

## SHA-256 parsing note (post-2026-06-18 fix)

`bridge-pull-shared.sh` parses `ZIP_SHA256` from `MANIFEST.txt` using
`sed -n 's/^ZIP_SHA256:[[:space:]]*//p'` and normalizes both the
expected and actual hashes to lowercase before comparing. An earlier
version used `awk -F': '` and a case-sensitive compare, which produced
a false SHA mismatch on iMac when the manifest had multi-space
alignment after the colon and the manifest hash was uppercase while
`shasum -a 256` output was lowercase. Reinstalling Option 12 with the
current `install-option-12.sh` overwrites the script and picks up the
fix.

## Option 11 remains the manual fallback

Manual Omega option 11 is still the fallback path. If Option 12 stops because
the shared folder, ZIP, manifest, SHA, or `bridge-sync.sh` is missing, use:

- Omega option `11) Bridge Sync`
- `~/Desktop/CHINTU_BRIDGE_SYNC.command`
- `bash ~/Documents/CHINTU_CONTROL_ROOM/scripts/bridge-sync.sh`

Option 12 is additive. It does not remove or replace Option 11.

## Privacy warning for cloud sync

If the founder chooses to place the shared bridge inside iCloud Drive, OneDrive,
Google Drive, Dropbox, or another sync tool, that is a founder-owned decision.
This package does not configure cloud sync and does not assume any cloud path.
Keep the bridge private. No health data should be transferred through this loop.

## Rollback steps

1. Remove `~/Desktop/CHINTU_PULL_SHARED_BRIDGE.command` if no longer wanted.
2. Remove `~/Documents/CHINTU_CONTROL_ROOM/scripts/bridge-pull-shared.sh`.
3. Restore `~/Documents/CHINTU_CONTROL_ROOM/scripts/chintu-omega-os.sh` from
   `~/Documents/CHINTU_CONTROL_ROOM/scripts/chintu-omega-os.sh.stage8-option12.bak`
   if that backup exists.
4. Optionally remove
   `~/Documents/CHINTU_CONTROL_ROOM/BRIDGE/shared-folder-path.txt`.
5. Optionally remove
   `~/Documents/CHINTU_CONTROL_ROOM/logs/bridge-pull-shared.log`.

## Safety note

BALA is a health-awareness companion. It does not diagnose, treat, predict,
prevent, replace doctors, or provide emergency monitoring.
