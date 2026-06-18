# Chintu iMac Bridge — Troubleshooting

The bridge is the one-way Windows -> shared-folder -> iMac flow used by
Omega OS Option 11 (manual) and Option 12 (shared-folder pull). It is
local-first by design: no cloud sync is configured, no automation
crosses machines, and no health data ever flows through it.

This doc covers the failure modes you are most likely to see and what
to do about each.

For the full package detail (what Option 12 installs, what it changes,
how to install it on the iMac), see
[CHINTU_IMAC_PACKAGES/OPTION_12_PULL_SHARED/README.md](CHINTU_IMAC_PACKAGES/OPTION_12_PULL_SHARED/README.md)
and the test plan in
[CHINTU_IMAC_PACKAGES/OPTION_12_PULL_SHARED/IMAC_TEST_PLAN.md](CHINTU_IMAC_PACKAGES/OPTION_12_PULL_SHARED/IMAC_TEST_PLAN.md).

For a clean revert path, see [CHINTU_BRIDGE_ROLLBACK.md](CHINTU_BRIDGE_ROLLBACK.md).

---

## Symptom: Windows side did not produce a bridge ZIP

Check, in order:

1. `git status --short` is reasonable (no half-staged conflict).
2. Run `powershell -ExecutionPolicy Bypass -File scripts\chintu-bridge-daily-export.ps1`.
3. Open `chintu-bridge-daily-export-report.md`. It will name the
   destination folder and whether `CHINTU_BRIDGE_LATEST.zip` and
   `MANIFEST.txt` were written.
4. If the report shows the ZIP was not produced, look at the destination
   path the script printed. The most common cause is the founder having
   moved or renamed the shared folder.

---

## Symptom: iMac Option 12 says "shared folder not found"

Option 12 stores the folder path in:

```text
~/Documents/CHINTU_CONTROL_ROOM/BRIDGE/shared-folder-path.txt
```

If the founder moved the shared folder, that saved path is stale.
Either:

- Delete `shared-folder-path.txt` and re-run Option 12 (it will ask
  again), or
- Edit the file to point at the new path.

---

## Symptom: iMac Option 12 says "manifest mismatch" or "SHA mismatch"

This is the bridge doing its job. The ZIP and the `MANIFEST.txt` did
not agree, so the iMac refused to unpack.

1. On Windows, re-run the bridge export: `scripts\chintu-bridge-daily-export.ps1`.
2. Copy the fresh `CHINTU_BRIDGE_LATEST.zip` and `MANIFEST.txt` to the
   shared folder together. Both files must be from the same export.
3. Re-run Option 12 on the iMac.

Never edit `MANIFEST.txt` by hand to make it match. The manifest is the
verification target.

---

## Symptom: iMac Option 12 says "bridge-sync.sh missing"

Option 12 calls the existing `bridge-sync.sh` after staging files. If
that script is not at
`~/Documents/CHINTU_CONTROL_ROOM/scripts/bridge-sync.sh`, the install
sequence on the iMac was skipped or partially rolled back.

Use manual Omega Option 11 as the fallback:

```text
Omega option 11) Bridge Sync
~/Desktop/CHINTU_BRIDGE_SYNC.command
bash ~/Documents/CHINTU_CONTROL_ROOM/scripts/bridge-sync.sh
```

Then re-install Option 12 when convenient.

---

## Symptom: Option 12 ran, but nothing appeared in BRIDGE/FROM_WINDOWS

Open the log:

```text
~/Documents/CHINTU_CONTROL_ROOM/logs/bridge-pull-shared.log
```

The log shows each step. Most common causes:

- ZIP was empty.
- The shared folder pointed at a different bridge export.
- The iMac side ran from a stale terminal session (close and reopen
  Terminal, try again).

---

## Symptom: I am not sure Option 12 was installed correctly

Run the install script again. It is safe to re-run. It does not
duplicate the Omega menu entry, and it does not overwrite an existing
backup.

If you want to start completely over, follow
[CHINTU_BRIDGE_ROLLBACK.md](CHINTU_BRIDGE_ROLLBACK.md), then re-install.

---

## What the bridge will never do

- Run on a schedule. The founder triggers each export and each pull.
- Transfer health data. The bridge carries Chintu OS artifacts only.
- Reach the network. No upload, no cloud sync activation.
- Push to git on either side.

If any of these appear to be happening, stop and treat it as a safety
incident.

---

## BALA safety footer

BALA is a health-awareness companion. It does not diagnose, treat,
predict, prevent, replace doctors, or provide emergency monitoring.
