<#
.SYNOPSIS
    Chintu Agent Board - local planning board for specialist work packets.

.DESCRIPTION
    Reads CHINTU_AGENT_BOARD.md and CHINTU_AGENT_PACKETS/*.md, verifies that
    every packet includes the required bounded sections, and writes a factual
    local report to chintu-agent-board-report.md.

    This script does not run external agents, does not activate connectors,
    does not send messages, and does not perform network egress. Packets are
    planning prompts only.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\chintu-agent-board.ps1
#>
[CmdletBinding()]
param(
    [string]$RepoRoot = "C:\Users\Chintu\Desktop\test",
    [string]$ReportPath = ""
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $RepoRoot)) {
    Write-Host "FAIL: repo root not found: $RepoRoot" -ForegroundColor Red
    exit 2
}

Set-Location -LiteralPath $RepoRoot

$boardPath = Join-Path $RepoRoot "CHINTU_AGENT_BOARD.md"
$packetDir = Join-Path $RepoRoot "CHINTU_AGENT_PACKETS"
$defaultReport = Join-Path $RepoRoot "chintu-agent-board-report.md"

if ([string]::IsNullOrWhiteSpace($ReportPath)) {
    $ReportPath = $defaultReport
}

if (-not (Test-Path -LiteralPath $boardPath)) {
    Write-Host "FAIL: missing board file: $boardPath" -ForegroundColor Red
    exit 2
}
if (-not (Test-Path -LiteralPath $packetDir)) {
    Write-Host "FAIL: missing packet directory: $packetDir" -ForegroundColor Red
    exit 2
}

$requiredSections = @(
    "## Mission",
    "## Files To Inspect",
    "## Protected Files",
    "## Allowed Actions",
    "## Forbidden Actions",
    "## Validation Commands",
    "## Suggested Commit Name",
    "## Stop Condition",
    "## Copy-Paste Prompt For Codex/Claude"
)

$packetFiles = Get-ChildItem -LiteralPath $packetDir -Filter "*.md" | Sort-Object Name
if ($packetFiles.Count -eq 0) {
    Write-Host "FAIL: no packet files found in $packetDir" -ForegroundColor Red
    exit 2
}

$stamp = Get-Date -Format "yyyy-MM-dd HH:mm"
$branch = (& git rev-parse --abbrev-ref HEAD 2>$null)
if (-not $branch) { $branch = "(unknown)" }
$head = (& git rev-parse --short HEAD 2>$null)
if (-not $head) { $head = "(unknown)" }
$statusShort = @(& git status --short 2>$null | Where-Object { $_.Trim() -ne "" })
$treeState = if ($statusShort.Count -eq 0) { "CLEAN" } else { "dirty($($statusShort.Count))" }

$packetRows = New-Object System.Collections.Generic.List[object]
$allReady = $true
foreach ($packet in $packetFiles) {
    $text = Get-Content -LiteralPath $packet.FullName -Raw
    $packetLines = $text -split "`r?`n"
    $missing = @()
    foreach ($section in $requiredSections) {
        if ($text -notmatch [regex]::Escape($section)) {
            $missing += $section
        }
    }

    $titleLine = ($packetLines | Where-Object { $_ -match "^# " } | Select-Object -First 1)
    $title = if ($titleLine) { $titleLine -replace "^#\s*", "" } else { $packet.BaseName }
    $commitLine = "(not found)"
    for ($i = 0; $i -lt $packetLines.Count; $i++) {
        if ($packetLines[$i] -eq "## Suggested Commit Name") {
            for ($j = $i + 1; $j -lt $packetLines.Count; $j++) {
                $candidate = $packetLines[$j].Trim()
                if ($candidate -match "^- ") {
                    $commitLine = $candidate
                    break
                }
                if ($candidate -match "^## ") {
                    break
                }
            }
            break
        }
    }
    $ready = $missing.Count -eq 0
    if (-not $ready) { $allReady = $false }

    $packetRows.Add([pscustomobject]@{
        Name = $packet.Name
        Title = $title
        Ready = $ready
        Missing = $missing
        Commit = $commitLine
    }) | Out-Null
}

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("# Chintu Agent Board Report")
$lines.Add("")
$lines.Add("**Generated:** $stamp  ")
$lines.Add("**Repo:** $RepoRoot  ")
$lines.Add("**Branch:** $branch  ")
$lines.Add("**HEAD:** ``$head``  ")
$lines.Add("**Working tree:** $treeState")
$lines.Add("")
$lines.Add("## Board Status")
$lines.Add("")
$lines.Add('- Board file: `CHINTU_AGENT_BOARD.md`')
$lines.Add('- Packet directory: `CHINTU_AGENT_PACKETS/`')
$lines.Add("- Specialist packets found: $($packetFiles.Count)")
$lines.Add("- Packet structure verdict: " + $(if ($allReady) { "READY" } else { "FIX MISSING SECTIONS" }))
$lines.Add("- Real agents run: no")
$lines.Add("- Network egress: none")
$lines.Add("- Connector activation: none")
$lines.Add("")
$lines.Add("## Specialist Lanes")
$lines.Add("")
foreach ($row in $packetRows) {
    $lines.Add("- **$($row.Title)** - $($row.Name) - " + $(if ($row.Ready) { "ready" } else { "needs fixes" }))
}
$lines.Add("")
$lines.Add("## Packet Checks")
$lines.Add("")
foreach ($row in $packetRows) {
    $lines.Add("### $($row.Title)")
    $lines.Add("")
    $lines.Add("- File: ``CHINTU_AGENT_PACKETS/$($row.Name)``")
    $lines.Add("- Suggested commit: $($row.Commit)")
    if ($row.Ready) {
        $lines.Add("- Required sections: complete")
    } else {
        $lines.Add("- Required sections missing:")
        foreach ($section in $row.Missing) {
            $lines.Add("  - $section")
        }
    }
    $lines.Add("")
}
$lines.Add("## Founder Reminder")
$lines.Add("")
$lines.Add("- Packets are copy-paste prompts only.")
$lines.Add("- Use one packet per specialist run.")
$lines.Add("- Validate locally, commit if green, and stop before push.")
$lines.Add("")
$lines.Add("## Safety Footer")
$lines.Add("")
$lines.Add("BALA is a health-awareness companion. It does not diagnose, treat, predict, prevent, replace doctors, or provide emergency monitoring.")

$report = $lines -join "`r`n"
Set-Content -LiteralPath $ReportPath -Value $report -Encoding utf8

Write-Host "Agent board report written: $ReportPath" -ForegroundColor Green
Write-Host ("Packet verdict: " + $(if ($allReady) { "READY" } else { "FIX MISSING SECTIONS" }))

if ($allReady) { exit 0 } else { exit 1 }
