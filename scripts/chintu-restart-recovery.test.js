#!/usr/bin/env node
// Chintu restart-recovery integrity test.
//
// Verifies that scripts/chintu-restart-recovery.ps1 exists, contains
// no network egress patterns, and that CHINTU_RESTART_RECOVERY.md
// (if present) carries the BALA safety footer and a resume action.
//
// Read-only. No network. No edits.

'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const scriptPath = path.join(repoRoot, 'scripts', 'chintu-restart-recovery.ps1');
const reportPath = path.join(repoRoot, 'CHINTU_RESTART_RECOVERY.md');

const FOOTER = 'BALA is a health-awareness companion';
const FORBIDDEN_IN_SCRIPT = [
  'Invoke-WebRequest',
  'Invoke-RestMethod',
  'System.Net.WebClient',
  'curl ',
];

let fails = 0;
function fail(msg) {
  fails++;
  console.error('FAIL: ' + msg);
}

if (!fs.existsSync(scriptPath)) {
  fail('scripts/chintu-restart-recovery.ps1 missing');
  process.exit(1);
}

const scriptText = fs.readFileSync(scriptPath, 'utf8');
for (const pat of FORBIDDEN_IN_SCRIPT) {
  if (scriptText.includes(pat)) {
    fail(`restart-recovery script contains forbidden network pattern: ${pat}`);
  }
}

if (fs.existsSync(reportPath)) {
  const text = fs.readFileSync(reportPath, 'utf8');
  if (!text.includes(FOOTER)) {
    fail('CHINTU_RESTART_RECOVERY.md missing BALA safety footer');
  }
  if (!/##\s+Resume action/i.test(text)) {
    fail('CHINTU_RESTART_RECOVERY.md missing "Resume action" section');
  }
}

if (fails > 0) {
  console.error(`\n${fails} failure(s) in chintu-restart-recovery.test.js`);
  process.exit(1);
}

console.log('PASS chintu-restart-recovery.test.js');
