<#
.SYNOPSIS
    Chintu Bridge Loop Reality Check. Is the Windows->bridge->iMac
    Option 12 path actually ready to test today?

.DESCRIPTION
    Read-only inspector. Inspects:
      - shared bridge folder presence
      - CHINTU_BRIDGE_LATEST.zip
      - MANIFEST.txt (and the SHA-256 it advertises)
      - LATEST_FLAT folder
      - the 7 expected flat files
      - latest export timestamps
      - bridge command center report
      - iMac Option 12 package presence under CHINTU_IMAC_PACKAGES/
      - install-option-12.sh presence
      - IMAC_TEST_PLAN.md presence
      - README.md presence

    Writes CHINTU_BRIDGE_LOOP_REALITY_CHECK.md with:
      - GREEN: ready to test iMac Option 12
      - YELLOW: ready but needs founder review
      - RED:  missing bridge package or unsafe state

    Never edits BALA app files, pushes, installs anything, calls the
    network, reads tokens, or sends data anywhere.

.PARAMETER RepoRoot
    Repo root. Defaults to C:\Users\Chintu\Desktop\test.

.PARAMETER SharedDir
    Shared bridge folder. Defaults to:
    $env:USERPROFILE\Desktop\CHINTU_SHARED_BRIDGE.

.PARAMETER StaleHours
    Bridge export older than this many hours is flagged YELLOW.
    Default 24.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\chintu-bridge-loop-reality-check.ps1
#>
[CmdletBinding()]
param(
    [string]$RepoRoot = "C:\Users\Chintu\Desktop\test",
    [string]$SharedDir = "",
    [int]$StaleHours = 24
)

$ErrorActionPreference = "Continue"

if (-not $SharedDir) {
    $SharedDir = Join-Path $env:USERPROFILE "Desktop\CHINTU_SHARED_BRIDGE"
}
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

# --- 1. shared bridge folder -------------------------------------------------
$bridgePresent = Test-Path -LiteralPath $SharedDir -PathType Container
if (-not $bridgePresent) {
    Add-Finding "RED" "bridge" "Shared bridge folder not found: $SharedDir"
}

# --- 2. CHINTU_BRIDGE_LATEST.zip --------------------------------------------
$latestZip = Join-Path $SharedDir "CHINTU_BRIDGE_LATEST.zip"
$zipPresent = Test-Path -LiteralPath $latestZip -PathType Leaf
$zipBytes = 0
$zipAgeHours = 0
if ($zipPresent) {
    $zipItem = Get-Item -LiteralPath $latestZip
    $zipBytes = $zipItem.Length
    $zipAgeHours = ($now - $zipItem.LastWriteTime).TotalHours
    if ($zipBytes -lt 1024) {
        Add-Finding "RED" "bridge" "CHINTU_BRIDGE_LATEST.zip is suspiciously small ($zipBytes bytes)"
    }
    if ($zipAgeHours -gt $StaleHours) {
        Add-Finding "YELLOW" "bridge" ("CHINTU_BRIDGE_LATEST.zip is {0:N1} h old" -f $zipAgeHours)
    }
} elseif ($bridgePresent) {
    Add-Finding "RED" "bridge" "CHINTU_BRIDGE_LATEST.zip missing in $SharedDir"
}

# --- 3. MANIFEST.txt + SHA-256 ----------------------------------------------
$manifestPath = Join-Path $SharedDir "MANIFEST.txt"
$manifestPresent = Test-Path -LiteralPath $manifestPath -PathType Leaf
$manifestSha = ""
$manifestZipName = ""
if ($manifestPresent) {
    $manifestText = Get-Content -LiteralPath $manifestPath -Raw
    if ($manifestText -match 'ZIP_SHA256:\s*([A-Fa-f0-9]{64})') {
        $manifestSha = $matches[1].ToUpper()
    } else {
        Add-Finding "YELLOW" "manifest" "MANIFEST.txt missing ZIP_SHA256 line"
    }
    if ($manifestText -match 'ZIP:\s*(\S+)') {
        $manifestZipName = $matches[1]
    }
} elseif ($bridgePresent) {
    Add-Finding "RED" "manifest" "MANIFEST.txt missing in $SharedDir"
}

# --- 4. Hash check: compare manifest SHA-256 to actual zip -------------------
$actualSha = ""
$hashMatches = $false
if ($zipPresent -and $manifestSha) {
    try {
        $actualSha = (Get-FileHash -LiteralPath $latestZip -Algorithm SHA256).Hash.ToUpper()
        if ($actualSha -eq $manifestSha) {
            $hashMatches = $true
        } else {
            Add-Finding "RED" "manifest" "ZIP SHA-256 mismatch: manifest=$manifestSha actual=$actualSha"
        }
    } catch {
        Add-Finding "YELLOW" "manifest" "Could not hash zip: $_"
    }
}

# --- 5. LATEST_FLAT folder + 7 expected flat files --------------------------
$flatDir = Join-Path $SharedDir "LATEST_FLAT"
$flatPresent = Test-Path -LiteralPath $flatDir -PathType Container
$expectedFlat = @(
    "latest_status.md",
    "latest_bala_validation.md",
    "latest_git_status.md",
    "latest_codex_handoff.md",
    "latest_openclaw_report.md",
    "latest_next_actions.md",
    "BRIDGE_TRANSFER_README.md"
)
$flatFound = @()
$flatMissing = @()
if ($flatPresent) {
    foreach ($f in $expectedFlat) {
        $p = Join-Path $flatDir $f
        if (Test-Path -LiteralPath $p -PathType Leaf) {
            $flatFound += $f
        } else {
            $flatMissing += $f
            Add-Finding "RED" "flat" "LATEST_FLAT missing $f"
        }
    }
} elseif ($bridgePresent) {
    Add-Finding "RED" "flat" "LATEST_FLAT folder missing in $SharedDir"
}

# --- 6. Bridge command center report ----------------------------------------
$ccReport = Join-Path $RepoRoot "chintu-bridge-command-center-report.md"
if (-not (Test-Path -LiteralPath $ccReport)) {
    Add-Finding "YELLOW" "report" "Bridge command center report not present (run chintu-bridge-command-center.ps1)"
}

# --- 7. iMac Option 12 package ----------------------------------------------
$pkgDir = Join-Path $RepoRoot "CHINTU_IMAC_PACKAGES\OPTION_12_PULL_SHARED"
$pkgPresent = Test-Path -LiteralPath $pkgDir -PathType Container
$pkgChecks = @{
    "install-option-12.sh" = Test-Path -LiteralPath (Join-Path $pkgDir "install-option-12.sh")
    "IMAC_TEST_PLAN.md"    = Test-Path -LiteralPath (Join-Path $pkgDir "IMAC_TEST_PLAN.md")
    "README.md"            = Test-Path -LiteralPath (Join-Path $pkgDir "README.md")
}
if (-not $pkgPresent) {
    Add-Finding "RED" "imac-pkg" "iMac Option 12 package folder missing: $pkgDir"
} else {
    foreach ($f in $pkgChecks.Keys) {
        if (-not $pkgChecks[$f]) {
            Add-Finding "RED" "imac-pkg" "iMac package missing: $f"
        }
    }
}

# --- 8. overall verdict ------------------------------------------------------
$status = "GREEN"
if ($red -gt 0) { $status = "RED" }
elseif ($yellow -gt 0) { $status = "YELLOW" }

# --- 9. write report --------------------------------------------------------
$lines = New-Object System.Collections.ArrayList
$null = $lines.Add("# Chintu Bridge Loop Reality Check")
$null = $lines.Add("")
$null = $lines.Add("**Generated:** $stamp")
$null = $lines.Add("**Repo:** $RepoRoot")
$null = $lines.Add("**Shared bridge:** $SharedDir")
$null = $lines.Add("**Bridge folder present:** $bridgePresent")
$null = $lines.Add("**CHINTU_BRIDGE_LATEST.zip present:** $zipPresent")
if ($zipPresent) {
    $null = $lines.Add(("**Zip size:** $zipBytes bytes"))
    $null = $lines.Add(("**Zip age:** {0:N1} h" -f $zipAgeHours))
}
$null = $lines.Add("**MANIFEST.txt present:** $manifestPresent")
if ($manifestSha) {
    $null = $lines.Add("**Manifest SHA-256:** ``$manifestSha``")
    $null = $lines.Add(("**Actual SHA-256:**   ``$actualSha``"))
    $null = $lines.Add("**Hash match:** $hashMatches")
}
$null = $lines.Add("**LATEST_FLAT present:** $flatPresent")
$null = $lines.Add(("**Flat files found:** {0}/{1}" -f $flatFound.Count, $expectedFlat.Count))
$null = $lines.Add("**iMac Option 12 package present:** $pkgPresent")
$null = $lines.Add("")
$null = $lines.Add("## Overall status: **$status**")
$null = $lines.Add("")
switch ($status) {
    "GREEN"  { $null = $lines.Add("Ready to test iMac Option 12. Founder may proceed with the install-now guide.") }
    "YELLOW" { $null = $lines.Add("Bridge is present but $yellow item(s) need founder glance before the iMac test.") }
    "RED"    { $null = $lines.Add("BLOCKED. $red red item(s). Re-run scripts/chintu-bridge-command-center.ps1 or inspect the shared folder before continuing.") }
}
$null = $lines.Add("")
$null = $lines.Add("## Expected flat files")
$null = $lines.Add("")
foreach ($f in $expectedFlat) {
    $tag = if ($flatFound -contains $f) { "[OK]" } else { "[--]" }
    $null = $lines.Add(("- $tag ``$f``"))
}
$null = $lines.Add("")
$null = $lines.Add("## iMac Option 12 package contents")
$null = $lines.Add("")
foreach ($f in $pkgChecks.Keys) {
    $tag = if ($pkgChecks[$f]) { "[OK]" } else { "[--]" }
    $null = $lines.Add(("- $tag ``$f``"))
}
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
$null = $lines.Add("## What this script does NOT do")
$null = $lines.Add("")
$null = $lines.Add("- Does not modify the iMac.")
$null = $lines.Add("- Does not push.")
$null = $lines.Add("- Does not activate Telegram, Discord, webhooks, cloud sync,")
$null = $lines.Add("  phone, voice, backend, or paid APIs.")
$null = $lines.Add("- Does not transfer health data.")
$null = $lines.Add("- Does not call the network or read any token.")
$null = $lines.Add("")
$null = $lines.Add("## BALA safety footer")
$null = $lines.Add("")
$null = $lines.Add("BALA is a health-awareness companion. It does not diagnose, treat, predict, prevent, replace doctors, or provide emergency monitoring.")

$out = Join-Path $RepoRoot "CHINTU_BRIDGE_LOOP_REALITY_CHECK.md"
[System.IO.File]::WriteAllText($out, ($lines -join "`r`n"), [System.Text.Encoding]::UTF8)

Write-Host "Bridge loop reality check written: $out"
Write-Host ("Overall: {0} ({1} red, {2} yellow)" -f $status, $red, $yellow)
exit 0
