#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const assert = require('assert');

const repoRoot = path.resolve(__dirname, '..');
const scriptPath = path.join(repoRoot, 'scripts', 'chintu-connector-send.js');
const outboxDir = path.join(repoRoot, 'CHINTU_OUTBOX');
const readinessPath = path.join(outboxDir, 'latest_connector_readiness.json');
const previewPath = path.join(outboxDir, 'latest_connector_preview.json');
const auditLogPath = path.join(outboxDir, 'connector_audit.log.jsonl');
const sentLogPath = path.join(outboxDir, 'connector_sent.log.jsonl');

function run(args, env = {}) {
  return cp.spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
}

function cleanup() {
  for (const file of [readinessPath, previewPath, auditLogPath, sentLogPath]) {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  }
}

cleanup();

let result = run(['--check'], {
  CHINTU_CONNECTOR_MODE: '',
  CHINTU_CONNECTOR_APPROVAL_PHRASE: '',
  CHINTU_TG_ALLOWLIST: '',
  CHINTU_TG_TARGET: '',
});
assert.strictEqual(result.status, 0, result.stderr);
assert.ok(fs.existsSync(readinessPath), 'readiness JSON should be written');
const readiness = JSON.parse(fs.readFileSync(readinessPath, 'utf8'));
assert.strictEqual(readiness.connector_mode, 'dry-run');
assert.strictEqual(readiness._label, 'DRY RUN ONLY');
assert.strictEqual(
  readiness.connectors.find((entry) => entry.connector === 'telegram').can_send_now,
  false,
  'telegram should never be sendable by default'
);

result = run(['--preview', '--connector', 'telegram', '--body', 'Chintu build is clean. Next action: review queue.'], {
  CHINTU_CONNECTOR_MODE: 'dry-run',
});
assert.strictEqual(result.status, 0, result.stderr);
assert.ok(fs.existsSync(previewPath), 'preview JSON should be written');
const preview = JSON.parse(fs.readFileSync(previewPath, 'utf8'));
assert.strictEqual(preview.preview_only, true);
assert.strictEqual(preview.connector, 'telegram');

result = run(
  ['--send', '--connector', 'telegram', '--preview-file', previewPath, '--approval', 'approve-now'],
  {
    CHINTU_CONNECTOR_MODE: 'dry-run',
    CHINTU_CONNECTOR_APPROVAL_PHRASE: 'approve-now',
    CHINTU_TG_ALLOWLIST: 'founder-room',
    CHINTU_TG_TARGET: 'founder-room',
    CHINTU_TG_BOT_TOKEN: 'placeholder-bot-token',
    CHINTU_TG_CHAT_ID: 'placeholder-chat-id',
  }
);
assert.strictEqual(result.status, 0, result.stderr);
assert.match(result.stdout, /"status": "blocked"/);
assert.ok(fs.existsSync(auditLogPath), 'blocked send should be audited');
assert.ok(!fs.existsSync(sentLogPath), 'no sent log should exist after blocked send');

result = run(
  ['--send', '--connector', 'telegram', '--preview-file', previewPath, '--approval', 'wrong-phrase'],
  {
    CHINTU_CONNECTOR_MODE: 'active',
    CHINTU_CONNECTOR_APPROVAL_PHRASE: 'exact founder phrase',
    CHINTU_TG_ALLOWLIST: 'founder-room',
    CHINTU_TG_TARGET: 'founder-room',
    CHINTU_TG_BOT_TOKEN: 'placeholder-bot-token',
    CHINTU_TG_CHAT_ID: 'placeholder-chat-id',
  }
);
assert.strictEqual(result.status, 0, result.stderr);
assert.match(result.stdout, /"status": "blocked"/);
assert.ok(!fs.existsSync(sentLogPath), 'approval mismatch must still prevent sent log creation');

result = run(['--preview', '--connector', 'telegram', '--body', 'heart rate 61 bpm today'], {
  CHINTU_CONNECTOR_MODE: 'dry-run',
});
assert.notStrictEqual(result.status, 0, 'health data preview should fail');
assert.match(result.stderr, /health-data guard/i);

// --discover outputs connector info without network calls
result = run(['--discover'], {});
assert.strictEqual(result.status, 0, `discover failed: ${result.stderr}`);
assert.match(result.stdout, /telegram/i, 'discover should list telegram');
assert.match(result.stdout, /discord/i, 'discover should list discord');
assert.match(result.stdout, /slack/i, 'discover should list slack');
assert.match(result.stdout, /No network call made/i, 'discover should confirm no network');

// --status outputs connector status without network calls
result = run(['--status'], {});
assert.strictEqual(result.status, 0, `status failed: ${result.stderr}`);
assert.match(result.stdout, /Global mode/i, 'status should show global mode');
assert.match(result.stdout, /telegram/i, 'status should list telegram');
assert.match(result.stdout, /No network call made/i, 'status should confirm no network');

// --validate-env reports missing env vars
result = run(['--validate-env'], {
  CHINTU_TG_BOT_TOKEN: '',
  CHINTU_TG_CHAT_ID: '',
  CHINTU_TG_TARGET: '',
  CHINTU_TG_ALLOWLIST: '',
});
assert.match(result.stdout, /MISSING/i, 'validate-env should show MISSING for unset vars');
assert.match(result.stdout, /No secrets printed/i, 'validate-env should not print secrets');

cleanup();
console.log('PASS chintu-connector-send.test.js');
