<#
  Chintu Agent Runner
  Creates a local run folder from an agent packet, executes its validation
  commands, and saves a structured run report.

  Usage:
    powershell -ExecutionPolicy Bypass -File scripts\chintu-agent-runner.ps1 -Agent "validator-agent"
    powershell -ExecutionPolicy Bypass -File scripts\chintu-agent-runner.ps1 -Agent "research-agent" -DryRun
    powershell -ExecutionPolicy Bypass -File scripts\chintu-agent-runner.ps1 -ListAgents

  Safety:
    - No network calls.
    - No secrets read or written.
    - No connector activation.
    - No health data transfer.
    - Validation commands run locally only.
#>

param(
  [string]$Agent = "",
  [switch]$DryRun,
  [switch]$ListAgents
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$packetsDir = Join-Path $repoRoot "CHINTU_AGENT_PACKETS"
$runsDir = Join-Path $repoRoot "CHINTU_AGENT_RUNS"

if (-not (Test-Path $runsDir)) {
  New-Item -ItemType Directory -Path $runsDir -Force | Out-Null
}

# List available agents
$packetFiles = Get-ChildItem -Path $packetsDir -Filter "*.packet.md" -ErrorAction SilentlyContinue
$agentNames = @()
foreach ($file in $packetFiles) {
  $agentNames += $file.BaseName -replace '\.packet$', ''
}

if ($ListAgents -or ($Agent -eq "")) {
  Write-Host "Chintu Agent Runner"
  Write-Host "==================="
  Write-Host ""
  Write-Host "Available agent packets:"
  foreach ($name in ($agentNames | Sort-Object)) {
    Write-Host "  - $name"
  }
  Write-Host ""
  Write-Host "Usage: scripts\chintu-agent-runner.ps1 -Agent <name>"
  Write-Host "Add -DryRun to skip validation command execution."
  exit 0
}

# Resolve packet
$packetFile = Join-Path $packetsDir "$Agent.packet.md"
if (-not (Test-Path $packetFile)) {
  Write-Host "ERROR: Agent packet not found: $packetFile"
  Write-Host "Available agents: $($agentNames -join ', ')"
  exit 1
}

# Create timestamped run folder
$timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$runId = "$Agent`_$timestamp"
$runDir = Join-Path $runsDir $runId

New-Item -ItemType Directory -Path $runDir -Force | Out-Null

# Copy the packet into the run folder
Copy-Item -Path $packetFile -Destination (Join-Path $runDir "packet.md")

Write-Host "Chintu Agent Runner"
Write-Host "==================="
Write-Host "Agent:    $Agent"
Write-Host "Run ID:   $runId"
Write-Host "Run dir:  $runDir"
Write-Host "Dry run:  $DryRun"
Write-Host ""

# Parse validation commands from the packet
$packetContent = Get-Content -Path $packetFile -Raw
$inValidation = $false
$validationCommands = @()
foreach ($line in ($packetContent -split "`n")) {
  $trimmed = $line.Trim()
  if ($trimmed -match "^## Validation Commands") {
    $inValidation = $true
    continue
  }
  if ($inValidation -and $trimmed -match "^## ") {
    break
  }
  if ($inValidation -and $trimmed -match "^- ``(.+)``$") {
    $validationCommands += $Matches[1]
  }
}

Write-Host "Validation commands found: $($validationCommands.Count)"
foreach ($cmd in $validationCommands) {
  Write-Host "  - $cmd"
}
Write-Host ""

# Execute validation commands
$results = @()
$allPassed = $true

if ($DryRun) {
  Write-Host "[DRY RUN] Skipping command execution."
  foreach ($cmd in $validationCommands) {
    $results += @{
      command = $cmd
      status = "skipped"
      exit_code = $null
      output = "Dry run - not executed"
    }
  }
} else {
  foreach ($cmd in $validationCommands) {
    Write-Host "Running: $cmd"
    $cmdOutput = ""
    $cmdExitCode = 0
    try {
      $cmdOutput = Invoke-Expression $cmd 2>&1 | Out-String
      $cmdExitCode = $LASTEXITCODE
      if ($null -eq $cmdExitCode) { $cmdExitCode = 0 }
    } catch {
      $cmdOutput = $_.Exception.Message
      $cmdExitCode = 1
    }
    $passed = ($cmdExitCode -eq 0)
    if (-not $passed) { $allPassed = $false }
    $statusLabel = if ($passed) { "PASS" } else { "FAIL" }
    Write-Host "  [$statusLabel] exit code $cmdExitCode"
    $results += @{
      command = $cmd
      status = $statusLabel.ToLower()
      exit_code = $cmdExitCode
      output = $cmdOutput.Trim()
    }
  }
}

# Write run report
$reportLines = @(
  "# Agent Run Report"
  ""
  "- **Agent:** $Agent"
  "- **Run ID:** $runId"
  "- **Timestamp:** $(Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ')"
  "- **Dry run:** $DryRun"
  "- **Overall:** $(if ($DryRun) { 'skipped' } elseif ($allPassed) { 'PASS' } else { 'FAIL' })"
  ""
  "## Validation Results"
  ""
)

foreach ($r in $results) {
  $reportLines += "### ``$($r.command)``"
  $reportLines += ""
  $reportLines += "- Status: **$($r.status)**"
  if ($null -ne $r.exit_code) {
    $reportLines += "- Exit code: $($r.exit_code)"
  }
  $reportLines += ""
  if ($r.output -and $r.output -ne "Dry run - not executed") {
    $reportLines += "``````"
    $outputTruncated = $r.output
    if ($outputTruncated.Length -gt 2000) {
      $outputTruncated = $outputTruncated.Substring(0, 2000) + "`n... (truncated)"
    }
    $reportLines += $outputTruncated
    $reportLines += "``````"
  }
  $reportLines += ""
}

$reportLines += "---"
$reportLines += "No network calls. No secrets. No connector activation. No health data transfer."

$reportPath = Join-Path $runDir "run-report.md"
$reportLines -join "`n" | Out-File -FilePath $reportPath -Encoding utf8

# Write JSON summary
$jsonSummary = @{
  agent = $Agent
  run_id = $runId
  timestamp = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
  dry_run = [bool]$DryRun
  overall = if ($DryRun) { "skipped" } elseif ($allPassed) { "pass" } else { "fail" }
  command_count = $validationCommands.Count
  results = @()
}
foreach ($r in $results) {
  $jsonSummary.results += @{
    command = $r.command
    status = $r.status
    exit_code = $r.exit_code
  }
}
$jsonPath = Join-Path $runDir "run-summary.json"
$jsonText = $jsonSummary | ConvertTo-Json -Depth 4
[System.IO.File]::WriteAllText($jsonPath, $jsonText, (New-Object System.Text.UTF8Encoding $false))

Write-Host ""
Write-Host "Run report:  $reportPath"
Write-Host "Run summary: $jsonPath"
Write-Host "Overall:     $(if ($DryRun) { 'SKIPPED (dry run)' } elseif ($allPassed) { 'PASS' } else { 'FAIL' })"
