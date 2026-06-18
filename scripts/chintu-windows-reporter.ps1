<#
.SYNOPSIS
    Chintu Windows Reporter V1.

.DESCRIPTION
    Local-only Windows-side exporter. Writes the six Markdown bridge files
    defined in CHINTU_BRIDGE_CONTRACT.md into a local outbox folder so the
    founder can transport them to the iMac Control Room manually.

    This script NEVER:
      - installs anything
      - enables any OpenClaw plugin
      - calls external URLs or any network endpoint
      - reads secrets, tokens, .env, openclaw.json, cookies, sessions, or
        paired-device files
      - reads or writes BALA health data
      - pushes to any git remote
      - posts to Telegram, Discord, webhooks, or any messaging surface

    It runs the existing local-only Chintu scripts (validate, release guard,
    agent board, OpenClaw readiness) and captures their text output. It also
    gathers a small git status / recent-log slice from this repo. The output
    is plain Markdown.

.PARAMETER RepoRoot
    Repo to report on. Defaults to C:\Users\Chintu\Desktop\test.

.PARAMETER OutDir
    Outbox folder to write bridge files to. Default:
    C:\Users\Chintu\Desktop\CHINTU_BRIDGE_OUTBOX. Created if missing.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\chintu-windows-reporter.ps1

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\chintu-windows-reporter.ps1 -OutDir "C:\Users\Chintu\Desktop\CHINTU_BRIDGE_OUTBOX"
#>
[CmdletBinding()]
param(
    [string]$RepoRoot = "C:\Users\Chintu\Desktop\test",
    [string]$OutDir = "C:\Users\Chintu\Desktop\CHINTU_BRIDGE_OUTBOX"
)

$ErrorActionPreference = "Continue"

function Write-Section {
    param([string]$Text)
    Write-Host $Text
}

if (-not (Test-Path -LiteralPath $RepoRoot)) {
    Write-Host "STOP: repo root not found: $RepoRoot" -ForegroundColor Red
    exit 2
}
Set-Location -LiteralPath $RepoRoot

if (-not (Test-Path -LiteralPath $OutDir)) {
    try {
        New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
    } catch {
        Write-Host ("STOP: could not create outbox folder: {0}" -f $OutDir) -ForegroundColor Red
        exit 2
    }
}

$stamp = Get-Date -Format "yyyy-MM-dd HH:mm"
$stampSlug = Get-Date -Format "yyyy-MM-dd"

function Safe-Invoke {
    param([scriptblock]$Script, [string]$Label)
    $out = @()
    try {
        $out = & $Script 2>&1
    } catch {
        $out = @("(error running {0}: {1})" -f $Label, $_.Exception.Message)
    }
    if ($null -eq $out) { return @() }
    return @($out | ForEach-Object { [string]$_ })
}

function Safe-Run-Script {
    param([string]$ScriptRelPath, [string]$Label)
    $full = Join-Path $RepoRoot $ScriptRelPath
    if (-not (Test-Path -LiteralPath $full)) {
        return @("(skipped: {0} not found at {1})" -f $Label, $ScriptRelPath)
    }
    return Safe-Invoke -Label $Label -Script {
        & powershell -NoProfile -ExecutionPolicy Bypass -File $full
    }
}

function To-MdFence {
    param([string[]]$Lines)
    $fence = '```'
    if ($null -eq $Lines -or $Lines.Count -eq 0) {
        return @($fence, '(no output)', $fence)
    }
    $body = @($fence)
    foreach ($line in $Lines) {
        $body += $line
    }
    $body += $fence
    return $body
}

function Write-MdFile {
    param([string]$FileName, [string[]]$Lines)
    $target = Join-Path $OutDir $FileName
    try {
        $Lines | Set-Content -LiteralPath $target -Encoding ASCII
        Write-Host ("Wrote {0}" -f $target)
    } catch {
        Write-Host ("FAILED to write {0}: {1}" -f $target, $_.Exception.Message) -ForegroundColor Red
    }
}

Write-Section "Chintu Windows Reporter V1 - $stamp"
Write-Section "Repo:    $RepoRoot"
Write-Section "Outbox:  $OutDir"

# --- Gather git state -------------------------------------------------------
$gitStatus      = Safe-Invoke -Label "git status --short" -Script { & git status --short }
$gitLog         = Safe-Invoke -Label "git log -10"       -Script { & git log --oneline -10 }
$gitUnpushed    = Safe-Invoke -Label "git log unpushed"  -Script { & git log --oneline origin/main..HEAD }
$branch         = (Safe-Invoke -Label "branch" -Script { & git rev-parse --abbrev-ref HEAD }) -join ""
$head           = (Safe-Invoke -Label "HEAD"   -Script { & git rev-parse --short HEAD })       -join ""
$origin         = (Safe-Invoke -Label "origin" -Script { & git rev-parse --short origin/main }) -join ""
if (-not $branch) { $branch = "(unknown)" }
if (-not $head)   { $head   = "(unknown)" }
if (-not $origin) { $origin = "(unknown)" }
$treeClean = (@($gitStatus | Where-Object { $_.Trim() -ne "" }).Count -eq 0)
$unpushedCount = @($gitUnpushed | Where-Object { $_.Trim() -ne "" }).Count

# --- Run Chintu scripts -----------------------------------------------------
$validateOut    = Safe-Run-Script -ScriptRelPath "scripts\chintu-validate.ps1"          -Label "chintu-validate"
$guardOut       = Safe-Run-Script -ScriptRelPath "scripts\chintu-release-guard.ps1"     -Label "chintu-release-guard"
$boardOut       = Safe-Run-Script -ScriptRelPath "scripts\chintu-agent-board.ps1"       -Label "chintu-agent-board"

# OpenClaw readiness may time out on the external CLI; capture whatever is on disk.
$openclawReportPath = Join-Path $RepoRoot "chintu-openclaw-readiness-report.md"
$openclawReportLines = @()
if (Test-Path -LiteralPath $openclawReportPath) {
    try {
        $openclawReportLines = Get-Content -LiteralPath $openclawReportPath -ErrorAction Stop
    } catch {
        $openclawReportLines = @("(failed to read {0}: {1})" -f $openclawReportPath, $_.Exception.Message)
    }
} else {
    $openclawReportLines = @("(no chintu-openclaw-readiness-report.md on disk; OpenClaw readiness not captured this run)")
}

# Next sprint queue
$nextSprintPath = Join-Path $RepoRoot "CHINTU_MEMORY_VAULT\NEXT_SPRINT_QUEUE.md"
$nextSprintLines = @()
if (Test-Path -LiteralPath $nextSprintPath) {
    try {
        $nextSprintLines = Get-Content -LiteralPath $nextSprintPath -ErrorAction Stop
    } catch {
        $nextSprintLines = @("(failed to read {0}: {1})" -f $nextSprintPath, $_.Exception.Message)
    }
} else {
    $nextSprintLines = @("(no CHINTU_MEMORY_VAULT/NEXT_SPRINT_QUEUE.md on disk)")
}

# --- Build bridge files -----------------------------------------------------

$header = @(
    "<!-- generated by scripts/chintu-windows-reporter.ps1 at $stamp -->",
    "<!-- Source repo: $RepoRoot -->",
    "<!-- Privacy: no health data, no secrets, no network egress -->",
    ""
)

# 1. latest_status.md
$statusLines = @()
$statusLines += $header
$statusLines += "# Chintu Status - $stamp"
$statusLines += ""
$statusLines += "Branch: $branch"
$statusLines += "HEAD: $head"
$statusLines += "origin/main: $origin"
if ($treeClean) { $statusLines += "Working tree: CLEAN" } else { $statusLines += "Working tree: DIRTY" }
$statusLines += ("Unpushed commits: {0}" -f $unpushedCount)
$statusLines += ""
$statusLines += "## Agent board output"
$statusLines += ""
$statusLines += To-MdFence -Lines $boardOut
Write-MdFile -FileName "latest_status.md" -Lines $statusLines

# 2. latest_bala_validation.md
$validationLines = @()
$validationLines += $header
$validationLines += "# BALA Validation - $stamp"
$validationLines += ""
$validationLines += "## chintu-validate output"
$validationLines += ""
$validationLines += To-MdFence -Lines $validateOut
$validationLines += ""
$validationLines += "## chintu-release-guard output"
$validationLines += ""
$validationLines += To-MdFence -Lines $guardOut
Write-MdFile -FileName "latest_bala_validation.md" -Lines $validationLines

# 3. latest_git_status.md
$gitLines = @()
$gitLines += $header
$gitLines += "# Git State - $stamp"
$gitLines += ""
$gitLines += "Branch: $branch"
$gitLines += "HEAD: $head"
$gitLines += "origin/main: $origin"
$gitLines += ""
$gitLines += "## git status --short"
$gitLines += ""
if (@($gitStatus | Where-Object { $_.Trim() -ne "" }).Count -eq 0) {
    $gitLines += To-MdFence -Lines @("(working tree clean)")
} else {
    $gitLines += To-MdFence -Lines $gitStatus
}
$gitLines += ""
$gitLines += "## git log --oneline -10"
$gitLines += ""
$gitLines += To-MdFence -Lines $gitLog
$gitLines += ""
$gitLines += "## Unpushed commits (origin/main..HEAD)"
$gitLines += ""
if ($unpushedCount -eq 0) {
    $gitLines += To-MdFence -Lines @("(none)")
} else {
    $gitLines += To-MdFence -Lines $gitUnpushed
}
Write-MdFile -FileName "latest_git_status.md" -Lines $gitLines

# 4. latest_codex_handoff.md
$codexLines = @()
$codexLines += $header
$codexLines += "# Codex Handoff - $stamp"
$codexLines += ""
$codexLines += "Codex agent: PARKED (reactivate only when explicitly requested by the founder)."
$codexLines += ""
$codexLines += "Recent Codex-attributed work (per release history):"
$codexLines += ""
$codexLines += '- `6c4393e` fix: disable webhook health-data egress'
$codexLines += '- `901e7ca` fix: keep latest snapshot aligned with history (snapshot helper + regression test)'
$codexLines += ""
$codexLines += "No new Codex sessions are queued. See CHINTU_MEMORY_VAULT/CHINTU_AGENT_ARCHITECTURE.md for"
$codexLines += "reactivation conditions."
Write-MdFile -FileName "latest_codex_handoff.md" -Lines $codexLines

# 5. latest_openclaw_report.md
$openclawLines = @()
$openclawLines += $header
$openclawLines += "# OpenClaw Readiness - $stamp"
$openclawLines += ""
$openclawLines += "Source file on Windows: chintu-openclaw-readiness-report.md (gitignored)."
$openclawLines += "memory-wiki remains DISABLED until explicit founder approval."
$openclawLines += ""
$openclawLines += "## Last readiness report on disk"
$openclawLines += ""
$openclawLines += $openclawReportLines
Write-MdFile -FileName "latest_openclaw_report.md" -Lines $openclawLines

# 6. latest_next_actions.md
$nextLines = @()
$nextLines += $header
$nextLines += "# Next Actions - $stamp"
$nextLines += ""
$nextLines += "Source: CHINTU_MEMORY_VAULT/NEXT_SPRINT_QUEUE.md"
$nextLines += ""
$nextLines += $nextSprintLines
Write-MdFile -FileName "latest_next_actions.md" -Lines $nextLines

# --- Local report summary (gitignored) --------------------------------------
$reportPath = Join-Path $RepoRoot "chintu-windows-reporter-report.md"
$summary = @()
$summary += "# Chintu Windows Reporter Report"
$summary += ""
$summary += "**Generated:** $stamp"
$summary += "**Repo:** $RepoRoot"
$summary += "**Outbox:** $OutDir"
$summary += ""
$summary += "## Files written"
$summary += ""
$summary += "- latest_status.md"
$summary += "- latest_bala_validation.md"
$summary += "- latest_git_status.md"
$summary += "- latest_codex_handoff.md"
$summary += "- latest_openclaw_report.md"
$summary += "- latest_next_actions.md"
$summary += ""
$summary += "## Repo snapshot"
$summary += ""
$summary += "- Branch: $branch"
$summary += "- HEAD: $head"
$summary += "- origin/main: $origin"
if ($treeClean) {
    $summary += "- Working tree: CLEAN"
} else {
    $summary += "- Working tree: DIRTY"
}
$summary += ("- Unpushed commits: {0}" -f $unpushedCount)
$summary += ""
$summary += "## Safety posture"
$summary += ""
$summary += "- No health data was written."
$summary += "- No secrets, tokens, or paired-device files were read."
$summary += "- No network egress."
$summary += "- No plugin install or enable."
$summary += "- No git push."
$summary += ""
$summary += "## Transport"
$summary += ""
$summary += "Move the outbox files to the iMac via the founder's chosen transport"
$summary += "(USB drive, cloud sync folder, network share, or manual copy). Drop them"
$summary += 'into `~/Documents/CHINTU_CONTROL_ROOM/BRIDGE/FROM_WINDOWS/` on the iMac.'
$summary += ""
$summary += "*Generated locally. Human transport only.*"

try {
    $summary | Set-Content -LiteralPath $reportPath -Encoding ASCII
    Write-Host ("Local report: {0}" -f $reportPath)
} catch {
    Write-Host ("FAILED to write local report: {0}" -f $_.Exception.Message) -ForegroundColor Red
}

Write-Section ""
Write-Section "Chintu Windows Reporter complete."
Write-Section ("Outbox: {0}" -f $OutDir)
Write-Section "Files: latest_status.md, latest_bala_validation.md, latest_git_status.md, latest_codex_handoff.md, latest_openclaw_report.md, latest_next_actions.md"
Write-Section "Next step: transport to iMac BRIDGE/FROM_WINDOWS/ (manual copy)."

exit 0
