#!/usr/bin/env node
// Chintu operator console integrity test.
//
// Verifies the operator console script exists, stays local-only, points
// at the expected upstream heartbeat/planner artifacts, documents its
// output paths, and does not require protected BALA app files.

'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const scriptPath = path.join(repoRoot, 'scripts', 'chintu-operator-console.ps1');
const htmlPath = path.join(repoRoot, 'CHINTU_OPERATOR_CONSOLE.html');
const jsonPath = path.join(repoRoot, 'CHINTU_OUTBOX', 'latest_operator_console.json');

const FORBIDDEN = [
  'Invoke-WebRequest',
  'Invoke-RestMethod',
  'System.Net.WebClient',
  'api.telegram.org',
  'hooks.slack.com',
  'discord.com/api/webhooks',
  'Send-MailMessage',
];
const REQUIRED_REFERENCES = [
  'CHINTU_HEARTBEAT.md',
  'CHINTU_DAILY_BRIEF.md',
  'CHINTU_ACTION_QUEUE.md',
  'CHINTU_APPROVAL_CENTER.md',
  'CHINTU_APPROVAL_AUDIT.md',
  'CHINTU_NEXT_OPERATOR_PROMPT.md',
  'CHINTU_OUTBOX/latest_founder_message.md',
  'CHINTU_OUTBOX/latest_action_plan.json',
  'CHINTU_OUTBOX/latest_heartbeat.json',
  'CHINTU_OPERATOR_CONSOLE.html',
  'latest_operator_console.json',
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
function fail(message) {
  fails++;
  console.error('FAIL: ' + message);
}

if (!fs.existsSync(scriptPath)) {
  fail('scripts/chintu-operator-console.ps1 missing');
  process.exit(1);
}

const scriptText = fs.readFileSync(scriptPath, 'utf8');
for (const token of FORBIDDEN) {
  if (scriptText.includes(token)) {
    fail(`operator console script contains forbidden token: ${token}`);
  }
}
for (const ref of REQUIRED_REFERENCES) {
  if (!scriptText.includes(ref)) {
    fail(`operator console script missing required reference: ${ref}`);
  }
}
for (const protectedPath of PROTECTED_BALA) {
  if (scriptText.includes(protectedPath)) {
    fail(`operator console script should not require protected BALA file: ${protectedPath}`);
  }
}

if (fs.existsSync(htmlPath)) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const requiredHtmlSnippets = [
    'Chintu status:',
    'No external messages sent',
    'No BALA app files touched unless founder approves',
    'Exact next human command',
    'CHINTU_NEXT_OPERATOR_PROMPT.md',
    'BALA is a health-awareness companion',
  ];
  for (const snippet of requiredHtmlSnippets) {
    if (!html.includes(snippet)) {
      fail(`CHINTU_OPERATOR_CONSOLE.html missing snippet: ${snippet}`);
    }
  }
}

if (fs.existsSync(jsonPath)) {
  let parsed = null;
  try {
    parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch (error) {
    fail(`latest_operator_console.json invalid JSON: ${error.message}`);
  }
  if (parsed) {
    if (parsed._dry_run !== true) fail('latest_operator_console.json missing _dry_run: true');
    if (parsed._label !== 'DRY RUN ONLY') fail('latest_operator_console.json missing _label: "DRY RUN ONLY"');
    if (!parsed.next_human_command) fail('latest_operator_console.json missing next_human_command');
    if (parsed.next_prompt_file !== 'CHINTU_NEXT_OPERATOR_PROMPT.md') {
      fail('latest_operator_console.json missing next_prompt_file');
    }
    if (!Array.isArray(parsed.badges) || !parsed.badges.includes('No external messages sent')) {
      fail('latest_operator_console.json missing no-send badge');
    }
    if (!parsed.bala_safety_footer || !parsed.bala_safety_footer.includes('health-awareness companion')) {
      fail('latest_operator_console.json missing BALA footer');
    }
  }
}

if (fails > 0) {
  console.error(`\n${fails} failure(s) in chintu-operator-console.test.js`);
  process.exit(1);
}

console.log('PASS chintu-operator-console.test.js');
