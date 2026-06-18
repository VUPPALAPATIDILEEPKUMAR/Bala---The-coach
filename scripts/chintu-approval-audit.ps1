<#
.SYNOPSIS
    Append one founder approval row to CHINTU_APPROVAL_AUDIT.md.

.DESCRIPTION
    Local-only helper for the planner approval workflow. Validates an
    exact `approve <id>` phrase, reads local git metadata, and appends
    one markdown-table row to the tracked approval audit log.

    No network. No sending. No BALA app edits. No secrets.

.PARAMETER ApprovalPhrase
    Exact founder approval phrase, for example:
    approve A6-flip-telegram-dry-run

.PARAMETER Notes
    Optional short note stored in the final column.

.PARAMETER RepoRoot
    Repo root. Defaults to the parent of this script folder.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\chintu-approval-audit.ps1 -ApprovalPhrase "approve A6-flip-telegram-dry-run"
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ApprovalPhrase,
    [string]$Notes = "",
    [string]$RepoRoot = ""
)

$ErrorActionPreference = "Stop"

if (-not $RepoRoot) {
    $RepoRoot = Split-Path -Parent $PSScriptRoot
}
if (-not (Test-Path -LiteralPath $RepoRoot -PathType Container)) {
    Write-Host "FAIL: repo root not found: $RepoRoot"
    exit 2
}
$RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
Set-Location -LiteralPath $RepoRoot

$auditPath = Join-Path $RepoRoot "CHINTU_APPROVAL_AUDIT.md"
if (-not (Test-Path -LiteralPath $auditPath -PathType Leaf)) {
    Write-Host "FAIL: approval audit file not found: $auditPath"
    exit 2
}

$normalizedPhrase = $ApprovalPhrase.Trim()
if ($normalizedPhrase -notmatch '^approve\s+([A-Za-z0-9][A-Za-z0-9-]*)$') {
    Write-Host "FAIL: approval phrase must match: approve <id>"
    exit 2
}
$actionId = $Matches[1]

function To-TableCell {
    param([AllowNull()][string]$Value)

    if ([string]::IsNullOrWhiteSpace($Value)) { return "-" }
    return (($Value -replace '\|', '/') -replace '\r?\n', ' ').Trim()
}

$stamp = Get-Date -Format "yyyy-MM-dd HH:mm zzz"
$branch = (& git rev-parse --abbrev-ref HEAD 2>$null)
if (-not $branch) { $branch = "(unknown)" }
$head = (& git rev-parse --short HEAD 2>$null)
if (-not $head) { $head = "(unknown)" }

$row = "| $stamp | ``$actionId`` | ``$normalizedPhrase`` | ``$(To-TableCell $branch)`` | ``$(To-TableCell $head)`` | $(To-TableCell $Notes) |"

$text = Get-Content -LiteralPath $auditPath -Raw
$marker = "## BALA safety footer"
$markerIndex = $text.IndexOf($marker)
if ($markerIndex -lt 0) {
    Write-Host "FAIL: approval audit footer marker missing"
    exit 2
}

$before = $text.Substring(0, $markerIndex).TrimEnd("`r", "`n")
$after = $text.Substring($markerIndex)
$updated = $before + "`r`n" + $row + "`r`n`r`n" + $after

[System.IO.File]::WriteAllText($auditPath, $updated, [System.Text.Encoding]::UTF8)

Write-Host "Approval audit appended: $auditPath"
Write-Host "Action id: $actionId"
Write-Host "Phrase: $normalizedPhrase"
exit 0
