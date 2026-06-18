#!/usr/bin/env node
// Chintu heartbeat integrity test.
//
// Verifies that scripts/chintu-heartbeat.ps1 exists, contains no
// network/send/webhook behavior, references the founder message,
// action planner, dry-run adapter, and dashboard generator, documents
// the heartbeat output paths, and does not require protected BALA app
// files. Also checks the generated heartbeat report/json shape if
// present.
//
// Read-only. No network. No edits.

'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const scriptPath = path.join(repoRoot, 'scripts', 'chintu-heartbeat.ps1');
const reportPath = path.join(repoRoot, 'CHINTU_HEARTBEAT.md');
const jsonPath = path.join(repoRoot, 'CHINTU_OUTBOX', 'latest_heartbeat.json');

const FOOTER = 'BALA is a health-awareness companion';
const FORBIDDEN_IN_SCRIPT = [
  'Invoke-WebRequest',
  'Invoke-RestMethod',
  'System.Net.WebClient',
  'api.telegram.org',
  'curl ',
  'hooks.slack.com',
  'discord.com/api/webhooks',
  'Send-MailMessage',
];
const REQUIRED_REFERENCES = [
  'scripts\\chintu-founder-message.ps1',
  'scripts\\chintu-action-planner.ps1',
  'scripts\\chintu-message-dry-run.js',
  'scripts\\chintu-control-room-index.ps1',
  'scripts\\chintu-operator-console.ps1',
  'CHINTU_HEARTBEAT.md',
  'latest_heartbeat.json',
];
const PROTECTED_BALA = [
  'app.js',
  'index.html',
  'styles.css',
  'sw.js',
  'coach.js',
  'manifest.webmanifest',
  'privacy.html',
  'functions/api/coach.js',
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
for (const ref of REQUIRED_REFERENCES) {
  if (!scriptText.includes(ref)) {
    fail(`heartbeat script missing required reference: ${ref}`);
  }
}
for (const protectedPath of PROTECTED_BALA) {
  if (scriptText.includes(protectedPath)) {
    fail(`heartbeat script should not require protected BALA app file: ${protectedPath}`);
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
  if (!/DRY RUN ONLY|Nothing sent|local-only/i.test(text)) {
    fail('CHINTU_HEARTBEAT.md missing explicit local-only / no-send language');
  }
  if (!text.includes('Exact next human command')) {
    fail('CHINTU_HEARTBEAT.md missing exact next human command line');
  }
}

if (fs.existsSync(jsonPath)) {
  let parsed = null;
  try {
    parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch (err) {
    fail(`latest_heartbeat.json is not valid JSON: ${err.message}`);
  }
  if (parsed) {
    if (parsed._dry_run !== true) fail('latest_heartbeat.json missing _dry_run: true');
    if (parsed._label !== 'DRY RUN ONLY') fail('latest_heartbeat.json missing _label: "DRY RUN ONLY"');
    if (!parsed.next_human_command) fail('latest_heartbeat.json missing next_human_command');
    if (!parsed.operator_console_status) fail('latest_heartbeat.json missing operator_console_status');
    if (!parsed.bala_safety_footer || !parsed.bala_safety_footer.includes('health-awareness companion')) {
      fail('latest_heartbeat.json missing BALA safety footer');
    }
  }
}

if (fails > 0) {
  console.error(`\n${fails} failure(s) in chintu-heartbeat.test.js`);
  process.exit(1);
}

console.log('PASS chintu-heartbeat.test.js');
