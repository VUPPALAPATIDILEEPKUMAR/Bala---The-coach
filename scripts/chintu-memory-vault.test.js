#!/usr/bin/env node
// Chintu memory vault integrity test.
//
// Verifies:
//  1. Every file/folder listed in CHINTU_MEMORY_VAULT/README.md exists.
//  2. Every shipped file/folder inside CHINTU_MEMORY_VAULT/ (excluding
//     DAILY_LOGS entries) is mentioned in the vault README contents
//     table.
//  3. The vault contains no executables, no .env, and no obvious
//     credential file names.
//
// Read-only. No network. No edits.

'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const vault = path.join(repoRoot, 'CHINTU_MEMORY_VAULT');
const readme = path.join(vault, 'README.md');

let fails = 0;
function fail(msg) {
  fails++;
  console.error('FAIL: ' + msg);
}

if (!fs.existsSync(vault) || !fs.statSync(vault).isDirectory()) {
  fail('CHINTU_MEMORY_VAULT directory missing');
  process.exit(1);
}
if (!fs.existsSync(readme)) {
  fail('CHINTU_MEMORY_VAULT/README.md missing');
  process.exit(1);
}

const text = fs.readFileSync(readme, 'utf8');

// Extract every `NAME.md` or `NAME/` token from inline backticks.
const refRe = /`([A-Z_][A-Z0-9_]*(?:\.md|\/))`/g;
const referenced = new Set();
let m;
while ((m = refRe.exec(text)) !== null) {
  referenced.add(m[1]);
}

for (const ref of referenced) {
  const p = path.join(vault, ref.replace(/\/$/, ''));
  if (!fs.existsSync(p)) {
    fail(`vault README references missing entry: ${ref}`);
  }
}

const shipped = fs.readdirSync(vault).filter((f) => f !== 'README.md');
const shippedTokens = shipped.map((f) => {
  const full = path.join(vault, f);
  return fs.statSync(full).isDirectory() ? f + '/' : f;
});

const unmentioned = shippedTokens.filter((t) => !referenced.has(t));
if (unmentioned.length > 0) {
  fail('shipped vault entry not mentioned in README: ' + unmentioned.join(', '));
}

const forbiddenNames = ['.env', 'paired.json', 'openclaw.json', 'cookies.txt'];
const forbiddenExt = ['.exe', '.bat', '.cmd', '.ps1', '.sh', '.dll'];

function walk(dir) {
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      walk(full);
      continue;
    }
    const lower = entry.toLowerCase();
    if (forbiddenNames.includes(lower)) {
      fail(`vault contains forbidden file name: ${path.relative(vault, full)}`);
    }
    if (forbiddenExt.some((e) => lower.endsWith(e))) {
      fail(`vault contains forbidden executable: ${path.relative(vault, full)}`);
    }
  }
}
walk(vault);

if (fails === 0) {
  console.log(
    `Memory vault integrity: PASS (${referenced.size} referenced, ${shippedTokens.length} shipped)`
  );
  process.exit(0);
}

console.error(`Memory vault integrity: FAIL (${fails} issue(s))`);
process.exit(1);
