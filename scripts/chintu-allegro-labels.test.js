#!/usr/bin/env node
'use strict';

// =============================================================================
// Chintu Allegro labels smoke test — Stage 26
// Reads the shipped local HTML shell and protects the visible Stage 24 label.
// Pure read-only, no browser, no network.
// =============================================================================

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const htmlPath = path.join(repoRoot, 'CHINTU_ALLEGRO.html');

let fails = 0;
function ok(cond, msg) {
  if (cond) { console.log('  PASS: ' + msg); }
  else { fails++; console.error('  FAIL: ' + msg); }
}

console.log('Chintu Allegro labels smoke test\n');

if (!fs.existsSync(htmlPath)) {
  console.error('FAIL: missing CHINTU_ALLEGRO.html');
  process.exit(1);
}

const html = fs.readFileSync(htmlPath, 'utf8');

ok(html.includes('Stage 24'), 'html contains the Stage 24 label');
ok(/brain runtime active/i.test(html), 'html contains "brain runtime active"');
ok(!/>\s*Stage 22\s*</i.test(html), 'html does not contain visible Stage 22 badge text');
ok(/\/api\/chat|api\/chat/i.test(html), 'html contains bridge chat integration references');

console.log('');
if (fails === 0) {
  console.log('Allegro labels: PASS');
  process.exit(0);
} else {
  console.error('Allegro labels: FAIL (' + fails + ' issue(s))');
  process.exit(1);
}
