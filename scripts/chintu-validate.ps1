<#
.SYNOPSIS
    BALA / Chintu local validation runner.

.DESCRIPTION
    Read-only, local-first validation for the BALA PWA repo. Produces a
    deterministic PASS / WARN / FAIL report and (optionally) writes it to a
    local file. It NEVER pushes, commits, installs, calls an external URL, or
    reads secrets (.env / paired.json / tokens / gateway config).

    Checks:
      [A] git working tree + unpushed commits + diff scope
      [B] JS syntax (app.js, sw.js, config.js) via node --check
      [C] service worker CACHE_NAME version
      [D] manifest.webmanifest valid JSON + shortcut action targets wired
      [E] medical-safety phrase scan (forbidden claims minus known-safe lines)
      [F] privacy / secret phrase scan
      [G] key Chintu / BALA handoff files exist

    Severity rules:
      FAIL  - syntax error, invalid manifest, real secret, or real medical claim. STOP.
      WARN  - non-blocking: only known-safe disclaimers matched; assets changed
              but SW cache maybe not bumped; high unpushed count; missing doc.
      PASS  - all green (or medical matched only known-safe disclaimers).

.PARAMETER RepoRoot
    Repo under test. Defaults to C:\Users\Chintu\Desktop\test.

.PARAMETER OutFile
    Where to write the report. Defaults to <RepoRoot>\last-validation.txt
    (gitignored). Use -NoFile to skip writing.

.PARAMETER NoFile
    Do not write any report file; print to console only.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\chintu-validate.ps1
#>
[CmdletBinding()]
param(
    [string]$RepoRoot = "C:\Users\Chintu\Desktop\test",
    [string]$OutFile = "",
    [switch]$NoFile
)

$ErrorActionPreference = "Continue"

# ---- result accumulation -------------------------------------------------
$script:Lines = New-Object System.Collections.Generic.List[string]
$script:Fails = 0
$script:Warns = 0

function Add-Line([string]$text) { $script:Lines.Add($text) | Out-Null }
function Note-Fail { $script:Fails++ }
function Note-Warn { $script:Warns++ }

# ---- preflight -----------------------------------------------------------
if (-not (Test-Path -LiteralPath $RepoRoot)) {
    Write-Host "FAIL: repo root not found: $RepoRoot" -ForegroundColor Red
    exit 2
}
Set-Location -LiteralPath $RepoRoot

$stamp = Get-Date -Format "yyyy-MM-dd HH:mm"
$branch = (& git rev-parse --abbrev-ref HEAD 2>$null)
if (-not $branch) { $branch = "(unknown)" }

Add-Line "CHINTU VALIDATION - $stamp"
Add-Line "Repo: $RepoRoot | Branch: $branch"
Add-Line ""

# ---- [A] git state -------------------------------------------------------
$statusRaw = (& git status --short 2>$null)
if ([string]::IsNullOrWhiteSpace($statusRaw)) {
    Add-Line "[A] Tree        : CLEAN"
} else {
    $dirtyN = ($statusRaw -split "`n" | Where-Object { $_.Trim() -ne "" }).Count
    Add-Line "[A] Tree        : dirty($dirtyN)"
    Note-Warn
}

$unpushed = @(& git log --oneline origin/main..HEAD 2>$null | Where-Object { $_.Trim() -ne "" })
$unN = $unpushed.Count
Add-Line "[A] Unpushed    : $unN commit(s)"
if ($unN -ge 20) { Note-Warn }

$diffStat = @(& git diff --stat origin/main..HEAD 2>$null | Where-Object { $_.Trim() -ne "" })
if ($diffStat.Count -gt 0) {
    $diffSummary = $diffStat[$diffStat.Count - 1].Trim()
    Add-Line "[A] Diff scope  : $diffSummary"
}

# ---- [B] JS syntax -------------------------------------------------------
$syntaxOk = $true
$syntaxDetail = @()
foreach ($f in @("app.js", "sw.js", "config.js")) {
    if (-not (Test-Path -LiteralPath $f)) {
        $syntaxDetail += "$f MISSING"
        $syntaxOk = $false
        continue
    }
    & node --check $f 2>$null
    if ($LASTEXITCODE -ne 0) {
        $syntaxDetail += "$f FAIL"
        $syntaxOk = $false
    }
}
if ($syntaxOk) {
    Add-Line "[B] Syntax      : PASS (app.js, sw.js, config.js)"
} else {
    Add-Line "[B] Syntax      : FAIL -> $($syntaxDetail -join ', ')"
    Note-Fail
}

# ---- [C] service worker cache version ------------------------------------
$cacheVer = "(not found)"
if (Test-Path -LiteralPath "sw.js") {
    $m = Select-String -Path "sw.js" -Pattern 'CACHE_NAME\s*=\s*"([^"]+)"' | Select-Object -First 1
    if ($m) { $cacheVer = $m.Matches[0].Groups[1].Value }
}
Add-Line "[C] SW cache    : $cacheVer"

# ---- [D] manifest + shortcuts --------------------------------------------
if (Test-Path -LiteralPath "manifest.webmanifest") {
    try {
        $man = Get-Content -LiteralPath "manifest.webmanifest" -Raw | ConvertFrom-Json
        $urls = @()
        if ($man.shortcuts) { $urls = @($man.shortcuts.url) }
        Add-Line "[D] Manifest    : VALID | shortcuts: $($urls -join ', ')"
        # Verify each ?action= target appears in app.js
        if ((Test-Path -LiteralPath "app.js") -and $urls.Count -gt 0) {
            $appText = Get-Content -LiteralPath "app.js" -Raw
            foreach ($u in $urls) {
                if ($u -match 'action=([A-Za-z0-9_-]+)') {
                    $act = $Matches[1]
                    if ($appText -notmatch [regex]::Escape($act)) {
                        Add-Line "              ! shortcut target '$act' not referenced in app.js"
                        Note-Warn
                    }
                }
            }
        }
    } catch {
        Add-Line "[D] Manifest    : FAIL (invalid JSON)"
        Note-Fail
    }
} else {
    Add-Line "[D] Manifest    : FAIL (manifest.webmanifest missing)"
    Note-Fail
}

# ---- [E] medical-safety scan ---------------------------------------------
# Forbidden-claim patterns. Bare 'cure'/'prevent' omitted on purpose to avoid
# securely/preventDefault false positives.
$medPat = 'predict.*(heart|cardiac|attack)|heart attack|cardiac arrest|' +
          'detect.*disease|diagnos|treat(s|ed|ing)? .*(disease|condition|illness)|' +
          'emergency monitor|early warning sign|replace.*(doctor|physician|professional)'
# Substrings that mark a matched line as a KNOWN-SAFE disclaimer / guidance.
$medSafe = @(
    'does not provide diagnosis',
    'does not diagnose',
    'not diagnose or replace',
    'does not replace',
    'not medical advice',
    'Treat it as one body signal',
    'Seek medical advice',
    'seek medical help',
    'supports health awareness'
)
$medFiles = @("app.js", "index.html") | Where-Object { Test-Path -LiteralPath $_ }
$medHits = @(Select-String -Path $medFiles -Pattern $medPat)
$medReal = @()
$medKnown = @()
foreach ($h in $medHits) {
    $line = $h.Line
    $isSafe = $false
    foreach ($s in $medSafe) { if ($line -like "*$s*") { $isSafe = $true; break } }
    $loc = "$([System.IO.Path]::GetFileName($h.Path)):$($h.LineNumber)"
    if ($isSafe) { $medKnown += $loc } else { $medReal += $loc }
}
if ($medReal.Count -gt 0) {
    Add-Line "[E] Medical     : FAIL (claim at $($medReal -join ', '))"
    Note-Fail
} elseif ($medKnown.Count -gt 0) {
    Add-Line "[E] Medical     : WARN (only known-safe disclaimers: $($medKnown -join ', '))"
    Note-Warn
} else {
    Add-Line "[E] Medical     : PASS"
}

# ---- [F] privacy / secret scan -------------------------------------------
$secPat = 'api[_-]?key\s*[:=]\s*["'']|secret\s*[:=]\s*["'']|Bearer [A-Za-z0-9]{12}|' +
          'token\s*[:=]\s*["''][A-Za-z0-9]|password\s*[:=]'
$secFiles = @("app.js", "config.js", "wrangler.toml") | Where-Object { Test-Path -LiteralPath $_ }
$secHits = @(Select-String -Path $secFiles -Pattern $secPat)
if ($secHits.Count -gt 0) {
    $locs = @($secHits | ForEach-Object { "$([System.IO.Path]::GetFileName($_.Path)):$($_.LineNumber)" })
    Add-Line "[F] Privacy     : FAIL (possible secret at $($locs -join ', '))"
    Note-Fail
} else {
    Add-Line "[F] Privacy     : PASS (no secret patterns)"
}

# ---- [G] key handoff / doc files exist -----------------------------------
$keyFiles = @(
    "CHINTU_HANDOFF.md",
    "CHINTU_INTELLIGENCE_LAYERS.md",
    "docs/BALA_SECURITY_RULES.md",
    "docs/BALA_PRODUCT_RESEARCH.md"
)
$missing = @($keyFiles | Where-Object { -not (Test-Path -LiteralPath $_) })
if ($missing.Count -eq 0) {
    Add-Line "[G] Handoff docs: PASS (all $($keyFiles.Count) present)"
} else {
    Add-Line "[G] Handoff docs: WARN (missing: $($missing -join ', '))"
    Note-Warn
}

# ---- verdict -------------------------------------------------------------
Add-Line ""
if ($script:Fails -gt 0) {
    $verdict = "FAIL"
} elseif ($script:Warns -gt 0) {
    $verdict = "PASS (with $($script:Warns) WARN - human glance)"
} else {
    $verdict = "PASS"
}
Add-Line "VERDICT: $verdict"

$next = "review + push $unN commit(s) (human)"
if ($script:Fails -gt 0) { $next = "resolve FAIL above before any commit/push" }
Add-Line "NEXT   : $next"

# ---- output --------------------------------------------------------------
$report = ($script:Lines -join "`r`n")
Write-Host ""
Write-Host $report
Write-Host ""

if (-not $NoFile) {
    if ([string]::IsNullOrWhiteSpace($OutFile)) {
        $OutFile = Join-Path $RepoRoot "last-validation.txt"
    }
    try {
        Set-Content -LiteralPath $OutFile -Value $report -Encoding utf8
        Write-Host "Report written: $OutFile" -ForegroundColor Green
    } catch {
        Write-Host "WARN: could not write report file: $OutFile" -ForegroundColor Yellow
    }
}

# Exit code: 0 PASS/WARN, 1 FAIL (handy for chaining; never throws)
if ($script:Fails -gt 0) { exit 1 } else { exit 0 }
