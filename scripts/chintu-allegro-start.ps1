<#
.SYNOPSIS
    Chintu Allegro one-command startup — Stage 23.

.DESCRIPTION
    Starts the local bridge (scripts/chintu-local-bridge.js), waits for it to
    answer /api/health, then opens CHINTU_ALLEGRO.html in the default browser.

    Local-first and safe: starts only a loopback Node server, never installs
    anything, never pushes, never calls external URLs, never reads secrets.

.PARAMETER Port
    Bridge port. Default 18791 (the bridge itself will fall back upward if busy).

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\chintu-allegro-start.ps1
#>
[CmdletBinding()]
param(
    [int]$Port = 18791,
    [string]$RepoRoot = "C:\Users\Chintu\Desktop\test"
)

$ErrorActionPreference = "Stop"

# --- 1. Confirm repo root ----------------------------------------------------
if (-not (Test-Path -LiteralPath $RepoRoot)) {
    Write-Host "FAIL: repo root not found: $RepoRoot" -ForegroundColor Red
    exit 2
}
Set-Location -LiteralPath $RepoRoot

$bridge = Join-Path $RepoRoot "scripts\chintu-local-bridge.js"
$appPath = Join-Path $RepoRoot "CHINTU_ALLEGRO.html"
foreach ($p in @($bridge, $appPath)) {
    if (-not (Test-Path -LiteralPath $p)) {
        Write-Host "FAIL: required file missing: $p" -ForegroundColor Red
        exit 2
    }
}

# --- 2. Is a bridge already healthy on this port? ----------------------------
function Test-BridgeHealth([int]$p) {
    # Local loopback TCP probe only (no web cmdlets, no egress). The bridge
    # listening on 127.0.0.1:$p means it is up and serving /api/health.
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $iar = $client.BeginConnect("127.0.0.1", $p, $null, $null)
        $ok = $iar.AsyncWaitHandle.WaitOne(800)
        if ($ok -and $client.Connected) { $client.EndConnect($iar); return $true }
        return $false
    } catch { return $false }
    finally { $client.Close() }
}

if (Test-BridgeHealth $Port) {
    Write-Host "Bridge already running and healthy on port $Port." -ForegroundColor Green
} else {
    # --- 3. Start the bridge as a background process -------------------------
    Write-Host "Starting Chintu Local Bridge on 127.0.0.1:$Port ..." -ForegroundColor Cyan
    $node = (Get-Command node -ErrorAction SilentlyContinue)
    if (-not $node) {
        Write-Host "FAIL: Node.js not found on PATH. Install Node, then re-run." -ForegroundColor Red
        exit 2
    }
    Start-Process -FilePath "node" -ArgumentList @("scripts\chintu-local-bridge.js") -WorkingDirectory $RepoRoot -WindowStyle Minimized | Out-Null

    # --- 4. Wait for /api/health (up to ~10s) -------------------------------
    $ready = $false
    for ($i = 0; $i -lt 20; $i++) {
        Start-Sleep -Milliseconds 500
        if (Test-BridgeHealth $Port) { $ready = $true; break }
    }
    if (-not $ready) {
        Write-Host "WARN: bridge did not answer /api/health in time." -ForegroundColor Yellow
        Write-Host "      The UI will open in offline (copy-paste) mode." -ForegroundColor Yellow
    } else {
        Write-Host "Bridge is healthy on port $Port." -ForegroundColor Green
    }
}

# --- 5. Open the Allegro app -------------------------------------------------
Start-Process $appPath | Out-Null

# --- 6. Print the operator card ---------------------------------------------
Write-Host ""
Write-Host "==================== CHINTU ALLEGRO ====================" -ForegroundColor Cyan
Write-Host "  Bridge URL : http://127.0.0.1:$Port" -ForegroundColor White
Write-Host "  Health     : http://127.0.0.1:$Port/api/health" -ForegroundColor White
Write-Host "  App        : $appPath" -ForegroundColor White
Write-Host ""
Write-Host "  Try saying or typing:" -ForegroundColor White
Write-Host "    - run release guard" -ForegroundColor Gray
Write-Host "    - check connectors" -ForegroundColor Gray
Write-Host "    - run validator" -ForegroundColor Gray
Write-Host "    - validate Bala" -ForegroundColor Gray
Write-Host "    - git status" -ForegroundColor Gray
Write-Host "    - build next Bala sprint" -ForegroundColor Gray
Write-Host ""
Write-Host "  To stop the bridge: close the minimized Node window," -ForegroundColor White
Write-Host "  or run:  Get-Process node | Stop-Process" -ForegroundColor Gray
Write-Host "========================================================" -ForegroundColor Cyan
