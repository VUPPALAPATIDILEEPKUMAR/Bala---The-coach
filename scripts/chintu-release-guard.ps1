<#
.SYNOPSIS
    Chintu Release Guard Runner v1.

.DESCRIPTION
    A read-only, local-first wrapper around scripts/chintu-validate.ps1. It runs the
    validator, reads its last-validation.txt block as the source of truth, gathers git
    state + recent commits + SW cache version, and writes a markdown release report with
    a PASS/WARN/FAIL verdict, a manual phone-test checklist placeholder, and a
    push / do-not-push recommendation.

    It NEVER pushes, installs, calls external URLs, reads secrets, sends Telegram/Discord
    messages, or includes any health-metric value from app data.

.PARAMETER RepoRoot
    Repo under guard. Defaults to C:\Users\Chintu\Desktop\test.

.PARAMETER OutFile
    Optional extra path to also write the markdown report to (parent folder created if
    needed). The default report is always written to <RepoRoot>\release-guard-report.md
    (gitignored).

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\chintu-release-guard.ps1
.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\chintu-release-guard.ps1 -OutFile "C:\path\report.md"
#>
[CmdletBinding()]
param(
    [string]$RepoRoot = "C:\Users\Chintu\Desktop\test",
    [string]$OutFile = ""
)

$ErrorActionPreference = "Continue"

if (-not (Test-Path -LiteralPath $RepoRoot)) {
    Write-Host "FAIL: repo root not found: $RepoRoot" -ForegroundColor Red
    exit 2
}
Set-Location -LiteralPath $RepoRoot

$validator = Join-Path $RepoRoot "scripts\chintu-validate.ps1"
$validationFile = Join-Path $RepoRoot "last-validation.txt"

if (-not (Test-Path -LiteralPath $validator)) {
    Write-Host "FAIL: validator not found: $validator" -ForegroundColor Red
    exit 2
}

# --- 1-3. Run the validator (writes last-validation.txt) and read it back ----
& powershell -ExecutionPolicy Bypass -File $validator | Out-Null
$validatorExit = $LASTEXITCODE

$block = ""
if (Test-Path -LiteralPath $validationFile) {
    $block = (Get-Content -LiteralPath $validationFile -Raw)
}
$blockLines = $block -split "`r?`n"

$verdictLine = ($blockLines | Where-Object { $_ -match "^VERDICT:" } | Select-Object -First 1)
$verdict = if ($verdictLine) { ($verdictLine -replace "^VERDICT:\s*", "").Trim() } else { "(unknown)" }

$swLine = ($blockLines | Where-Object { $_ -match "SW cache" } | Select-Object -First 1)
$swVer = "(unknown)"
if ($swLine -match "(bala-shell-v\d+)") { $swVer = $Matches[1] }

$isFail = ($verdict -match "FAIL") -or ($validatorExit -ne 0)

# --- 3b. Extra integrity tests (read-only, local) ----------------------------
$extraChecks = New-Object System.Collections.Generic.List[string]
function Run-Extra([string]$label, [string]$relPath, [string]$cmd) {
    $full = Join-Path $RepoRoot $relPath
    if (-not (Test-Path -LiteralPath $full)) {
        $extraChecks.Add("$label : SKIP (missing $relPath)") | Out-Null
        return
    }
    if ($cmd -eq "node") {
        & node $full | Out-Null
    } else {
        & powershell -ExecutionPolicy Bypass -File $full | Out-Null
    }
    if ($LASTEXITCODE -eq 0) {
        $extraChecks.Add("$label : PASS") | Out-Null
    } else {
        $extraChecks.Add("$label : FAIL (exit $LASTEXITCODE)") | Out-Null
        $script:isFail = $true
    }
}
Run-Extra "Command map integrity" "scripts\chintu-command-map.test.js" "node"
Run-Extra "Memory vault integrity" "scripts\chintu-memory-vault.test.js" "node"
Run-Extra "Agent control shell"    "scripts\chintu-agent-control-shell.test.js" "node"
Run-Extra "No network egress"      "scripts\chintu-no-network-egress.test.js" "node"
Run-Extra "Medical claims"         "scripts\chintu-medical-claims.test.js" "node"
Run-Extra "Safety boundary"        "scripts\chintu-safety-boundary.test.js" "node"
Run-Extra "Doc link integrity"     "scripts\chintu-doc-link-integrity.test.js" "node"
Run-Extra "Generated files map"    "scripts\chintu-generated-files-map.test.js" "node"
Run-Extra "BALA safe docs"         "scripts\chintu-bala-safe-docs.test.js" "node"
Run-Extra "Parked systems"         "scripts\chintu-parked-systems.test.js" "node"
Run-Extra "Continuation prompts"   "scripts\chintu-continuation-prompts.test.js" "node"
Run-Extra "Runtime health"         "scripts\chintu-runtime-health.test.js" "node"
Run-Extra "Heartbeat"              "scripts\chintu-heartbeat.test.js" "node"
Run-Extra "Restart recovery"       "scripts\chintu-restart-recovery.test.js" "node"
Run-Extra "Telegram status plan"   "scripts\chintu-telegram-status-plan.test.js" "node"
Run-Extra "Bridge loop reality"    "scripts\chintu-bridge-loop-reality-check.test.js" "node"
Run-Extra "iMac Option 12 SHA"     "scripts\chintu-imac-option-12-sha-parse.test.js" "node"
Run-Extra "Dry-run adapter"        "scripts\chintu-dry-run-adapter.test.js" "node"
Run-Extra "Connector policy"       "scripts\chintu-connector-policy.test.js" "node"
Run-Extra "Outbox shape"           "scripts\chintu-outbox-shape.test.js" "node"
Run-Extra "Action planner"         "scripts\chintu-action-planner.test.js" "node"

# --- 4. Capture git state (read-only) ----------------------------------------
$stamp = Get-Date -Format "yyyy-MM-dd HH:mm"
$branch = (& git rev-parse --abbrev-ref HEAD 2>$null)
if (-not $branch) { $branch = "(unknown)" }

$statusShort = (& git status --short 2>$null)
$treeState = if ([string]::IsNullOrWhiteSpace(($statusShort -join ""))) { "CLEAN" } else { "dirty" }

$unpushed = @(& git log --oneline origin/main..HEAD 2>$null | Where-Object { $_.Trim() -ne "" })
$unN = $unpushed.Count

$last5 = @(& git log --oneline -5 2>$null)
$headHash = (& git rev-parse --short HEAD 2>$null)
$originHash = (& git rev-parse --short origin/main 2>$null)
if (-not $originHash) { $originHash = "(no origin/main)" }

# --- 7. Push recommendation --------------------------------------------------
if ($isFail) {
    $recommendation = "DO NOT PUSH - resolve validation failures first."
} elseif ($unN -gt 0) {
    $recommendation = "READY FOR HUMAN PUSH - $unN commit(s) pending."
} else {
    $recommendation = "NOTHING TO PUSH - origin/main is caught up."
}

# --- 5/Report sections. Build the markdown -----------------------------------
$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("# Chintu Release Guard Report")
$lines.Add("")
$lines.Add("**Generated:** $stamp")
$lines.Add("**Repo:** $RepoRoot  ")
$lines.Add("**Branch:** $branch")
$lines.Add("")
$lines.Add("## Repo state")
$lines.Add("")
$lines.Add("- Working tree: **$treeState**")
$lines.Add("- HEAD: ``$headHash`` | origin/main: ``$originHash``")
$lines.Add("- Unpushed commits: **$unN**")
$lines.Add("- Service worker cache: **$swVer**")
$lines.Add("")
$lines.Add("## Latest commits")
$lines.Add("")
$lines.Add('```')
foreach ($c in $last5) { $lines.Add($c) }
$lines.Add('```')
$lines.Add("")
$lines.Add("## Validation verdict")
$lines.Add("")
$lines.Add("**$verdict**")
$lines.Add("")
$lines.Add("## Validation block (from last-validation.txt)")
$lines.Add("")
$lines.Add('```')
foreach ($l in $blockLines) { $lines.Add($l) }
$lines.Add('```')
$lines.Add("")
$lines.Add("## Integrity tests")
$lines.Add("")
foreach ($e in $extraChecks) { $lines.Add("- $e") }
$lines.Add("")
$lines.Add("## Known WARN note")
$lines.Add("")
$lines.Add("Known WARNs may include safe disclaimer lines (awareness / not-medical-advice copy). A WARN is non-blocking - glance and proceed. A **FAIL** means stop: no commit, no push, until resolved.")
$lines.Add("")
$lines.Add("## Manual phone test checklist")
$lines.Add("")
$lines.Add("- [ ] Hard refresh / reopen the app so the current service worker ($swVer) activates.")
$lines.Add("- [ ] Confirm the app loads.")
$lines.Add("- [ ] Confirm the main changed feature works manually.")
$lines.Add("- [ ] Confirm no console-breaking behavior if checked.")
$lines.Add("")
$lines.Add("## Push recommendation")
$lines.Add("")
$lines.Add("**$recommendation**")
$lines.Add("")
$lines.Add("## Human push command (if ready)")
$lines.Add("")
$lines.Add('```cmd')
$lines.Add("cd /d $RepoRoot")
$lines.Add("git push")
$lines.Add('```')
$lines.Add("")
$lines.Add("---")
$lines.Add("")
$lines.Add("*Generated locally. Human push only. Codex parked. Telegram/Discord parked.*")

$report = ($lines -join "`r`n")

# --- 6. Write default report + optional -OutFile -----------------------------
$defaultOut = Join-Path $RepoRoot "release-guard-report.md"
Set-Content -LiteralPath $defaultOut -Value $report -Encoding utf8
Write-Host ""
Write-Host "Release guard report written: $defaultOut" -ForegroundColor Green

if ($OutFile -ne "") {
    $parent = Split-Path -Parent $OutFile
    if ($parent -and -not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Force -Path $parent | Out-Null
    }
    Set-Content -LiteralPath $OutFile -Value $report -Encoding utf8
    Write-Host "Copy written: $OutFile" -ForegroundColor Green
}

Write-Host ""
Write-Host "VERDICT: $verdict"
Write-Host "RECOMMENDATION: $recommendation"

if ($isFail) { exit 1 } else { exit 0 }
