<#
.SYNOPSIS
    Generates the local-only Chintu Agent dashboard snapshot.

.DESCRIPTION
    Reads local Git metadata and approved Chintu OS Markdown reports, escapes
    every dynamic value, and writes a self-contained static HTML dashboard.
    It performs no network calls and never reads or writes BALA app data.

.PARAMETER RepoRoot
    Chintu OS repository root. Defaults to the parent of this script folder.

.PARAMETER OutFile
    Dashboard output path. Defaults to CHINTU_AGENT_DASHBOARD.html in RepoRoot.
#>
[CmdletBinding()]
param(
    [string]$RepoRoot = "",
    [string]$OutFile = ""
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
if (-not $OutFile) {
    $OutFile = Join-Path $RepoRoot "CHINTU_AGENT_DASHBOARD.html"
}

function ConvertTo-HtmlText {
    param([AllowNull()][object]$Value)

    if ($null -eq $Value) { return "" }
    return [System.Security.SecurityElement]::Escape([string]$Value)
}

function Get-GitText {
    param([string[]]$Arguments)

    $result = @(& git -C $RepoRoot @Arguments 2>$null)
    if ($LASTEXITCODE -ne 0) { return @() }
    return @($result | ForEach-Object { [string]$_ })
}

function Read-LocalSnapshot {
    param(
        [string]$RelativePath,
        [int]$MaxCharacters = 6000
    )

    $path = Join-Path $RepoRoot $RelativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        return "Not present: $RelativePath"
    }

    $text = (Get-Content -LiteralPath $path -Raw).Trim()
    if (-not $text) { return "Present but empty: $RelativePath" }
    if ($text.Length -gt $MaxCharacters) {
        return $text.Substring(0, $MaxCharacters) + "`n`n[Snapshot shortened by dashboard generator.]"
    }
    return $text
}

function Get-FirstBulletAfterHeading {
    param(
        [string]$Text,
        [string]$HeadingPattern,
        [string]$Fallback
    )

    $lines = @($Text -split "`r?`n")
    $inside = $false
    foreach ($line in $lines) {
        if (-not $inside -and $line -match $HeadingPattern) {
            $inside = $true
            continue
        }
        if ($inside -and $line -match '^##\s+') { break }
        if ($inside -and $line -match '^\s*-\s+(.+?)\s*$') {
            return $Matches[1]
        }
    }
    return $Fallback
}

function Get-ParkedItems {
    param([string]$RelativePath)

    $path = Join-Path $RepoRoot $RelativePath
    $items = New-Object System.Collections.Generic.List[string]
    if (Test-Path -LiteralPath $path -PathType Leaf) {
        foreach ($line in Get-Content -LiteralPath $path) {
            if ($line -match '^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|') {
                $name = $Matches[1].Trim()
                $status = $Matches[2].Trim()
                if ($name -ne "System" -and $name -notmatch '^-+$') {
                    $items.Add("$name - $status") | Out-Null
                }
            }
        }
    }
    if ($items.Count -eq 0) {
        foreach ($fallback in @(
            "Telegram - parked",
            "Discord - parked",
            "Webhooks - parked",
            "Cloud sync automation - parked",
            "Voice cloning - prohibited"
        )) {
            $items.Add($fallback) | Out-Null
        }
    }
    return @($items)
}

$stamp = Get-Date -Format "yyyy-MM-dd HH:mm zzz"
$branchLines = Get-GitText -Arguments @("rev-parse", "--abbrev-ref", "HEAD")
$branch = if ($branchLines.Count -gt 0) { $branchLines[0] } else { "unknown" }
$latestLines = Get-GitText -Arguments @("log", "-1", "--oneline")
$latestCommit = if ($latestLines.Count -gt 0) { $latestLines[0] } else { "unknown" }
$recentCommits = Get-GitText -Arguments @("log", "-5", "--oneline")
$statusLines = Get-GitText -Arguments @("status", "--short")
$treeState = if ($statusLines.Count -eq 0) { "CLEAN" } else { "CHANGES PRESENT ($($statusLines.Count))" }
$originCheck = Get-GitText -Arguments @("rev-parse", "--verify", "origin/main")
if ($originCheck.Count -gt 0) {
    $unpushedLines = Get-GitText -Arguments @("rev-list", "--count", "origin/main..HEAD")
    $unpushedCount = if ($unpushedLines.Count -gt 0) { $unpushedLines[0] } else { "unknown" }
} else {
    $unpushedCount = "origin/main unavailable"
}

$operatorStatus = Read-LocalSnapshot -RelativePath "CHINTU_OPERATOR_STATUS.md"
$tomorrowStart = Read-LocalSnapshot -RelativePath "CHINTU_TOMORROW_START.md" -MaxCharacters 2500
$claudeHandoff = Read-LocalSnapshot -RelativePath "CHINTU_CLAUDE_HANDOFF.md" -MaxCharacters 2500
$bridgeReport = Read-LocalSnapshot -RelativePath "chintu-bridge-command-center-report.md" -MaxCharacters 3500
$parkedItems = Get-ParkedItems -RelativePath "CHINTU_MEMORY_VAULT\PARKED_SYSTEMS.md"
$nextAction = Get-FirstBulletAfterHeading -Text $operatorStatus -HeadingPattern '^##\s+(?:7\.)?\s*Next exact action\s*$' -Fallback "Run the local Stage 10 validation list, review the diff, and keep push founder-owned."

$commitItems = if ($recentCommits.Count -gt 0) {
    ($recentCommits | ForEach-Object { "<li><code>$(ConvertTo-HtmlText $_)</code></li>" }) -join "`n"
} else {
    "<li>No local commit history available.</li>"
}
$changeItems = if ($statusLines.Count -gt 0) {
    ($statusLines | ForEach-Object { "<li><code>$(ConvertTo-HtmlText $_)</code></li>" }) -join "`n"
} else {
    "<li>No working-tree changes at snapshot time.</li>"
}
$parkedHtml = ($parkedItems | ForEach-Object { "<li>$(ConvertTo-HtmlText $_)</li>" }) -join "`n"

$html = @"
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>Chintu Agent Control Shell</title>
  <style>
    :root { color-scheme: dark; --bg:#08111f; --panel:#101d30; --line:#263b55; --text:#edf4ff; --muted:#9eb1c9; --safe:#56d69b; --park:#f1bf65; --accent:#79a9ff; }
    * { box-sizing: border-box; }
    body { margin:0; font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif; background:radial-gradient(circle at top right,#18335c 0,#08111f 38rem); color:var(--text); line-height:1.55; }
    header,main,footer { width:min(1180px,calc(100% - 2rem)); margin-inline:auto; }
    header { padding:3rem 0 1.5rem; }
    h1 { margin:0; font-size:clamp(2rem,5vw,4rem); letter-spacing:-.04em; }
    h2 { margin:.2rem 0 1rem; font-size:1.05rem; letter-spacing:.02em; }
    p { margin:.45rem 0; }
    .eyebrow,.meta { color:var(--muted); }
    .brief { max-width:760px; font-size:1.16rem; }
    .grid { display:grid; grid-template-columns:repeat(12,1fr); gap:1rem; padding-bottom:2rem; }
    .card { grid-column:span 6; min-width:0; background:rgba(16,29,48,.94); border:1px solid var(--line); border-radius:18px; padding:1.2rem; box-shadow:0 16px 45px rgba(0,0,0,.22); }
    .wide { grid-column:1/-1; }
    .third { grid-column:span 4; }
    .safe { border-color:rgba(86,214,155,.55); }
    .parked { border-color:rgba(241,191,101,.5); }
    .next { border-color:var(--accent); background:linear-gradient(145deg,rgba(31,61,105,.98),rgba(16,29,48,.98)); }
    .status { display:inline-block; padding:.2rem .55rem; border-radius:999px; background:#18314f; color:var(--safe); font-weight:700; font-size:.82rem; }
    code { color:#c8dcff; overflow-wrap:anywhere; }
    ul { margin:.5rem 0 0; padding-left:1.2rem; }
    pre { margin:0; max-height:25rem; overflow:auto; white-space:pre-wrap; overflow-wrap:anywhere; color:#c6d4e6; font:12px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace; }
    details summary { cursor:pointer; color:var(--accent); }
    button { border:1px solid var(--line); border-radius:999px; padding:.5rem .8rem; color:var(--text); background:#142946; cursor:pointer; }
    .compact .snapshot { display:none; }
    footer { padding:0 0 3rem; color:var(--muted); font-size:.9rem; }
    @media (max-width:800px) { .card,.third { grid-column:1/-1; } header { padding-top:2rem; } }
    @media print { body { background:#fff; color:#111; } .card { box-shadow:none; background:#fff; border-color:#bbb; } button { display:none; } }
  </style>
</head>
<body>
  <header>
    <p class="eyebrow">CHINTU OS / LOCAL OPERATOR SNAPSHOT</p>
    <h1>Agent Control Shell</h1>
    <p class="brief">Bro, Chintu checked the system. Here is what changed. Here is what is safe. Here is the next move.</p>
    <p class="meta">Generated $(ConvertTo-HtmlText $stamp) from local files. <strong>This is a static snapshot, not live file reading.</strong></p>
    <button id="snapshot-toggle" type="button" aria-pressed="false">Hide report snapshots</button>
  </header>
  <main class="grid" id="dashboard">
    <section class="card third">
      <h2>System state</h2>
      <span class="status">$(ConvertTo-HtmlText $treeState)</span>
      <p>Branch: <code>$(ConvertTo-HtmlText $branch)</code></p>
      <p>Unpushed commits: $(ConvertTo-HtmlText $unpushedCount)</p>
      <p>Latest: <code>$(ConvertTo-HtmlText $latestCommit)</code></p>
    </section>
    <section class="card third">
      <h2>What changed</h2>
      <ul>$changeItems</ul>
    </section>
    <section class="card third safe">
      <h2>BALA safety status</h2>
      <p><strong>BOUNDARY ACTIVE.</strong> Stage 10 is scripts, reports, and planning only. BALA product files and behavior are outside this shell.</p>
      <p>No diagnosis, prediction, prevention, emergency monitoring, network transfer, or external automation.</p>
    </section>
    <section class="card">
      <h2>Latest commits</h2>
      <ul>$commitItems</ul>
    </section>
    <section class="card next">
      <h2>Next exact action</h2>
      <p><strong>$(ConvertTo-HtmlText $nextAction)</strong></p>
    </section>
    <section class="card snapshot">
      <h2>Operator status</h2>
      <details><summary>Open local report snapshot</summary><pre>$(ConvertTo-HtmlText $operatorStatus)</pre></details>
    </section>
    <section class="card snapshot">
      <h2>Bridge state</h2>
      <details><summary>Open Bridge Command Center snapshot</summary><pre>$(ConvertTo-HtmlText $bridgeReport)</pre></details>
    </section>
    <section class="card parked">
      <h2>Parked systems</h2>
      <ul>$parkedHtml</ul>
    </section>
    <section class="card snapshot">
      <h2>Tomorrow start</h2>
      <details><summary>Open restart snapshot</summary><pre>$(ConvertTo-HtmlText $tomorrowStart)</pre></details>
    </section>
    <section class="card snapshot">
      <h2>Claude overnight lane</h2>
      <p>Inspect Stage 8/9/10, harden Chintu OS reliability/docs/tests, and plan future BALA work without changing BALA app files.</p>
      <details><summary>Open existing Claude handoff snapshot</summary><pre>$(ConvertTo-HtmlText $claudeHandoff)</pre></details>
    </section>
    <section class="card">
      <h2>Codex lane</h2>
      <p>Validate this local control-shell slice, prove protected BALA files are unchanged, commit if safe, and stop before push.</p>
    </section>
    <section class="card wide parked">
      <h2>Future Chintu Agent vision - parked</h2>
      <p>Local LLM routing, local speech input/output, desktop wrappers, launchd/Task Scheduler, and external channels remain research lanes only. No installs, activation, voice cloning, real-person imitation, cloud sync, webhooks, calls, or messages are part of Stage 10.</p>
    </section>
  </main>
  <footer>
    <p><strong>Local-only disclaimer:</strong> This dashboard is a generated snapshot of local repository reports. It does not read files live, send data, call a backend, track activity, or activate automation.</p>
    <p>BALA is a health-awareness companion. It does not diagnose, treat, predict, prevent, replace doctors, or provide emergency monitoring.</p>
  </footer>
  <script>
    (() => {
      const button = document.getElementById("snapshot-toggle");
      const dashboard = document.getElementById("dashboard");
      button.addEventListener("click", () => {
        const compact = dashboard.classList.toggle("compact");
        button.setAttribute("aria-pressed", String(compact));
        button.textContent = compact ? "Show report snapshots" : "Hide report snapshots";
      });
    })();
  </script>
</body>
</html>
"@

$parent = Split-Path -Parent $OutFile
if ($parent -and -not (Test-Path -LiteralPath $parent)) {
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
}
$html | Set-Content -LiteralPath $OutFile -Encoding UTF8
Write-Host "Chintu Agent dashboard written: $OutFile"
Write-Host "Mode: local-only static snapshot"
exit 0
