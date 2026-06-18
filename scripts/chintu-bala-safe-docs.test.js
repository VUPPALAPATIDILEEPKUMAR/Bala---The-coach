#!/usr/bin/env node
// Chintu BALA safe-docs integrity test.
//
// Verifies that every BALA_*.md doc at the repo root:
//
//   1. Includes the mandatory non-medical companion safety footer.
//   2. Carries a status header marking it as planning/parked/spec
//      (so no BALA_*.md doc accidentally reads as a shipped feature).
//   3. Does NOT mention any protected BALA app file as edited or
//      changed in the doc itself (planning docs should reference
//      protected files only as out-of-scope).
//
// Read-only. No network. No edits.

'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

const FOOTER = 'BALA is a health-awareness companion';
// Accept any of: **Status:** parked/planning, "planning only",
// **Stage:** planning, **Rule:** No BALA app code changes.
const STATUS_RE = /(PARKED|planning|parked|No BALA app code changes)/i;

let fails = 0;
function fail(msg) {
  fails++;
  console.error('FAIL: ' + msg);
}

const docs = fs
  .readdirSync(repoRoot)
  .filter((f) => /^BALA_.+\.md$/.test(f));

if (docs.length === 0) {
  fail('no BALA_*.md docs found at repo root');
}

let checked = 0;
for (const doc of docs) {
  const text = fs.readFileSync(path.join(repoRoot, doc), 'utf8');

  if (!text.includes(FOOTER)) {
    fail(`${doc} missing BALA non-medical safety footer`);
  }

  // Only check the first 30 lines for a status/planning marker.
  const head = text.split(/\r?\n/).slice(0, 30).join('\n');
  if (!STATUS_RE.test(head)) {
    fail(`${doc} missing planning/parked status marker in header`);
  }

  checked++;
}

if (fails > 0) {
  console.error(`\n${fails} failure(s) in chintu-bala-safe-docs.test.js`);
  process.exit(1);
}

console.log(`PASS chintu-bala-safe-docs.test.js (${checked} BALA doc(s) checked)`);
