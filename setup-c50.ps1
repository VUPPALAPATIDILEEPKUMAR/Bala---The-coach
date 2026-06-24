# setup-c50.ps1
# C50 -- Store Telegram two-way bridge env vars permanently in Windows Registry.
# Run this ONCE from a normal PowerShell window (not Admin needed).
# Values survive reboots. Task Scheduler inherits them automatically.
#
# What gets stored (all in HKCU\Environment -- User scope):
#   TELEGRAM_BOT_TOKEN                  -- your bot's API token
#   CHINTU_TELEGRAM_ALLOWED_CHAT_IDS    -- comma-separated chat IDs (founder's chat only)
#   CHINTU_TELEGRAM_ALLOWED_SENDER_IDS  -- comma-separated Telegram user IDs (you only)
#   CHINTU_TELEGRAM_SEND_ENABLED        -- "1" (enables actual reply sending)
#
# SECURITY:
#   Token is read via Read-Host -AsSecureString (never echoed to terminal).
#   Token is NEVER written to any file, NEVER committed to git.
#   Chat/sender IDs are masked in output.
#
# PREREQUISITE:
#   1. Create a Telegram bot via @BotFather. Copy the token.
#   2. Find your chat ID: message your bot, then run:
#      node scripts\chintu-telegram-runner.js --poll-once --dry-run --discover-ids
#      (needs TELEGRAM_BOT_TOKEN set in current shell only for discovery)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "Chintu C50 -- Telegram Bridge Setup" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This stores your Telegram config permanently in Windows Registry." -ForegroundColor Gray
Write-Host "Values are only accessible to your user account." -ForegroundColor Gray
Write-Host "The bot token is NEVER written to any file or git." -ForegroundColor Gray
Write-Host ""

# --- Step 1: Bot Token ---
Write-Host "Step 1/4: Telegram Bot Token" -ForegroundColor Yellow
Write-Host "  Get this from @BotFather in Telegram." -ForegroundColor Gray
Write-Host "  Format: 1234567890:AABBccDDeeFF..." -ForegroundColor Gray
$tokenSecure = Read-Host -Prompt "  Paste token (input hidden)" -AsSecureString
$tokenBstr   = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($tokenSecure)
$tokenPlain  = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenBstr)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenBstr)

if ($tokenPlain.Trim() -eq "") {
    Write-Host "ERROR: Token cannot be empty." -ForegroundColor Red
    exit 1
}

[System.Environment]::SetEnvironmentVariable("TELEGRAM_BOT_TOKEN", $tokenPlain.Trim(), "User")
$tokenPlain = $null
Write-Host "  Stored: TELEGRAM_BOT_TOKEN (hidden)" -ForegroundColor Green

# --- Step 2: Allowed Chat IDs ---
Write-Host ""
Write-Host "Step 2/4: Allowed Chat IDs" -ForegroundColor Yellow
Write-Host "  Your founder chat ID (from --discover-ids run)." -ForegroundColor Gray
Write-Host "  Comma-separated if multiple. Example: -100123456789" -ForegroundColor Gray
$chatIds = (Read-Host -Prompt "  Enter chat ID(s)").Trim()

if ($chatIds -eq "") {
    Write-Host "  SKIPPED -- allowlist not set (replies will be blocked until you set this)." -ForegroundColor Yellow
} else {
    [System.Environment]::SetEnvironmentVariable("CHINTU_TELEGRAM_ALLOWED_CHAT_IDS", $chatIds, "User")
    $masked = $chatIds.Substring(0, [Math]::Min(4, $chatIds.Length)) + "..."
    Write-Host "  Stored: CHINTU_TELEGRAM_ALLOWED_CHAT_IDS = $masked" -ForegroundColor Green
}

# --- Step 3: Allowed Sender IDs ---
Write-Host ""
Write-Host "Step 3/4: Allowed Sender IDs" -ForegroundColor Yellow
Write-Host "  Your Telegram user ID (numeric). Also from --discover-ids." -ForegroundColor Gray
Write-Host "  Comma-separated if multiple. Example: 987654321" -ForegroundColor Gray
$senderIds = (Read-Host -Prompt "  Enter sender ID(s) (or press Enter to skip)").Trim()

if ($senderIds -eq "") {
    Write-Host "  SKIPPED -- sender allowlist not set (chat ID alone will guard access)." -ForegroundColor Yellow
} else {
    [System.Environment]::SetEnvironmentVariable("CHINTU_TELEGRAM_ALLOWED_SENDER_IDS", $senderIds, "User")
    $maskedS = $senderIds.Substring(0, [Math]::Min(3, $senderIds.Length)) + "..."
    Write-Host "  Stored: CHINTU_TELEGRAM_ALLOWED_SENDER_IDS = $maskedS" -ForegroundColor Green
}

# --- Step 4: Enable Sending ---
Write-Host ""
Write-Host "Step 4/4: Enable Telegram Replies" -ForegroundColor Yellow
Write-Host "  Setting CHINTU_TELEGRAM_SEND_ENABLED=1" -ForegroundColor Gray
[System.Environment]::SetEnvironmentVariable("CHINTU_TELEGRAM_SEND_ENABLED", "1", "User")
Write-Host "  Stored: CHINTU_TELEGRAM_SEND_ENABLED = 1" -ForegroundColor Green

# --- Done ---
Write-Host ""
Write-Host "====================================" -ForegroundColor Green
Write-Host "  C50 Telegram config stored!" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  1. Test the poll (dry-run, no send):" -ForegroundColor White
Write-Host "     node scripts\chintu-telegram-poll.js --dry-run" -ForegroundColor Yellow
Write-Host ""
Write-Host "  2. Test live (sends a real reply to your phone):" -ForegroundColor White
Write-Host "     node scripts\chintu-telegram-poll.js" -ForegroundColor Yellow
Write-Host ""
Write-Host "  3. Schedule every-minute polling:" -ForegroundColor White
Write-Host "     .\schedule-c50.ps1   (run as Administrator)" -ForegroundColor Yellow
Write-Host ""
Write-Host "  4. Check last poll log:" -ForegroundColor White
Write-Host "     node scripts\chintu-telegram-poll.js --status" -ForegroundColor Yellow
Write-Host ""
Write-Host "  DISCOVERY (if you need your chat/sender IDs):" -ForegroundColor White
Write-Host "     `$env:TELEGRAM_BOT_TOKEN = 'your-token-here'" -ForegroundColor Gray
Write-Host "     node scripts\chintu-telegram-runner.js --poll-once --dry-run --discover-ids" -ForegroundColor Gray
Write-Host ""
Write-Host "Commands you can send from your phone (text to your bot):" -ForegroundColor White
Write-Host "  help | status | git log | today | test | bala | count | scripts | resume" -ForegroundColor Gray
Write-Host ""
