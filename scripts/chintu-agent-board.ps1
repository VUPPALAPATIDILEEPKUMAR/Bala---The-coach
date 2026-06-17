<#
.SYNOPSIS
    Chintu Agent Board v2 - local-only daily briefing + next-sprint recommender.

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
$stopGo = if ($isFail) {
    "STOP - validation FAIL; no commit, no push until resolved."
} elseif ($statusShort.Count -gt 0) {
    "REVIEW - validation PASS but the tree has uncommitted changes; validate and commit before pushing."
} else {
    "GO - validation PASS and repo clean; human owns push."
}

# --- Build the board markdown (V2 daily briefing) ----------------------------
$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("# Chintu Agent Board - Daily Briefing (v2)")
$lines.Add("")
$lines.Add("**Generated:** $stamp  ")
$lines.Add("**Repo:** $RepoRoot  ")
$lines.Add("**Branch:** $branch")
$lines.Add("")
$lines.Add("## 1. Morning Brief")
$lines.Add("")
$lines.Add("- Repo: working tree **$treeState**, " + ($(if ($unN -eq 0) { "**caught up** with origin/main" } else { "**$unN commit(s) ahead** of origin/main" })) + ".")
$lines.Add("- Latest commit: ``$headHash`` (origin/main ``$originHash``).")
$lines.Add("  - " + ($(if ($last5.Count -gt 0) { $last5[0] } else { "(none)" })))
$lines.Add("- Validation verdict: **$verdict**.")
$lines.Add("- Release guard: **$recommendation**")
$lines.Add("")
$lines.Add("## 2. BALA Level")
$lines.Add("")
$lines.Add("- $productLevel")
$lines.Add("- **Stage 2 data-entry/history trust complete** (view more, edit, remove, past-date add). **Stage 3 started** (doctor-ready .txt download).")
$lines.Add("- PWA: service worker cache **$swVer**; $manifestLine")
$lines.Add("")
$lines.Add("## 3. Chintu Level")
$lines.Add("")
$lines.Add("- Validation runner: ``scripts/chintu-validate.ps1`` - $verdict")
$lines.Add("- Release guard runner: ``scripts/chintu-release-guard.ps1`` - $recommendation")
$lines.Add("- Agent board runner: ``scripts/chintu-agent-board.ps1`` - this daily briefing (v2).")
$lines.Add("- Safety: $medicalLine - BALA never claims to diagnose, predict, prevent, detect disease, or monitor emergencies.")
$lines.Add("- Privacy: $privacyLine - health data stays in localStorage on the device; nothing is sent anywhere.")
$lines.Add("")
$lines.Add("## 4. Manual Phone Test Checklist")
$lines.Add("")
$lines.Add("Hard-refresh (Ctrl+F5) or reopen the installed app so the current service worker (**$swVer**) activates, then:")
$lines.Add("- [ ] App loads; no console-breaking behavior.")
$lines.Add("- [ ] Latest shipped feature works (currently: past-date check-in + doctor-ready .txt download).")
$lines.Add("- [ ] History: add (today and a past date), edit, and remove a check-in.")
$lines.Add("- [ ] Doctor-Ready Summary: Copy and **Download .txt** (last 5).")
$lines.Add("- [ ] Show more / Show fewer history (5 -> 30 -> 60 -> 90).")
$lines.Add("")
$lines.Add("## 5. Next Sprint Recommender")
$lines.Add("")
$lines.Add("- **A. Stage 3 doctor-ready share polish** - cleaner .txt/clipboard wording + section order. Render/copy only, lowest risk.")
$lines.Add("- **B. Stage 3 tester onboarding / feedback checklist** - a calm in-app or report checklist so a tester can self-verify the build. Render/static, low risk.")
$lines.Add("- **C. Chintu one-command daily briefing polish** - refine this board (e.g. since-last-push commit list). Local tooling, low risk.")
$lines.Add("")
$lines.Add("## 6. Paste-Ready Next Claude Prompt")
$lines.Add("")
$lines.Add('```')
$lines.Add("BALA + CHINTU - STAGE 3 DOCTOR-READY SHARE POLISH (design check first)")
$lines.Add("")
$lines.Add("Repo: $RepoRoot. Claude only; Codex parked. Read-only design check first, then smallest safe patch.")
$lines.Add("Rules: no push (human pushes), no install, no external URLs, no secrets, no backend, no medical claims,")
$lines.Add("local-first. Start: git status --short; git log --oneline origin/main..HEAD;")
$lines.Add("powershell -ExecutionPolicy Bypass -File scripts\chintu-agent-board.ps1.")
$lines.Add("Goal: polish the doctor-ready summary wording/section order (still last-5, no BALA Score exposed,")
$lines.Add("no diagnosis/prediction/emergency language). Validate with chintu-validate + chintu-release-guard;")
$lines.Add("bump sw.js cache if the app shell changes; commit locally; do not push.")
$lines.Add('```')
$lines.Add("")
$lines.Add("## 7. Parked Systems")
$lines.Add("")
$lines.Add("- **Codex** - parked until explicitly activated (read-only/spec only; never pushes or networks).")
$lines.Add("- **Telegram/Discord** - future only; no implementation; nothing networked ships in v1/v2.")
$lines.Add("- **External APIs / backend / paid services** - not used.")
$lines.Add("")
$lines.Add("## 8. Go / Stop Decision")
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
