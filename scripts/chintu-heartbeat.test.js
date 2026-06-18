#!/usr/bin/env node
// Chintu heartbeat integrity test.
//
// Verifies that scripts/chintu-heartbeat.ps1 exists, contains no
// network egress patterns, and that CHINTU_HEARTBEAT.md (if present)
// carries:
//   1. the BALA safety footer
//   2. the "No health data sent" section header
//   3. an explicit "NOT SENT" marker on the Telegram candidate block
//
// Read-only. No network. No edits.

'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const scriptPath = path.join(repoRoot, 'scripts', 'chintu-heartbeat.ps1');
const reportPath = path.join(repoRoot, 'CHINTU_HEARTBEAT.md');

const FOOTER = 'BALA is a health-awareness companion';
const FORBIDDEN_IN_SCRIPT = [
  'Invoke-WebRequest',
  'Invoke-RestMethod',
  'System.Net.WebClient',
  'api.telegram.org',
  'curl ',
];

let fails = 0;
function fail(msg) {
  fails++;
  console.error('FAIL: ' + msg);
}

if (!fs.existsSync(scriptPath)) {
  fail('scripts/chintu-heartbeat.ps1 missing');
  process.exit(1);
}

const scriptText = fs.readFileSync(scriptPath, 'utf8');
for (const pat of FORBIDDEN_IN_SCRIPT) {
  if (scriptText.includes(pat)) {
    fail(`heartbeat script contains forbidden network pattern: ${pat}`);
  }
}

if (fs.existsSync(reportPath)) {
  const text = fs.readFileSync(reportPath, 'utf8');
  if (!text.includes(FOOTER)) {
    fail('CHINTU_HEARTBEAT.md missing BALA safety footer');
  }
  if (!/##\s+No health data sent/i.test(text)) {
    fail('CHINTU_HEARTBEAT.md missing "No health data sent" section');
  }
  if (!/NOT SENT/.test(text)) {
    fail('CHINTU_HEARTBEAT.md Telegram candidate block missing explicit NOT SENT marker');
  }
}

if (fails > 0) {
  console.error(`\n${fails} failure(s) in chintu-heartbeat.test.js`);
  process.exit(1);
}

console.log('PASS chintu-heartbeat.test.js');
