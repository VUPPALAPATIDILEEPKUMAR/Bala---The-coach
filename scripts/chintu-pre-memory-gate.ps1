<#
.SYNOPSIS
    Chintu Pre-Memory Gate V1.

.DESCRIPTION
    Runs local safety and readiness checks before Memory-Wiki Seed Vault V1.
    This script does not install or enable plugins, push commits, call external
    URLs, read secrets, or read health data. It writes a gitignored report.

.PARAMETER OutFile
    Optional extra report path. The default report is always written to the
    repository root as chintu-pre-memory-gate-report.md.
#>
[CmdletBinding()]
param(
    [string]$RepoRoot = "C:\Users\Chintu\Desktop\test",
    [string]$OutFile = ""
)

$ErrorActionPreference = "Continue"

if (-not (Test-Path -LiteralPath $RepoRoot)) {
    Write-Host "STOP: repo root not found: $RepoRoot" -ForegroundColor Red
    exit 2
}
Set-Location -LiteralPath $RepoRoot

function First-Line {
    param([object[]]$Lines, [string]$Pattern)
    $match = $Lines | Where-Object { [string]$_ -match $Pattern } | Select-Object -First 1
    if ($null -eq $match) { return "(not reported)" }
    return ([string]$match).Trim()
}

function Status-Word {
    param([bool]$Passed)
    if ($Passed) { return "PASS" }
    return "FAIL"
}

$stamp = Get-Date -Format "yyyy-MM-dd HH:mm"
$statusShort = @(& git status --short 2>$null | Where-Object { $_.Trim() -ne "" })
$repoClean = ($statusShort.Count -eq 0)
$unpushed = @(& git log --oneline origin/main..HEAD 2>$null | Where-Object { $_.Trim() -ne "" })
$noUnpushed = ($unpushed.Count -eq 0)
$branch = (& git rev-parse --abbrev-ref HEAD 2>$null)
if (-not $branch) { $branch = "(unknown)" }
$head = (& git rev-parse --short HEAD 2>$null)
$origin = (& git rev-parse --short origin/main 2>$null)
if (-not $head) { $head = "(unknown)" }
if (-not $origin) { $origin = "(unknown)" }

& node --check app.js 2>$null
$appSyntaxPass = ($LASTEXITCODE -eq 0)
& node --check sw.js 2>$null
$swSyntaxPass = ($LASTEXITCODE -eq 0)

$snapshotOutput = @(& node scripts/chintu-snapshot-consistency.test.js 2>&1)
$snapshotPass = ($LASTEXITCODE -eq 0)

$validationOutput = @(& powershell -NoProfile -ExecutionPolicy Bypass -File scripts/chintu-validate.ps1 2>&1)
$validationExit = $LASTEXITCODE
$validationVerdict = First-Line $validationOutput "^VERDICT:"
$privacyLine = First-Line $validationOutput "^\[F\] Privacy"
$validationPass = ($validationExit -eq 0) -and ($validationVerdict -match "^VERDICT:\s*PASS")

$guardOutput = @(& powershell -NoProfile -ExecutionPolicy Bypass -File scripts/chintu-release-guard.ps1 2>&1)
$guardExit = $LASTEXITCODE
$guardVerdict = First-Line $guardOutput "^VERDICT:"
$guardPass = ($guardExit -eq 0) -and ($guardVerdict -match "^VERDICT:\s*PASS")

$boardOutput = @(& powershell -NoProfile -ExecutionPolicy Bypass -File scripts/chintu-agent-board.ps1 2>&1)
$boardExit = $LASTEXITCODE
$boardPass = ($boardExit -eq 0)

$protocolPath = Join-Path $RepoRoot "CHINTU_MULTI_BRAIN_REVIEW_PROTOCOL.md"
$protocolExists = Test-Path -LiteralPath $protocolPath
$readinessScript = Join-Path $RepoRoot "scripts\chintu-openclaw-readiness.ps1"
$readinessScriptExists = Test-Path -LiteralPath $readinessScript
$readinessReport = Join-Path $RepoRoot "chintu-openclaw-readiness-report.md"
$readinessExit = -1
$readinessTimedOut = $false

if ($readinessScriptExists) {
    $arguments = @(
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-File", ('"' + $readinessScript + '"'),
        "-RepoRoot", ('"' + $RepoRoot + '"')
    )
    $process = Start-Process -FilePath "powershell" -ArgumentList $arguments -PassThru -WindowStyle Hidden
    if ($process.WaitForExit(150000)) {
        $readinessExit = $process.ExitCode
    } else {
        $readinessTimedOut = $true
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    }
}

$readinessPass = $readinessScriptExists -and (-not $readinessTimedOut) -and ($readinessExit -eq 0) -and (Test-Path -LiteralPath $readinessReport)
$memoryWikiState = "unknown"
if (Test-Path -LiteralPath $readinessReport) {
    $memoryLine = Select-String -LiteralPath $readinessReport -Pattern '^\| memory-wiki \|' | Select-Object -First 1
    if ($memoryLine) {
        $cells = @($memoryLine.Line.Split('|') | ForEach-Object { $_.Trim() })
        if ($cells.Count -gt 3) { $memoryWikiState = $cells[3].ToLowerInvariant() }
    }
}
$memoryWikiParked = ($memoryWikiState -eq "disabled")

$go = $repoClean -and $noUnpushed -and $appSyntaxPass -and $swSyntaxPass -and
      $snapshotPass -and $validationPass -and $guardPass -and $boardPass -and
      $protocolExists -and $readinessPass -and $memoryWikiParked
$decision = if ($go) { "GO" } else { "STOP" }

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("# Chintu Pre-Memory Gate Report")
$lines.Add("")
$lines.Add("**Generated:** $stamp")
$lines.Add("")
$lines.Add("## Repo state")
$lines.Add("")
$lines.Add("- Branch: $branch")
$lines.Add("- Working tree clean: $(Status-Word $repoClean)")
$lines.Add("- HEAD: $head")
$lines.Add("- origin/main: $origin")
$lines.Add("- Unpushed commits: $($unpushed.Count) ($(Status-Word $noUnpushed))")
$lines.Add("")
$lines.Add("## Validation summary")
$lines.Add("")
$lines.Add("- app.js syntax: $(Status-Word $appSyntaxPass)")
$lines.Add("- sw.js syntax: $(Status-Word $swSyntaxPass)")
$lines.Add("- Chintu validation: $validationVerdict")
$lines.Add("- Release guard: $guardVerdict")
$lines.Add("- Agent board: $(Status-Word $boardPass)")
$lines.Add("")
$lines.Add("## Snapshot consistency")
$lines.Add("")
$lines.Add("- Result: $(Status-Word $snapshotPass)")
$lines.Add("- Detail: $(First-Line $snapshotOutput '^Snapshot consistency tests:')")
$lines.Add("")
$lines.Add("## Privacy / egress status")
$lines.Add("")
$lines.Add("- $privacyLine")
$lines.Add("- No health data was read or sent by this gate.")
$lines.Add("")
$lines.Add("## Multi-Brain protocol status")
$lines.Add("")
$lines.Add("- CHINTU_MULTI_BRAIN_REVIEW_PROTOCOL.md: $(Status-Word $protocolExists)")
$lines.Add("")
$lines.Add("## OpenClaw readiness status")
$lines.Add("")
$lines.Add("- Readiness script exists: $(Status-Word $readinessScriptExists)")
$lines.Add("- Readiness command: $(Status-Word $readinessPass)")
$lines.Add("- Timed out: $readinessTimedOut")
$lines.Add("")
$lines.Add("## Memory-Wiki readiness")
$lines.Add("")
$lines.Add("- Enabled state: $memoryWikiState")
$lines.Add("- Remains parked: $(Status-Word $memoryWikiParked)")
$lines.Add("- Enabling requires explicit founder approval.")
$lines.Add("")
$lines.Add("## GO / STOP decision")
$lines.Add("")
$lines.Add("**$decision**")
$lines.Add("")
$lines.Add("## Recommended next sprint")
$lines.Add("")
if ($go) {
    $lines.Add("CHINTU MEMORY-WIKI SEED VAULT V1 may begin after explicit founder approval.")
} else {
    $lines.Add("Resolve every failed gate item before CHINTU MEMORY-WIKI SEED VAULT V1.")
}

$report = $lines -join "`r`n"
$defaultOut = Join-Path $RepoRoot "chintu-pre-memory-gate-report.md"
Set-Content -LiteralPath $defaultOut -Value $report -Encoding utf8
Write-Host ""
Write-Host "Pre-memory gate report written: $defaultOut"

if ($OutFile -ne "") {
    $parent = Split-Path -Parent $OutFile
    if ($parent -and -not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Force -Path $parent | Out-Null
    }
    Set-Content -LiteralPath $OutFile -Value $report -Encoding utf8
    Write-Host "Copy written: $OutFile"
}

Write-Host "DECISION: $decision"
if ($go) { exit 0 }
exit 1
