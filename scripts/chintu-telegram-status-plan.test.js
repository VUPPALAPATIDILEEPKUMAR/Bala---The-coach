#!/usr/bin/env node
// Chintu telegram-status-plan integrity test.
//
// Verifies that CHINTU_TELEGRAM_STATUS_PLAN.md:
//   1. Exists and is marked PARKED in its header.
//   2. Carries the BALA safety footer.
//   3. Explicitly prohibits sending BALA / health / medical content.
//   4. Names the no-network-egress test as the enforcement gate.
//
// Also verifies that no Chintu script under scripts/ contains a
// Telegram API URL (api.telegram.org) - a future activation must
// happen behind a founder-approved allowlist amendment, not silently.
//
// Read-only. No network. No edits.

'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const docPath = path.join(repoRoot, 'CHINTU_TELEGRAM_STATUS_PLAN.md');
const scriptsDir = path.join(repoRoot, 'scripts');

const FOOTER = 'BALA is a health-awareness companion';

let fails = 0;
function fail(msg) {
  fails++;
  console.error('FAIL: ' + msg);
}

if (!fs.existsSync(docPath)) {
  fail('CHINTU_TELEGRAM_STATUS_PLAN.md missing');
  process.exit(1);
}

const text = fs.readFileSync(docPath, 'utf8');
const head = text.split(/\r?\n/).slice(0, 20).join('\n');

if (!/\*\*Status:\*\*\s*PARKED/i.test(head)) {
  fail('CHINTU_TELEGRAM_STATUS_PLAN.md missing **Status:** PARKED in header');
}
if (!text.includes(FOOTER)) {
  fail('CHINTU_TELEGRAM_STATUS_PLAN.md missing BALA safety footer');
}
if (!/health[- ]data/i.test(text) || !/never|prohibited|must not/i.test(text)) {
  fail('CHINTU_TELEGRAM_STATUS_PLAN.md does not clearly prohibit health-data transfer');
}
if (!/chintu-no-network-egress\.test\.js/.test(text)) {
  fail('CHINTU_TELEGRAM_STATUS_PLAN.md does not name the no-network-egress test as gate');
}

// Scan production scripts (.ps1) for any Telegram API URL. Test files
// (.test.js) are allowed to name forbidden patterns - that is their job.
if (fs.existsSync(scriptsDir)) {
  for (const f of fs.readdirSync(scriptsDir)) {
    if (!/\.ps1$/.test(f)) continue;
    const t = fs.readFileSync(path.join(scriptsDir, f), 'utf8');
    if (/api\.telegram\.org/i.test(t)) {
      fail(`scripts/${f} references api.telegram.org - Telegram is parked, no script may target it`);
    }
  }
}

if (fails > 0) {
  console.error(`\n${fails} failure(s) in chintu-telegram-status-plan.test.js`);
  process.exit(1);
}

console.log('PASS chintu-telegram-status-plan.test.js');
