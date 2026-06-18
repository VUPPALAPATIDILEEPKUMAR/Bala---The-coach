#!/usr/bin/env node
// Chintu dry-run adapter integrity test.
//
// Guards against the dry-run adapter ever becoming a real sender by
// accident. Verifies:
//
//   1. scripts/chintu-message-dry-run.js exists.
//   2. It contains NO forbidden patterns (no fetch, no http(s).request,
//      no Telegram/Slack/Discord URL, no nodemailer, etc.).
//   3. It contains an explicit DRY RUN ONLY marker.
//   4. If dry-run payload files exist, each contains "_dry_run": true,
//      a DRY RUN ONLY label, and no real URL.
//
// Read-only. No network. No edits.

'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const adapter = path.join(repoRoot, 'scripts', 'chintu-message-dry-run.js');
const payloadsDir = path.join(repoRoot, 'CHINTU_OUTBOX', 'dry_run_payloads');

const FORBIDDEN_IN_ADAPTER = [
  /\brequire\(['"]https?['"]\)/,
  /\brequire\(['"]node:https?['"]\)/,
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\bnodemailer\b/i,
  /\baxios\b/i,
  /https?:\/\/api\.telegram\.org/i,
  /https?:\/\/hooks\.slack\.com/i,
  /https?:\/\/discord\.com\/api\/webhooks/i,
  /https?:\/\/discordapp\.com\/api\/webhooks/i,
];

const FORBIDDEN_IN_PAYLOAD_URLS = [
  /https?:\/\/api\.telegram\.org/i,
  /https?:\/\/hooks\.slack\.com/i,
  /https?:\/\/discord\.com\/api\/webhooks/i,
  /https?:\/\/discordapp\.com\/api\/webhooks/i,
];

let fails = 0;
function fail(msg) {
  fails++;
  console.error('FAIL: ' + msg);
}

if (!fs.existsSync(adapter)) {
  fail('scripts/chintu-message-dry-run.js missing');
  process.exit(1);
}

const text = fs.readFileSync(adapter, 'utf8');
for (const re of FORBIDDEN_IN_ADAPTER) {
  if (re.test(text)) {
    fail(`dry-run adapter contains forbidden pattern: ${re}`);
  }
}
if (!/DRY RUN ONLY/.test(text)) {
  fail('dry-run adapter missing the "DRY RUN ONLY" marker constant');
}
// The adapter must not import any "send" oriented module.
if (/require\(['"](?:request|got|undici)['"]\)/.test(text)) {
  fail('dry-run adapter imports an HTTP client');
}

// Inspect generated payloads (if present).
if (fs.existsSync(payloadsDir)) {
  for (const f of fs.readdirSync(payloadsDir)) {
    if (!f.endsWith('.json')) continue;
    const p = path.join(payloadsDir, f);
    const raw = fs.readFileSync(p, 'utf8');
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      fail(`payload ${f} is not valid JSON: ${e.message}`);
      continue;
    }
    if (parsed._dry_run !== true) {
      fail(`payload ${f} missing _dry_run: true`);
    }
    if (parsed._label !== 'DRY RUN ONLY') {
      fail(`payload ${f} missing _label: "DRY RUN ONLY"`);
    }
    for (const re of FORBIDDEN_IN_PAYLOAD_URLS) {
      if (re.test(raw)) {
        fail(`payload ${f} contains a real connector URL (${re})`);
      }
    }
  }
}

if (fails > 0) {
  console.error(`\n${fails} failure(s) in chintu-dry-run-adapter.test.js`);
  process.exit(1);
}

console.log('PASS chintu-dry-run-adapter.test.js');
