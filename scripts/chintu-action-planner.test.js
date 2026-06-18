#!/usr/bin/env node
// Chintu action-planner integrity test.
//
// Verifies that scripts/chintu-action-planner.ps1 exists, contains
// no network egress or send patterns, and that if its three founder-
// facing outputs are present they carry:
//   1. The BALA safety footer.
//   2. An explicit approval phrase pattern in the approval center.
//   3. No real connector URL or send language.
//   4. The "parked" listing.
//
// Also verifies that the JSON mirror under CHINTU_OUTBOX/ (if present)
// is valid JSON and marked _dry_run: true / _label: "DRY RUN ONLY".
//
// Read-only. No network. No edits.

'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const script = path.join(repoRoot, 'scripts', 'chintu-action-planner.ps1');
const queue  = path.join(repoRoot, 'CHINTU_ACTION_QUEUE.md');
const center = path.join(repoRoot, 'CHINTU_APPROVAL_CENTER.md');
const prompt = path.join(repoRoot, 'CHINTU_NEXT_OPERATOR_PROMPT.md');
const jsonP  = path.join(repoRoot, 'CHINTU_OUTBOX', 'latest_action_plan.json');

const FOOTER = 'BALA is a health-awareness companion';
const FORBIDDEN_IN_SCRIPT = [
  'Invoke-WebRequest',
  'Invoke-RestMethod',
  'System.Net.WebClient',
  'api.telegram.org',
  'hooks.slack.com',
  'discord.com/api/webhooks',
];
const FORBIDDEN_SEND_LANG = [
  /\bsend(?:s|ing)? telegram\b/i,
  /\bpost(?:ed|ing)? to slack\b/i,
  /\bnotify discord channel\b/i,
];

let fails = 0;
function fail(m) { fails++; console.error('FAIL: ' + m); }

if (!fs.existsSync(script)) {
  fail('scripts/chintu-action-planner.ps1 missing');
  process.exit(1);
}

const stext = fs.readFileSync(script, 'utf8');
for (const p of FORBIDDEN_IN_SCRIPT) {
  if (stext.includes(p)) fail(`planner script contains forbidden pattern: ${p}`);
}

// Each docs check is conditional on the file existing (the script may not
// have been run yet in this checkout).
const checks = [
  { path: queue,  label: 'CHINTU_ACTION_QUEUE.md' },
  { path: center, label: 'CHINTU_APPROVAL_CENTER.md' },
  { path: prompt, label: 'CHINTU_NEXT_OPERATOR_PROMPT.md' },
];
for (const c of checks) {
  if (!fs.existsSync(c.path)) continue;
  const t = fs.readFileSync(c.path, 'utf8');
  if (!t.includes(FOOTER)) fail(`${c.label} missing BALA safety footer`);
  for (const re of FORBIDDEN_SEND_LANG) {
    if (re.test(t)) fail(`${c.label} contains external-send language: ${re}`);
  }
}

if (fs.existsSync(queue)) {
  const t = fs.readFileSync(queue, 'utf8');
  if (!/Parked/i.test(t)) fail('CHINTU_ACTION_QUEUE.md missing parked listing');
}

if (fs.existsSync(center)) {
  const t = fs.readFileSync(center, 'utf8');
  // Either there is an approval card (with the approval phrase pattern)
  // or there is the explicit "no approval needed" header.
  const hasApprovePhrase = /^\s*approve\s+[A-Z]\d/m.test(t);
  const hasNoneHeader = /No approval needed this turn/i.test(t);
  if (!hasApprovePhrase && !hasNoneHeader) {
    fail('CHINTU_APPROVAL_CENTER.md has neither an "approve <id>" phrase nor a "no approval needed" header');
  }
  if (hasApprovePhrase) {
    if (!t.includes('CHINTU_APPROVAL_AUDIT.md')) {
      fail('CHINTU_APPROVAL_CENTER.md missing CHINTU_APPROVAL_AUDIT.md reference for approval workflow');
    }
    if (!t.includes('scripts\\chintu-approval-audit.ps1')) {
      fail('CHINTU_APPROVAL_CENTER.md missing approval-audit helper command');
    }
  }
}

if (fs.existsSync(jsonP)) {
  const raw = fs.readFileSync(jsonP, 'utf8');
  let parsed;
  try { parsed = JSON.parse(raw); } catch (e) { fail('latest_action_plan.json is not valid JSON: ' + e.message); }
  if (parsed) {
    if (parsed._dry_run !== true) fail('latest_action_plan.json missing _dry_run: true');
    if (parsed._label !== 'DRY RUN ONLY') fail('latest_action_plan.json missing _label: "DRY RUN ONLY"');
    if (!parsed.bala_safety_footer || !parsed.bala_safety_footer.includes('health-awareness companion')) {
      fail('latest_action_plan.json missing bala_safety_footer');
    }
  }
}

if (fails > 0) {
  console.error(`\n${fails} failure(s) in chintu-action-planner.test.js`);
  process.exit(1);
}
console.log('PASS chintu-action-planner.test.js');
