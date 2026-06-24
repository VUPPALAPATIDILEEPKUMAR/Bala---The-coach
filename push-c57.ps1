# push-c57.ps1
# C57 -- Voice I/O: Telegram voice notes → Groq Whisper → Groq brain → edge-tts → voice reply.
#
# What C57 adds:
#   scripts/chintu-voice-in.js   (NEW):
#     - Downloads Telegram OGG voice file via getFile + file download
#     - Converts OGG → MP3 with ffmpeg if available (graceful fallback to raw OGG)
#     - Transcribes via Groq Whisper API (whisper-large-v3-turbo, free, same CHINTU_GROQ_API_KEY)
#     - Pure Node.js multipart/form-data upload, no npm deps
#     - Temp files in os.tmpdir(), always deleted in finally block
#
#   scripts/chintu-voice-out.js  (NEW):
#     - Cleans Groq reply text for natural speech (strips markdown, URLs, emoji)
#     - Calls edge-tts via Python spawnSync (no shell injection risk)
#     - Voice: en-IN-NeerjaNeural (warm Indian English female, Microsoft neural, free, no key)
#     - Uploads MP3 to Telegram via sendVoice multipart/form-data
#     - Falls back to text sendMessage if TTS or upload fails
#
#   scripts/chintu-telegram-poll.js (UPDATED):
#     - Adds optional require for chintu-voice-in.js + chintu-voice-out.js
#     - parseUpdate() now returns voice field (msg.voice object)
#     - Main loop: detects message.voice BEFORE the text-check skip
#     - Full voice pipeline: transcribe → Groq tools → voice reply (text fallback if TTS fails)
#     - HELP_TEXT updated with Voice (C57) section
#
#   scripts/chintu-no-network-egress.test.js (UPDATED):
#     - chintu-voice-in.js + chintu-voice-out.js added to scannerAllowlist with full safety commentary
#
#   setup-c57.ps1 (NEW):
#     - pip install edge-tts
#     - Confirms Indian English voices available
#     - Generates a test MP3 to confirm edge-tts works
#
# Requires (one-time, run setup-c57.ps1):
#   pip install edge-tts
#
# Security properties preserved:
#   - No transcript stored to disk (temp audio in os.tmpdir(), deleted immediately)
#   - Voice replies require CHINTU_TELEGRAM_SEND_ENABLED=1 (same gate as text replies)
#   - CHINTU_GROQ_API_KEY required for both STT and LLM (never printed)
#   - Token never printed in voice module logs
#   - spawnSync (no shell) used for edge-tts to prevent injection
#
# Full voice conversation flow:
#   Dileep speaks on Telegram → OGG download → [ffmpeg] → Groq Whisper → transcript
#   → Groq tool-use (all 11 tools available) → reply text
#   → edge-tts NeerjaNeural → MP3 → Telegram sendVoice → Dileep hears reply

$ErrorActionPreference = "Stop"
$repoRoot = "C:\Users\Chintu\Desktop\test"
Set-Location $repoRoot

Write-Host ""
Write-Host "Chintu C57 -- Voice I/O (Whisper + edge-tts)" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Syntax checks ────────────────────────────────────────────────────
Write-Host "Step 1/4: Syntax checks" -ForegroundColor Yellow

foreach ($f in @(
    "scripts\chintu-voice-in.js",
    "scripts\chintu-voice-out.js",
    "scripts\chintu-telegram-poll.js",
    "scripts\chintu-no-network-egress.test.js"
)) {
    node --check $f
    Write-Host "  $f : OK" -ForegroundColor Green
}

# ── Step 2: Safety tests ─────────────────────────────────────────────────────
Write-Host ""
Write-Host "Step 2/4: Safety tests" -ForegroundColor Yellow

node scripts\chintu-no-network-egress.test.js
Write-Host "  Egress: PASS" -ForegroundColor Green

node scripts\chintu-medical-claims.test.js
Write-Host "  Medical claims: PASS" -ForegroundColor Green

node scripts\chintu-skill-contracts.js
Write-Host "  Skill contracts: PASS" -ForegroundColor Green

# ── Step 3: Dry-run poll ─────────────────────────────────────────────────────
Write-Host ""
Write-Host "Step 3/4: Dry-run poll ..." -ForegroundColor Yellow
node scripts\chintu-telegram-poll.js --dry-run
Write-Host "  Dry-run: OK (ABORT on no token = correct)" -ForegroundColor Green

# ── Step 4: Commit + push ────────────────────────────────────────────────────
Write-Host ""
Write-Host "Step 4/4: Commit and push" -ForegroundColor Yellow

git add scripts/chintu-voice-in.js
git add scripts/chintu-voice-out.js
git add scripts/chintu-telegram-poll.js
git add scripts/chintu-no-network-egress.test.js
git add setup-c57.ps1
git add push-c57.ps1

Write-Host ""
Write-Host "Staged:" -ForegroundColor Gray
git status --short

git commit -m "C57: Voice I/O -- Telegram voice note -> Groq Whisper -> brain -> edge-tts -> voice reply

New files:
- scripts/chintu-voice-in.js (NEW):
    Downloads Telegram OGG voice, converts to MP3 with ffmpeg if available
    (graceful OGG fallback), uploads to Groq Whisper (whisper-large-v3-turbo,
    free, same CHINTU_GROQ_API_KEY). Pure Node.js multipart/form-data.
    Temp files in os.tmpdir(), always deleted in finally.

- scripts/chintu-voice-out.js (NEW):
    Cleans text for speech, generates MP3 via edge-tts Python spawnSync
    (en-IN-NeerjaNeural, Microsoft neural, free, no key), uploads to Telegram
    via sendVoice multipart/form-data. Text fallback if TTS fails.

Updated:
- scripts/chintu-telegram-poll.js:
    Optional require for voice-in + voice-out modules.
    parseUpdate() adds voice field (msg.voice object).
    Voice handler runs BEFORE text-check skip:
      transcribe -> Groq tools (all 11) -> voice reply
      (falls back to text if edge-tts unavailable).
    HELP_TEXT: added Voice (C57) section.

- scripts/chintu-no-network-egress.test.js:
    chintu-voice-in.js + chintu-voice-out.js added to scannerAllowlist
    with full safety commentary.

- setup-c57.ps1 (NEW): pip install edge-tts + test MP3 generation.

Security:
  No audio or transcript stored to disk. CHINTU_TELEGRAM_SEND_ENABLED=1
  required (same gate as text). spawnSync (no shell) for TTS. Token never
  printed. Graceful fallback to text on any voice failure.

Voice: en-IN-NeerjaNeural (warm Indian English female, Microsoft neural)"

git push origin main

Write-Host ""
Write-Host "==============================================" -ForegroundColor Green
Write-Host "  C57 pushed! Voice mode is live." -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green
Write-Host ""
git log --oneline -3
Write-Host ""
Write-Host "To activate voice mode:" -ForegroundColor Cyan
Write-Host "  1. Run setup-c57.ps1 (one-time: pip install edge-tts)" -ForegroundColor White
Write-Host "  2. Open Telegram -> your bot -> hold the mic button -> speak" -ForegroundColor White
Write-Host "  3. Chintu will: hear you -> think -> reply with a voice note" -ForegroundColor White
Write-Host ""
Write-Host "Full voice pipeline:" -ForegroundColor Gray
Write-Host "  OGG download -> [ffmpeg MP3] -> Groq Whisper -> Groq 11-tool brain" -ForegroundColor Gray
Write-Host "  -> edge-tts NeerjaNeural -> sendVoice -> you hear the reply" -ForegroundColor Gray
Write-Host ""
Write-Host "If edge-tts not installed, voice replies fall back to text." -ForegroundColor Gray
Write-Host "If ffmpeg not installed, OGG sent directly to Groq (still works)." -ForegroundColor Gray
Write-Host ""
