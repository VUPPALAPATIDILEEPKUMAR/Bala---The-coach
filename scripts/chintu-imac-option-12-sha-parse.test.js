#!/usr/bin/env node
// Chintu iMac Option 12 SHA-parse regression test.
//
// Guards against a known real bug observed during the first manual
// iMac install on 2026-06-18: bridge-pull-shared.sh parsed
// MANIFEST.txt with awk -F': ', which truncated/misread the
// ZIP_SHA256 value when the manifest had variable spacing after the
// colon, and the manifest used uppercase hex while shasum -a 256
// returned lowercase. Result: false SHA-256 mismatch on iMac even
// when the zip was intact.
//
// This test verifies that install-option-12.sh (which emits the
// pull script as a heredoc) contains the robust sed-based parser
// AND the lowercase normalization on both sides. It also fails if
// the old awk -F': ' pattern reappears.
//
// Read-only. No network. No edits.

'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const installer = path.join(
  repoRoot,
  'CHINTU_IMAC_PACKAGES',
  'OPTION_12_PULL_SHARED',
  'install-option-12.sh'
);

let fails = 0;
function fail(msg) {
  fails++;
  console.error('FAIL: ' + msg);
}

if (!fs.existsSync(installer)) {
  fail('install-option-12.sh missing');
  process.exit(1);
}

const text = fs.readFileSync(installer, 'utf8');

// 1. Must contain the robust sed-based parser for EXPECTED_SHA.
if (!/EXPECTED_SHA=\$\(sed -n 's\/\^ZIP_SHA256:\[\[:space:\]\]\*\/\/p'/.test(text)) {
  fail("install-option-12.sh missing robust sed parser for EXPECTED_SHA (sed -n 's/^ZIP_SHA256:[[:space:]]*//p')");
}

// 2. Must lowercase EXPECTED_SHA (otherwise an uppercase manifest
//    hash will never equal the lowercase shasum output).
if (!/EXPECTED_SHA=[^\n]*tr '\[:upper:\]' '\[:lower:\]'/.test(text)) {
  fail("install-option-12.sh missing lowercase normalization on EXPECTED_SHA");
}

// 3. Must lowercase ACTUAL_SHA too (so behavior is symmetric).
if (!/ACTUAL_SHA=\$\(compute_sha256[^)]*tr '\[:upper:\]' '\[:lower:\]'\)/.test(text)) {
  fail("install-option-12.sh missing lowercase normalization on ACTUAL_SHA");
}

// 4. Must NOT contain the regressed awk -F': ' parse.
if (/awk -F': '[^\n]*ZIP_SHA256/.test(text)) {
  fail("install-option-12.sh still uses the regressed awk -F': ' parse for ZIP_SHA256");
}

if (fails > 0) {
  console.error(`\n${fails} failure(s) in chintu-imac-option-12-sha-parse.test.js`);
  process.exit(1);
}

console.log('PASS chintu-imac-option-12-sha-parse.test.js');
