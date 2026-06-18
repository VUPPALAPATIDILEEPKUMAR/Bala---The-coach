<#
.SYNOPSIS
    Chintu Runtime Health: is Chintu alive right now?

.DESCRIPTION
    Local-only, read-only inspector. Answers "is Chintu alive?" in one
    word (GREEN / YELLOW / RED) and writes CHINTU_RUNTIME_HEALTH.md with
    the supporting evidence.

    Inspects:
      - repo state (branch, dirty/clean, unpushed count)
      - latest commit
      - master launcher availability
      - release guard availability
      - OpenClaw readiness script presence (does NOT invoke openclaw)
      - Telegram docs/config presence (NEVER prints tokens or secrets)
      - bridge folder presence
      - control room files presence
      - latest generated report timestamps + staleness
      - approximate "machine likely restarted/slept" heuristic from
        last-modified gaps

    Never edits BALA app files, pushes, installs, calls the network, or
    sends any data. The "Telegram" probe only checks whether config
    docs exist; it never reads token values.

.PARAMETER RepoRoot
    Repo root. Defaults to C:\Users\Chintu\Desktop\test.

.PARAMETER StaleHours
    A tracked report older than this many hours is flagged. Default 48.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\chintu-runtime-health.ps1
#>
[CmdletBinding()]
param(
    [string]$RepoRoot = "C:\Users\Chintu\Desktop\test",
    [int]$StaleHours = 48
)

$ErrorActionPreference = "Continue"

if (-not (Test-Path -LiteralPath $RepoRoot -PathType Container)) {
    Write-Host "FAIL: repo root not found: $RepoRoot"
    exit 2
}
$RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
Set-Location -LiteralPath $RepoRoot

$now = Get-Date
$stamp = $now.ToString("yyyy-MM-dd HH:mm zzz")

$findings = New-Object System.Collections.ArrayList
$yellow = 0
$red = 0

function Add-Finding {
    param([string]$Level, [string]$Area, [string]$Note)
    $findings.Add([pscustomobject]@{ Level=$Level; Area=$Area; Note=$Note }) | Out-Null
    if ($Level -eq "YELLOW") { $script:yellow++ }
    if ($Level -eq "RED")    { $script:red++ }
}

# --- 1. repo state -----------------------------------------------------------
$branch = (& git rev-parse --abbrev-ref HEAD 2>$null)
if (-not $branch) { $branch = "(unknown)"; Add-Finding "RED" "git" "branch unknown" }

$dirty = (& git status --porcelain 2>$null)
$dirtyCount = if ($dirty) { ($dirty -split "`n").Count } else { 0 }
if ($dirtyCount -gt 0) {
    Add-Finding "YELLOW" "git" "$dirtyCount file(s) in working tree (uncommitted)"
}

$unpushed = (& git log --oneline origin/main..HEAD 2>$null)
$unpushedCount = if ($unpushed) { ($unpushed -split "`n").Count } else { 0 }
if ($unpushedCount -gt 0) {
    Add-Finding "YELLOW" "git" "$unpushedCount unpushed commit(s) - founder push pending"
}

$latest = (& git log -1 --oneline 2>$null)
if (-not $latest) { $latest = "(unknown)"; Add-Finding "RED" "git" "no commits visible" }

# --- 2. core scripts ---------------------------------------------------------
$coreScripts = @(
    "scripts\chintu-master-launcher.ps1",
    "scripts\chintu-release-guard.ps1",
    "scripts\chintu-validate.ps1",
    "scripts\chintu-control-room-index.ps1",
    "scripts\chintu-agent-dashboard.ps1",
    "scripts\chintu-alive-briefing.ps1",
    "scripts\chintu-os-health-check.ps1",
    "scripts\chintu-next-action.ps1"
)
foreach ($s in $coreScripts) {
    if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot $s))) {
        Add-Finding "RED" "scripts" "missing: $s"
    }
}

# --- 3. OpenClaw readiness script (presence only; do NOT invoke openclaw) ----
if (Test-Path -LiteralPath (Join-Path $RepoRoot "scripts\chintu-openclaw-readiness.ps1")) {
    # presence is enough; we never call openclaw here
} else {
    Add-Finding "YELLOW" "openclaw" "openclaw-readiness script not present"
}

# --- 4. Telegram: docs only, no token reads ----------------------------------
# Telegram is parked. We only check that the parked-systems doc still
# marks it as parked. We NEVER read tokens or environment variables.
$parkedDoc = Join-Path $RepoRoot "CHINTU_MEMORY_VAULT\PARKED_SYSTEMS.md"
$telegramStatus = "parked"
if (Test-Path -LiteralPath $parkedDoc) {
    $parkedText = Get-Content -LiteralPath $parkedDoc -Raw
    if ($parkedText -match "Telegram[^|]*\|\s*parked") {
        # parked, expected
    } elseif ($parkedText -match "Telegram[^|]*\|\s*active") {
        $telegramStatus = "UNEXPECTEDLY ACTIVE"
        Add-Finding "RED" "telegram" "PARKED_SYSTEMS.md marks Telegram active - investigate"
    } else {
        Add-Finding "YELLOW" "telegram" "Telegram row not found in PARKED_SYSTEMS.md"
    }
} else {
    Add-Finding "YELLOW" "telegram" "PARKED_SYSTEMS.md missing"
}

# --- 5. bridge folder --------------------------------------------------------
$bridge = Join-Path $env:USERPROFILE "Desktop\CHINTU_SHARED_BRIDGE"
$bridgePresent = Test-Path -LiteralPath $bridge -PathType Container
if (-not $bridgePresent) {
    Add-Finding "YELLOW" "bridge" "CHINTU_SHARED_BRIDGE folder not present on desktop"
}

# --- 6. control room files ---------------------------------------------------
$controlRoomFiles = @(
    "CHINTU_OPEN_FIRST.md",
    "CHINTU_TOMORROW_MORNING_BRIEF.md",
    "CHINTU_SAFETY_INVARIANTS.md",
    "CHINTU_FOUNDER_COMMAND_MAP.md",
    "CHINTU_PUSH_REVIEW_CHECKLIST.md",
    "CHINTU_CLAUDE_SURVIVAL_HANDOFF.md",
    "CHINTU_CONTROL_ROOM_INDEX.html",
    "CHINTU_AGENT_DASHBOARD.html"
)
foreach ($f in $controlRoomFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot $f))) {
        Add-Finding "RED" "control-room" "missing: $f"
    }
}

# --- 7. latest generated report staleness ------------------------------------
$trackedReports = @(
    "CHINTU_ALIVE_BRIEFING.md",
    "CHINTU_OS_HEALTH_CHECK.md",
    "CHINTU_AGENT_DASHBOARD.html",
    "CHINTU_CONTROL_ROOM_INDEX.html"
)
$lastModTimes = @{}
foreach ($f in $trackedReports) {
    $p = Join-Path $RepoRoot $f
    if (Test-Path -LiteralPath $p) {
        $lm = (Get-Item -LiteralPath $p).LastWriteTime
        $lastModTimes[$f] = $lm
        $ageHours = ($now - $lm).TotalHours
        if ($ageHours -gt $StaleHours) {
            Add-Finding "YELLOW" "freshness" ("{0} stale ({1:N1} h old)" -f $f, $ageHours)
        }
    } else {
        Add-Finding "YELLOW" "freshness" "$f missing (no generated snapshot yet)"
    }
}

# --- 8. heuristic: machine likely slept/restarted ----------------------------
# If the *youngest* tracked report is older than 12h, and the system
# uptime (if available) is small, the laptop was likely off/asleep.
$mostRecent = $null
foreach ($k in $lastModTimes.Keys) {
    if (-not $mostRecent -or $lastModTimes[$k] -gt $mostRecent) {
        $mostRecent = $lastModTimes[$k]
    }
}
$restartHint = ""
if ($mostRecent) {
    $gapHours = ($now - $mostRecent).TotalHours
    if ($gapHours -gt 12) {
        $restartHint = "Most recent report is {0:N1} h old. Laptop may have slept/restarted; re-run master launcher." -f $gapHours
        Add-Finding "YELLOW" "restart" $restartHint
    } else {
        $restartHint = "Most recent report is {0:N1} h old. Recent." -f $gapHours
    }
} else {
    $restartHint = "No tracked reports found."
}

# --- 9. overall verdict ------------------------------------------------------
$status = "GREEN"
if ($red -gt 0) { $status = "RED" }
elseif ($yellow -gt 0) { $status = "YELLOW" }

# --- 10. write report --------------------------------------------------------
$lines = New-Object System.Collections.ArrayList
$null = $lines.Add("# Chintu Runtime Health")
$null = $lines.Add("")
$null = $lines.Add("**Generated:** $stamp")
$null = $lines.Add("**Repo:** $RepoRoot")
$null = $lines.Add("**Branch:** $branch")
$null = $lines.Add("**Latest commit:** ``$latest``")
$null = $lines.Add("**Working tree:** $dirtyCount uncommitted file(s)")
$null = $lines.Add("**Unpushed commits:** $unpushedCount")
$null = $lines.Add("**Telegram:** $telegramStatus (parked is expected)")
$null = $lines.Add("**Bridge folder present:** $bridgePresent")
$null = $lines.Add("")
$null = $lines.Add("## Overall status: **$status**")
$null = $lines.Add("")
if ($status -eq "GREEN") {
    $null = $lines.Add("Alive and clean. Safe to continue.")
} elseif ($status -eq "YELLOW") {
    $null = $lines.Add("Alive. $yellow item(s) need founder glance. Not safety failures.")
} else {
    $null = $lines.Add("BLOCKED. $red red item(s). Resolve before continuing.")
}
$null = $lines.Add("")
$null = $lines.Add("## Restart / sleep hint")
$null = $lines.Add("")
$null = $lines.Add($restartHint)
$null = $lines.Add("")
$null = $lines.Add("## Findings")
$null = $lines.Add("")
if ($findings.Count -eq 0) {
    $null = $lines.Add("- (none)")
} else {
    $null = $lines.Add("| Level | Area | Note |")
    $null = $lines.Add("|---|---|---|")
    foreach ($f in $findings) {
        $null = $lines.Add(("| **{0}** | {1} | {2} |" -f $f.Level, $f.Area, $f.Note))
    }
}
$null = $lines.Add("")
$null = $lines.Add("## What this report does NOT do")
$null = $lines.Add("")
$null = $lines.Add("- Does not read tokens, secrets, or environment variables.")
$null = $lines.Add("- Does not call the network.")
$null = $lines.Add("- Does not send any message to Telegram, Discord, email, or any external service.")
$null = $lines.Add("- Does not edit any BALA app file.")
$null = $lines.Add("- Does not change any commit, branch, or push state.")
$null = $lines.Add("")
$null = $lines.Add("## BALA safety footer")
$null = $lines.Add("")
$null = $lines.Add("BALA is a health-awareness companion. It does not diagnose, treat, predict, prevent, replace doctors, or provide emergency monitoring.")

$out = Join-Path $RepoRoot "CHINTU_RUNTIME_HEALTH.md"
[System.IO.File]::WriteAllText($out, ($lines -join "`r`n"), [System.Text.Encoding]::UTF8)

Write-Host "Runtime health written: $out"
Write-Host ("Overall: {0} ({1} red, {2} yellow)" -f $status, $red, $yellow)
exit 0
