#!/bin/bash

set -u

CONTROL_ROOT="$HOME/Documents/CHINTU_CONTROL_ROOM"
SCRIPTS_DIR="$CONTROL_ROOT/scripts"
BRIDGE_DIR="$CONTROL_ROOT/BRIDGE"
LOGS_DIR="$CONTROL_ROOT/logs"
OMEGA_SCRIPT="$SCRIPTS_DIR/chintu-omega-os.sh"
PULL_SCRIPT="$SCRIPTS_DIR/bridge-pull-shared.sh"
DESKTOP_COMMAND="$HOME/Desktop/CHINTU_PULL_SHARED_BRIDGE.command"
BACKUP_SUFFIX=".stage8-option12.bak"

say() {
  printf '%s\n' "$1"
}

stop() {
  say "STOP: $1"
  exit 1
}

ensure_dir() {
  if [ ! -d "$1" ]; then
    mkdir -p "$1" || stop "Could not create directory: $1"
  fi
}

write_pull_script() {
  cat > "$PULL_SCRIPT" <<'EOF'
#!/bin/bash

set -u

CONTROL_ROOT="$HOME/Documents/CHINTU_CONTROL_ROOM"
SCRIPTS_DIR="$CONTROL_ROOT/scripts"
BRIDGE_DIR="$CONTROL_ROOT/BRIDGE"
FROM_WINDOWS_DIR="$BRIDGE_DIR/FROM_WINDOWS"
LOGS_DIR="$CONTROL_ROOT/logs"
PATH_FILE="$BRIDGE_DIR/shared-folder-path.txt"
SYNC_SCRIPT="$SCRIPTS_DIR/bridge-sync.sh"
STATUS_HTML="$BRIDGE_DIR/BRIDGE_STATUS.html"
LOG_FILE="$LOGS_DIR/bridge-pull-shared.log"
TMP_DIR=""
SELECTED_SHARED_DIR=""

say() {
  printf '%s\n' "$1"
}

log() {
  local ts
  ts=$(date '+%Y-%m-%d %H:%M:%S')
  printf '[%s] %s\n' "$ts" "$1" | tee -a "$LOG_FILE"
}

cleanup() {
  if [ -n "$TMP_DIR" ] && [ -d "$TMP_DIR" ]; then
    rm -rf "$TMP_DIR"
  fi
}

trim_quotes() {
  local value="$1"
  value=${value#\"}
  value=${value%\"}
  printf '%s' "$value"
}

ensure_dir() {
  if [ ! -d "$1" ]; then
    mkdir -p "$1" || return 1
  fi
  return 0
}

read_shared_dir() {
  local saved=""
  local input=""
  if [ -f "$PATH_FILE" ]; then
    saved=$(head -n 1 "$PATH_FILE")
  fi

  say ""
  say "Pull from Shared Bridge Folder"
  if [ -n "$saved" ]; then
    say "Saved shared folder: $saved"
    printf 'Press Enter to reuse it, or type a new local folder path: '
  else
    printf 'Type the local iMac folder path that contains CHINTU_BRIDGE_LATEST.zip: '
  fi
  IFS= read -r input
  input=$(trim_quotes "$input")

  if [ -z "$input" ]; then
    input="$saved"
  fi

  if [ -z "$input" ]; then
    log "STOP: no shared folder path was provided."
    return 1
  fi

  printf '%s\n' "$input" > "$PATH_FILE" || return 1
  SELECTED_SHARED_DIR="$input"
  return 0
}

compute_sha256() {
  local file="$1"
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$file" | awk '{print $1}'
    return 0
  fi
  if command -v openssl >/dev/null 2>&1; then
    openssl dgst -sha256 "$file" | awk '{print $2}'
    return 0
  fi
  return 1
}

ensure_dir "$LOGS_DIR" || stop "Could not create logs directory."
ensure_dir "$BRIDGE_DIR" || stop "Could not create bridge directory."
ensure_dir "$FROM_WINDOWS_DIR" || stop "Could not create FROM_WINDOWS directory."

touch "$LOG_FILE" || stop "Could not open log file: $LOG_FILE"
log "Starting shared bridge pull."

read_shared_dir || exit 1
SHARED_DIR="$SELECTED_SHARED_DIR"
ZIP_PATH="$SHARED_DIR/CHINTU_BRIDGE_LATEST.zip"
MANIFEST_PATH="$SHARED_DIR/MANIFEST.txt"

if [ ! -d "$SHARED_DIR" ]; then
  log "STOP: shared folder is missing: $SHARED_DIR"
  exit 1
fi

if [ ! -f "$ZIP_PATH" ]; then
  log "STOP: CHINTU_BRIDGE_LATEST.zip is missing in $SHARED_DIR"
  exit 1
fi

if [ ! -f "$MANIFEST_PATH" ]; then
  log "WARN: MANIFEST.txt is missing in $SHARED_DIR"
  log "Use manual option 11 or rerun the Windows daily export."
  exit 1
fi

EXPECTED_SHA=$(awk -F': ' '/^ZIP_SHA256:/ {print $2; exit}' "$MANIFEST_PATH")
if [ -z "$EXPECTED_SHA" ]; then
  log "WARN: ZIP_SHA256 is missing in MANIFEST.txt"
  log "Use manual option 11 or rerun the Windows daily export."
  exit 1
fi

ACTUAL_SHA=$(compute_sha256 "$ZIP_PATH") || {
  log "WARN: Could not compute SHA-256 on this iMac."
  log "Use manual option 11 or rerun the Windows daily export."
  exit 1
}

if [ "$EXPECTED_SHA" != "$ACTUAL_SHA" ]; then
  log "STOP: SHA-256 mismatch. Expected $EXPECTED_SHA but found $ACTUAL_SHA"
  exit 1
fi

if [ ! -f "$SYNC_SCRIPT" ]; then
  log "STOP: bridge-sync.sh is missing at $SYNC_SCRIPT"
  exit 1
fi

if ! command -v unzip >/dev/null 2>&1; then
  log "STOP: unzip is not available on this iMac."
  exit 1
fi

TMP_DIR=$(mktemp -d "$BRIDGE_DIR/.pull-shared.XXXXXX") || stop "Could not create temp folder."
trap cleanup EXIT

unzip -oq "$ZIP_PATH" -d "$TMP_DIR" || {
  log "STOP: unzip failed for $ZIP_PATH"
  exit 1
}

for name in \
  latest_status.md \
  latest_bala_validation.md \
  latest_git_status.md \
  latest_codex_handoff.md \
  latest_openclaw_report.md \
  latest_next_actions.md \
  BRIDGE_TRANSFER_README.md
do
  if [ ! -f "$TMP_DIR/$name" ]; then
    log "STOP: extracted package is missing $name"
    exit 1
  fi
done

for name in \
  latest_status.md \
  latest_bala_validation.md \
  latest_git_status.md \
  latest_codex_handoff.md \
  latest_openclaw_report.md \
  latest_next_actions.md \
  BRIDGE_TRANSFER_README.md
do
  cp -f "$TMP_DIR/$name" "$FROM_WINDOWS_DIR/$name" || {
    log "STOP: could not copy $name into $FROM_WINDOWS_DIR"
    exit 1
  }
done

log "Verified SHA-256 and refreshed FROM_WINDOWS from CHINTU_BRIDGE_LATEST.zip."

bash "$SYNC_SCRIPT"
SYNC_EXIT=$?
if [ "$SYNC_EXIT" -ne 0 ]; then
  log "STOP: bridge-sync.sh exited with code $SYNC_EXIT"
  exit "$SYNC_EXIT"
fi

if [ -f "$STATUS_HTML" ]; then
  open "$STATUS_HTML" >/dev/null 2>&1
  log "Opened $STATUS_HTML"
else
  log "WARN: BRIDGE_STATUS.html was not found after bridge-sync.sh"
fi

log "Shared bridge pull complete."
exit 0
EOF

  chmod +x "$PULL_SCRIPT" || stop "Could not make $PULL_SCRIPT executable."
}

write_desktop_command() {
  cat > "$DESKTOP_COMMAND" <<'EOF'
#!/bin/bash
bash "$HOME/Documents/CHINTU_CONTROL_ROOM/scripts/bridge-pull-shared.sh"
EOF
  chmod +x "$DESKTOP_COMMAND" || stop "Could not make $DESKTOP_COMMAND executable."
}

patch_omega_script() {
  local backup tmp_menu tmp_case rc

  if [ ! -f "$OMEGA_SCRIPT" ]; then
    say "STOP: Omega script not found at $OMEGA_SCRIPT"
    say "The desktop command was installed. Add the Omega script, then rerun this installer."
    return 1
  fi

  if grep -q 'Pull from Shared Bridge Folder' "$OMEGA_SCRIPT" && \
     grep -q 'bridge-pull-shared.sh' "$OMEGA_SCRIPT"; then
    say "Omega option 12 already exists. No duplicate entry added."
    return 0
  fi

  backup="${OMEGA_SCRIPT}${BACKUP_SUFFIX}"
  if [ ! -f "$backup" ]; then
    cp "$OMEGA_SCRIPT" "$backup" || stop "Could not create Omega backup at $backup"
  fi

  tmp_menu="${OMEGA_SCRIPT}.stage8.menu.$$"
  tmp_case="${OMEGA_SCRIPT}.stage8.case.$$"

  awk '
    BEGIN { added=0 }
    {
      print
      if (!added && $0 ~ /Bridge Sync/ && $0 ~ /11/) {
        print "echo \"12. Pull from Shared Bridge Folder\""
        added=1
      }
    }
    END { if (added) exit 0; exit 2 }
  ' "$OMEGA_SCRIPT" > "$tmp_menu"
  rc=$?
  if [ "$rc" -ne 0 ]; then
    rm -f "$tmp_menu" "$tmp_case"
    say "STOP: could not find the Option 11 menu line in $OMEGA_SCRIPT"
    say "The desktop command was installed. Keep using it or patch Omega manually after review."
    return 1
  fi

  awk '
    BEGIN { after11=0; inserted=0 }
    {
      print
      if (!inserted && $0 ~ /^[[:space:]]*11[[:space:]]*\)/) {
        after11=1
        next
      }
      if (after11 && $0 ~ /^[[:space:]]*;;[[:space:]]*$/) {
        print "    12)"
        print "        bash \"$HOME/Documents/CHINTU_CONTROL_ROOM/scripts/bridge-pull-shared.sh\""
        print "        ;;"
        inserted=1
        after11=0
      }
    }
    END { if (inserted) exit 0; exit 2 }
  ' "$tmp_menu" > "$tmp_case"
  rc=$?
  if [ "$rc" -ne 0 ]; then
    rm -f "$tmp_menu" "$tmp_case"
    say "STOP: could not find the Option 11 case block in $OMEGA_SCRIPT"
    say "The desktop command was installed. Keep using it or patch Omega manually after review."
    return 1
  fi

  mv "$tmp_case" "$OMEGA_SCRIPT" || stop "Could not update $OMEGA_SCRIPT"
  rm -f "$tmp_menu"
  chmod +x "$OMEGA_SCRIPT" >/dev/null 2>&1 || true
  say "Omega script patched with Option 12."
  return 0
}

ensure_dir "$SCRIPTS_DIR"
ensure_dir "$BRIDGE_DIR"
ensure_dir "$LOGS_DIR"

write_pull_script
write_desktop_command
patch_omega_script || exit 1

say ""
say "Stage 8 Option 12 package installed."
say "Desktop command: $DESKTOP_COMMAND"
say "Bridge pull script: $PULL_SCRIPT"
say "Omega backup (if patch ran): ${OMEGA_SCRIPT}${BACKUP_SUFFIX}"
