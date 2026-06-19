#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const runner = require('./chintu-telegram-runner.js');

const repoRoot = path.resolve(__dirname, '..');
const auditPath = runner.paths.auditPath;

function cleanupAudit() {
  if (fs.existsSync(auditPath)) fs.unlinkSync(auditPath);
}

function makeDeps(overrides) {
  return Object.assign({
    telegramGetUpdates: async () => [],
    telegramSendMessage: async () => ({ message_id: 123 }),
    probeLocalBridge: async () => ({ ok: false, port: null }),
    executeLocalBridgeChat: async () => ({ ok: true }),
  }, overrides || {});
}

function readAuditLines() {
  return fs.existsSync(auditPath)
    ? fs.readFileSync(auditPath, 'utf8').trim().split(/\r?\n/).filter(Boolean)
    : [];
}

(async function main() {
  cleanupAudit();

  const baseEnv = {
    TELEGRAM_BOT_TOKEN: '',
    CHINTU_TELEGRAM_ALLOWED_CHAT_IDS: '710001',
    CHINTU_TELEGRAM_ALLOWED_SENDER_IDS: '510001',
    CHINTU_TELEGRAM_SEND_ENABLED: '0',
  };

  const setupMissingToken = await runner.runWithArgs(['--setup-check'], {
    TELEGRAM_BOT_TOKEN: '',
    CHINTU_TELEGRAM_ALLOWED_CHAT_IDS: '',
    CHINTU_TELEGRAM_ALLOWED_SENDER_IDS: '',
    CHINTU_TELEGRAM_SEND_ENABLED: '0',
  }, makeDeps());
  assert.equal(setupMissingToken.mode, 'setup-check');
  assert.equal(setupMissingToken.setup.tokenConfigured, false);
  assert.equal(setupMissingToken.setup.allowlistConfigured, false);
  assert.match(setupMissingToken.lines.join('\n'), /token: missing/i);

  const setupWithEnv = await runner.runWithArgs(['--setup-check'], {
    TELEGRAM_BOT_TOKEN: '123456789:ABCDEFGHIJKLMNOPQRSTUVWX123456789',
    CHINTU_TELEGRAM_ALLOWED_CHAT_IDS: '710001',
    CHINTU_TELEGRAM_ALLOWED_SENDER_IDS: '510001',
    CHINTU_TELEGRAM_SEND_ENABLED: '1',
  }, makeDeps({
    probeLocalBridge: async () => ({ ok: true, port: 18791 }),
  }));
  assert.equal(setupWithEnv.setup.tokenConfigured, true);
  assert.equal(setupWithEnv.setup.allowlistConfigured, true);
  assert.equal(setupWithEnv.setup.bridgeOnline, true);
  assert.equal(setupWithEnv.setup.sendEnabled, true);
  assert.doesNotMatch(setupWithEnv.lines.join('\n'), /ABCDEFGHIJKLMNOPQRST/);

  const fixtureHi = ['--fixture', 'scripts\\fixtures\\telegram-hi.json', '--dry-run'];
  const hi = await runner.runWithArgs(fixtureHi, baseEnv, makeDeps());
  assert.equal(hi.ok, true);
  assert.equal(hi.sourceMode, 'fixture');
  assert.equal(hi.preview.intent, 'greeting');
  assert.equal(hi.send.status, 'not_requested');

  await assert.rejects(
    () => runner.runWithArgs(['--poll-once', '--dry-run'], baseEnv, makeDeps()),
    /TELEGRAM_BOT_TOKEN is required/
  );

  await assert.rejects(
    () => runner.runWithArgs(['--poll-once', '--dry-run'], {
      ...baseEnv,
      TELEGRAM_BOT_TOKEN: '123456789:ABCDEFGHIJKLMNOPQRSTUVWX123456789',
      CHINTU_TELEGRAM_ALLOWED_CHAT_IDS: '',
      CHINTU_TELEGRAM_ALLOWED_SENDER_IDS: '',
    }, makeDeps()),
    /allowlist env vars are required/i
  );

  const discovery = await runner.runWithArgs(['--poll-once', '--dry-run', '--discover-ids'], {
    TELEGRAM_BOT_TOKEN: '123456789:ABCDEFGHIJKLMNOPQRSTUVWX123456789',
    CHINTU_TELEGRAM_ALLOWED_CHAT_IDS: '',
    CHINTU_TELEGRAM_ALLOWED_SENDER_IDS: '',
    CHINTU_TELEGRAM_SEND_ENABLED: '0',
  }, makeDeps({
    telegramGetUpdates: async () => [{
      update_id: 900002,
      message: {
        message_id: 4002,
        date: 1781740860,
        chat: { id: 710001, type: 'private' },
        from: { id: 510001, first_name: 'Founder' },
        text: 'check everything',
      },
    }],
  }));
  assert.equal(discovery.discoveryMode, true);
  assert.equal(discovery.discovery.chatId, '710001');
  assert.equal(discovery.discovery.senderId, '510001');
  assert.equal(discovery.bridge.executed, false);
  assert.equal(discovery.send.sent, false);

  let bridgeCalled = false;
  const executedOffline = await runner.runWithArgs(['--fixture', 'scripts\\fixtures\\telegram-check-everything.json', '--execute-local'], baseEnv, makeDeps({
    probeLocalBridge: async () => ({ ok: false, port: null }),
  }));
  assert.equal(executedOffline.bridge.executed, false);
  assert.match(executedOffline.bridge.reason, /offline/i);

  const executed = await runner.runWithArgs(['--fixture', 'scripts\\fixtures\\telegram-check-everything.json', '--execute-local'], baseEnv, makeDeps({
    probeLocalBridge: async () => ({ ok: true, port: 18791 }),
    executeLocalBridgeChat: async (port, message) => {
      bridgeCalled = true;
      assert.equal(port, 18791);
      assert.equal(message, 'check everything');
      return { ok: true, intent: 'check_everything', risk: 'safe_read', ranLive: true, results: [{ ok: true }], nextSuggestedAction: 'release_guard', reply: 'done' };
    },
  }));
  assert.equal(bridgeCalled, true);
  assert.equal(executed.bridge.executed, true);
  assert.equal(executed.bridge.resultsCount, 1);

  const sendBlocked = await runner.runWithArgs(['--fixture', 'scripts\\fixtures\\telegram-hi.json', '--send'], {
    TELEGRAM_BOT_TOKEN: '123456789:ABCDEFGHIJKLMNOPQRSTUVWX123456789',
    CHINTU_TELEGRAM_ALLOWED_CHAT_IDS: '710001',
    CHINTU_TELEGRAM_ALLOWED_SENDER_IDS: '510001',
    CHINTU_TELEGRAM_SEND_ENABLED: '0',
  }, makeDeps({
    telegramSendMessage: async () => {
      throw new Error('send should stay blocked');
    },
  }));
  assert.equal(sendBlocked.send.status, 'blocked');
  assert.match(sendBlocked.send.reason, /SEND_ENABLED is not 1/i);

  let sendCalled = false;
  const sent = await runner.runWithArgs(['--fixture', 'scripts\\fixtures\\telegram-hi.json', '--send'], {
    TELEGRAM_BOT_TOKEN: '123456789:ABCDEFGHIJKLMNOPQRSTUVWX123456789',
    CHINTU_TELEGRAM_ALLOWED_CHAT_IDS: '710001',
    CHINTU_TELEGRAM_ALLOWED_SENDER_IDS: '510001',
    CHINTU_TELEGRAM_SEND_ENABLED: '1',
  }, makeDeps({
    telegramSendMessage: async (token, chatId, text) => {
      sendCalled = true;
      assert.match(token, /^\d{9}:/);
      assert.equal(chatId, '710001');
      assert.match(text, /Chintu is live/i);
      return { message_id: 555 };
    },
  }));
  assert.equal(sendCalled, true);
  assert.equal(sent.send.status, 'sent');
  assert.equal(sent.send.messageId, 555);

  const blockedEmergency = await runner.runWithArgs(['--fixture', 'scripts\\fixtures\\telegram-emergency.json', '--send'], {
    TELEGRAM_BOT_TOKEN: '123456789:ABCDEFGHIJKLMNOPQRSTUVWX123456789',
    CHINTU_TELEGRAM_ALLOWED_CHAT_IDS: '710001',
    CHINTU_TELEGRAM_ALLOWED_SENDER_IDS: '510001',
    CHINTU_TELEGRAM_SEND_ENABLED: '1',
  }, makeDeps({
    telegramSendMessage: async () => {
      throw new Error('send should not be called for health-sensitive content');
    },
  }));
  assert.equal(blockedEmergency.send.status, 'blocked');
  assert.match(blockedEmergency.send.reason, /health-sensitive/i);

  const redacted = runner.redactText('token 123456789:ABCDEFGHIJKLMNOPQRSTUVWX123456789 https://api.telegram.org/bot123456789:ABCDEFGHIJKLMNOPQRSTUVWX123456789/getUpdates');
  assert.doesNotMatch(redacted, /ABCDEFGHIJKLMNOPQRST/);
  assert.doesNotMatch(redacted, /api\.telegram\.org/);

  const auditLines = readAuditLines();
  assert.ok(auditLines.length >= 7, 'audit log should contain one line per actionable run');

  cleanupAudit();
  console.log('PASS chintu-telegram-runner.test.js');
})().catch((error) => {
  cleanupAudit();
  console.error('FAIL: ' + error.message);
  process.exit(1);
});
