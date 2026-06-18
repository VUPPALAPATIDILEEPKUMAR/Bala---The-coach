#!/usr/bin/env node
// Chintu approval-audit integrity test.
//
// Verifies the local approval-audit helper and tracked markdown log:
//   1. The helper exists and contains no network/send patterns.
//   2. The tracked audit doc exists with schema + entries headings.
//   3. The helper validates an `approve <id>` phrase shape.
//   4. The helper supports the validation dry-run flow.
//   5. The audit doc carries the BALA safety footer.
//
// Read-only. No network. No edits.

'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const script = path.join(repoRoot, 'scripts', 'chintu-approval-audit.ps1');
const audit = path.join(repoRoot, 'CHINTU_APPROVAL_AUDIT.md');

const FOOTER = 'BALA is a health-awareness companion';
const FORBIDDEN = [
  'Invoke-WebRequest',
  'Invoke-RestMethod',
  'System.Net.WebClient',
  'api.telegram.org',
  'hooks.slack.com',
  'discord.com/api/webhooks',
];

let fails = 0;
function fail(msg) {
  fails++;
  console.error('FAIL: ' + msg);
}

if (!fs.existsSync(script)) {
  fail('scripts/chintu-approval-audit.ps1 missing');
} else {
  const text = fs.readFileSync(script, 'utf8');
  for (const pattern of FORBIDDEN) {
    if (text.includes(pattern)) fail(`approval-audit helper contains forbidden pattern: ${pattern}`);
  }
  if (!text.includes('^approve\\s+([A-Za-z0-9][A-Za-z0-9-]*)$')) {
    fail('approval-audit helper does not validate the expected approve <id> phrase');
  }
  if (!text.includes('[switch]$DryRun')) {
    fail('approval-audit helper missing DryRun support');
  }
  if (!text.includes('[string]$ActionId')) {
    fail('approval-audit helper missing ActionId support');
  }
  if (!text.includes('CHINTU_APPROVAL_AUDIT.md')) {
    fail('approval-audit helper does not target CHINTU_APPROVAL_AUDIT.md');
  }
}

if (!fs.existsSync(audit)) {
  fail('CHINTU_APPROVAL_AUDIT.md missing');
} else {
  const text = fs.readFileSync(audit, 'utf8');
  if (!text.includes('## Schema')) fail('CHINTU_APPROVAL_AUDIT.md missing schema heading');
  if (!text.includes('## Entries')) fail('CHINTU_APPROVAL_AUDIT.md missing entries heading');
  if (!text.includes('| Timestamp | Action id | Approval phrase | Branch | HEAD | Notes |')) {
    fail('CHINTU_APPROVAL_AUDIT.md missing approval table header');
  }
  if (!text.includes('scripts\\chintu-approval-audit.ps1 -ApprovalPhrase "approve')) {
    fail('CHINTU_APPROVAL_AUDIT.md missing helper command example');
  }
  if (!text.includes(FOOTER)) fail('CHINTU_APPROVAL_AUDIT.md missing BALA safety footer');
}

if (fails > 0) {
  console.error(`\n${fails} failure(s) in chintu-approval-audit.test.js`);
  process.exit(1);
}

console.log('PASS chintu-approval-audit.test.js');
