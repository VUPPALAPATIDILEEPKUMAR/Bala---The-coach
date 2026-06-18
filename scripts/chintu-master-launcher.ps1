<#
.SYNOPSIS
    Chintu OS master launcher. Runs the safe validation + reporting sweep
    in a deterministic order and stops on the first FAIL.

.DESCRIPTION
    Local-first, read-only orchestration of existing Chintu scripts. Does
    not push, install, edit BALA app files, or call the network. It only
    invokes other Chintu scripts and Node syntax checks already approved
    in the founder command map.

    Sequence:
      1. git status snapshot
      2. node --check on app.js, sw.js, config.js
      3. node snapshot consistency test
      4. node agent control shell test (if present)
      5. chintu-validate.ps1 (PASS/WARN/FAIL gate)
      6. chintu-release-guard.ps1
      7. chintu-os-health-check.ps1
      8. chintu-alive-briefing.ps1
      9. chintu-control-room-index.ps1
     10. chintu-agent-dashboard.ps1

    Any step exiting non-zero halts the launcher and prints the failing
    step. No external network or side effects beyond the scripts above.

.PARAMETER RepoRoot
    Repo root. Defaults to C:\Users\Chintu\Desktop\test.

.PARAMETER SkipReports
    Skip dashboard / index regeneration (steps 9 and 10). Use this when
    you only want the validation gate, not the static HTML refresh.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\chintu-master-launcher.ps1
#>
[CmdletBinding()]
param(
    [string]$RepoRoot = "",
    [switch]$SkipReports
)

$ErrorActionPreference = "Continue"

if (-not $RepoRoot) {
    $RepoRoot = Split-Path -Parent $PSScriptRoot
}
if (-not (Test-Path -LiteralPath $RepoRoot -PathType Container)) {
    Write-Host "FAIL: repo root not found: $RepoRoot" -ForegroundColor Red
    exit 2
}
$RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
Set-Location -LiteralPath $RepoRoot

$stamp = Get-Date -Format "yyyy-MM-dd HH:mm"
Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Chintu OS master launcher" -ForegroundColor Cyan
Write-Host " $stamp | $RepoRoot" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$steps = New-Object System.Collections.Generic.List[object]

function Add-Step {
    param([string]$Name, [scriptblock]$Action, [bool]$FailIsFatal = $true)
    $steps.Add([pscustomobject]@{
        Name        = $Name
        Action      = $Action
        FailIsFatal = $FailIsFatal
    }) | Out-Null
}

Add-Step "git status snapshot" {
    & git status --short | Out-Host
    return 0
} $false

Add-Step "node --check app.js" {
    & node --check "app.js" | Out-Host
    return $LASTEXITCODE
} $true

Add-Step "node --check sw.js" {
    & node --check "sw.js" | Out-Host
    return $LASTEXITCODE
} $true

Add-Step "node --check config.js" {
    if (Test-Path -LiteralPath "config.js") {
        & node --check "config.js" | Out-Host
        return $LASTEXITCODE
    }
    Write-Host "  (config.js not present, skipping)"
    return 0
} $true

Add-Step "snapshot consistency test" {
    & node "scripts/chintu-snapshot-consistency.test.js" | Out-Host
    return $LASTEXITCODE
} $true

Add-Step "command map integrity test" {
    if (Test-Path -LiteralPath "scripts/chintu-command-map.test.js") {
        & node "scripts/chintu-command-map.test.js" | Out-Host
        return $LASTEXITCODE
    }
    Write-Host "  (command map test not present, skipping)"
    return 0
} $true

Add-Step "memory vault integrity test" {
    if (Test-Path -LiteralPath "scripts/chintu-memory-vault.test.js") {
        & node "scripts/chintu-memory-vault.test.js" | Out-Host
        return $LASTEXITCODE
    }
    Write-Host "  (memory vault test not present, skipping)"
    return 0
} $true

Add-Step "agent control shell test" {
    if (Test-Path -LiteralPath "scripts/chintu-agent-control-shell.test.js") {
        & node "scripts/chintu-agent-control-shell.test.js" | Out-Host
        return $LASTEXITCODE
    }
    Write-Host "  (agent control shell test not present, skipping)"
    return 0
} $true

Add-Step "no network egress test" {
    if (Test-Path -LiteralPath "scripts/chintu-no-network-egress.test.js") {
        & node "scripts/chintu-no-network-egress.test.js" | Out-Host
        return $LASTEXITCODE
    }
    Write-Host "  (no-network-egress test not present, skipping)"
    return 0
} $true

Add-Step "medical claims test" {
    if (Test-Path -LiteralPath "scripts/chintu-medical-claims.test.js") {
        & node "scripts/chintu-medical-claims.test.js" | Out-Host
        return $LASTEXITCODE
    }
    Write-Host "  (medical-claims test not present, skipping)"
    return 0
} $true

Add-Step "safety boundary test" {
    if (Test-Path -LiteralPath "scripts/chintu-safety-boundary.test.js") {
        & node "scripts/chintu-safety-boundary.test.js" | Out-Host
        return $LASTEXITCODE
    }
    Write-Host "  (safety-boundary test not present, skipping)"
    return 0
} $true

Add-Step "chintu-validate" {
    & powershell -ExecutionPolicy Bypass -File "scripts/chintu-validate.ps1" -NoFile | Out-Host
    return $LASTEXITCODE
} $true

Add-Step "chintu-release-guard" {
    & powershell -ExecutionPolicy Bypass -File "scripts/chintu-release-guard.ps1" | Out-Host
    return $LASTEXITCODE
} $true

Add-Step "chintu-os-health-check" {
    & powershell -ExecutionPolicy Bypass -File "scripts/chintu-os-health-check.ps1" | Out-Host
    return $LASTEXITCODE
} $true

Add-Step "chintu-alive-briefing" {
    & powershell -ExecutionPolicy Bypass -File "scripts/chintu-alive-briefing.ps1" | Out-Host
    return $LASTEXITCODE
} $false

if (-not $SkipReports) {
    Add-Step "chintu-control-room-index" {
        & powershell -ExecutionPolicy Bypass -File "scripts/chintu-control-room-index.ps1" | Out-Host
        return $LASTEXITCODE
    } $false

    Add-Step "chintu-agent-dashboard" {
        & powershell -ExecutionPolicy Bypass -File "scripts/chintu-agent-dashboard.ps1" | Out-Host
        return $LASTEXITCODE
    } $false
}

$results = New-Object System.Collections.Generic.List[object]
$halted = $false
$haltStep = ""
$idx = 0

foreach ($s in $steps) {
    $idx++
    Write-Host ""
    Write-Host "[$idx/$($steps.Count)] $($s.Name)" -ForegroundColor Yellow
    Write-Host "----------------------------------------------------------"
    $code = 0
    try {
        $raw = & $s.Action
        if ($raw -is [array]) { $raw = $raw[-1] }
        if ($null -eq $raw) { $code = 0 } else { $code = [int]$raw }
    } catch {
        Write-Host "  exception: $($_.Exception.Message)" -ForegroundColor Red
        $code = 99
    }
    $verdict = if ($code -eq 0) { "OK" } else { "FAIL($code)" }
    $color = if ($code -eq 0) { "Green" } else { "Red" }
    Write-Host "  -> $verdict" -ForegroundColor $color
    $results.Add([pscustomobject]@{ Name = $s.Name; Code = $code; Fatal = $s.FailIsFatal }) | Out-Null
    if ($code -ne 0 -and $s.FailIsFatal) {
        $halted = $true
        $haltStep = $s.Name
        break
    }
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Summary" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
foreach ($r in $results) {
    $tag = if ($r.Code -eq 0) { "OK     " } elseif ($r.Fatal) { "FAIL   " } else { "WARN   " }
    Write-Host (" {0} {1}" -f $tag, $r.Name)
}

if ($halted) {
    Write-Host ""
    Write-Host "HALTED at: $haltStep" -ForegroundColor Red
    Write-Host "NEXT: fix that step before re-running the launcher." -ForegroundColor Red
    exit 1
}

$fatalFails = @($results | Where-Object { $_.Code -ne 0 -and $_.Fatal })
if ($fatalFails.Count -gt 0) {
    Write-Host ""
    Write-Host "RESULT: FAIL ($($fatalFails.Count) fatal)" -ForegroundColor Red
    exit 1
}

$softFails = @($results | Where-Object { $_.Code -ne 0 -and -not $_.Fatal })
if ($softFails.Count -gt 0) {
    Write-Host ""
    Write-Host "RESULT: PASS with $($softFails.Count) soft warning(s)" -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "RESULT: PASS (all $($results.Count) steps clean)" -ForegroundColor Green
exit 0
