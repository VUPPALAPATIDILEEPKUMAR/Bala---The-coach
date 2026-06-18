<#
.SYNOPSIS
    Chintu next-action engine.

.DESCRIPTION
    Local-only decision engine for Chintu OS. It inspects the repo, validation
    state, shared bridge readiness, and current blocker notes, then prints one
    exact next action. It never edits app files, pushes, installs, or makes any
    network call.

.PARAMETER RepoRoot
    Repo root. Defaults to C:\Users\Chintu\Desktop\test.

.PARAMETER SharedDir
    Shared bridge folder. Defaults to:
    C:\Users\<user>\Desktop\CHINTU_SHARED_BRIDGE

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\chintu-next-action.ps1
#>
[CmdletBinding()]
param(
    [string]$RepoRoot = "C:\Users\Chintu\Desktop\test",
    [string]$SharedDir = "$env:USERPROFILE\Desktop\CHINTU_SHARED_BRIDGE"
)

$ErrorActionPreference = "Continue"

function Say {
    param([string]$Text)
    Write-Host $Text
}

function Run-LocalScript {
    param(
        [string]$RelPath,
        [string]$Label
    )
    $full = Join-Path $RepoRoot $RelPath
    if (-not (Test-Path -LiteralPath $full)) {
        return [pscustomobject]@{
            Label  = $Label
            Status = "MISSING"
            Exit   = -1
            Output = @("(missing: $RelPath)")
        }
    }

    $out = @()
    $exitCode = -1
    $status = "ERROR"
    try {
        $out = & powershell -NoProfile -ExecutionPolicy Bypass -File $full 2>&1
        $exitCode = $LASTEXITCODE
        if ($null -eq $exitCode) { $exitCode = 0 }
        if ($exitCode -eq 0) { $status = "OK" } else { $status = "FAIL" }
    } catch {
        $out = @("(error running ${Label}: $($_.Exception.Message))")
        $status = "ERROR"
    }

    $outText = @($out | ForEach-Object { [string]$_ })
    return [pscustomobject]@{
        Label  = $Label
        Status = $status
        Exit   = $exitCode
        Output = $outText
    }
}

function Test-ExpectedFlatFiles {
    param([string]$FlatDir)
    $expected = @(
        "latest_status.md",
        "latest_bala_validation.md",
        "latest_git_status.md",
        "latest_codex_handoff.md",
        "latest_openclaw_report.md",
        "latest_next_actions.md",
        "BRIDGE_TRANSFER_README.md"
    )
    $missing = @()
    foreach ($name in $expected) {
        if (-not (Test-Path -LiteralPath (Join-Path $FlatDir $name))) {
            $missing += $name
        }
    }
    return [pscustomobject]@{
        Missing = $missing
        Ok      = ($missing.Count -eq 0)
    }
}

function Get-SharedBridgeState {
    param([string]$Path)

    $exists = Test-Path -LiteralPath $Path
    $zipPath = Join-Path $Path "CHINTU_BRIDGE_LATEST.zip"
    $manifestPath = Join-Path $Path "MANIFEST.txt"
    $flatDir = Join-Path $Path "LATEST_FLAT"
    $zipExists = $exists -and (Test-Path -LiteralPath $zipPath)
    $manifestExists = $exists -and (Test-Path -LiteralPath $manifestPath)
    $flatExists = $exists -and (Test-Path -LiteralPath $flatDir)
    $flatCheck = if ($flatExists) {
        Test-ExpectedFlatFiles -FlatDir $flatDir
    } else {
        [pscustomobject]@{ Missing = @(); Ok = $false }
    }

    return [pscustomobject]@{
        Exists         = $exists
        ZipExists      = $zipExists
        ManifestExists = $manifestExists
        FlatExists     = $flatExists
        FlatOk         = $flatCheck.Ok
        Ready          = ($exists -and $zipExists -and $manifestExists -and $flatExists -and $flatCheck.Ok)
    }
}

function Get-BlockerFlags {
    param([string]$Path)

    $raw = ""
    if (Test-Path -LiteralPath $Path) {
        try {
            $raw = Get-Content -LiteralPath $Path -Raw
        } catch {
            $raw = ""
        }
    }

    return [pscustomobject]@{
        Option12Pending   = ($raw -match "(?i)iMac Option 12.*must be tested")
        BridgeLoopPending = ($raw -match "(?i)smooth-loop")
    }
}

if (-not (Test-Path -LiteralPath $RepoRoot)) {
    Say "STOP: repo root not found: $RepoRoot"
    exit 2
}
Set-Location -LiteralPath $RepoRoot

$stamp = Get-Date -Format "yyyy-MM-dd HH:mm"
$branch = (& git rev-parse --abbrev-ref HEAD 2>$null)
if (-not $branch) { $branch = "(unknown)" }
$latestCommit = (& git log --oneline -1 2>$null)
if (-not $latestCommit) { $latestCommit = "(unknown)" }

$statusShort = @(& git status --short 2>$null | Where-Object { $_.Trim() -ne "" })
$treeClean = ($statusShort.Count -eq 0)
$unpushedCount = 0
try {
    $countText = (& git rev-list --count origin/main..HEAD 2>$null)
    if ($countText) { $unpushedCount = [int]$countText }
} catch {
    $unpushedCount = @(& git log --oneline origin/main..HEAD 2>$null | Where-Object { $_.Trim() -ne "" }).Count
}

$validator = Run-LocalScript -RelPath "scripts\chintu-validate.ps1" -Label "chintu-validate"
$shared = Get-SharedBridgeState -Path $SharedDir
$blockers = Get-BlockerFlags -Path (Join-Path $RepoRoot "CHINTU_MEMORY_VAULT\BLOCKERS.md")

$action = ""
if (-not $treeClean) {
    $action = "STOP - review the working tree before continuing."
} elseif ($validator.Exit -ne 0) {
    $action = "STOP - fix validation failure before continuing."
} elseif ($unpushedCount -gt 0) {
    $action = "Review the local commit(s) and push if safe."
} elseif (-not $shared.Ready) {
    $action = "Run Windows daily export to refresh the shared bridge."
} elseif ($blockers.Option12Pending) {
    $action = "Install and test iMac Option 12 before assuming the bridge is smooth."
} elseif ($blockers.BridgeLoopPending) {
    $action = "Continue bridge hardening until the shared loop is smooth."
} else {
    $action = "Stage 9 is stable. Next candidate: BALA Voice Coach enhancement. Do not edit BALA yet."
}

Say "Chintu Next Action Engine - $stamp"
Say "Branch: $branch"
Say "Latest commit: $latestCommit"
Say ("Repo clean: {0}" -f $(if ($treeClean) { "YES" } else { "NO" }))
Say ("Validation runner: {0} (exit {1})" -f $validator.Status, $validator.Exit)
Say ("Unpushed commits: {0}" -f $unpushedCount)
Say ("Shared bridge ready: {0}" -f $(if ($shared.Ready) { "YES" } else { "NO" }))
Say ("iMac Option 12 test pending: {0}" -f $(if ($blockers.Option12Pending) { "YES" } else { "NO" }))
Say ("Shared smooth-loop pending: {0}" -f $(if ($blockers.BridgeLoopPending) { "YES" } else { "NO" }))
Say "NEXT ACTION: $action"
exit 0
