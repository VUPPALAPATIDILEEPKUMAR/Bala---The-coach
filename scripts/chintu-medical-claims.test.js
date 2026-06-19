#!/usr/bin/env node
// Chintu medical-claims test.
//
// Scans Chintu-authored markdown for unsafe absolute medical-claim
// phrasing that should never appear regardless of context. The patterns
// here are deliberately narrow: phrases that have no safe meaning in a
// BALA-adjacent doc. Generic words like "diagnose" or "treat" are NOT
// flagged because safety footers legitimately use them in negated form
// ("does not diagnose, treat, ...").
//
// Scanned: CHINTU_*.md, BALA_*.md, scripts/chintu-*.ps1, scripts/chintu-*.js
// (excluding *.test.js, the master prompt, and this script itself).
//
// Read-only. No network. No edits.

'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

const unsafe = [
  /\bFDA[\s-]approved\b/i,
  /\bclinically proven\b/i,
  /\bmedically proven\b/i,
  /\bdoctor[\s-]recommended\b/i,
  /\bguaranteed cure\b/i,
  /\bcures? (?:diabetes|cancer|heart disease|hypertension)\b/i,
  /\bdiagnoses? your\b/i,
  /\bemergency monitoring (?:enabled|active|on)\b/i,
  /\breplace[s]? your doctor\b/i,
];

const allowFiles = new Set([
  'chintu_os_master_autonomous_builder_prompt.md',
  'chintu-medical-claims.test.js',
  // BALA_SAFE_COPY_REVIEW.md lists risky phrases in a risky->safer table.
  'bala_safe_copy_review.md',
  // CHINTU_SKILLS_MAP.md documents blocked language Chintu must never generate.
  // Listing forbidden phrases here is intentional (same pattern as above).
  'chintu_skills_map.md',
]);

let fails = 0;
function fail(msg) {
  fails++;
  console.error('FAIL: ' + msg);
}

function listTargets() {
  const out = [];
  for (const f of fs.readdirSync(repoRoot)) {
    if (!/^(CHINTU|BALA)_.+\.md$/.test(f)) continue;
    if (allowFiles.has(f.toLowerCase())) continue;
    out.push(path.join(repoRoot, f));
  }
  const scriptsDir = path.join(repoRoot, 'scripts');
  if (fs.existsSync(scriptsDir)) {
    for (const f of fs.readdirSync(scriptsDir)) {
      if (!/^chintu-/i.test(f)) continue;
      if (/\.test\.js$/i.test(f)) continue;
      if (allowFiles.has(f.toLowerCase())) continue;
      if (!/\.(ps1|js|md)$/i.test(f)) continue;
      out.push(path.join(scriptsDir, f));
    }
  }
  return out;
}

const targets = listTargets();

if (targets.length === 0) {
  fail('no Chintu-authored files found to scan');
}

let scanned = 0;
for (const full of targets) {
  const rel = path.relative(repoRoot, full).replace(/\\/g, '/');
  const text = fs.readFileSync(full, 'utf8');
  scanned++;
  for (const re of unsafe) {
    const m = text.match(re);
    if (m) {
      fail('unsafe medical claim in ' + rel + ': "' + m[0] + '"');
    }
  }
}

if (fails === 0) {
  console.log('Medical claims: PASS (' + scanned + ' file(s) scanned, ' + unsafe.length + ' pattern(s) checked)');
  process.exit(0);
}

console.error('Medical claims: FAIL (' + fails + ' issue(s))');
process.exit(1);
