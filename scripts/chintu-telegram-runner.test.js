#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const runner = require('./chintu-telegram-runner.js');

const repoRoot = path.resolve(__dirname, '..');
const auditPath = runner.paths.auditPath;

function cleanupAudit() {
  try {
    if (fs.existsSync(auditPath)) fs.unlinkSync(auditPath);
  } catch (e) {
    // EPERM on NTFS mounts (Linux sandbox) — safe to ignore, file is test-only.
    if (e.code !== 'EPERM') throw e;
  }
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

  const fixtureHi = ['--fixture', 'scripts/fixtures/telegram-hi.json', '--dry-run'];
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
  const executedOffline = await runner.runWithArgs(['--fixture', 'scripts/fixtures/telegram-check-everything.json', '--execute-local'], baseEnv, makeDeps({
    probeLocalBridge: async () => ({ ok: false, port: null }),
  }));
  assert.equal(executedOffline.bridge.executed, false);
  assert.match(executedOffline.bridge.reason, /offline/i);

  const executed = await runner.runWithArgs(['--fixture', 'scripts/fixtures/telegram-check-everything.json', '--execute-local'], baseEnv, makeDeps({
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

  const sendBlocked = await runner.runWithArgs(['--fixture', 'scripts/fixtures/telegram-hi.json', '--send'], {
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
  const sent = await runner.runWithArgs(['--fixture', 'scripts/fixtures/telegram-hi.json', '--send'], {
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

  const blockedEmergency = await runner.runWithArgs(['--fixture', 'scripts/fixtures/telegram-emergency.json', '--send'], {
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

  // ---------------------------------------------------------------------------
  // Stage 37: bala_ask dispatch tests
  // ---------------------------------------------------------------------------

  // 1. Dry-run: bala_ask intent produces balaSkillResult with safe_awareness tag.
  const balaAskDry = await runner.runWithArgs(
    ['--fixture', 'scripts/fixtures/telegram-bala-ask.json', '--dry-run'],
    baseEnv,
    makeDeps(),
  );
  assert.ok(balaAskDry.ok, 'bala_ask dry-run should succeed');
  assert.equal(balaAskDry.preview && balaAskDry.preview.intent, 'bala_ask', 'intent should be bala_ask');
  assert.ok(balaAskDry.balaSkillResult, 'balaSkillResult should be populated');
  assert.equal(balaAskDry.balaSkillResult.safetyTag, 'safe_awareness');
  assert.equal(balaAskDry.balaSkillResult.emergency, false);
  assert.equal(balaAskDry.balaSkillResult.capabilityId, 'bala.askSkill');
  assert.ok(balaAskDry.balaSkillResult.reply.length > 20, 'reply should be non-empty');
  assert.ok(balaAskDry.balaSkillResult.footer.length > 20, 'footer should be non-empty');
  // send should NOT be attempted in dry-run
  assert.ok(!balaAskDry.balaSkillSent, 'balaSkillSent should not be set in dry-run');

  // 2. Send enabled: bala_ask dispatches reply via Telegram.
  let balaSendCalled = false;
  let balaSentToken = null;
  let balaSentChatId = null;
  let balaSentText = null;
  const balaAskSent = await runner.runWithArgs(
    ['--fixture', 'scripts/fixtures/telegram-bala-ask.json', '--send'],
    {
      TELEGRAM_BOT_TOKEN: '123456789:ABCDEFGHIJKLMNOPQRSTUVWX123456789',
      CHINTU_TELEGRAM_ALLOWED_CHAT_IDS: '710001',
      CHINTU_TELEGRAM_ALLOWED_SENDER_IDS: '510001',
      CHINTU_TELEGRAM_SEND_ENABLED: '1',
    },
    makeDeps({
      telegramSendMessage: async (token, chatId, text) => {
        balaSendCalled = true;
        balaSentToken = token;
        balaSentChatId = chatId;
        balaSentText = text;
        return { message_id: 999 };
      },
    }),
  );
  assert.ok(balaAskSent.ok, 'bala_ask send should succeed');
  assert.equal(balaSendCalled, true, 'telegramSendMessage should have been called');
  assert.equal(balaAskSent.balaSkillSent, true);
  assert.match(balaSentToken, /^\d{9}:/);
  assert.equal(balaSentChatId, '710001');
  // Reply must contain HRV content and the safety footer
  assert.match(balaSentText, /hrv/i);
  assert.match(balaSentText, /BALA is a health-awareness companion/i);
  // 3. Send NOT enabled: balaSkillResult populated but no send attempted.
  const balaAskNoSend = await runner.runWithArgs(
    ['--fixture', 'scripts/fixtures/telegram-bala-ask.json', '--send'],
    {
      TELEGRAM_BOT_TOKEN: '123456789:ABCDEFGHIJKLMNOPQRSTUVWX123456789',
      CHINTU_TELEGRAM_ALLOWED_CHAT_IDS: '710001',
      CHINTU_TELEGRAM_ALLOWED_SENDER_IDS: '510001',
      // CHINTU_TELEGRAM_SEND_ENABLED intentionally absent
    },
    makeDeps({
      telegramSendMessage: async () => {
        throw new Error('send should not be called when SEND_ENABLED is not 1');
      },
    }),
  );
  assert.ok(balaAskNoSend.ok, 'run should succeed even without send enabled');
  assert.ok(balaAskNoSend.balaSkillResult, 'balaSkillResult should still be populated');
  assert.ok(!balaAskNoSend.balaSkillSent, 'balaSkillSent should not be set');

  const auditLines = readAuditLines();
  assert.ok(auditLines.length >= 10, 'audit log should contain one line per actionable run');

  cleanupAudit();
  console.log('PASS chintu-telegram-runner.test.js');
})().catch((error) => {
  cleanupAudit();
  console.error('FAIL: ' + error.message);
  process.exit(1);
});
