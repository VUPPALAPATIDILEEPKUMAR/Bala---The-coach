<#
.SYNOPSIS
    Chintu OpenClaw Plugin Readiness Dashboard v1 - read-only, local.

.DESCRIPTION
    Inspects OpenClaw plugin readiness locally and writes a markdown dashboard. For each target plugin it
    runs "openclaw plugins inspect <id> --runtime --json" (read-only) and records status + enabled state,
    merged with a static safe/use-case/risk assessment. Captures command errors and continues.

    It NEVER installs, enables plugins, pushes, calls external URLs, reads secrets/tokens/credentials,
    sends Telegram/Discord messages, or includes any health-metric value. Inspection only.

.PARAMETER RepoRoot
    Repo root for the default report location. Defaults to C:\Users\Chintu\Desktop\test.

.PARAMETER OutFile
    Optional extra path to also write the report to (parent folder created if needed). The default report
    is always written to <RepoRoot>\chintu-openclaw-readiness-report.md (gitignored).

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\chintu-openclaw-readiness.ps1
#>
[CmdletBinding()]
param(
    [string]$RepoRoot = "C:\Users\Chintu\Desktop\test",
    [string]$OutFile = ""
)

$ErrorActionPreference = "Continue"

# --- safe read-only helpers --------------------------------------------------
function Invoke-OpenClaw {
    param([string[]]$ClawArgs)
    try {
        $out = & openclaw @ClawArgs 2>$null
        if ($null -eq $out) { return "" }
        return ($out -join "`n")
    } catch {
        return ""
    }
}

function Get-PluginStatus {
    param([string]$Id, [string]$FallbackId = "")
    $raw = Invoke-OpenClaw @("plugins", "inspect", $Id, "--runtime", "--json")
    if (-not $raw.Trim() -and $FallbackId -ne "") {
        $raw = Invoke-OpenClaw @("plugins", "inspect", $FallbackId, "--runtime", "--json")
    }
    if (-not $raw.Trim()) { return @{ status = "unknown / command failed"; enabled = "unknown" } }
    try {
        $j = $raw | ConvertFrom-Json
        $st = if ($j.plugin.status) { [string]$j.plugin.status } else { "unknown" }
        $en = if ($j.plugin.enabled -eq $true) { "enabled" } elseif ($j.plugin.enabled -eq $false) { "disabled" } else { "unknown" }
        return @{ status = $st; enabled = $en }
    } catch {
        return @{ status = "unknown / parse failed"; enabled = "unknown" }
    }
}

# --- OpenClaw version / status (read-only) -----------------------------------
$stamp = Get-Date -Format "yyyy-MM-dd HH:mm"
$versionText = (Invoke-OpenClaw @("--version")).Trim()
if (-not $versionText) { $versionText = "(openclaw --version unavailable)" }
$statusText = Invoke-OpenClaw @("status")
$tailscale = if ($statusText -match "Tailscale exposure\s+\S*\s*off") { "off (local loopback)" } else { "see openclaw status" }
$memNote = if ($statusText -match "memory-core") { "memory enabled (memory-core)" } else { "see openclaw status" }

# --- target plugins: live status merged with static assessment ----------------
$mc = Get-PluginStatus "memory-core"
$mw = Get-PluginStatus "memory-wiki"
$de = Get-PluginStatus "document-extract"
$ft = Get-PluginStatus "file-transfer"
$dd = Get-PluginStatus "duckduckgo"
$ol = Get-PluginStatus "ollama-provider" "ollama"

# Each row: Name | Status | Enabled | SafeNow | ChintuUse | BalaUse | DataRisk | NextAction
$rows = @()
$rows += ,@("memory-core", $mc.status, $mc.enabled, "Yes", "Long-term memory search", "Index design/handoff notes", "Low (local files)", "Use as-is")
$rows += ,@("memory-wiki", $mw.status, $mw.enabled, "Later (enable w/ approval)", "Local knowledge vault", "Store BALA design knowledge", "Low (local files)", "Sprint: seed vault")
$rows += ,@("document-extract", $de.status, $de.enabled, "Yes", "Extract local research docs", "Read a user-placed local doc (non-PHI)", "Low-Med (local doc)", "Local PDF proof")
$rows += ,@("file-transfer", $ft.status, $ft.enabled, "Later (dry-run)", "Move build artifacts between nodes", "Artifacts/reports only - never PHI", "Med (moves files)", "Dry-run proof")
$rows += ,@("duckduckgo", $dd.status, $dd.enabled, "Later (public only)", "Public dev/docs lookups", "Never a personal/health query", "Med (query leaves device)", "Public-only wrapper")
$rows += ,@("ollama-provider", $ol.status, $ol.enabled, "Later", "Local summarize [unverified]", "Optional local rephrase, no claim", "Low (local)", "Evaluate after memory/doc")
$rows += ,@("Telegram/Discord/messaging", "n/a", "parked", "Parked", "None", "None", "High (could leak PHI)", "Keep parked")
$rows += ,@("webhooks", "n/a", "parked", "No (parked)", "None automated", "In-app webhook stays user-confirmed", "High (off-device)", "Keep parked")

# --- build markdown ----------------------------------------------------------
$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("# Chintu OpenClaw Readiness Dashboard")
$lines.Add("")
$lines.Add("**Generated:** $stamp  ")
$lines.Add("**Repo:** $RepoRoot")
$lines.Add("")
$lines.Add("## OpenClaw version / status")
$lines.Add("")
$lines.Add("- Version: **$versionText**")
$lines.Add("- Tailscale exposure: $tailscale")
$lines.Add("- Memory: $memNote")
$lines.Add("- Inspection is read-only; openclaw.json / tokens / credentials were not read.")
$lines.Add("")
$lines.Add("## Plugin readiness table")
$lines.Add("")
$lines.Add("| Plugin | Status | Enabled | Safe now | Chintu use | BALA use | Data risk | Next action |")
$lines.Add("|---|---|---|---|---|---|---|---|")
foreach ($r in $rows) {
    $lines.Add("| " + ($r -join " | ") + " |")
}
$lines.Add("")
$lines.Add("## Priority ranking")
$lines.Add("")
$lines.Add("1. **memory-wiki seed vault** (local knowledge vault).")
$lines.Add("2. **document-extract local proof** (non-PHI sample).")
$lines.Add("3. **file-transfer dry run** (artifacts only, never PHI).")
$lines.Add("4. **DuckDuckGo public-search wrapper** (public, non-sensitive only).")
$lines.Add("5. **Telegram/Discord parked** (design-only; no health data).")
$lines.Add("")
$lines.Add("## Safety rules")
$lines.Add("")
$lines.Add("- No PHI to external APIs.")
$lines.Add("- No health data in messaging (Telegram/Discord/webhooks).")
$lines.Add("- No plugin installs or enables without explicit approval.")
$lines.Add("- No secrets read (openclaw.json / tokens / .env / credentials / cookies).")
$lines.Add("- Local-first by default; deterministic checks stay authoritative.")
$lines.Add("")
$lines.Add("## Recommended next sprint")
$lines.Add("")
$lines.Add("**CHINTU MEMORY-WIKI SEED VAULT V1** - create a local knowledge vault (BALA design/handoff distilled);")
$lines.Add("enable memory-wiki only with founder approval; no network; no secrets.")
$lines.Add("")
$lines.Add("## Founder-friendly summary")
$lines.Add("")
$lines.Add("Safe to activate next (local, low risk): a **memory vault** so Chintu remembers decisions, and")
$lines.Add("**local document reading** for files you place yourself. Held for later with care: **file transfer**")
$lines.Add("(artifacts only, dry-run first) and **public web search** (never personal/health questions). Staying")
$lines.Add("**parked**: Telegram/Discord and webhooks - nothing sends your health data anywhere, and nothing")
$lines.Add("installs or enables without your say-so.")
$lines.Add("")
$lines.Add("---")
$lines.Add("")
$lines.Add("*Generated locally. Read-only inspection. Human owns enables/installs. Codex parked. Telegram/Discord parked.*")

$report = ($lines -join "`r`n")

# --- write default + optional -OutFile ---------------------------------------
$defaultOut = Join-Path $RepoRoot "chintu-openclaw-readiness-report.md"
Set-Content -LiteralPath $defaultOut -Value $report -Encoding utf8
Write-Host ""
Write-Host "Readiness report written: $defaultOut" -ForegroundColor Green

if ($OutFile -ne "") {
    $parent = Split-Path -Parent $OutFile
    if ($parent -and -not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Force -Path $parent | Out-Null
    }
    Set-Content -LiteralPath $OutFile -Value $report -Encoding utf8
    Write-Host "Copy written: $OutFile" -ForegroundColor Green
}

Write-Host ""
Write-Host "OpenClaw: $versionText"
Write-Host "Highest priority: memory-wiki seed vault (local)."
exit 0
