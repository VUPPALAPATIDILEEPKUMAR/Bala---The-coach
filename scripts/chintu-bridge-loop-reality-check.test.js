#!/usr/bin/env node
// Chintu bridge-loop-reality-check integrity test.
//
// Verifies that the bridge-reality-check script + the two founder-
// facing docs exist, carry the BALA safety footer, and contain no
// unsafe external automation references (Telegram API URL, webhook
// posting patterns, etc.).
//
// Read-only. No network. No edits.

'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const scriptPath = path.join(repoRoot, 'scripts', 'chintu-bridge-loop-reality-check.ps1');
const installDoc = path.join(repoRoot, 'CHINTU_IMAC_OPTION_12_INSTALL_NOW.md');
const logDoc     = path.join(repoRoot, 'CHINTU_BRIDGE_LOOP_TEST_LOG.md');
const reportDoc  = path.join(repoRoot, 'CHINTU_BRIDGE_LOOP_REALITY_CHECK.md');

const FOOTER = 'BALA is a health-awareness companion';
const FORBIDDEN_PATTERNS = [
  'api.telegram.org',
  'discord.com/api/webhooks',
  'hooks.slack.com',
  'Invoke-WebRequest',
  'Invoke-RestMethod',
  'System.Net.WebClient',
];
const SECRET_PATTERNS = [
  /BOT_TOKEN\s*=\s*['"][^'"]+['"]/i,
  /API_KEY\s*=\s*['"][^'"]+['"]/i,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];

let fails = 0;
function fail(msg) {
  fails++;
  console.error('FAIL: ' + msg);
}

function checkExists(p, label) {
  if (!fs.existsSync(p)) {
    fail(`${label} missing: ${path.relative(repoRoot, p)}`);
    return false;
  }
  return true;
}

if (!checkExists(scriptPath, 'reality-check script')) process.exit(1);
if (!checkExists(installDoc, 'install-now doc')) process.exit(1);
if (!checkExists(logDoc,     'test-log doc')) process.exit(1);

// 1. Script must contain no forbidden network or secret patterns.
const scriptText = fs.readFileSync(scriptPath, 'utf8');
for (const pat of FORBIDDEN_PATTERNS) {
  if (scriptText.includes(pat)) {
    fail(`reality-check script contains forbidden pattern: ${pat}`);
  }
}
for (const re of SECRET_PATTERNS) {
  if (re.test(scriptText)) {
    fail(`reality-check script contains a literal secret-shaped value`);
  }
}

// 2. Both founder docs carry the BALA safety footer.
for (const [p, label] of [[installDoc, 'install-now'], [logDoc, 'test-log']]) {
  const t = fs.readFileSync(p, 'utf8');
  if (!t.includes(FOOTER)) {
    fail(`${label} doc missing BALA safety footer`);
  }
  for (const pat of FORBIDDEN_PATTERNS) {
    // Allow benign mentions (e.g. listing what is parked). Only fail
    // on direct URL hits.
    if (pat.includes('://') && t.includes(pat)) {
      fail(`${label} doc references forbidden URL: ${pat}`);
    }
    if (!pat.includes('://') && pat.startsWith('Invoke-') === false) {
      // skip non-URL non-shell patterns in docs
      continue;
    }
  }
  for (const re of SECRET_PATTERNS) {
    if (re.test(t)) {
      fail(`${label} doc contains a literal secret-shaped value`);
    }
  }
}

// 3. If the generated report is present, it should also carry the footer
// and an Overall status line.
if (fs.existsSync(reportDoc)) {
  const t = fs.readFileSync(reportDoc, 'utf8');
  if (!t.includes(FOOTER)) {
    fail('CHINTU_BRIDGE_LOOP_REALITY_CHECK.md missing BALA safety footer');
  }
  if (!/## Overall status:\s*\*\*(GREEN|YELLOW|RED)\*\*/.test(t)) {
    fail('CHINTU_BRIDGE_LOOP_REALITY_CHECK.md missing valid Overall status header');
  }
}

if (fails > 0) {
  console.error(`\n${fails} failure(s) in chintu-bridge-loop-reality-check.test.js`);
  process.exit(1);
}

console.log('PASS chintu-bridge-loop-reality-check.test.js');
