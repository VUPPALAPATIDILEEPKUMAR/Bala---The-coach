# push-c62.ps1 -- C62: GitHub notifications watcher
# Run from C:\Users\Chintu\Desktop\test (must be in that dir)

Set-Location 'C:\Users\Chintu\Desktop\test'

Write-Host "=== C62 push script ==="

# 1. Syntax check
Write-Host "1. node --check..."
node --check scripts\chintu-github-watch.js
if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: syntax check"; exit 1 }
Write-Host "   OK"

# 2. Add chintu-github-watch.js to egress allowlist if not present
Write-Host "2. Patching egress allowlist..."
$ef = 'scripts\chintu-no-network-egress.test.js'
$ec = Get-Content $ef -Raw
if ($ec -notmatch "'chintu-github-watch.js'") {
  $ec = $ec -replace "  'chintu-voice-out\.js',", "  'chintu-voice-out.js',`n  // C62: GitHub watcher -- api.github.com notifications (read-only, GITHUB_TOKEN gated)`n  'chintu-github-watch.js',"
  Set-Content $ef $ec -NoNewline
  git add $ef
  Write-Host "   Patched and staged."
} else {
  Write-Host "   Already present, skipping."
}

# 3. Egress test
Write-Host "3. Egress test..."
node scripts\chintu-no-network-egress.test.js
if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: egress test"; exit 1 }
Write-Host "   PASS"

# 4. Stage files
Write-Host "4. git add..."
git add scripts\chintu-github-watch.js .gitignore push-c62.ps1 schedule-c62.ps1

# 5. Commit
Write-Host "5. git commit..."
git commit -m "C62: GitHub notifications watcher -- Telegram digest of new issues/PRs/mentions"
if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: git commit"; exit 1 }

# 6. Push
Write-Host "6. git push..."
git push origin main
if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: git push"; exit 1 }

Write-Host "=== C62 pushed OK ==="
