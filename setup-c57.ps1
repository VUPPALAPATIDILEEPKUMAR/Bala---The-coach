# setup-c57.ps1
# C57 -- One-time setup for voice I/O.
#
# What this installs:
#   edge-tts  -- Microsoft neural TTS, Python package, free, no API key.
#                Voice: en-IN-NeerjaNeural (warm Indian English female)
#
# What it tests:
#   1. pip install edge-tts
#   2. python -m edge_tts --list-voices | grep IN  (confirm Indian voices)
#   3. Generate a test MP3 and confirm file size > 0
#
# After this, send a voice note to your Telegram bot and Chintu will:
#   - Transcribe it with Groq Whisper (same API key, free)
#   - Think with the 11-tool Groq brain
#   - Reply with a voice note in Indian English
#
# Requirements: Python must be in PATH. Run from repo root.

$ErrorActionPreference = "Stop"
$repoRoot = "C:\Users\Chintu\Desktop\test"
Set-Location $repoRoot

Write-Host ""
Write-Host "Chintu C57 -- Voice I/O setup" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: pip install edge-tts ────────────────────────────────────────────
Write-Host "Step 1/3: Installing edge-tts..." -ForegroundColor Yellow

$pipCmds = @("pip", "pip3")
$installed = $false
foreach ($pip in $pipCmds) {
    try {
        & $pip install edge-tts --quiet 2>&1 | Out-Null
        Write-Host "  edge-tts: installed OK (via $pip)" -ForegroundColor Green
        $installed = $true
        break
    } catch {
        # try next
    }
}
if (-not $installed) {
    Write-Host "  WARNING: pip install failed. Try manually: pip install edge-tts" -ForegroundColor Yellow
}

# ── Step 2: Confirm edge-tts is runnable ────────────────────────────────────
Write-Host ""
Write-Host "Step 2/3: Checking edge-tts + Indian English voices..." -ForegroundColor Yellow

$pythonCmds = @("python", "python3")
$voiceCheckOk = $false
foreach ($py in $pythonCmds) {
    try {
        $voices = & $py -m edge_tts --list-voices 2>&1
        $indianVoices = $voices | Select-String "NeerjaNeural|PrabhatNeural|AaravNeural"
        if ($indianVoices) {
            Write-Host "  Indian English voices found:" -ForegroundColor Green
            $indianVoices | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
            $voiceCheckOk = $true
            break
        }
    } catch {
        # try next
    }
}
if (-not $voiceCheckOk) {
    Write-Host "  WARNING: Could not list voices. edge-tts may not be installed correctly." -ForegroundColor Yellow
    Write-Host "  Try: python -m edge_tts --list-voices" -ForegroundColor Gray
}

# ── Step 3: Generate a test voice MP3 ───────────────────────────────────────
Write-Host ""
Write-Host "Step 3/3: Generating test voice MP3..." -ForegroundColor Yellow

$testMp3 = "$env:TEMP\chintu-voice-test.mp3"
$testText = "Hello Dileep! Chintu voice mode is now active. You can send me a voice note anytime."

$generated = $false
foreach ($py in $pythonCmds) {
    try {
        & $py -m edge_tts --voice "en-IN-NeerjaNeural" --text $testText --write-media $testMp3 2>&1 | Out-Null
        if (Test-Path $testMp3) {
            $size = (Get-Item $testMp3).Length
            if ($size -gt 1000) {
                Write-Host "  Test MP3 generated: $([Math]::Round($size/1024, 1)) KB" -ForegroundColor Green
                Write-Host "  File: $testMp3" -ForegroundColor Gray
                Write-Host "  (Open to hear the voice Chintu will use)" -ForegroundColor Gray
                $generated = $true
                break
            }
        }
    } catch {
        # try next
    }
}
if (-not $generated) {
    Write-Host "  WARNING: Test MP3 not generated. Voice replies may fall back to text." -ForegroundColor Yellow
}

# ── Summary ──────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "==============================" -ForegroundColor Cyan
Write-Host "  C57 Setup complete!" -ForegroundColor Green
Write-Host "==============================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next step:" -ForegroundColor White
Write-Host "  Run push-c57.ps1 to commit the voice modules." -ForegroundColor Gray
Write-Host ""
Write-Host "Then try it:" -ForegroundColor White
Write-Host "  Open Telegram -> your bot -> hold the mic icon -> say something." -ForegroundColor Gray
Write-Host "  Chintu will transcribe, think with all 11 tools, and reply with voice." -ForegroundColor Gray
Write-Host ""
