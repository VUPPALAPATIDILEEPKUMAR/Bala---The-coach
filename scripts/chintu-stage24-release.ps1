<#
.SYNOPSIS
    Chintu Stage 24 release gate + push path.

.DESCRIPTION
    Runs the full Stage 24 validation set. If everything passes, stages ONLY the
    intentional Stage 24 files, commits with a fixed message, and pushes.

    Safety:
      * Never uses `git add -A` / `git add .` - staging is an explicit allowlist.
      * Stops before commit if any check fails.
      * Pushes only after the release guard reports PASS.
      * Never stages secrets, token files, or generated runner/console output.

.PARAMETER IncludeBalaFiles
    Optional extra paths to stage as intentional BALA fixes. Only changed files
    are staged.

.PARAMETER NoPush
    Run the gate and commit but do not push.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\chintu-stage24-release.ps1
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

Write-Host "===== Chintu Stage 24 release gate =====" -ForegroundColor White

& git status --short
Write-Host ""

Step "node --check app.js"                               { & node --check app.js }
Step "node --check sw.js"                                { & node --check sw.js }
Step "node --check scripts/chintu-local-bridge.js"       { & node --check scripts\chintu-local-bridge.js }
Step "node --check scripts/chintu-brain-router.js"       { & node --check scripts\chintu-brain-router.js }
Step "node --check scripts/chintu-local-ai-provider.js"  { & node --check scripts\chintu-local-ai-provider.js }
Step "node --check scripts/chintu-agent-orchestrator.js" { & node --check scripts\chintu-agent-orchestrator.js }
Step "brain router test"                                 { & node scripts\chintu-brain-router.test.js }
Step "local bridge test"                                 { & node scripts\chintu-local-bridge.test.js }
Step "local ai provider test"                            { & node scripts\chintu-local-ai-provider.test.js }
Step "agent orchestrator test"                           { & node scripts\chintu-agent-orchestrator.test.js }
Step "no-network egress test"                            { & node scripts\chintu-no-network-egress.test.js }
Step "medical claims test"                               { & node scripts\chintu-medical-claims.test.js }
Step "doc link integrity test"                           { & node scripts\chintu-doc-link-integrity.test.js }
Step "release guard"                                     { & powershell -ExecutionPolicy Bypass -File scripts\chintu-release-guard.ps1 }

if ($failed) {
    Write-Host "`nRELEASE BLOCKED - one or more checks failed. Nothing staged, nothing pushed." -ForegroundColor Red
    exit 1
}

# Clean the index first without touching the working tree.
Write-Host "`nResetting index to HEAD (working tree untouched) ..." -ForegroundColor Cyan
& git reset -q

# Explicit Stage 24 allowlist.
$stage24 = @(
    "scripts\chintu-brain-router.js",
    "scripts\chintu-brain-router.test.js",
    "scripts\chintu-local-ai-provider.js",
    "scripts\chintu-local-ai-provider.test.js",
    "scripts\chintu-agent-orchestrator.js",
    "scripts\chintu-agent-orchestrator.test.js",
    "scripts\chintu-local-bridge.js",
    "scripts\chintu-local-bridge.test.js",
    "scripts\chintu-allegro-start.ps1",
    "scripts\chintu-stage23-release.ps1",
    "scripts\chintu-stage24-release.ps1",
    "CHINTU_FOUNDER_COMMAND_MAP.md",
    "CHINTU_BRAIN_RUNTIME.md",
    "CHINTU_AGENT_ORCHESTRATOR.md",
    "CHINTU_PLUGIN_REGISTRY.md",
    "CHINTU_MCP_SECURITY_GATE.md",
    "CHINTU_PHONE_MODE_PLAN.md",
    "CHINTU_ALLEGRO.html",
    "index.html",
    "app.js"
)
$toStage = @()
foreach ($f in ($stage24 + $IncludeBalaFiles)) {
    if (Test-Path -LiteralPath (Join-Path $RepoRoot $f)) { $toStage += $f }
}

Write-Host "`nStaging exactly these files:" -ForegroundColor White
$toStage | ForEach-Object { Write-Host "  + $_" -ForegroundColor Gray }
& git add -- $toStage

Write-Host "`nStaged status:" -ForegroundColor White
& git status --short

& git commit -m "feat: add Chintu brain router and live action sequences"
if ($LASTEXITCODE -ne 0) { Write-Host "Commit failed (nothing to commit?)." -ForegroundColor Yellow; exit 1 }
$hash = (& git rev-parse --short HEAD)
Write-Host "Committed: $hash" -ForegroundColor Green

if ($NoPush) { Write-Host "NoPush set - stopping before push." -ForegroundColor Yellow; exit 0 }

Write-Host "`nPushing to origin ..." -ForegroundColor Cyan
& git push
if ($LASTEXITCODE -ne 0) { Write-Host "Push failed - check remote/auth." -ForegroundColor Red; exit 1 }
Write-Host "Pushed. BALA GitHub Pages will rebuild shortly." -ForegroundColor Green
exit 0
