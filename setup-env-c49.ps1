# setup-env-c49.ps1
# C49 -- Store Chintu API keys as permanent Windows User environment variables.
# The key lives in the Windows Registry (HKCU\Environment), NOT in any file.
# Task Scheduler will inherit these on every run. Survives reboots.
# NEVER committed to git. Run once.

Write-Host ""
Write-Host "Chintu C49 -- Permanent Environment Setup" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Keys are stored in the Windows Registry (HKCU\Environment)."
Write-Host "They are NOT written to any file and NOT committed to git."
Write-Host ""

# 1. CHINTU_GROQ_API_KEY
$keySecure = Read-Host "Paste your Groq API key (gsk_...)" -AsSecureString
$keyPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($keySecure)
)

if (-not $keyPlain.StartsWith("gsk_")) {
    Write-Host "WARNING: Key does not start with 'gsk_' -- storing anyway, but double-check." -ForegroundColor Yellow
}

[System.Environment]::SetEnvironmentVariable("CHINTU_GROQ_API_KEY", $keyPlain, "User")
$keyPlain = $null  # clear from memory immediately

# 2. CHINTU_AUTONOMOUS_APPROVAL_PHRASE
[System.Environment]::SetEnvironmentVariable("CHINTU_AUTONOMOUS_APPROVAL_PHRASE", "go", "User")

# 3. Optional: CHINTU_NTFY_TOPIC (for phone push)
Write-Host ""
$ntfyTopic = Read-Host "Optional: your ntfy.sh topic name (leave blank to skip)"
if ($ntfyTopic.Trim() -ne "") {
    [System.Environment]::SetEnvironmentVariable("CHINTU_NTFY_TOPIC", $ntfyTopic.Trim(), "User")
    Write-Host "  CHINTU_NTFY_TOPIC = $($ntfyTopic.Trim())" -ForegroundColor Green
}

Write-Host ""
Write-Host "Permanent env vars stored in Windows Registry:" -ForegroundColor Green
Write-Host "  CHINTU_GROQ_API_KEY              = [stored -- not shown for security]" -ForegroundColor Cyan
Write-Host "  CHINTU_AUTONOMOUS_APPROVAL_PHRASE = go" -ForegroundColor Cyan
if ($ntfyTopic.Trim() -ne "") {
    Write-Host "  CHINTU_NTFY_TOPIC                = $($ntfyTopic.Trim())" -ForegroundColor Cyan
}
Write-Host ""
Write-Host "These survive reboots. Windows Task Scheduler inherits them." -ForegroundColor Yellow
Write-Host ""
Write-Host "To verify:" -ForegroundColor Gray
Write-Host "  [System.Environment]::GetEnvironmentVariable('CHINTU_GROQ_API_KEY', 'User')" -ForegroundColor Gray
Write-Host ""
Write-Host "To remove key:" -ForegroundColor Gray
Write-Host "  [System.Environment]::SetEnvironmentVariable('CHINTU_GROQ_API_KEY', `$null, 'User')" -ForegroundColor Gray
Write-Host ""
Write-Host "Next: run .\schedule-c49.ps1 to register the 7am Task Scheduler task." -ForegroundColor Green
