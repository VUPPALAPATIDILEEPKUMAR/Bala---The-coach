<#
.SYNOPSIS
    Chintu Stage 32 release gate + push path.

.DESCRIPTION
    Runs the Stage 32 validation set. If everything passes, stages ONLY the
    six Stage 32 files, commits with a fixed message, and pushes.

    Stage 32 adds Telegram poll-once zero-updates diagnostics:
      --token-check, --get-updates-debug, --delete-webhook [--dry-run]
    and updates the founder command map with the Stage 32 diagnostic section.
    Also ships CHINTU_CONNECTOR_RUNTIME_FOUNDATION.md — the safe connector
    architecture doc that defines the trust gate, intent, and execution layers.

    Safety:
      * Never uses git add -A / git add . — staging is an explicit six-file allowlist.
      * Stops before commit if any check fails.
      * Never stages secrets, token files, or generated output.
      * Never prints TELEGRAM_BOT_TOKEN.

.PARAMETER NoPush
    Run the gate and commit but do not push.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\chintu-stage32-release.ps1
    powershell -ExecutionPolicy Bypass -File scripts\chintu-stage32-release.ps1 -NoPush
#>
[CmdletBinding()]
param(
    [string]$RepoRoot = "C:\Users\Chintu\Desktop\test",
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

Write-Host "===== Chintu Stage 32 release gate =====" -ForegroundColor White
Write-Host "Scope: Telegram diagnostics (--token-check, --get-updates-debug, --delete-webhook)" -ForegroundColor Gray
Write-Host ""

& git status --short
Write-Host ""

# Syntax checks
Step "node --check scripts/chintu-telegram-runner.js" { & node --check scripts\chintu-telegram-runner.js }

# Stage 32 unit tests (builder functions + dispatch)
Step "telegram runner test (Stage 32 units)"   { & node scripts\chintu-telegram-runner.test.js }

# Safety / integrity tests that must always pass
Step "no-network egress test"                  { & node scripts\chintu-no-network-egress.test.js }
Step "command map integrity test"              { & node scripts\chintu-command-map.test.js }
Step "telegram status plan test"               { & node scripts\chintu-telegram-status-plan.test.js }
Step "dry-run adapter test"                    { & node scripts\chintu-dry-run-adapter.test.js }
Step "medical claims test"                     { & node scripts\chintu-medical-claims.test.js }

# Release guard
Step "release guard"                           { & powershell -ExecutionPolicy Bypass -File scripts\chintu-release-guard.ps1 }

if ($failed) {
    Write-Host "`nRELEASE BLOCKED — one or more checks failed. Nothing staged, nothing pushed." -ForegroundColor Red
    exit 1
}

# Reset index to HEAD (working tree untouched).
Write-Host "`nResetting index to HEAD (working tree untouched) ..." -ForegroundColor Cyan
& git reset -q

# Explicit Stage 32 allowlist — nothing else.
# .gitignore: telegram_connector_audit.jsonl safety gap closed.
# CHINTU_CONNECTOR_RUNTIME_FOUNDATION.md: connector architecture doc (no secrets).
$stage32 = @(
    "scripts\chintu-telegram-runner.js",
    "scripts\chintu-telegram-runner.test.js",
    "scripts\chintu-stage32-release.ps1",
    "CHINTU_FOUNDER_COMMAND_MAP.md",
    ".gitignore",
    "CHINTU_CONNECTOR_RUNTIME_FOUNDATION.md"
)

$toStage = @()
foreach ($f in $stage32) {
    $fullPath = Join-Path $RepoRoot $f
    if (Test-Path -LiteralPath $fullPath) {
        $toStage += $f
    } else {
        Write-Host "  WARNING: $f not found, skipping." -ForegroundColor Yellow
    }
}

if ($toStage.Count -eq 0) {
    Write-Host "`nNothing to stage — all Stage 32 files missing? Aborting." -ForegroundColor Red
    exit 1
}

Write-Host "`nStaging exactly these files (Stage 32 allowlist):" -ForegroundColor White
$toStage | ForEach-Object { Write-Host "  + $_" -ForegroundColor Gray }
& git add -- $toStage

Write-Host "`nStaged diff stat:" -ForegroundColor White
& git diff --cached --stat

& git commit -m "feat: add Telegram poll-once diagnostics (Stage 32)"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Commit failed — nothing to commit, or git error." -ForegroundColor Yellow
    exit 1
}
$hash = (& git rev-parse --short HEAD)
Write-Host "Committed: $hash" -ForegroundColor Green

if ($NoPush) {
    Write-Host "NoPush set — stopping before push." -ForegroundColor Yellow
    exit 0
}

Write-Host "`nPushing to origin ..." -ForegroundColor Cyan
& git push
if ($LASTEXITCODE -ne 0) {
    Write-Host "Push failed — check remote/auth." -ForegroundColor Red
    exit 1
}

Write-Host "`n===== Stage 32 release complete =====" -ForegroundColor Green
Write-Host "Committed and pushed: feat: add Telegram poll-once diagnostics (Stage 32)" -ForegroundColor Gree