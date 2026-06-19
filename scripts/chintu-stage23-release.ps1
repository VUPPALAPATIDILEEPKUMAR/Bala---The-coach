<#
.SYNOPSIS
    Chintu Stage 23 release gate + push path.

.DESCRIPTION
    Runs the full validation set. If everything passes, stages ONLY the
    intentional Stage 23 files (plus any explicitly-listed BALA app fixes),
    commits with a fixed message, and pushes to origin.

    Safety:
      * Never uses `git add -A` / `git add .` — staging is an explicit allowlist.
      * Stops before commit if any check fails.
      * Pushes only after the release guard reports PASS.
      * Never stages secrets, token files, generated runner/console output, or
        the messy pre-existing index noise.

.PARAMETER IncludeBalaFiles
    Optional extra paths (e.g. app.js, index.html) to stage as intentional BALA
    fixes. Only files that actually changed are staged.

.PARAMETER NoPush
    Run the gate and commit but do not push.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\chintu-stage23-release.ps1
.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\chintu-stage23-release.ps1 -IncludeBalaFiles app.js,index.html,styles.css
#>
[CmdletBinding()]
param(
    [string]$RepoRoot = "C:\Users\Chintu\Desktop\test",
    [string[]]$IncludeBalaFiles = @(),
    [switch]$NoPush
)

$ErrorActionPreference = "Continue"
if (-not (Test-Path -LiteralPath $RepoRoot)) { Write-Host "FAIL: repo root not found" -ForegroundColor Red; exit 2 }
Set-Location -LiteralPath $RepoRoot

$failed = $false
function Step([string]$label, [scriptblock]$cmd) {
    Write-Host "`n>> $label" -ForegroundColor Cyan
    & $cmd
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   FAIL ($label) exit $LASTEXITCODE" -ForegroundColor Red
        $script:failed = $true
    } else {
        Write-Host "   PASS ($label)" -ForegroundColor Green
    }
}

Write-Host "===== Chintu Stage 23 release gate =====" -ForegroundColor White

& git status --short
Write-Host ""

Step "node --check app.js"                          { & node --check app.js }
Step "node --check sw.js"                            { & node --check sw.js }
Step "node --check scripts/chintu-local-bridge.js"  { & node --check scripts\chintu-local-bridge.js }
Step "local bridge test"                            { & node scripts\chintu-local-bridge.test.js }
Step "no-network egress test"                       { & node scripts\chintu-no-network-egress.test.js }
Step "medical claims test"                          { & node scripts\chintu-medical-claims.test.js }
Step "doc link integrity test"                      { & node scripts\chintu-doc-link-integrity.test.js }
Step "release guard"                                { & powershell -ExecutionPolicy Bypass -File scripts\chintu-release-guard.ps1 }

if ($failed) {
    Write-Host "`nRELEASE BLOCKED — one or more checks failed. Nothing staged, nothing pushed." -ForegroundColor Red
    exit 1
}

# --- Clean the index first --------------------------------------------------
# The working tree may carry pre-existing staged deletions (e.g. an earlier
# `git rm --cached`). Reset the index to HEAD so a commit cannot accidentally
# delete files. This NEVER touches the working tree — files on disk are kept.
Write-Host "`nResetting index to HEAD (working tree untouched) ..." -ForegroundColor Cyan
& git reset -q

# --- Explicit Stage 23 allowlist --------------------------------------------
$stage23 = @(
    "scripts\chintu-local-bridge.js",
    "scripts\chintu-local-bridge.test.js",
    "scripts\chintu-allegro-start.ps1",
    "scripts\chintu-stage23-release.ps1",
    "scripts\chintu-no-network-egress.test.js",
    "CHINTU_LOCAL_BRIDGE_README.md",
    "CHINTU_ALLEGRO_START_HERE.md",
    "CHINTU_REAL_CONNECTOR_MCP_SCAN.md",
    "CHINTU_ALLEGRO.html",
    "index.html",
    "styles.css",
    "BALA_REPORT_METRIC_EXPLAINER_PLAN.md",
    ".gitignore"
)
$toStage = @()
foreach ($f in ($stage23 + $IncludeBalaFiles)) {
    if (Test-Path -LiteralPath (Join-Path $RepoRoot $f)) { $toStage += $f }
}

Write-Host "`nStaging exactly these files:" -ForegroundColor White
$toStage | ForEach-Object { Write-Host "  + $_" -ForegroundColor Gray }
& git add -- $toStage

Write-Host "`nStaged status:" -ForegroundColor White
& git status --short

& git commit -m "feat: add Chintu live local bridge runtime"
if ($LASTEXITCODE -ne 0) { Write-Host "Commit failed (nothing to commit?)." -ForegroundColor Yellow; exit 1 }
$hash = (& git rev-parse --short HEAD)
Write-Host "Committed: $hash" -ForegroundColor Green

if ($NoPush) { Write-Host "NoPush set — stopping before push." -ForegroundColor Yellow; exit 0 }

Write-Host "`nPushing to origin ..." -ForegroundColor Cyan
& git push
if ($LASTEXITCODE -ne 0) { Write-Host "Push failed — check remote/auth." -ForegroundColor Red; exit 1 }
Write-Host "Pushed. BALA GitHub Pages will rebuild shortly." -ForegroundColor Green
exit 0
