#!/usr/bin/env node
// Chintu outbox-shape integrity test.
//
// Verifies:
//   1. CHINTU_OUTBOX/README.md exists and carries the BALA safety
//      footer.
//   2. If latest_founder_message.md exists, it carries the footer and
//      contains the safety promise that nothing was sent.
//   3. If founder_message_history.md exists, it carries the footer
//      at least once.
//   4. The outbox README explicitly lists at least latest_founder_message.md,
//      founder_message_history.md, and dry_run_payloads/.
//   5. No file under CHINTU_OUTBOX/ contains a real connector URL
//      (api.telegram.org / hooks.slack.com / discord.com webhook).
//
// Read-only. No network. No edits.

'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const outboxDir = path.join(repoRoot, 'CHINTU_OUTBOX');
const readmePath = path.join(outboxDir, 'README.md');
const latestPath = path.join(outboxDir, 'latest_founder_message.md');
const historyPath = path.join(outboxDir, 'founder_message_history.md');

const FOOTER = 'BALA is a health-awareness companion';
const REAL_URL_PATTERNS = [
  /https?:\/\/api\.telegram\.org/i,
  /https?:\/\/hooks\.slack\.com/i,
  /https?:\/\/discord(?:app)?\.com\/api\/webhooks/i,
];

let fails = 0;
function fail(msg) {
  fails++;
  console.error('FAIL: ' + msg);
}

if (!fs.existsSync(outboxDir)) {
  fail('CHINTU_OUTBOX/ missing');
  process.exit(1);
}
if (!fs.existsSync(readmePath)) {
  fail('CHINTU_OUTBOX/README.md missing');
  process.exit(1);
}

const readme = fs.readFileSync(readmePath, 'utf8');
if (!readme.includes(FOOTER)) {
  fail('CHINTU_OUTBOX/README.md missing BALA safety footer');
}
for (const need of ['latest_founder_message.md', 'founder_message_history.md', 'dry_run_payloads']) {
  if (!readme.includes(need)) {
    fail(`CHINTU_OUTBOX/README.md does not mention ${need}`);
  }
}

if (fs.existsSync(latestPath)) {
  const t = fs.readFileSync(latestPath, 'utf8');
  if (!t.includes(FOOTER)) {
    fail('latest_founder_message.md missing BALA safety footer');
  }
  if (!/nothing was sent/i.test(t) && !/local-only/i.test(t)) {
    fail('latest_founder_message.md missing the "nothing was sent" / local-only promise');
  }
}

if (fs.existsSync(historyPath)) {
  const t = fs.readFileSync(historyPath, 'utf8');
  if (!t.includes(FOOTER)) {
    fail('founder_message_history.md missing BALA safety footer');
  }
}

// Walk every file under CHINTU_OUTBOX/ recursively, fail if any
// contains a real connector URL.
function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      walk(p);
      continue;
    }
    if (st.size > 2 * 1024 * 1024) continue; // skip large blobs
    const t = fs.readFileSync(p, 'utf8');
    for (const re of REAL_URL_PATTERNS) {
      if (re.test(t)) {
        fail(`${path.relative(repoRoot, p)} contains a real connector URL`);
      }
    }
  }
}
walk(outboxDir);

if (fails > 0) {
  console.error(`\n${fails} failure(s) in chintu-outbox-shape.test.js`);
  process.exit(1);
}

console.log('PASS chintu-outbox-shape.test.js');
