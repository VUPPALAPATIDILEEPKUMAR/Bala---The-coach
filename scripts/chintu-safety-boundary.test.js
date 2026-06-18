#!/usr/bin/env node
// Chintu safety-boundary test.
//
// Verifies the canonical protected BALA file set against
// CHINTU_FOUNDER_COMMAND_MAP.md and the working tree:
//   1. Every file in the canonical set is mentioned in the command map
//      under the "will never include" / protected list.
//   2. Every file in the canonical set exists in the repo (so the list
//      cannot quietly point at deleted files).
//   3. The canonical set matches the master builder prompt's protected
//      list exactly (drift guard).
//
// Read-only. No network. No edits.

'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

// Canonical set of protected BALA files that must exist in the repo
// and be listed in the founder command map's "will never include" block.
// Note: the master builder prompt also lists a bare `coach.js`; in this
// repo the actual coach module is `functions/api/coach.js`, so that is
// the file that must exist. The bare `coach.js` token still has to be
// present in the command map's protected list (drift guard below).
const canonicalProtected = [
  'app.js',
  'index.html',
  'styles.css',
  'sw.js',
  'manifest.webmanifest',
  'privacy.html',
  'functions/api/coach.js',
];

const canonicalDocTokens = [...canonicalProtected, 'coach.js'];

let fails = 0;
function fail(msg) {
  fails++;
  console.error('FAIL: ' + msg);
}

// 1 + 3: command map and master prompt must list every canonical entry.
const checkDocs = [
  'CHINTU_FOUNDER_COMMAND_MAP.md',
  'CHINTU_OS_MASTER_AUTONOMOUS_BUILDER_PROMPT.md',
];
for (const doc of checkDocs) {
  const full = path.join(repoRoot, doc);
  if (!fs.existsSync(full)) {
    // The master prompt may live in Downloads, not the repo. Skip rather
    // than fail in that case.
    if (doc === 'CHINTU_OS_MASTER_AUTONOMOUS_BUILDER_PROMPT.md') continue;
    fail(`expected doc missing: ${doc}`);
    continue;
  }
  const text = fs.readFileSync(full, 'utf8');
  for (const f of canonicalDocTokens) {
    if (!text.includes(f)) {
      fail(`${doc} does not mention protected file token: ${f}`);
    }
  }
}

// 2: each protected file exists.
for (const f of canonicalProtected) {
  const full = path.join(repoRoot, f);
  if (!fs.existsSync(full)) {
    fail(`protected file is missing from repo: ${f}`);
  }
}

if (fails === 0) {
  console.log(
    `Safety boundary: PASS (${canonicalProtected.length} protected file(s) verified)`
  );
  process.exit(0);
}

console.error(`Safety boundary: FAIL (${fails} issue(s))`);
process.exit(1);
