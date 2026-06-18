#!/usr/bin/env node
// Chintu parked-systems integrity test.
//
// Verifies that every *_PARKED.md doc at the repo root:
//
//   1. Carries a Status header marking it parked.
//   2. Includes the BALA non-medical safety footer.
//   3. Does NOT contain wording that suggests activation
//      ("now active", "shipped", "enabled in production").
//
// Read-only. No network. No edits.

'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

const FOOTER = 'BALA is a health-awareness companion';
const STATUS_RE = /\*\*Status:\*\*\s*PARKED/i;
const ACTIVATION_RE = /\b(now active|shipped|enabled in production|live in prod)\b/i;

let fails = 0;
function fail(msg) {
  fails++;
  console.error('FAIL: ' + msg);
}

const docs = fs
  .readdirSync(repoRoot)
  .filter((f) => /_PARKED\.md$/.test(f));

if (docs.length === 0) {
  fail('no *_PARKED.md docs found at repo root');
}

let checked = 0;
for (const doc of docs) {
  const text = fs.readFileSync(path.join(repoRoot, doc), 'utf8');
  const head = text.split(/\r?\n/).slice(0, 20).join('\n');

  if (!STATUS_RE.test(head)) {
    fail(`${doc} missing **Status:** PARKED in header`);
  }
  if (!text.includes(FOOTER)) {
    fail(`${doc} missing BALA non-medical safety footer`);
  }
  if (ACTIVATION_RE.test(text)) {
    fail(`${doc} contains activation wording (parked docs must not claim activation)`);
  }

  checked++;
}

if (fails > 0) {
  console.error(`\n${fails} failure(s) in chintu-parked-systems.test.js`);
  process.exit(1);
}

console.log(`PASS chintu-parked-systems.test.js (${checked} parked doc(s) checked)`);
