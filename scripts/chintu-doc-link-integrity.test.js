#!/usr/bin/env node
// Chintu doc-link integrity test.
//
// Scans every top-level Chintu-authored markdown file (CHINTU_*.md,
// BALA_*.md) for inline markdown links of the form [text](target). For
// each target that is a local relative path (no scheme, no leading
// anchor, no mailto), it verifies the file exists on disk.
//
// Skipped target shapes:
//   - http:// or https:// (external)
//   - mailto:
//   - bare #anchor links
//   - absolute paths (start with / or drive letter)
//
// Read-only. No network. No edits.

'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

let fails = 0;
function fail(msg) {
  fails++;
  console.error('FAIL: ' + msg);
}

function listDocs() {
  return fs
    .readdirSync(repoRoot)
    .filter((f) => /^(CHINTU|BALA)_.+\.md$/.test(f))
    .map((f) => path.join(repoRoot, f));
}

const docs = listDocs();
if (docs.length === 0) {
  fail('no Chintu-authored markdown found');
}

const linkRe = /\[(?:[^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

let linksChecked = 0;
for (const docPath of docs) {
  const rel = path.relative(repoRoot, docPath).replace(/\\/g, '/');
  const text = fs.readFileSync(docPath, 'utf8');
  let m;
  while ((m = linkRe.exec(text)) !== null) {
    let target = m[1];
    if (!target) continue;
    if (/^(https?:|mailto:|tel:)/i.test(target)) continue;
    if (target.startsWith('#')) continue;
    if (target.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(target)) continue;

    // Drop fragment and query.
    target = target.split('#')[0].split('?')[0];
    if (!target) continue;

    linksChecked++;
    const resolved = path.resolve(path.dirname(docPath), target);
    if (!fs.existsSync(resolved)) {
      fail(`broken link in ${rel}: (${m[1]})`);
    }
  }
}

if (fails === 0) {
  console.log(
    `Doc link integrity: PASS (${docs.length} doc(s), ${linksChecked} local link(s) checked)`
  );
  process.exit(0);
}

console.error(`Doc link integrity: FAIL (${fails} issue(s))`);
process.exit(1);
