# Chintu Bridge — Rollback

How to back the bridge out cleanly, either to retry an install or to
park the bridge entirely. None of these steps touch BALA app files or
the network. All of them are reversible.

For setup detail see
[CHINTU_IMAC_PACKAGES/OPTION_12_PULL_SHARED/README.md](CHINTU_IMAC_PACKAGES/OPTION_12_PULL_SHARED/README.md).
For failure modes see
[CHINTU_IMAC_BRIDGE_TROUBLESHOOTING.md](CHINTU_IMAC_BRIDGE_TROUBLESHOOTING.md).

---

## On Windows

The Windows side is the source. There is nothing to "uninstall" — the
bridge scripts only produce artifacts. To park the Windows side:

1. Stop running `scripts\chintu-bridge-daily-export.ps1` and
   `scripts\chintu-bridge-command-center.ps1`.
2. Optionally delete the generated report files (they are gitignored):
   - `chintu-bridge-daily-export-report.md`
   - `chintu-bridge-command-center-report.md`
3. Leave the scripts in place. They are dormant until you call them.

No git revert is needed. The scripts produce no committed state on
their own.

---

## On the iMac — Option 12 rollback

Run these in Terminal. They are listed in safe order.

```bash
# 1. Remove the desktop shortcut.
rm -f ~/Desktop/CHINTU_PULL_SHARED_BRIDGE.command

# 2. Remove the pull-shared helper script.
rm -f ~/Documents/CHINTU_CONTROL_ROOM/scripts/bridge-pull-shared.sh

# 3. Restore Omega OS from the backup the installer created.
backup="$HOME/Documents/CHINTU_CONTROL_ROOM/scripts/chintu-omega-os.sh.stage8-option12.bak"
target="$HOME/Documents/CHINTU_CONTROL_ROOM/scripts/chintu-omega-os.sh"
if [ -f "$backup" ]; then
  cp "$backup" "$target"
fi

# 4. Optionally clear the remembered shared-folder path.
rm -f ~/Documents/CHINTU_CONTROL_ROOM/BRIDGE/shared-folder-path.txt

# 5. Optionally clear the pull-shared log.
rm -f ~/Documents/CHINTU_CONTROL_ROOM/logs/bridge-pull-shared.log
```

Step 3 is the only step that mutates an existing file. If the backup
does not exist (it should — the installer wrote it on first run),
skip step 3 and re-run `install-option-12.sh` to lay down a fresh
Omega OS with Option 12 present.

Option 11 (manual bridge sync) keeps working after Option 12 rollback.
It is the always-available fallback.

---

## On the iMac — bridge data rollback

To clear staged Windows-side artifacts on the iMac without uninstalling
anything:

```bash
rm -rf ~/Documents/CHINTU_CONTROL_ROOM/BRIDGE/FROM_WINDOWS/*
```

This deletes the staged copy only. The shared folder on disk is not
touched, and nothing on Windows is affected.

---

## What rollback will never do

- Push or revert git history.
- Touch BALA app files.
- Reach the network.
- Send anything to Telegram / Discord / cloud sync.
- Modify the founder's iMac account, login items, or system settings.

If a rollback step appears to be doing any of these, stop and treat it
as a safety incident.

---

## BALA safety footer

BALA is a health-awareness companion. It does not diagnose, treat,
predict, prevent, replace doctors, or provide emergency monitoring.
