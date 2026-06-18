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

.PARAMETER SharedDir
    Optional shared-folder mirror. When set (default:
    "$env:USERPROFILE\Desktop\CHINTU_SHARED_BRIDGE"), the script copies the
    new ZIP, an overwriting CHINTU_BRIDGE_LATEST.zip, a LATEST_FLAT/ folder
    with the 7 unzipped bridge files, and a MANIFEST.txt (SHA-256 + sizes)
    into the folder. Older dated ZIPs beyond -Keep are pruned. Pass an
    empty string ("") to disable the mirror entirely.

    Refuses unsafe paths: inside the repo, drive roots, C:\Windows,
    AppData, LocalAppData, or the user-profile root. Aborts the mirror
    (not the export) if the outbox fails a defense-in-depth secret /
    health-data scan.

.PARAMETER Keep
    How many dated ZIPs to retain in the shared folder. Default 7.
    CHINTU_BRIDGE_LATEST.zip, MANIFEST.txt, and LATEST_FLAT are never pruned.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\chintu-bridge-daily-export.ps1

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\chintu-bridge-daily-export.ps1 -SharedDir ""

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\chintu-bridge-daily-export.ps1 -SharedDir "C:\Users\Chintu\Desktop\CHINTU_SHARED_BRIDGE" -Keep 14
#>
[CmdletBinding()]
param(
    [string]$RepoRoot = "C:\Users\Chintu\Desktop\test",
    [string]$OutDir = "C:\Users\Chintu\Desktop\CHINTU_BRIDGE_OUTBOX",
    [string]$DesktopDir = "C:\Users\Chintu\Desktop",
    [int]$OpenclawTimeoutSeconds = 60,
    [string]$SharedDir = "$env:USERPROFILE\Desktop\CHINTU_SHARED_BRIDGE",
    [int]$Keep = 7
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

function Test-SafeSharedDir {
    param([string]$Path, [string]$RepoRoot)
    if ([string]::IsNullOrWhiteSpace($Path)) {
        return @{ Safe = $false; Reason = "SharedDir is empty (mirror disabled)." }
    }
    $resolved = $Path
    try { $resolved = [System.IO.Path]::GetFullPath($Path) } catch {
        return @{ Safe = $false; Reason = "SharedDir cannot be resolved: $Path" }
    }
    if ($resolved -match '^[A-Za-z]:\\?$') {
        return @{ Safe = $false; Reason = "SharedDir is a drive root: $resolved" }
    }
    $repoResolved = $RepoRoot
    try { $repoResolved = [System.IO.Path]::GetFullPath($RepoRoot) } catch {}
    $resolvedTrim = $resolved.TrimEnd('\')
    $repoTrim = $repoResolved.TrimEnd('\')
    if (($resolvedTrim -ieq $repoTrim) -or $resolvedTrim.StartsWith($repoTrim + '\', [System.StringComparison]::OrdinalIgnoreCase)) {
        return @{ Safe = $false; Reason = "SharedDir is inside the repo root: $resolved" }
    }
    if ($resolved -match '^[A-Za-z]:\\Windows($|\\)') {
        return @{ Safe = $false; Reason = "SharedDir is inside C:\Windows: $resolved" }
    }
    if ($env:APPDATA -and $resolved.StartsWith($env:APPDATA, [System.StringComparison]::OrdinalIgnoreCase)) {
        return @{ Safe = $false; Reason = "SharedDir is inside AppData: $resolved" }
    }
    if ($env:LOCALAPPDATA -and $resolved.StartsWith($env:LOCALAPPDATA, [System.StringComparison]::OrdinalIgnoreCase)) {
        return @{ Safe = $false; Reason = "SharedDir is inside LocalAppData: $resolved" }
    }
    if ($env:USERPROFILE) {
        $up = $env:USERPROFILE.TrimEnd('\')
        if ($resolvedTrim -ieq $up) {
            return @{ Safe = $false; Reason = "SharedDir is the user profile root: $resolved" }
        }
    }
    return @{ Safe = $true; Reason = "OK"; Resolved = $resolved }
}

function Scan-OutboxForSensitive {
    param([string]$OutboxDir, [string[]]$FileNames)
    $hits = @()
    $secretPatterns = @(
        @{ Name = "OpenAI-style key";  Pattern = "sk-[A-Za-z0-9]{20,}" },
        @{ Name = "GitHub PAT";        Pattern = "ghp_[A-Za-z0-9]{20,}" },
        @{ Name = "Slack token";       Pattern = "xox[bpoars]-[A-Za-z0-9-]{20,}" },
        @{ Name = "AWS access key";    Pattern = "AKIA[0-9A-Z]{16}" },
        @{ Name = "Google API key";    Pattern = "AIza[A-Za-z0-9_\-]{35}" },
        @{ Name = "Private key block"; Pattern = "-----BEGIN [A-Z ]*PRIVATE KEY-----" },
        @{ Name = "JWT-like";          Pattern = "eyJ[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{20,}" },
        @{ Name = "Slack webhook";     Pattern = "hooks\.slack\.com/services/" },
        @{ Name = "Discord webhook";   Pattern = "discord\.com/api/webhooks/" },
        @{ Name = "Telegram bot URL";  Pattern = "api\.telegram\.org/bot[0-9]+:[A-Za-z0-9_\-]+" },
        @{ Name = "env-style secret";  Pattern = "(?m)^[A-Z][A-Z0-9_]+_(KEY|TOKEN|SECRET|PASSWORD)\s*=\s*\S+" },
        @{ Name = "Cookie header";     Pattern = "(?im)^(set-)?cookie:\s+\S+" }
    )
    $vitalsFieldPattern = '"(hrv|rhr|resting_heart_rate|sleep_hours|spo2)"\s*:\s*[0-9]+(\.[0-9]+)?'
    foreach ($name in $FileNames) {
        $p = Join-Path $OutboxDir $name
        if (-not (Test-Path -LiteralPath $p)) { continue }
        $content = ""
        try { $content = Get-Content -LiteralPath $p -Raw -ErrorAction Stop } catch { continue }
        if (-not $content) { continue }
        foreach ($s in $secretPatterns) {
            if ($content -match $s.Pattern) {
                $hits += @{ File = $name; Hit = $s.Name }
            }
        }
        $vitalsMatches = [regex]::Matches($content, $vitalsFieldPattern, 'IgnoreCase')
        if ($vitalsMatches.Count -ge 3) {
            $hits += @{ File = $name; Hit = "vitals-like JSON export ($($vitalsMatches.Count) matches)" }
        }
    }
    return $hits
}

function Get-Sha256Hex {
    param([string]$Path)
    try {
        return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash
    } catch {
        return ""
    }
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
$readme += "## Shared-folder mirror"
$readme += ""
$readme += "When the daily export is run with ``-SharedDir`` set (default:"
$readme += "``$env:USERPROFILE\Desktop\CHINTU_SHARED_BRIDGE``), Windows also writes the"
$readme += "latest package to that folder. Layout:"
$readme += ""
$readme += '- `CHINTU_BRIDGE_PACKAGE_YYYY-MM-DD_HHMM.zip` -- the dated copy'
$readme += '- `CHINTU_BRIDGE_LATEST.zip` -- always the most recent package'
$readme += '- `LATEST_FLAT/` -- the 7 unzipped bridge files for direct intake'
$readme += '- `MANIFEST.txt` -- timestamp + SHA-256 + sizes'
$readme += ""
$readme += "The iMac can pull from either ``CHINTU_BRIDGE_LATEST.zip`` or"
$readme += "``LATEST_FLAT/``. Do not share this folder publicly. Cloud sync"
$readme += "(iCloud Drive / OneDrive / Google Drive) is optional and"
$readme += "founder-owned; the script never picks a cloud path on its own."
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

# --- Shared folder mirror (optional, opt-in via -SharedDir) ----------------
$sharedDone = $false
$sharedSkipReason = ""
$sharedResolved = ""
$sharedManifestSha = ""
$sharedZipBytes = 0
$sharedFlatFiles = @()
$prunedZips = @()
$scanHits = @()

if ([string]::IsNullOrWhiteSpace($SharedDir)) {
    $sharedSkipReason = "SharedDir was empty; shared mirror disabled."
    Say ""
    Say "Shared mirror: SKIPPED (SharedDir empty)"
} elseif (-not $zipOk) {
    $sharedSkipReason = "ZIP precondition failed; shared mirror skipped."
    Say ""
    Say "Shared mirror: SKIPPED (ZIP not built)"
} else {
    $check = Test-SafeSharedDir -Path $SharedDir -RepoRoot $RepoRoot
    if (-not $check.Safe) {
        $sharedSkipReason = $check.Reason
        Say ""
        Say "STOP (shared mirror): $($check.Reason)"
    } else {
        $sharedResolved = $check.Resolved
        $scanFiles = @()
        foreach ($n in $bridgeFileNames) { $scanFiles += $n }
        $scanFiles += "BRIDGE_TRANSFER_README.md"
        $scanHits = Scan-OutboxForSensitive -OutboxDir $OutDir -FileNames $scanFiles
        if ($scanHits.Count -gt 0) {
            $sharedSkipReason = "Sensitive-content scan flagged outbox; shared mirror aborted."
            Say ""
            Say "STOP (shared mirror): outbox failed defense-in-depth scan."
            foreach ($h in $scanHits) {
                Say ("  - {0} :: {1}" -f $h.File, $h.Hit)
            }
        } else {
            try {
                if (-not (Test-Path -LiteralPath $sharedResolved)) {
                    New-Item -ItemType Directory -Path $sharedResolved -Force | Out-Null
                }
                $flatDir = Join-Path $sharedResolved "LATEST_FLAT"
                if (-not (Test-Path -LiteralPath $flatDir)) {
                    New-Item -ItemType Directory -Path $flatDir -Force | Out-Null
                }

                Copy-Item -LiteralPath $zipPath -Destination $sharedResolved -Force
                $latestZipPath = Join-Path $sharedResolved "CHINTU_BRIDGE_LATEST.zip"
                Copy-Item -LiteralPath $zipPath -Destination $latestZipPath -Force

                $sharedFlatFiles = @()
                foreach ($n in $scanFiles) {
                    $src = Join-Path $OutDir $n
                    if (Test-Path -LiteralPath $src) {
                        Copy-Item -LiteralPath $src -Destination $flatDir -Force
                        $size = (Get-Item -LiteralPath $src).Length
                        $sharedFlatFiles += @{ Name = $n; Size = $size }
                    }
                }

                $copiedZip = Join-Path $sharedResolved (Split-Path $zipPath -Leaf)
                $sharedManifestSha = Get-Sha256Hex -Path $copiedZip
                $sharedZipBytes = (Get-Item -LiteralPath $copiedZip).Length

                $manifest = @()
                $manifest += "Chintu Bridge Manifest"
                $manifest += "Generated:  $stamp"
                $manifest += "ZIP:        $zipName"
                $manifest += "ZIP_SHA256: $sharedManifestSha"
                $manifest += ("ZIP_BYTES:  {0}" -f $sharedZipBytes)
                $manifest += ""
                $manifest += "LATEST_FLAT files:"
                foreach ($f in $sharedFlatFiles) {
                    $manifest += ("  {0,-32} {1,8} bytes" -f $f.Name, $f.Size)
                }
                $manifest += ""
                $manifest += "No health data, no secrets, no network egress. Local-only mirror."
                $manifestPath = Join-Path $sharedResolved "MANIFEST.txt"
                $manifest | Set-Content -LiteralPath $manifestPath -Encoding ASCII

                $protectedNames = @("CHINTU_BRIDGE_LATEST.zip", "MANIFEST.txt")
                $datedZips = Get-ChildItem -LiteralPath $sharedResolved -Filter "CHINTU_BRIDGE_PACKAGE_*.zip" -File -ErrorAction SilentlyContinue
                $datedZips = @($datedZips | Where-Object { $protectedNames -notcontains $_.Name })
                $sortedZips = @($datedZips | Sort-Object LastWriteTime -Descending)
                if ($sortedZips.Count -gt $Keep) {
                    $toPrune = $sortedZips[$Keep..($sortedZips.Count - 1)]
                    foreach ($p in $toPrune) {
                        try {
                            Remove-Item -LiteralPath $p.FullName -Force
                            $prunedZips += $p.Name
                        } catch {}
                    }
                }

                $sharedDone = $true
                Say ""
                Say "Shared mirror: $sharedResolved"
                Say "  Copied:        $zipName"
                Say "  Latest copy:   CHINTU_BRIDGE_LATEST.zip"
                Say "  LATEST_FLAT:   $($sharedFlatFiles.Count) files"
                Say "  MANIFEST.txt:  SHA-256 $sharedManifestSha"
                if ($prunedZips.Count -gt 0) {
                    Say ("  Pruned ZIPs:   {0}" -f ($prunedZips -join ', '))
                } else {
                    Say "  Pruned ZIPs:   (none)"
                }
            } catch {
                $sharedSkipReason = "Shared mirror error: $($_.Exception.Message)"
                Say ""
                Say "STOP (shared mirror): $sharedSkipReason"
            }
        }
    }
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
$report += "## Shared folder mirror"
$report += ""
if ($sharedDone) {
    $report += "- Status: DONE"
    $report += ("- Resolved path: ``{0}``" -f $sharedResolved)
    $report += ("- Copied ZIP: ``{0}``" -f $zipName)
    $report += "- Latest copy: ``CHINTU_BRIDGE_LATEST.zip``"
    $report += ("- LATEST_FLAT files: {0}" -f $sharedFlatFiles.Count)
    $report += ("- MANIFEST.txt SHA-256: ``{0}``" -f $sharedManifestSha)
    $report += ("- ZIP bytes: {0}" -f $sharedZipBytes)
    $report += ("- Keep policy: {0} dated ZIPs" -f $Keep)
    if ($prunedZips.Count -gt 0) {
        $report += ("- Pruned: " + ($prunedZips -join ", "))
    } else {
        $report += "- Pruned: (none)"
    }
} else {
    $report += "- Status: SKIPPED"
    $report += ("- Reason: {0}" -f $sharedSkipReason)
    if ($scanHits.Count -gt 0) {
        $report += ""
        $report += "Sensitive-content scan hits:"
        foreach ($h in $scanHits) {
            $report += ("- ``{0}`` :: {1}" -f $h.File, $h.Hit)
        }
    }
}
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
