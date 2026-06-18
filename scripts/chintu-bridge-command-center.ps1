<#
.SYNOPSIS
    Chintu Bridge Command Center.

.DESCRIPTION
    A PowerShell 5.1 friendly, ASCII-safe, local-only bridge dashboard. It
    summarizes repo state, validation state, app safety, shared bridge
    readiness, iMac intake readiness, parked systems, and the exact next
    operator action. It never edits app files, pushes, installs, or makes
    network calls.

    The only intentional write is:
      <RepoRoot>\chintu-bridge-command-center-report.md

.PARAMETER RepoRoot
    Repo root. Defaults to C:\Users\Chintu\Desktop\test.

.PARAMETER SharedDir
    Shared bridge folder. Defaults to:
    C:\Users\<user>\Desktop\CHINTU_SHARED_BRIDGE

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\chintu-bridge-command-center.ps1
#>
[CmdletBinding()]
param(
    [string]$RepoRoot = "C:\Users\Chintu\Desktop\test",
    [string]$SharedDir = "$env:USERPROFILE\Desktop\CHINTU_SHARED_BRIDGE"
)

$ErrorActionPreference = "Continue"

function Say { param([string]$Text) Write-Host $Text }

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

function Find-FirstLine {
    param(
        [string[]]$Lines,
        [string]$Pattern
    )
    $hit = @($Lines | Where-Object { $_ -match $Pattern } | Select-Object -First 1)
    if ($hit.Count -gt 0) { return [string]$hit[0] }
    return ""
}

function Get-FileUnchangedWord {
    param([string]$RelPath)
    $raw = @(& git status --porcelain -- $RelPath 2>$null | Where-Object { $_.Trim() -ne "" })
    if ($raw.Count -eq 0) { return "YES" }
    return "NO"
}

function Parse-ManifestValue {
    param(
        [string[]]$Lines,
        [string]$Key
    )
    $prefix = "${Key}:"
    foreach ($line in $Lines) {
        if ($line.StartsWith($prefix)) {
            return $line.Substring($prefix.Length).Trim()
        }
    }
    return ""
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
        ExpectedCount = $expected.Count
        Missing       = $missing
        Ok            = ($missing.Count -eq 0)
    }
}

if (-not (Test-Path -LiteralPath $RepoRoot)) {
    Say "STOP: repo root not found: $RepoRoot"
    exit 2
}
Set-Location -LiteralPath $RepoRoot

$stamp = Get-Date -Format "yyyy-MM-dd HH:mm"
$reportPath = Join-Path $RepoRoot "chintu-bridge-command-center-report.md"
$branch = (& git rev-parse --abbrev-ref HEAD 2>$null)
if (-not $branch) { $branch = "(unknown)" }
$latestCommit = (& git log --oneline -1 2>$null)
if (-not $latestCommit) { $latestCommit = "(unknown)" }
$statusShort = @(& git status --short 2>$null | Where-Object { $_.Trim() -ne "" })
$treeClean = ($statusShort.Count -eq 0)
$treeWord = if ($treeClean) { "YES" } else { "NO" }
$unpushedCount = 0
try {
    $countText = (& git rev-list --count origin/main..HEAD 2>$null)
    if ($countText) { $unpushedCount = [int]$countText }
} catch {
    $unpushedCount = @(& git log --oneline origin/main..HEAD 2>$null | Where-Object { $_.Trim() -ne "" }).Count
}

$validate = Run-LocalScript -RelPath "scripts\chintu-validate.ps1" -Label "chintu-validate"
$guard = Run-LocalScript -RelPath "scripts\chintu-release-guard.ps1" -Label "chintu-release-guard"
$board = Run-LocalScript -RelPath "scripts\chintu-agent-board.ps1" -Label "chintu-agent-board"

$validateVerdict = Find-FirstLine -Lines $validate.Output -Pattern "^VERDICT:"
if (-not $validateVerdict) { $validateVerdict = "(no verdict line)" }
$guardRecommendation = Find-FirstLine -Lines $guard.Output -Pattern "^RECOMMENDATION:"
if (-not $guardRecommendation) { $guardRecommendation = "(no recommendation line)" }
$boardDecision = Find-FirstLine -Lines $board.Output -Pattern "^DECISION:"
if (-not $boardDecision) { $boardDecision = "(no decision line)" }
$disclaimerWarn = Find-FirstLine -Lines $validate.Output -Pattern "^\[E\] Medical\s+: WARN"
$disclaimerWord = if ($disclaimerWarn) { "PRESENT" } else { "NOT PRESENT" }

$appJsUnchanged = Get-FileUnchangedWord -RelPath "app.js"
$indexUnchanged = Get-FileUnchangedWord -RelPath "index.html"
$stylesUnchanged = Get-FileUnchangedWord -RelPath "styles.css"
$swUnchanged = Get-FileUnchangedWord -RelPath "sw.js"

$sharedExists = Test-Path -LiteralPath $SharedDir
$latestZipPath = Join-Path $SharedDir "CHINTU_BRIDGE_LATEST.zip"
$manifestPath = Join-Path $SharedDir "MANIFEST.txt"
$flatDir = Join-Path $SharedDir "LATEST_FLAT"
$latestZipExists = Test-Path -LiteralPath $latestZipPath
$manifestExists = Test-Path -LiteralPath $manifestPath
$flatExists = Test-Path -LiteralPath $flatDir
$flatCheck = if ($flatExists) { Test-ExpectedFlatFiles -FlatDir $flatDir } else { [pscustomobject]@{ ExpectedCount = 7; Missing = @(); Ok = $false } }
$manifestLines = @()
if ($manifestExists) {
    try { $manifestLines = @(Get-Content -LiteralPath $manifestPath) } catch { $manifestLines = @() }
}
$manifestSha = Parse-ManifestValue -Lines $manifestLines -Key "ZIP_SHA256"
if (-not $manifestSha) { $manifestSha = "(not available)" }
$zipSize = "(not available)"
if ($latestZipExists) {
    try {
        $zipSize = ("{0} bytes" -f ((Get-Item -LiteralPath $latestZipPath).Length))
    } catch {
        $zipSize = "(not available)"
    }
}
$sharedReady = $sharedExists -and $latestZipExists -and $manifestExists -and $flatExists -and $flatCheck.Ok

$option12PackageDir = Join-Path $RepoRoot "CHINTU_IMAC_PACKAGES\OPTION_12_PULL_SHARED"
$option12Installer = Join-Path $option12PackageDir "install-option-12.sh"
$option12Readme = Join-Path $option12PackageDir "README.md"
$option12TestPlan = Join-Path $option12PackageDir "IMAC_TEST_PLAN.md"
$option12PackageReady = (Test-Path -LiteralPath $option12Installer) -and (Test-Path -LiteralPath $option12Readme) -and (Test-Path -LiteralPath $option12TestPlan)
$option12Installed = $false
$option12InstallNote = "Windows cannot verify iMac Option 12 installation directly, so the command center treats it as NOT INSTALLED until the founder confirms."

$manualOption11Path = "~/Documents/CHINTU_CONTROL_ROOM/scripts/bridge-sync.sh"
$manualOption11Desktop = "~/Desktop/CHINTU_BRIDGE_SYNC.command"
$futureOption12Path = "~/Documents/CHINTU_CONTROL_ROOM/scripts/bridge-pull-shared.sh"
$futureOption12Desktop = "~/Desktop/CHINTU_PULL_SHARED_BRIDGE.command"

$moveOrSync = "Sync the iMac's local shared bridge folder so it contains CHINTU_BRIDGE_LATEST.zip and MANIFEST.txt from $SharedDir."
if (-not $sharedReady) {
    $moveOrSync = "Run Windows daily export first, then manually move the newest bridge package into ~/Documents/CHINTU_CONTROL_ROOM/BRIDGE/FROM_WINDOWS/ or keep using Omega option 11."
}

$nextAction = ""
if (-not $treeClean) {
    $nextAction = "STOP and review the repo before any bridge action."
} elseif ($unpushedCount -gt 0) {
    $nextAction = "Ask the founder whether to push the pending commit(s). Do not push until the founder says 'push it.'"
} elseif (-not $sharedReady) {
    $nextAction = "Run Windows daily export to refresh the shared bridge."
} elseif (-not $option12Installed) {
    $nextAction = "Install the iMac Option 12 package on the iMac."
} elseif ($sharedReady -and $option12Installed) {
    $nextAction = "Run iMac Omega option 12 to pull from the shared bridge."
} else {
    $nextAction = "Next sprint candidate: BALA Voice Coach enhancement."
}

$parked = @(
    "Telegram parked",
    "Discord parked",
    "Webhooks parked",
    "Memory-wiki parked",
    "Cloud sync automation parked until explicit founder approval"
)

$lines = @()
$lines += "# Chintu Bridge Command Center"
$lines += ""
$lines += "**Generated:** $stamp"
$lines += "**Repo:** $RepoRoot"
$lines += ""
$lines += "## 1. Repo state"
$lines += ""
$lines += "- Current branch: ``$branch``"
$lines += "- Latest commit: ``$latestCommit``"
$lines += "- Working tree clean: **$treeWord**"
$lines += "- Unpushed commits count: **$unpushedCount**"
$lines += ""
$lines += "## 2. Validation state"
$lines += ""
$lines += "- chintu-validate result: **$($validate.Status)** | $validateVerdict"
$lines += "- release guard result: **$($guard.Status)** | $guardRecommendation"
$lines += "- agent board result (safe to run): **$($board.Status)** | $boardDecision"
$lines += "- Known disclaimer warning: **$disclaimerWord**"
$lines += ""
$lines += "## 3. App safety state"
$lines += ""
$lines += "- app.js unchanged: **$appJsUnchanged**"
$lines += "- index.html unchanged: **$indexUnchanged**"
$lines += "- styles.css unchanged: **$stylesUnchanged**"
$lines += "- sw.js unchanged: **$swUnchanged**"
$lines += ""
$lines += "## 4. Shared bridge state"
$lines += ""
$lines += "- Shared folder path: ``$SharedDir``"
$lines += "- CHINTU_BRIDGE_LATEST.zip present: **$(if ($latestZipExists) { 'YES' } else { 'NO' })**"
$lines += "- MANIFEST.txt present: **$(if ($manifestExists) { 'YES' } else { 'NO' })**"
$lines += "- LATEST_FLAT present: **$(if ($flatExists) { 'YES' } else { 'NO' })**"
$lines += "- LATEST_FLAT has 7 expected files: **$(if ($flatCheck.Ok) { 'YES' } else { 'NO' })**"
if (-not $flatCheck.Ok -and $flatExists) {
    $lines += "- Missing flat files: $($flatCheck.Missing -join ', ')"
}
$lines += "- SHA-256 from MANIFEST.txt: ``$manifestSha``"
$lines += "- Latest ZIP size: $zipSize"
$lines += ""
$lines += "## 5. iMac intake readiness"
$lines += ""
$lines += "- Manual option 11 path: ``$manualOption11Path``"
$lines += "- Manual option 11 desktop command: ``$manualOption11Desktop``"
$lines += "- Future option 12 path: ``$futureOption12Path``"
$lines += "- Future option 12 desktop command: ``$futureOption12Desktop``"
$lines += "- Option 12 package ready in repo: **$(if ($option12PackageReady) { 'YES' } else { 'NO' })**"
$lines += "- Option 12 install status on iMac: **NO (not verifiable from Windows)**"
$lines += "- Founder move/sync target: $moveOrSync"
$lines += "- Install note: $option12InstallNote"
$lines += ""
$lines += "## 6. Next action recommendation"
$lines += ""
$lines += $nextAction
$lines += ""
$lines += "## 7. Parked systems"
$lines += ""
foreach ($item in $parked) {
    $lines += "- $item"
}
$lines += ""
$lines += "## 8. Safety footer"
$lines += ""
$lines += "BALA is a health-awareness companion. It does not diagnose, treat, predict, prevent, replace doctors, or provide emergency monitoring."

try {
    $lines | Set-Content -LiteralPath $reportPath -Encoding ASCII
} catch {
    Say ("FAILED to write report: {0}" -f $_.Exception.Message)
    exit 1
}

Say "Bridge command center report written: $reportPath"
Say "Next action: $nextAction"
exit 0
