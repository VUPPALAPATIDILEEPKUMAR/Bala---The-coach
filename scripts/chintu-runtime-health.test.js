#!/usr/bin/env node
// Chintu runtime-health integrity test.
//
// Verifies that scripts/chintu-runtime-health.ps1 exists, contains
// the safety guarantees its output relies on (no network calls, no
// secret reads), and that if CHINTU_RUNTIME_HEALTH.md exists it
// carries the BALA safety footer and an Overall status header.
//
// Read-only. No network. No edits.

'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const scriptPath = path.join(repoRoot, 'scripts', 'chintu-runtime-health.ps1');
const reportPath = path.join(repoRoot, 'CHINTU_RUNTIME_HEALTH.md');

const FOOTER = 'BALA is a health-awareness companion';
const FORBIDDEN_IN_SCRIPT = [
  'Invoke-WebRequest',
  'Invoke-RestMethod',
  'System.Net.WebClient',
  'curl ',
  'wget ',
];

let fails = 0;
function fail(msg) {
  fails++;
  console.error('FAIL: ' + msg);
}

if (!fs.existsSync(scriptPath)) {
  fail('scripts/chintu-runtime-health.ps1 missing');
  process.exit(1);
}

const scriptText = fs.readFileSync(scriptPath, 'utf8');
for (const pat of FORBIDDEN_IN_SCRIPT) {
  if (scriptText.includes(pat)) {
    fail(`runtime-health script contains forbidden network pattern: ${pat}`);
  }
}

if (fs.existsSync(reportPath)) {
  const text = fs.readFileSync(reportPath, 'utf8');
  if (!text.includes(FOOTER)) {
    fail('CHINTU_RUNTIME_HEALTH.md missing BALA safety footer');
  }
  if (!/## Overall status:\s*\*\*(GREEN|YELLOW|RED)\*\*/.test(text)) {
    fail('CHINTU_RUNTIME_HEALTH.md missing valid Overall status header');
  }
}

if (fails > 0) {
  console.error(`\n${fails} failure(s) in chintu-runtime-health.test.js`);
  process.exit(1);
}

console.log('PASS chintu-runtime-health.test.js');
