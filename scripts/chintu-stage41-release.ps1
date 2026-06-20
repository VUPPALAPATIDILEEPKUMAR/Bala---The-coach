<#
.SYNOPSIS
    Chintu Stage 41 release gate + push path.

.DESCRIPTION
    Runs the Stage 41 validation set. If every gate passes, it stages only the
    explicit Stage 41 allowlist, blocks queue/audit/tmp artifacts, commits with
    the fixed Stage 41 message, and optionally pushes to origin/main.

    Safety:
      * Never uses `git add -A` / `git add .`.
      * Never resets unrelated staged work.
      * Stops before commit if validation fails.
      * Stops before commit if unexpected staged files already exist.
      * Never stages queue files, audit logs, temp fixtures, or recovery notes.
      * Never prints secrets.

.PARAMETER NoPush
    Run the gate and commit, but stop before push.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\chintu-stage41-release.ps1
.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\chintu-stage41-release.ps1 -NoPush
#>
[CmdletBinding()]
param(
    [string]$RepoRoot = "C:\Users\Chintu\Desktop\test",
    [switch]$NoPush
)

$ErrorActionPreference = "Continue"
if (-not (Test-Path -LiteralPath $RepoRoot)) {
    Write-Host "FAIL: repo root not found" -ForegroundColor Red
    exit 2
}
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

function Normalize-Path([string]$path) {
    return ($path -replace '\\', '/')
}

$allowlist = @(
    ".gitignore",
    "CHINTU_ALLEGRO.html",
    "CHINTU_CURRENT_RUNTIME_STATE.md",
    "CHINTU_FOUNDER_COMMAND_MAP.md",
    "CHINTU_LOCAL_TOOLS_AND_HOOKS.md",
    "CHINTU_STAGE41_FOUNDER_DEMO.md",
    "scripts/chintu-allegro-labels.test.js",
    "scripts/chintu-approve.js",
    "scripts/chintu-command-map-integrity.test.js",
    "scripts/chintu-local-bridge.js",
    "scripts/chintu-local-bridge.test.js",
    "scripts/chintu-stage41-release.ps1"
)
$allowset = @{}
foreach ($item in $allowlist) {
    $allowset[(Normalize-Path $item)] = $true
}

$blockedExact = @(
    "CHINTU_STAGE41_GIT_RECOVERY_REPORT.md",
    "CHINTU_OUTBOX/pending_approvals.jsonl",
    "release-guard-report.md",
    "last-validation.txt"
)
$blockedRegex = @(
    '^CHINTU_OUTBOX/',
    '^scripts/fixtures/_tmp_.*\.json$'
)

Write-Host "===== Chintu Stage 41 release gate =====" -ForegroundColor White
Write-Host "Scope: Runtime Reality panel + /api/runtime-status + dry-run approval repair" -ForegroundColor Gray
Write-Host ""

& git status --short
Write-Host ""

Step "node --check scripts/chintu-local-bridge.js" { & node --check scripts\chintu-local-bridge.js }
Step "node scripts/chintu-local-bridge.test.js" { & node scripts\chintu-local-bridge.test.js }
Step "node scripts/chintu-allegro-labels.test.js" { & node scripts\chintu-allegro-labels.test.js }
Step "node scripts/chintu-approve.test.js" { & node scripts\chintu-approve.test.js }
Step "node scripts/chintu-command-map-integrity.test.js" { & node scripts\chintu-command-map-integrity.test.js }
Step "node scripts/chintu-no-network-egress.test.js" { & node scripts\chintu-no-network-egress.test.js }
Step "node scripts/chintu-medical-claims.test.js" { & node scripts\chintu-medical-claims.test.js }
Step "node scripts/chintu-doc-link-integrity.test.js" { & node scripts\chintu-doc-link-integrity.test.js }
Step "release guard" { & powershell -ExecutionPolicy Bypass -File scripts\chintu-release-guard.ps1 }

if ($failed) {
    Write-Host "`nRELEASE BLOCKED - one or more checks failed. Nothing staged, nothing pushed." -ForegroundColor Red
    exit 1
}

$preStaged = @(& git diff --cached --name-only | Where-Object { $_.Trim() -ne "" } | ForEach-Object { Normalize-Path $_ })
$unexpectedPreStaged = @($preStaged | Where-Object { -not $allowset.ContainsKey($_) })
if ($unexpectedPreStaged.Count -gt 0) {
    Write-Host "`nRELEASE BLOCKED - unexpected staged files already exist:" -ForegroundColor Red
    $unexpectedPreStaged | ForEach-Object { Write-Host "  ! $_" -ForegroundColor Yellow }
    Write-Host "Resolve them manually first; this script will not overwrite unrelated staged work." -ForegroundColor Yellow
    exit 1
}

if ($preStaged.Count -gt 0) {
    Write-Host "`nClearing pre-staged Stage 41 files from the index (working tree untouched) ..." -ForegroundColor Cyan
    & git reset -q HEAD -- $preStaged
    if ($LASTEXITCODE -ne 0) {
        Write-Host "FAIL: could not reset allowlisted staged files." -ForegroundColor Red
        exit 1
    }
}

$existingAllowlist = @()
foreach ($item in $allowlist) {
    if (Test-Path -LiteralPath (Join-Path $RepoRoot $item)) {
        $existingAllowlist += $item
    } else {
        Write-Host "  WARN: allowlist file missing, skipping: $item" -ForegroundColor Yellow
    }
}

if ($existingAllowlist.Count -eq 0) {
    Write-Host "`nNothing to stage from the Stage 41 allowlist." -ForegroundColor Red
    exit 1
}

Write-Host "`nStaging exactly these Stage 41 files:" -ForegroundColor White
$existingAllowlist | ForEach-Object { Write-Host "  + $_" -ForegroundColor Gray }
& git add -- $existingAllowlist
if ($LASTEXITCODE -ne 0) {
    Write-Host "FAIL: git add failed for the Stage 41 allowlist." -ForegroundColor Red
    exit 1
}

$staged = @(& git diff --cached --name-only | Where-Object { $_.Trim() -ne "" } | ForEach-Object { Normalize-Path $_ })
if ($staged.Count -eq 0) {
    Write-Host "`nNothing staged after allowlist add. Aborting." -ForegroundColor Yellow
    exit 1
}

$outsideAllowlist = @($staged | Where-Object { -not $allowset.ContainsKey($_) })
if ($outsideAllowlist.Count -gt 0) {
    Write-Host "`nRELEASE BLOCKED - staged files escaped the Stage 41 allowlist:" -ForegroundColor Red
    $outsideAllowlist | ForEach-Object { Write-Host "  ! $_" -ForegroundColor Yellow }
    exit 1
}

$blocked = New-Object System.Collections.Generic.List[string]
foreach ($item in $staged) {
    if ($blockedExact -contains $item) {
        $blocked.Add($item) | Out-Null
        continue
    }
    foreach ($pattern in $blockedRegex) {
        if ($item -match $pattern) {
            $blocked.Add($item) | Out-Null
            break
        }
    }
}
if ($blocked.Count -gt 0) {
    Write-Host "`nRELEASE BLOCKED - blocked artifacts are staged:" -ForegroundColor Red
    $blocked | Sort-Object -Unique | ForEach-Object { Write-Host "  ! $_" -ForegroundColor Yellow }
    exit 1
}

Write-Host "`nStaged diff stat:" -ForegroundColor White
& git diff --cached --stat

& git commit -m "feat: add Chintu runtime reality console"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Commit failed - nothing to commit, or git error." -ForegroundColor Yellow
    exit 1
}

$hash = (& git rev-parse --short HEAD).Trim()
Write-Host "Committed: $hash" -ForegroundColor Green

if ($NoPush) {
    Write-Host "NoPush set - stopping before push." -ForegroundColor Yellow
    exit 0
}

Write-Host "`nPushing to origin/main ..." -ForegroundColor Cyan
& git push origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "Push failed - run 'git push origin main' manually." -ForegroundColor Red
    exit 1
}

Write-Host "`n===== Stage 41 release complete =====" -ForegroundColor Green
Write-Host "Committed and pushed: feat: add Chintu runtime reality console" -ForegroundColor Green
exit 0
