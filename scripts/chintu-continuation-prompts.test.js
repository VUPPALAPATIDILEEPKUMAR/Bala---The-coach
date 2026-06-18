#!/usr/bin/env node
// Chintu continuation-prompts integrity test.
//
// Verifies that each continuation / review / starter prompt doc:
//
//   1. Exists.
//   2. Includes the BALA non-medical safety footer.
//   3. Reminds the reader to NEVER push and to NEVER edit any
//      protected BALA app file.
//
// Read-only. No network. No edits.

'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

const DOCS = [
  'CHINTU_CODEX_REVIEW_PROMPT.md',
  'CHINTU_CLAUDE_CONTINUATION_PROMPT.md',
  'CHINTU_NEXT_THREAD_STARTER_DETAILED.md',
  'CHINTU_PUSH_REVIEW_CHECKLIST.md',
];

const FOOTER = 'BALA is a health-awareness companion';
const PUSH_RE = /\b(never push|do\s+\*?\*?not\*?\*?\s+push|push is the founder|do not let any agent run through this list and\s+auto-push)\b/i;
const PROTECTED_RE = /app\.js/i;

let fails = 0;
function fail(msg) {
  fails++;
  console.error('FAIL: ' + msg);
}

let checked = 0;
for (const doc of DOCS) {
  const p = path.join(repoRoot, doc);
  if (!fs.existsSync(p)) {
    fail(`missing required prompt doc: ${doc}`);
    continue;
  }
  const text = fs.readFileSync(p, 'utf8');

  if (!text.includes(FOOTER)) {
    fail(`${doc} missing BALA non-medical safety footer`);
  }
  if (!PUSH_RE.test(text)) {
    fail(`${doc} missing explicit push restriction`);
  }
  if (!PROTECTED_RE.test(text)) {
    fail(`${doc} missing mention of protected BALA file list (app.js)`);
  }

  checked++;
}

if (fails > 0) {
  console.error(`\n${fails} failure(s) in chintu-continuation-prompts.test.js`);
  process.exit(1);
}

console.log(`PASS chintu-continuation-prompts.test.js (${checked} prompt doc(s) checked)`);
