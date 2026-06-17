<#
.SYNOPSIS
    Chintu Agent Board v1 - local-only multi-agent status board.

.DESCRIPTION
    A read-only, local-first command that coordinates Chintu's existing local checks into a
    single "agent board" markdown report. Each section is a local "agent": Repo, Validation,
    Release Guard, BALA Safety, Privacy, PWA, Product, and Founder Handoff. It runs the existing
    release guard (which runs the validator and writes last-validation.txt + release-guard-report.md),
    reads those as the source of truth, gathers read-only git/repo metadata, and writes a board report.

    It NEVER pushes, installs, calls external URLs, reads secrets, sends Telegram/Discord messages,
    or includes any health-metric value from app data. These are local "agents" / report sections,
    not external bots.

.PARAMETER RepoRoot
    Repo under board. Defaults to C:\Users\Chintu\Desktop\test.

.PARAMETER OutFile
    Optional extra path to also write the board report to (parent folder created if needed).
    The default report is always written to <RepoRoot>\chintu-agent-board-report.md (gitignored).

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\chintu-agent-board.ps1
.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\chintu-agent-board.ps1 -OutFile "C:\path\board.md"
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

$guard = Join-Path $RepoRoot "scripts\chintu-release-guard.ps1"
$validationFile = Join-Path $RepoRoot "last-validation.txt"

if (-not (Test-Path -LiteralPath $guard)) {
    Write-Host "FAIL: release guard not found: $guard" -ForegroundColor Red
    exit 2
}

# --- Run the release guard (it runs the validator + writes last-validation.txt) ---
& powershell -ExecutionPolicy Bypass -File $guard | Out-Null
$guardExit = $LASTEXITCODE

$block = ""
if (Test-Path -LiteralPath $validationFile) {
    $block = (Get-Content -LiteralPath $validationFile -Raw)
}
$blockLines = $block -split "`r?`n"

function Find-Line([string]$pattern) {
    $m = ($blockLines | Where-Object { $_ -match $pattern } | Select-Object -First 1)
    if ($m) { return $m.Trim() } else { return "" }
}

$verdictLine = Find-Line "^VERDICT:"
$verdict = if ($verdictLine) { ($verdictLine -replace "^VERDICT:\s*", "").Trim() } else { "(unknown)" }
$syntaxLine = Find-Line "^\[B\] Syntax"
$swLine = Find-Line "SW cache"
$manifestLine = Find-Line "^\[D\] Manifest"
$medicalLine = Find-Line "^\[E\] Medical"
$privacyLine = Find-Line "^\[F\] Privacy"
$swVer = "(unknown)"
if ($swLine -match "(bala-shell-v\d+)") { $swVer = $Matches[1] }
$isFail = ($verdict -match "FAIL") -or ($guardExit -ne 0)

# --- Repo metadata (read-only) ----------------------------------------------
$stamp = Get-Date -Format "yyyy-MM-dd HH:mm"
$branch = (& git rev-parse --abbrev-ref HEAD 2>$null)
if (-not $branch) { $branch = "(unknown)" }
$statusShort = @(& git status --short 2>$null | Where-Object { $_.Trim() -ne "" })
$treeState = if ($statusShort.Count -eq 0) { "CLEAN" } else { "dirty($($statusShort.Count))" }
$unpushed = @(& git log --oneline origin/main..HEAD 2>$null | Where-Object { $_.Trim() -ne "" })
$unN = $unpushed.Count
$last5 = @(& git log --oneline -5 2>$null)
$headHash = (& git rev-parse --short HEAD 2>$null)
$originHash = (& git rev-parse --short origin/main 2>$null)
if (-not $originHash) { $originHash = "(no origin/main)" }

# --- Release guard recommendation (re-derived, same logic) -------------------
if ($isFail) {
    $recommendation = "DO NOT PUSH - resolve validation failures first."
} elseif ($unN -gt 0) {
    $recommendation = "READY FOR HUMAN PUSH - $unN commit(s) pending."
} else {
    $recommendation = "NOTHING TO PUSH - origin/main is caught up."
}

# --- Product Agent: read CHINTU_HANDOFF.md markers ---------------------------
$handoff = Join-Path $RepoRoot "CHINTU_HANDOFF.md"
$productLevel = "(CHINTU_HANDOFF.md not found)"
$nextOptions = ""
if (Test-Path -LiteralPath $handoff) {
    $trustLine = (Select-String -Path $handoff -Pattern "data-entry trust" -SimpleMatch | Select-Object -First 1)
    if ($trustLine) { $productLevel = $trustLine.Line.Trim() } else { $productLevel = "Stage 2 history/data-entry features present (see CHINTU_HANDOFF.md)." }
    $optLine = (Select-String -Path $handoff -Pattern "Next BALA options" -SimpleMatch | Select-Object -First 1)
    if ($optLine) { $nextOptions = $optLine.Line.Trim() }
}

# --- Founder handoff helpers -------------------------------------------------
$pushNeeded = if ($isFail) { "No - fix FAIL first" } elseif ($unN -gt 0) { "Yes - $unN commit(s) ready for human push" } else { "No - origin/main caught up" }
$stopGo = if ($isFail) { "STOP - validation FAIL; no commit, no push until resolved." } else { "GO - all green (known-safe WARN only); human owns push." }

# --- Build the board markdown ------------------------------------------------
$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("# Chintu Agent Board Report")
$lines.Add("")
$lines.Add("**Generated:** $stamp  ")
$lines.Add("**Repo:** $RepoRoot  ")
$lines.Add("**Branch:** $branch")
$lines.Add("")
$lines.Add("## 1. Repo Agent")
$lines.Add("")
$lines.Add("- Working tree: **$treeState**")
$lines.Add("- HEAD: ``$headHash`` | origin/main: ``$originHash``")
$lines.Add("- Unpushed commits: **$unN**")
if ($unN -gt 0) {
    $lines.Add("")
    $lines.Add('```')
    foreach ($c in $unpushed) { $lines.Add($c) }
    $lines.Add('```')
}
$lines.Add("- Latest commits:")
$lines.Add("")
$lines.Add('```')
foreach ($c in $last5) { $lines.Add($c) }
$lines.Add('```')
$lines.Add("")
$lines.Add("## 2. Validation Agent")
$lines.Add("")
$lines.Add("- $syntaxLine")
$lines.Add("- VERDICT: **$verdict**")
$lines.Add("")
$lines.Add("## 3. Release Guard Agent")
$lines.Add("")
$lines.Add("- Recommendation: **$recommendation**")
$lines.Add("")
$lines.Add("## 4. BALA Safety Agent")
$lines.Add("")
$lines.Add("- $medicalLine")
$lines.Add("- Reminder: BALA never claims to diagnose, predict, prevent, detect disease, or monitor emergencies. Awareness / body signals / recent trend / talk to a healthcare professional only.")
$lines.Add("")
$lines.Add("## 5. Privacy Agent")
$lines.Add("")
$lines.Add("- $privacyLine")
$lines.Add("- Reminder: no secrets in code; health data stays in localStorage on the device; nothing is sent anywhere automatically.")
$lines.Add("")
$lines.Add("## 6. PWA Agent")
$lines.Add("")
$lines.Add("- Service worker cache: **$swVer**")
$lines.Add("- $manifestLine")
$lines.Add("")
$lines.Add("## 7. Product Agent")
$lines.Add("")
$lines.Add("- $productLevel")
if ($nextOptions) { $lines.Add("- $nextOptions") }
$lines.Add("")
$lines.Add("## 8. Founder Handoff Agent")
$lines.Add("")
$lines.Add("- Push needed: **$pushNeeded**")
$lines.Add("- Manual phone test needed: **Yes if an app feature changed since the last test** (hard-refresh so $swVer activates, then confirm the changed feature).")
$lines.Add("- Next Claude prompt title: **""BALA + CHINTU - POST-PUSH/GUARD CONFIRM, THEN NEXT STAGE 3 POLISH""**")
$lines.Add("")
$lines.Add("## 9. Recommended next 3 sprints")
$lines.Add("")
$lines.Add("1. Stage 3 doctor-ready share polish (render/copy wording) - lowest risk.")
$lines.Add("2. Manual phone-tester checklist (in-app Data tab or report) - repeatable verification.")
$lines.Add("3. Chintu one-command daily run (wrapper around validate + release guard).")
$lines.Add("")
$lines.Add("## 10. Stop/Go decision")
$lines.Add("")
$lines.Add("**$stopGo**")
$lines.Add("")
$lines.Add("---")
$lines.Add("")
$lines.Add("*Generated locally. Human owns final decisions. Codex parked. Telegram/Discord parked.*")

$report = ($lines -join "`r`n")

# --- Write default report + optional -OutFile --------------------------------
$defaultOut = Join-Path $RepoRoot "chintu-agent-board-report.md"
Set-Content -LiteralPath $defaultOut -Value $report -Encoding utf8
Write-Host ""
Write-Host "Agent board report written: $defaultOut" -ForegroundColor Green

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
Write-Host ("DECISION: " + $stopGo)

if ($isFail) { exit 1 } else { exit 0 }
