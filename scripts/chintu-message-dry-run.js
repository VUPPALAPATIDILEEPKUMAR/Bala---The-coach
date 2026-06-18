#!/usr/bin/env node
// Chintu dry-run message adapter.
//
// Reads the latest founder message from CHINTU_OUTBOX/latest_founder_message.md
// and writes simulated per-connector payloads to
// CHINTU_OUTBOX/dry_run_payloads/.
//
// This script NEVER sends anything externally. It contains no
// http/https client, no Telegram URL, no Slack webhook URL, no
// Discord webhook URL, no SMTP code. Its only output is local files
// labeled "DRY RUN ONLY".
//
// Usage:
//   node scripts/chintu-message-dry-run.js
//   node scripts/chintu-message-dry-run.js --check   (validate inputs/outputs only)
//
// Exits 0 on success, 1 on error.

'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const outboxDir = path.join(repoRoot, 'CHINTU_OUTBOX');
const payloadsDir = path.join(outboxDir, 'dry_run_payloads');
const messagePath = path.join(outboxDir, 'latest_founder_message.md');
const configPath = path.join(repoRoot, 'CHINTU_CONNECTORS_CONFIG.example.json');

const DRY_RUN_TAG = 'DRY RUN ONLY';
const SAFETY_FOOTER =
  'BALA is a health-awareness companion. It does not diagnose, treat, predict, prevent, replace doctors, or provide emergency monitoring.';

const checkOnly = process.argv.includes('--check');

function fail(msg) {
  console.error('FAIL: ' + msg);
  process.exit(1);
}

if (!fs.existsSync(outboxDir)) {
  fail('CHINTU_OUTBOX/ missing. Run scripts/chintu-founder-message.ps1 first.');
}
if (!fs.existsSync(messagePath)) {
  fail(
    'CHINTU_OUTBOX/latest_founder_message.md missing. Run scripts/chintu-founder-message.ps1 first.'
  );
}
if (!fs.existsSync(configPath)) {
  fail('CHINTU_CONNECTORS_CONFIG.example.json missing.');
}

const message = fs.readFileSync(messagePath, 'utf8');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Refuse to proceed if the message somehow lacks the safety footer.
if (!message.includes('BALA is a health-awareness companion')) {
  fail('latest_founder_message.md missing the BALA safety footer; refusing to format payloads.');
}

// Extract a short body for connectors with low maxBodyChars.
function shortBody(maxChars) {
  // Drop the title; keep "What needs attention" / "Best next action" lines.
  const lines = message.split(/\r?\n/);
  const wanted = [];
  let pickAttention = false;
  let pickNext = false;
  for (const line of lines) {
    if (/^##\s+What needs attention/.test(line)) {
      pickAttention = true;
      wanted.push('Attention:');
      continue;
    }
    if (/^##\s+Best next action/.test(line)) {
      pickAttention = false;
      pickNext = true;
      wanted.push('Next:');
      continue;
    }
    if (/^##\s+/.test(line)) {
      pickAttention = false;
      pickNext = false;
      continue;
    }
    if ((pickAttention || pickNext) && line.trim()) {
      wanted.push(line.trim().replace(/^-+\s*/, ''));
    }
  }
  let body = `[${DRY_RUN_TAG}] Chintu heartbeat\n` + wanted.join('\n');
  body += `\n${SAFETY_FOOTER}`;
  if (body.length > maxChars) {
    body = body.slice(0, maxChars - 3) + '...';
  }
  return body;
}

// Pre-payload sanity: refuse if the message body (with the standard
// safety footer stripped, since the footer *negates* these terms)
// contains any forbidden affirmative term.
const bodyForScan = message.replace(
  /BALA is a health-awareness companion\.[^]*?provide emergency monitoring\./g,
  ''
);
const FORBIDDEN_TERMS = [
  /\bdiagnose\b/i,
  /\bcure\b/i,
  /\bpredict\b/i,
  /\bheart attack\b/i,
  /\bcardiac arrest\b/i,
  /\bBOT_TOKEN\s*=/i,
  /\bAPI_KEY\s*=/i,
];
for (const re of FORBIDDEN_TERMS) {
  if (re.test(bodyForScan)) {
    fail(`latest_founder_message.md contains a forbidden term (${re}); refusing to format payloads.`);
  }
}

if (checkOnly) {
  console.log('PASS chintu-message-dry-run.js --check (inputs valid; nothing written)');
  process.exit(0);
}

if (!fs.existsSync(payloadsDir)) {
  fs.mkdirSync(payloadsDir, { recursive: true });
}

const connectors = config.connectors || {};
const payloadConnectors = ['telegram', 'slack', 'discord'];
const written = [];

for (const name of payloadConnectors) {
  const c = connectors[name];
  if (!c) continue;
  const max = c.maxBodyChars || 2000;
  const body = shortBody(max);

  let payload;
  switch (name) {
    case 'telegram':
      payload = {
        _dry_run: true,
        _label: DRY_RUN_TAG,
        _no_send_reason: 'connector status is "' + c.status + '"',
        method: 'sendMessage',
        chat_id_env_var: c.chatIdEnvVar || null,
        disable_web_page_preview: true,
        text: body,
      };
      break;
    case 'slack':
      payload = {
        _dry_run: true,
        _label: DRY_RUN_TAG,
        _no_send_reason: 'connector status is "' + c.status + '"',
        webhook_url_env_var: c.webhookUrlEnvVar || null,
        text: body,
      };
      break;
    case 'discord':
      payload = {
        _dry_run: true,
        _label: DRY_RUN_TAG,
        _no_send_reason: 'connector status is "' + c.status + '"',
        webhook_url_env_var: c.webhookUrlEnvVar || null,
        allowed_mentions: { parse: [] },
        content: body,
      };
      break;
  }

  const outPath = path.join(payloadsDir, `${name}_preview.json`);
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  written.push(outPath);
}

const readmePath = path.join(payloadsDir, 'README.md');
const readme = [
  '# Chintu Dry-Run Payloads',
  '',
  `**Every file in this folder is labeled "${DRY_RUN_TAG}".** Nothing here was sent. The script that produced these files contains no HTTP client, no webhook URL, no token read. It only writes JSON to disk.`,
  '',
  'Generated by `scripts/chintu-message-dry-run.js` from',
  '`CHINTU_OUTBOX/latest_founder_message.md`.',
  '',
  'These payloads are previews — what a future activated connector',
  '*would* send, if and only if the founder explicitly flipped that',
  "connector's status from `dry-run` to `active` (see",
  '`CHINTU_CONNECTOR_POLICY.md`).',
  '',
  '## Files',
  '',
  ...written.map(
    (p) => `- \`${path.relative(repoRoot, p).replace(/\\/g, '/')}\``
  ),
  '',
  '## BALA safety footer',
  '',
  SAFETY_FOOTER,
  '',
].join('\n');
fs.writeFileSync(readmePath, readme, 'utf8');

console.log('Dry-run payloads written:');
for (const p of written) {
  console.log('  ' + path.relative(repoRoot, p).replace(/\\/g, '/'));
}
console.log(
  '  ' + path.relative(repoRoot, readmePath).replace(/\\/g, '/')
);
console.log('No network calls. No tokens read. No data sent.');
