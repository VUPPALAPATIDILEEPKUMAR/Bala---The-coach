#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const preflight = require('./chintu-c42-preflight.js');

const repoRoot = path.resolve(__dirname, '..');
const scriptPath = path.join(__dirname, 'chintu-c42-preflight.js');
const scriptText = fs.readFileSync(scriptPath, 'utf8');

function makeDeps(overrides) {
  return Object.assign({
    exists: (filePath) => {
      if (/\.gitignore$/i.test(filePath)) return true;
      return !/missing-required-file/i.test(filePath);
    },
    readText: (filePath) => {
      if (/\.gitignore$/i.test(filePath)) {
        return 'CHINTU_OUTBOX/telegram_connector_audit.jsonl\n';
      }
      throw new Error('Unexpected readText for ' + filePath);
    },
    readAuditEntries: () => [],
    probeBridge: async () => ({ ok: false, statusCode: 0, json: null, error: 'offline' }),
    probeRuntimeStatus: async () => ({ ok: false, statusCode: 0, json: null, error: 'offline' }),
  }, overrides || {});
}

async function run(env, deps) {
  return preflight.inspectPreflight(env || {}, deps || makeDeps());
}

(async function main() {
  const noToken = await run({}, makeDeps());
  assert.equal(noToken.readinessState, 'TOKEN_MISSING');
  assert.equal(noToken.tokenConfigured, false);
  assert.equal(noToken.allowlistConfigured, false);
  assert.equal(noToken.telegramLiveProven, false);
  assert.equal(noToken.nextSafeCommand, 'node scripts\\chintu-telegram-runner.js --setup-check');

  const identityCheck = await run({
    TELEGRAM_BOT_TOKEN: '123456789:ABCDEFGHIJKLMNOPQRSTUVWX123456789',
  }, makeDeps());
  assert.equal(identityCheck.readinessState, 'READY_FOR_IDENTITY_CHECK');
  assert.equal(identityCheck.tokenConfigured, true);
  assert.equal(identityCheck.allowlistConfigured, false);
  assert.doesNotMatch(JSON.stringify(identityCheck), /ABCDEFGHIJKLMNOPQRSTUVWX123456789/);

  const idDiscovery = await run({
    TELEGRAM_BOT_TOKEN: '123456789:ABCDEFGHIJKLMNOPQRSTUVWX123456789',
  }, makeDeps({
    readAuditEntries: () => [{ mode: 'token-check', ok: true }],
  }));
  assert.equal(idDiscovery.readinessState, 'READY_FOR_ID_DISCOVERY');
  assert.equal(idDiscovery.nextSafeCommand, 'node scripts\\chintu-telegram-runner.js --poll-once --dry-run --discover-ids');

  const bridgeOffline = await run({
    TELEGRAM_BOT_TOKEN: '123456789:ABCDEFGHIJKLMNOPQRSTUVWX123456789',
    CHINTU_TELEGRAM_ALLOWED_CHAT_IDS: '710001',
  }, makeDeps({
    readAuditEntries: () => [{ mode: 'token-check', ok: true }],
  }));
  assert.equal(bridgeOffline.readinessState, 'READY_FOR_DRY_RUN');
  assert.equal(bridgeOffline.allowlistConfigured, true);
  assert.equal(bridgeOffline.bridgeStatus.reachable, false);
  assert.equal(bridgeOffline.nextSafeCommand, 'node scripts\\chintu-telegram-runner.js --poll-once --dry-run');

  const bridgeOnlineSendDisabled = await run({
    TELEGRAM_BOT_TOKEN: '123456789:ABCDEFGHIJKLMNOPQRSTUVWX123456789',
    CHINTU_TELEGRAM_ALLOWED_CHAT_IDS: '710001',
    CHINTU_TELEGRAM_SEND_ENABLED: '0',
  }, makeDeps({
    readAuditEntries: () => [
      { mode: 'token-check', ok: true },
      { sourceMode: 'poll-once', executeLocalPerformed: false },
    ],
    probeBridge: async () => ({ ok: true, statusCode: 200, json: { ok: true } }),
    probeRuntimeStatus: async () => ({ ok: true, statusCode: 200, json: { ok: true } }),
  }));
  assert.equal(bridgeOnlineSendDisabled.readinessState, 'READY_FOR_EXECUTE_LOCAL_PROOF');
  assert.equal(bridgeOnlineSendDisabled.sendEnabled, false);
  assert.equal(bridgeOnlineSendDisabled.nextSafeCommand, 'node scripts\\chintu-telegram-runner.js --poll-once --dry-run --execute-local');

  const liveNotClaimedFromSetupAlone = await run({
    TELEGRAM_BOT_TOKEN: '123456789:ABCDEFGHIJKLMNOPQRSTUVWX123456789',
    CHINTU_TELEGRAM_ALLOWED_CHAT_IDS: '710001',
  }, makeDeps({
    readAuditEntries: () => [{ mode: 'token-check', ok: true }],
    probeBridge: async () => ({ ok: true, statusCode: 200, json: { ok: true } }),
    probeRuntimeStatus: async () => ({ ok: true, statusCode: 200, json: { ok: true } }),
  }));
  assert.equal(liveNotClaimedFromSetupAlone.telegramLiveProven, false);
  assert.equal(liveNotClaimedFromSetupAlone.readinessState, 'READY_FOR_DRY_RUN');

  const liveProofSeen = await run({
    TELEGRAM_BOT_TOKEN: '123456789:ABCDEFGHIJKLMNOPQRSTUVWX123456789',
    CHINTU_TELEGRAM_ALLOWED_CHAT_IDS: '710001',
  }, makeDeps({
    readAuditEntries: () => [
      { mode: 'token-check', ok: true },
      { traceVersion: '1', source: 'telegram', executed: true },
    ],
    probeBridge: async () => ({ ok: true, statusCode: 200, json: { ok: true } }),
    probeRuntimeStatus: async () => ({ ok: true, statusCode: 200, json: { ok: true } }),
  }));
  assert.equal(liveProofSeen.telegramLiveProven, true);
  assert.equal(liveProofSeen.readinessState, 'LIVE_PROOF_UNCONFIRMED');

  const jsonShape = await run({
    TELEGRAM_BOT_TOKEN: '123456789:ABCDEFGHIJKLMNOPQRSTUVWX123456789',
  }, makeDeps());
  for (const key of [
    'readinessState',
    'tokenConfigured',
    'allowlistConfigured',
    'sendEnabled',
    'bridgeStatus',
    'runtimeStatusReachable',
    'telegramLiveProven',
    'blockers',
    'nextSafeCommand',
    'nextHumanAction',
    'safetyNotes',
  ]) {
    assert.ok(Object.prototype.hasOwnProperty.call(jsonShape, key), 'missing key ' + key);
  }

  assert.doesNotMatch(scriptText, /api\.telegram\.org/i);
  assert.doesNotMatch(scriptText, /\brequire\(['"]node:https?['"]\)/i);
  assert.doesNotMatch(scriptText, /\brequire\(['"]https?['"]\)/i);
  assert.doesNotMatch(scriptText, /\bfetch\s*\(/i);

  assert.equal(preflight.BRIDGE_HOST, '127.0.0.1');
  assert.equal(preflight.RUNTIME_HOST, 'localhost');
  await assert.rejects(
    async () => preflight.probeLocalJson('example.com', 80, '/', 50),
    /Only localhost bridge probes are allowed/
  );

  const statusText = preflight.formatStatus(bridgeOnlineSendDisabled);
  assert.doesNotMatch(statusText, /ABCDEFGHIJKLMNOPQRSTUVWX123456789/);
  assert.match(statusText, /127\.0\.0\.1:18791/);

  console.log('PASS chintu-c42-preflight.test.js');
})().catch((error) => {
  console.error('FAIL: ' + error.message);
  process.exit(1);
});
