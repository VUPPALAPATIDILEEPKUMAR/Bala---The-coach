# iMac Option 12 Test Plan

## 1. Install check

1. Copy the package to the iMac.
2. Run `bash install-option-12.sh`.
3. Confirm these files now exist:
   - `~/Documents/CHINTU_CONTROL_ROOM/scripts/bridge-pull-shared.sh`
   - `~/Desktop/CHINTU_PULL_SHARED_BRIDGE.command`
4. If the Omega patch succeeds, confirm the backup file exists:
   - `~/Documents/CHINTU_CONTROL_ROOM/scripts/chintu-omega-os.sh.stage8-option12.bak`

## 2. Omega menu option 12 check

1. Launch Omega OS.
2. Confirm menu text includes:
   `12. Pull from Shared Bridge Folder`
3. Select option 12.
4. Confirm it prompts for the local shared-folder path on first use.

## 3. Pull latest ZIP check

1. Point Option 12 at a local iMac folder that contains:
   - `CHINTU_BRIDGE_LATEST.zip`
   - `MANIFEST.txt`
2. Confirm the path is stored in:
   `~/Documents/CHINTU_CONTROL_ROOM/BRIDGE/shared-folder-path.txt`
3. Confirm the seven bridge files refresh inside:
   `~/Documents/CHINTU_CONTROL_ROOM/BRIDGE/FROM_WINDOWS/`
4. Confirm `bridge-sync.sh` runs.

## 4. SHA-256 verification check

1. Use a valid shared folder first and confirm the run succeeds.
2. Compare the SHA in `MANIFEST.txt` with the computed SHA log entry in
   `~/Documents/CHINTU_CONTROL_ROOM/logs/bridge-pull-shared.log`.
3. Confirm no extraction happens when the hash does not match.

**Historical note:** earlier versions of `bridge-pull-shared.sh` parsed
`MANIFEST.txt` with `awk -F': '`, which truncated/misread the
`ZIP_SHA256` value when the manifest used variable spacing. That
caused a *false* SHA mismatch even when the zip was intact. The fix
is to use `sed -n 's/^ZIP_SHA256:[[:space:]]*//p'` and normalize both
expected and actual hashes to lowercase. The current package contains
this fix; if you patched an earlier install manually, rerunning
`install-option-12.sh` overwrites the script with the corrected
version.

## 5. Bridge status opens check

1. After a successful run, confirm:
   `~/Documents/CHINTU_CONTROL_ROOM/BRIDGE/BRIDGE_STATUS.html`
   opens automatically.
2. If it does not open, confirm the file was still generated and note the
   behavior in the log.

## 6. Failure test with missing folder

1. Run Option 12 and enter a folder path that does not exist.
2. Confirm it stops with a friendly message.
3. Confirm it does not delete anything from `FROM_WINDOWS/`.

## 7. Failure test with wrong ZIP or hash

1. Keep `MANIFEST.txt` but replace `CHINTU_BRIDGE_LATEST.zip` with a different
   file, if practical.
2. Run Option 12.
3. Confirm SHA-256 mismatch causes a STOP and no extraction.
4. Confirm the log records the mismatch.

## 8. Rollback steps

1. Delete `~/Desktop/CHINTU_PULL_SHARED_BRIDGE.command`.
2. Delete `~/Documents/CHINTU_CONTROL_ROOM/scripts/bridge-pull-shared.sh`.
3. Restore `chintu-omega-os.sh` from the `.stage8-option12.bak` backup if it
   exists.
4. Remove `shared-folder-path.txt` and `bridge-pull-shared.log` if the founder
   wants a clean rollback.
