<#
.SYNOPSIS
    Chintu Windows Bridge Daily Export V1.

.DESCRIPTION
    One-button Windows-side rhythm. Runs the full Chintu status pipeline
    (agent board, validate, release guard, OpenClaw readiness, Windows
    reporter), refreshes BRIDGE_TRANSFER_README.md in the outbox, packages
    the seven bridge files into a date/time-stamped ZIP on the Desktop, and
    writes a gitignored local report.

    Hard rules (enforced by what this script does NOT do):
      - No installs.
      - No plugin enables.
      - No network egress.
      - No external URLs.
      - No secrets, tokens, .env, openclaw.json, cookies, sessions, or
        paired-device files are read.
      - No BALA health data is read or packaged.
      - No git push.
      - No edits to BALA app code (app.js, index.html, styles.css, sw.js).
      - OpenClaw readiness is wrapped in a timeout; if it hangs, the script
        continues and uses whatever readiness report is already on disk.

.PARAMETER RepoRoot
    Repo root. Defaults to C:\Users\Chintu\Desktop\test.

.PARAMETER OutDir
    Outbox folder (must match chintu-windows-reporter.ps1). Default:
    C:\Users\Chintu\Desktop\CHINTU_BRIDGE_OUTBOX.

.PARAMETER DesktopDir
    Where the ZIP package lands. Default: C:\Users\Chintu\Desktop.

.PARAMETER OpenclawTimeoutSeconds
    Soft timeout for OpenClaw readiness. Default 60.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\chintu-bridge-daily-export.ps1
#>
[CmdletBinding()]
param(
    [string]$RepoRoot = "C:\Users\Chintu\Desktop\test",
    [string]$OutDir = "C:\Users\Chintu\Desktop\CHINTU_BRIDGE_OUTBOX",
    [string]$DesktopDir = "C:\Users\Chintu\Desktop",
    [int]$OpenclawTimeoutSeconds = 60
)

$ErrorActionPreference = "Continue"

function Say { param([string]$msg) Write-Host $msg }

if (-not (Test-Path -LiteralPath $RepoRoot)) {
    Say "STOP: repo root not found: $RepoRoot"
    exit 2
}
Set-Location -LiteralPath $RepoRoot

$stamp = Get-Date -Format "yyyy-MM-dd HH:mm"
$stampSlug = Get-Date -Format "yyyy-MM-dd_HHmm"
$dateSlug = Get-Date -Format "yyyy-MM-dd"

function Run-LocalScript {
    param([string]$RelPath, [string]$Label)
    $full = Join-Path $RepoRoot $RelPath
    $out = @()
    $exit = -1
    $status = "SKIP"
    if (-not (Test-Path -LiteralPath $full)) {
        $out = @("(skipped: $Label not found at $RelPath)")
        return [pscustomobject]@{ Label = $Label; Status = "MISSING"; Exit = -1; Output = $out }
    }
    try {
        $out = & powershell -NoProfile -ExecutionPolicy Bypass -File $full 2>&1
        $exit = $LASTEXITCODE
        if ($null -eq $exit) { $exit = 0 }
        if ($exit -eq 0) { $status = "OK" } else { $status = "FAIL" }
    } catch {
        $out = @("(error running $Label : $($_.Exception.Message))")
        $status = "ERROR"
    }
    if ($null -eq $out) { $out = @() }
    $outStr = @($out | ForEach-Object { [string]$_ })
    return [pscustomobject]@{ Label = $Label; Status = $status; Exit = $exit; Output = $outStr }
}

function Run-WithTimeout {
    param([string]$RelPath, [string]$Label, [int]$TimeoutSec)
    $full = Join-Path $RepoRoot $RelPath
    if (-not (Test-Path -LiteralPath $full)) {
        return [pscustomobject]@{ Label = $Label; Status = "MISSING"; Exit = -1; Output = @("(skipped: $Label not found at $RelPath)") }
    }
    $job = Start-Job -ScriptBlock {
        param($script)
        & powershell -NoProfile -ExecutionPolicy Bypass -File $script 2>&1
        return $LASTEXITCODE
    } -ArgumentList $full
    $completed = Wait-Job -Job $job -Timeout $TimeoutSec
    if (-not $completed) {
        try { Stop-Job -Job $job -ErrorAction SilentlyContinue } catch {}
        try { Remove-Job -Job $job -Force -ErrorAction SilentlyContinue } catch {}
        return [pscustomobject]@{
            Label  = $Label
            Status = "TIMEOUT"
            Exit   = -1
            Output = @("(timed out after $TimeoutSec seconds; continuing with last on-disk report)")
        }
    }
    $raw = @(Receive-Job -Job $job -ErrorAction SilentlyContinue)
    try { Remove-Job -Job $job -Force -ErrorAction SilentlyContinue } catch {}
    $exit = 0
    if ($raw.Count -gt 0 -and ($raw[-1] -is [int])) {
        $exit = [int]$raw[-1]
        $raw = $raw[0..($raw.Count - 2)]
    }
    $status = "OK"
    if ($exit -ne 0) { $status = "FAIL" }
    $outStr = @($raw | ForEach-Object { [string]$_ })
    return [pscustomobject]@{ Label = $Label; Status = $status; Exit = $exit; Output = $outStr }
}

Say "Chintu Bridge Daily Export V1 - $stamp"
Say "Repo:    $RepoRoot"
Say "Outbox:  $OutDir"
Say "Desktop: $DesktopDir"
Say ""

# --- Step 1: agent board ----------------------------------------------------
Say "[1/5] chintu-agent-board.ps1"
$board = Run-LocalScript -RelPath "scripts\chintu-agent-board.ps1" -Label "agent-board"
Say ("    -> {0} (exit {1})" -f $board.Status, $board.Exit)

# --- Step 2: validate -------------------------------------------------------
Say "[2/5] chintu-validate.ps1"
$validate = Run-LocalScript -RelPath "scripts\chintu-validate.ps1" -Label "validate"
Say ("    -> {0} (exit {1})" -f $validate.Status, $validate.Exit)

# --- Step 3: release guard --------------------------------------------------
Say "[3/5] chintu-release-guard.ps1"
$guard = Run-LocalScript -RelPath "scripts\chintu-release-guard.ps1" -Label "release-guard"
Say ("    -> {0} (exit {1})" -f $guard.Status, $guard.Exit)

# --- Step 4: openclaw readiness (timeout-tolerant) --------------------------
Say "[4/5] chintu-openclaw-readiness.ps1 (timeout $OpenclawTimeoutSeconds s)"
$openclaw = Run-WithTimeout -RelPath "scripts\chintu-openclaw-readiness.ps1" -Label "openclaw-readiness" -TimeoutSec $OpenclawTimeoutSeconds
Say ("    -> {0} (exit {1})" -f $openclaw.Status, $openclaw.Exit)

# --- Step 5: windows reporter -----------------------------------------------
Say "[5/5] chintu-windows-reporter.ps1"
$reporter = Run-LocalScript -RelPath "scripts\chintu-windows-reporter.ps1" -Label "windows-reporter"
Say ("    -> {0} (exit {1})" -f $reporter.Status, $reporter.Exit)

# --- Verify outbox bridge files --------------------------------------------
$bridgeFileNames = @(
    "latest_status.md",
    "latest_bala_validation.md",
    "latest_git_status.md",
    "latest_codex_handoff.md",
    "latest_openclaw_report.md",
    "latest_next_actions.md"
)
$missing = @()
foreach ($f in $bridgeFileNames) {
    $p = Join-Path $OutDir $f
    if (-not (Test-Path -LiteralPath $p)) { $missing += $f }
}
$outboxOk = ($missing.Count -eq 0)
Say ""
if ($outboxOk) {
    Say "Outbox check: PASS (all 6 bridge files present)"
} else {
    Say "Outbox check: FAIL (missing: $($missing -join ', '))"
}

# --- Refresh BRIDGE_TRANSFER_README.md --------------------------------------
$zipName = "CHINTU_BRIDGE_PACKAGE_${stampSlug}.zip"
$zipPath = Join-Path $DesktopDir $zipName

$readmePath = Join-Path $OutDir "BRIDGE_TRANSFER_README.md"
$readme = @()
$readme += "# Chintu Bridge Transfer Package"
$readme += ""
$readme += "**Package date/time:** $stamp"
$readme += "**Source machine:** Windows Chintu (build / AI brain)"
$readme += "**Source folder:** ``$OutDir``"
$readme += "**Target folder on iMac:** ``~/Documents/CHINTU_CONTROL_ROOM/BRIDGE/FROM_WINDOWS/``"
$readme += ""
$readme += "## Copy instructions"
$readme += ""
$readme += "1. Move ``$zipName`` from the Windows Desktop to the iMac"
$readme += "   (USB drive, cloud-sync folder, or AirDrop)."
$readme += "2. On the iMac, extract all seven files into:"
$readme += "   ``~/Documents/CHINTU_CONTROL_ROOM/BRIDGE/FROM_WINDOWS/``"
$readme += "3. Run the iMac bridge sync:"
$readme += "   - Double-click ``~/Desktop/CHINTU_BRIDGE_SYNC.command``, or"
$readme += "   - Choose option **11) Bridge Sync** in ``CHINTU_OMEGA_OS.command``, or"
$readme += "   - From a terminal: ``bash ~/Documents/CHINTU_CONTROL_ROOM/scripts/bridge-sync.sh``"
$readme += "4. Open ``~/Documents/CHINTU_CONTROL_ROOM/BRIDGE/BRIDGE_STATUS.html`` to confirm."
$readme += ""
$readme += "## Files in this package (7 total)"
$readme += ""
$readme += "1. ``latest_status.md`` -- overall Chintu status (agent board output)"
$readme += "2. ``latest_bala_validation.md`` -- validate + release-guard output"
$readme += "3. ``latest_git_status.md`` -- git status, last 10 commits, unpushed list"
$readme += "4. ``latest_codex_handoff.md`` -- Codex parked notice + recent Codex commits"
$readme += "5. ``latest_openclaw_report.md`` -- latest OpenClaw readiness report"
$readme += "6. ``latest_next_actions.md`` -- NEXT_SPRINT_QUEUE.md contents"
$readme += "7. ``BRIDGE_TRANSFER_README.md`` -- this file"
$readme += ""
$readme += "## What is NOT in this package"
$readme += ""
$readme += "- ``chintu-windows-reporter-report.md`` (gitignored Windows-side summary; stays on Windows)."
$readme += "- ``chintu-bridge-daily-export-report.md`` (gitignored daily-export summary; stays on Windows)."
$readme += "- No repo source files (app.js, index.html, styles.css, sw.js)."
$readme += "- No secrets, tokens, .env, openclaw.json, cookies, sessions, or paired-device files."
$readme += "- No BALA health data."
$readme += "- No Telegram / Discord / webhook payloads."
$readme += ""
$readme += "## Roles after transfer"
$readme += ""
$readme += "- Windows remains the brain (repo, build, validation, commits)."
$readme += "- iMac is a read-only Control Room (display, archive, status dashboard)."
$readme += ""
$readme += "No health data crossed this bridge. Local-only. Manual transport only."

try {
    $readme | Set-Content -LiteralPath $readmePath -Encoding ASCII
    Say "Refreshed: $readmePath"
} catch {
    Say ("FAILED to write {0}: {1}" -f $readmePath, $_.Exception.Message)
}

# --- Build ZIP --------------------------------------------------------------
$zipOk = $false
$zipEntries = @()
if ($outboxOk -and (Test-Path -LiteralPath $readmePath)) {
    $sources = @()
    foreach ($f in $bridgeFileNames) { $sources += (Join-Path $OutDir $f) }
    $sources += $readmePath
    try {
        if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
        Compress-Archive -LiteralPath $sources -DestinationPath $zipPath -CompressionLevel Optimal -Force
        if (Test-Path -LiteralPath $zipPath) {
            try {
                Add-Type -AssemblyName System.IO.Compression.FileSystem -ErrorAction SilentlyContinue
                $zr = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
                $zipEntries = @($zr.Entries | ForEach-Object { $_.FullName })
                $zr.Dispose()
            } catch {
                $zipEntries = @()
            }
            $zipOk = ($zipEntries.Count -eq 7)
        }
    } catch {
        Say ("ZIP build error: {0}" -f $_.Exception.Message)
    }
}
Say ""
if ($zipOk) {
    Say "ZIP: $zipPath"
    Say "ZIP entries: $($zipEntries -join ', ')"
} else {
    Say "ZIP: NOT created (precondition failed)"
}

# --- Local report -----------------------------------------------------------
$reportPath = Join-Path $RepoRoot "chintu-bridge-daily-export-report.md"
$report = @()
$report += "# Chintu Bridge Daily Export Report"
$report += ""
$report += "**Generated:** $stamp"
$report += "**Repo:** $RepoRoot"
$report += "**Outbox:** $OutDir"
$report += "**ZIP:** $zipPath"
$report += ""
$report += "## Step results"
$report += ""
$report += "| Step | Status | Exit |"
$report += "|---|---|---|"
$report += "| 1. agent-board       | $($board.Status)    | $($board.Exit)    |"
$report += "| 2. validate          | $($validate.Status) | $($validate.Exit) |"
$report += "| 3. release-guard     | $($guard.Status)    | $($guard.Exit)    |"
$report += "| 4. openclaw-readiness| $($openclaw.Status) | $($openclaw.Exit) |"
$report += "| 5. windows-reporter  | $($reporter.Status) | $($reporter.Exit) |"
$report += ""
$report += "## Outbox check"
$report += ""
if ($outboxOk) {
    $report += "PASS - all six bridge files present in ``$OutDir``."
} else {
    $report += "FAIL - missing: $($missing -join ', ')"
}
$report += ""
$report += "## ZIP"
$report += ""
if ($zipOk) {
    $report += "Built: ``$zipPath``"
    $report += ""
    $report += "Entries (7):"
    foreach ($e in $zipEntries) { $report += "- ``$e``" }
} else {
    $report += "Not built. Precondition failed or Compress-Archive error."
}
$report += ""
$report += "## Validation block (from chintu-validate)"
$report += ""
$report += '```'
foreach ($line in $validate.Output) { $report += $line }
$report += '```'
$report += ""
$report += "## Release guard block"
$report += ""
$report += '```'
foreach ($line in $guard.Output) { $report += $line }
$report += '```'
$report += ""
$report += "## OpenClaw readiness status"
$report += ""
$report += "- Status: $($openclaw.Status)"
$report += "- The last on-disk readiness report (if any) was used by the Windows reporter."
$report += "- This step never blocks the export; OpenClaw readiness is informational."
$report += ""
$report += "## Safety posture"
$report += ""
$report += "- No health data was read or packaged."
$report += "- No secrets, tokens, or paired-device files were read."
$report += "- No network egress."
$report += "- No plugin install or enable."
$report += "- No git push."
$report += ""
$report += "## iMac destination"
$report += ""
$report += "``~/Documents/CHINTU_CONTROL_ROOM/BRIDGE/FROM_WINDOWS/``"
$report += ""
$report += "## Next manual step"
$report += ""
$report += "1. Move ``$zipName`` from the Windows Desktop to the iMac."
$report += "2. Extract all 7 files into ``~/Documents/CHINTU_CONTROL_ROOM/BRIDGE/FROM_WINDOWS/``."
$report += "3. Run Omega OS option **11) Bridge Sync** (or ``bridge-sync.sh``)."
$report += "4. Open ``BRIDGE_STATUS.html`` to confirm."

try {
    $report | Set-Content -LiteralPath $reportPath -Encoding ASCII
    Say "Local report: $reportPath"
} catch {
    Say ("FAILED to write local report: {0}" -f $_.Exception.Message)
}

Say ""
Say "iMac destination: ~/Documents/CHINTU_CONTROL_ROOM/BRIDGE/FROM_WINDOWS/"
Say ""
if ($zipOk -and $outboxOk -and $validate.Status -eq "OK" -and $guard.Status -eq "OK") {
    Say "Chintu Bridge Daily Export V1: PASS"
    exit 0
} else {
    Say "Chintu Bridge Daily Export V1: COMPLETED WITH WARNINGS (see report)"
    exit 0
}
