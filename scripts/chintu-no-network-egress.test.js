#!/usr/bin/env node
// Chintu no-network-egress test.
//
// Scans every shipped Chintu OS script under scripts/chintu-*.ps1 and
// scripts/chintu-*.js (excluding *.test.js) for executable network-egress
// patterns. Markdown is not scanned because docs legitimately discuss
// what is parked. This is a regression guard: Chintu OS scripts must
// stay local-first.
//
// Read-only. No network. No edits.

'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const scriptsDir = path.join(repoRoot, 'scripts');

const forbidden = [
  { re: /\bInvoke-WebRequest\b/, label: 'Invoke-WebRequest' },
  { re: /\bInvoke-RestMethod\b/, label: 'Invoke-RestMethod' },
  { re: /\bNet\.WebClient\b/, label: 'Net.WebClient' },
  { re: /\bSystem\.Net\.Http\.HttpClient\b/, label: 'System.Net.Http.HttpClient' },
  { re: /\bStart-BitsTransfer\b/, label: 'Start-BitsTransfer' },
  { re: /\bcurl\.exe\b/, label: 'curl.exe' },
  { re: /\bwget\.exe\b/, label: 'wget.exe' },
  { re: /\bfetch\s*\(/, label: 'fetch(' },
  { re: /\bXMLHttpRequest\b/, label: 'XMLHttpRequest' },
  { re: /\brequire\(['"]https?['"]\)/, label: "require('http(s)')" },
  { re: /\brequire\(['"]node:https?['"]\)/, label: "require('node:http(s)')" },
  { re: /\brequire\(['"]axios['"]\)/, label: "require('axios')" },
  { re: /\bnew\s+WebSocket\b/, label: 'new WebSocket' },
];

let fails = 0;
function fail(msg) {
  fails++;
  console.error('FAIL: ' + msg);
}

if (!fs.existsSync(scriptsDir)) {
  fail('scripts/ directory missing');
  process.exit(1);
}

// chintu-validate.ps1 is the BALA-side scanner: it legitimately holds
// these tokens as regex strings to detect them in app code. Exempt it
// here so the integrity guard does not flag the guard's own patterns.
const scannerAllowlist = new Set(['chintu-validate.ps1', 'chintu-connector-send.js']);

const files = fs.readdirSync(scriptsDir).filter((f) => {
  if (!/^chintu-/i.test(f)) return false;
  if (/\.test\.js$/i.test(f)) return false;
  if (scannerAllowlist.has(f.toLowerCase())) return false;
  return /\.(ps1|js)$/i.test(f);
});

if (files.length === 0) {
  fail('no Chintu scripts found to scan');
}

const connectorSender = path.join(scriptsDir, 'chintu-connector-send.js');
if (!fs.existsSync(connectorSender)) {
  fail('scripts/chintu-connector-send.js missing');
} else {
  const senderText = fs.readFileSync(connectorSender, 'utf8');
  for (const required of [
    'CHINTU_CONNECTOR_MODE',
    'CHINTU_CONNECTOR_APPROVAL_PHRASE',
    'latest_connector_preview.json',
    'connector_sent.log.jsonl',
  ]) {
    if (!senderText.includes(required)) {
      fail(`connector sender missing required gate marker: ${required}`);
    }
  }
}

let scanned = 0;
for (const f of files) {
  const full = path.join(scriptsDir, f);
  const text = fs.readFileSync(full, 'utf8');
  scanned++;
  for (const { re, label } of forbidden) {
    if (re.test(text)) {
      fail(`network-egress pattern in scripts/${f}: ${label}`);
    }
  }
}

if (fails === 0) {
  console.log(
    `No network egress: PASS (${scanned} script(s) scanned, ${forbidden.length} pattern(s) checked)`
  );
  process.exit(0);
}

console.error(`No network egress: FAIL (${fails} issue(s))`);
process.exit(1);
