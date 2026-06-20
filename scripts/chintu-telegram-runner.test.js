#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const runner = require('./chintu-telegram-runner.js');
const { queuePath, loadQueue, enqueueAction } = require('./chintu-approve.js');

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

  // -------------------------------------------------------------------------
  // Stage 38: git_push -> RISK.CODE -> requires_approval -> Stage 35 enqueue
  //           -> Stage 38 Telegram confirmation reply sent to founder.
  // -------------------------------------------------------------------------

  // Clear any leftover queue entry for this fixture's update_id so each run
  // always tests a fresh enqueue (not the skip-already-queued branch).
  // Helper: remove the fixture's queue entry (VirtioFS: overwrite, never unlink).
  function clearGitPushQueueEntry() {
    if (fs.existsSync(queuePath)) {
      const remaining = loadQueue().filter((e) => e.approvalId !== 'tel_upd_900011');
      const body = remaining.length > 0
        ? remaining.map((e) => JSON.stringify(e)).join('\n') + '\n'
        : '';
      fs.writeFileSync(queuePath, body, 'utf8');
    }
  }

  // 1. Send enabled — fresh enqueue: Stage 35 enqueues, Stage 38 sends Telegram confirmation.
  //    (Stage 35 enqueues on requires_approval regardless of dryRun flag, so we clear first.)
  clearGitPushQueueEntry();
  let confirmSendCalled = false;
  let confirmSentText = null;
  let confirmSentChatId = null;
  const gitPushSend = await runner.runWithArgs(
    ['--fixture', 'scripts/fixtures/telegram-git-push.json', '--send'],
    {
      TELEGRAM_BOT_TOKEN: '123456789:ABCDEFGHIJKLMNOPQRSTUVWX123456789',
      CHINTU_TELEGRAM_ALLOWED_CHAT_IDS: '710001',
      CHINTU_TELEGRAM_ALLOWED_SENDER_IDS: '510001',
      CHINTU_TELEGRAM_SEND_ENABLED: '1',
    },
    makeDeps({
      telegramSendMessage: async (token, chatId, text) => {
        confirmSendCalled = true;
        confirmSentChatId = chatId;
        confirmSentText = text;
        return { message_id: 1001 };
      },
    }),
  );
  assert.ok(gitPushSend.ok, 'git_push send run should succeed');
  // Must route to git_push with code_change risk.
  assert.equal(gitPushSend.preview && gitPushSend.preview.intent, 'git_push', 'intent should be git_push');
  assert.equal(gitPushSend.preview && gitPushSend.preview.risk, 'code_change', 'brain router risk must be code_change for git_push');
  // Fresh enqueue must succeed.
  assert.equal(gitPushSend.enqueued, true, 'git_push must be freshly enqueued: ' + JSON.stringify(gitPushSend));
  // Stage 38: confirmation Telegram reply must be sent.
  assert.equal(confirmSendCalled, true, 'Stage 38 confirmation reply must be sent via Telegram');
  assert.equal(confirmSentChatId, '710001', 'confirmation must go to the founder chat');
  // Confirmation text must reference the APPROVE phrase and action name.
  assert.match(confirmSentText, /APPROVE/i, 'confirmation must include the APPROVE phrase');
  assert.match(confirmSentText, /git.push|chintu\.gitPush/i, 'confirmation must name the queued action');
  // Token must never appear in the confirmation text.
  assert.doesNotMatch(confirmSentText, /ABCDEFGHIJKLMNOPQRSTUVWX123456789/, 'token must never appear in confirmation text');

  // 2. Second run with same update_id: already-queued skip path — still sends confirmation (via maybeSend reply).
  clearGitPushQueueEntry();

  // -------------------------------------------------------------------------
  // Stage 39: Pre-routing approval phrase handler + "pending approvals" cmd.
  // -------------------------------------------------------------------------

  function clearAllQueue() {
    if (fs.existsSync(queuePath)) {
      fs.writeFileSync(queuePath, '', 'utf8');
    }
  }

  const s39BaseEnv = {
    TELEGRAM_BOT_TOKEN: '123456789:ABCDEFGHIJKLMNOPQRSTUVWX123456789',
    CHINTU_TELEGRAM_ALLOWED_CHAT_IDS: '710001',
    CHINTU_TELEGRAM_ALLOWED_SENDER_IDS: '510001',
    CHINTU_TELEGRAM_SEND_ENABLED: '1',
  };

  // Stage 39 Test 1: "pending approvals" with empty queue.
  clearAllQueue();
  const pendingEmpty = await runner.runWithArgs(
    ['--fixture', 'scripts/fixtures/telegram-pending-approvals.json', '--send'],
    s39BaseEnv,
    makeDeps({ telegramSendMessage: async () => ({ message_id: 2001 }) }),
  );
  assert.equal(pendingEmpty.mode, 'pending_approvals', 'Stage39 T1: mode should be pending_approvals');
  assert.equal(pendingEmpty.pendingCount, 0, 'Stage39 T1: empty queue should have pendingCount 0');
  assert.equal(pendingEmpty.ok, true, 'Stage39 T1: pending approvals (empty) should be ok');

  // Stage 39 Test 2: "pending approvals" with an item in the queue.
  clearAllQueue();
  // Enqueue by running git-push fixture (Stage 35 path).
  await runner.runWithArgs(
    ['--fixture', 'scripts/fixtures/telegram-git-push.json', '--send'],
    s39BaseEnv,
    makeDeps({ telegramSendMessage: async () => ({ message_id: 2002 }) }),
  );
  const pendingWithItems = await runner.runWithArgs(
    ['--fixture', 'scripts/fixtures/telegram-pending-approvals.json', '--send'],
    s39BaseEnv,
    makeDeps({ telegramSendMessage: async () => ({ message_id: 2003 }) }),
  );
  assert.equal(pendingWithItems.mode, 'pending_approvals', 'Stage39 T2: mode should be pending_approvals');
  assert.ok(pendingWithItems.pendingCount >= 1, 'Stage39 T2: should have at least 1 pending item');

  // Stage 39 Test 3: Approval phrase match -- "APPROVE GIT PUSH" with a pending entry.
  clearAllQueue();
  // Enqueue git_push first.
  await runner.runWithArgs(
    ['--fixture', 'scripts/fixtures/telegram-git-push.json', '--send'],
    s39BaseEnv,
    makeDeps({ telegramSendMessage: async () => ({ message_id: 2004 }) }),
  );
  let s39ApproveSendCalled = false;
  let s39ApproveText = null;
  const approveMatch = await runner.runWithArgs(
    ['--fixture', 'scripts/fixtures/telegram-approve-phrase.json', '--send'],
    s39BaseEnv,
    makeDeps({
      telegramSendMessage: async (token, chatId, text) => {
        s39ApproveSendCalled = true;
        s39ApproveText = text;
        return { message_id: 2005 };
      },
    }),
  );
  assert.equal(approveMatch.mode, 'approval_executed', 'Stage39 T3: mode should be approval_executed');
  assert.equal(approveMatch.ok, true, 'Stage39 T3: approve match should succeed');
  assert.equal(approveMatch.capabilityId, 'chintu.gitPush', 'Stage39 T3: capabilityId should be chintu.gitPush');
  assert.ok(approveMatch.executionResult, 'Stage39 T3: executionResult should be present');
  assert.equal(approveMatch.executionResult.ok, true, 'Stage39 T3: executionResult.ok should be true');
  assert.equal(approveMatch.executionResult.dryRun, true, 'Stage39 T3: should be dry-run without CHINTU_GITPUSH_ENABLED');
  assert.equal(s39ApproveSendCalled, true, 'Stage39 T3: Telegram reply should be sent on approval');
  assert.match(s39ApproveText, /approved|Approved/i, 'Stage39 T3: reply should confirm approval');
  // Verify queue entry now has approvedAt.
  const s39QueueAfter = loadQueue();
  const s39ApprovedEntry = s39QueueAfter.find((e) => e.approvalId === 'tel_upd_900011');
  assert.ok(s39ApprovedEntry && s39ApprovedEntry.approvedAt, 'Stage39 T3: queue entry should have approvedAt set');

  // Stage 39 Test 4: Approval phrase with no matching pending entry.
  clearAllQueue();
  let s39NoMatchSendCalled = false;
  let s39NoMatchText = null;
  const approveNoMatch = await runner.runWithArgs(
    ['--fixture', 'scripts/fixtures/telegram-approve-phrase.json', '--send'],
    s39BaseEnv,
    makeDeps({
      telegramSendMessage: async (token, chatId, text) => {
        s39NoMatchSendCalled = true;
        s39NoMatchText = text;
        return { message_id: 2006 };
      },
    }),
  );
  assert.equal(approveNoMatch.mode, 'approval_executed', 'Stage39 T4: mode should be approval_executed');
  assert.equal(approveNoMatch.ok, false, 'Stage39 T4: approve with no match should not be ok');
  assert.equal(approveNoMatch.reason, 'no_pending_entry', 'Stage39 T4: reason should be no_pending_entry');
  assert.equal(s39NoMatchSendCalled, true, 'Stage39 T4: Telegram reply should be sent for no-match case');
  assert.match(s39NoMatchText, /No pending approval/i, 'Stage39 T4: reply should explain no match found');

  // Stage 40: REJECT keyword handler.
  // -------------------------------------------------------------------------

  // Stage 40 Test 1: "REJECT" with empty queue -> no_pending_items.
  clearAllQueue();
  let s40T1SendText = null;
  const rejectEmpty = await runner.runWithArgs(
    ['--fixture', 'scripts/fixtures/telegram-reject-phrase.json', '--send'],
    s39BaseEnv,
    makeDeps({
      telegramSendMessage: async (token, chatId, text) => {
        s40T1SendText = text;
        return { message_id: 3001 };
      },
    }),
  );
  assert.equal(rejectEmpty.mode, 'rejection_executed', 'Stage40 T1: mode should be rejection_executed');
  assert.equal(rejectEmpty.ok, false, 'Stage40 T1: reject with empty queue should not be ok');
  assert.equal(rejectEmpty.reason, 'no_pending_items', 'Stage40 T1: reason should be no_pending_items');
  assert.ok(s40T1SendText && /nothing to reject/i.test(s40T1SendText), 'Stage40 T1: reply should say nothing to reject');

  // Stage 40 Test 2: "REJECT" with a single pending entry -> auto-selects and rejects.
  clearAllQueue();
  await runner.runWithArgs(
    ['--fixture', 'scripts/fixtures/telegram-git-push.json', '--send'],
    s39BaseEnv,
    makeDeps({ telegramSendMessage: async () => ({ message_id: 3002 }) }),
  );
  let s40T2SendText = null;
  const rejectSingle = await runner.runWithArgs(
    ['--fixture', 'scripts/fixtures/telegram-reject-phrase.json', '--send'],
    s39BaseEnv,
    makeDeps({
      telegramSendMessage: async (token, chatId, text) => {
        s40T2SendText = text;
        return { message_id: 3003 };
      },
    }),
  );
  assert.equal(rejectSingle.mode, 'rejection_executed', 'Stage40 T2: mode should be rejection_executed');
  assert.equal(rejectSingle.ok, true, 'Stage40 T2: auto-reject single pending should succeed');
  assert.ok(s40T2SendText && /rejected/i.test(s40T2SendText), 'Stage40 T2: reply should confirm rejection');
  const s40QueueAfterT2 = loadQueue();
  const s40RejectedEntry = s40QueueAfterT2.find(function(e) { return e.approvalId === 'tel_upd_900011'; });
  assert.ok(s40RejectedEntry && s40RejectedEntry.rejectedAt, 'Stage40 T2: queue entry should have rejectedAt set');

  // Stage 40 Test 3: "REJECT <explicit-id>" targets the right entry.
  clearAllQueue();
  await runner.runWithArgs(
    ['--fixture', 'scripts/fixtures/telegram-git-push.json', '--send'],
    s39BaseEnv,
    makeDeps({ telegramSendMessage: async () => ({ message_id: 3004 }) }),
  );
  const s40T3FixturePath = path.join(__dirname, 'fixtures', '_tmp_reject_explicit.json');
  const s40T3Body = JSON.stringify({
    update_id: 900015,
    message: { message_id: 4015, date: 1781741400,
      chat: { id: 710001, type: 'private' },
      from: { id: 510001, is_bot: false, first_name: 'Founder' },
      text: 'REJECT tel_upd_900011' },
  });
  fs.writeFileSync(s40T3FixturePath, s40T3Body, 'utf8');
  let s40T3SendText = null;
  const rejectExplicit = await runner.runWithArgs(
    ['--fixture', 'scripts/fixtures/_tmp_reject_explicit.json', '--send'],
    s39BaseEnv,
    makeDeps({
      telegramSendMessage: async (token, chatId, text) => {
        s40T3SendText = text;
        return { message_id: 3005 };
      },
    }),
  );
  fs.writeFileSync(s40T3FixturePath, '{}', 'utf8');  // VirtioFS-safe cleanup
  assert.equal(rejectExplicit.mode, 'rejection_executed', 'Stage40 T3: mode should be rejection_executed');
  assert.equal(rejectExplicit.ok, true, 'Stage40 T3: explicit-id reject should succeed');
  assert.equal(rejectExplicit.approvalId, 'tel_upd_900011', 'Stage40 T3: approvalId should match requested id');

  // Stage 40 Test 4: "REJECT" with multiple pending entries -> ambiguous_multiple.
  clearAllQueue();
  const s40T4BaseEntry = {
    capabilityId: 'chintu.gitPush', riskLabel: 'code_change',
    source: 'telegram', userText: 'git push', preview: 'push to origin/main',
    approvalPhrase: 'APPROVE GIT PUSH', secretsPresent: false,
    healthDataPresent: false, createdAt: new Date().toISOString(),
    actionDescription: 'stage40 multi-pending test',
  };
  enqueueAction(Object.assign({}, s40T4BaseEntry, { approvalId: 'tel_upd_multi_a' }));
  enqueueAction(Object.assign({}, s40T4BaseEntry, { approvalId: 'tel_upd_multi_b' }));
  let s40T4SendText = null;
  const rejectAmbiguous = await runner.runWithArgs(
    ['--fixture', 'scripts/fixtures/telegram-reject-phrase.json', '--send'],
    s39BaseEnv,
    makeDeps({
      telegramSendMessage: async (token, chatId, text) => {
        s40T4SendText = text;
        return { message_id: 3006 };
      },
    }),
  );
  assert.equal(rejectAmbiguous.mode, 'rejection_executed', 'Stage40 T4: mode should be rejection_executed');
  assert.equal(rejectAmbiguous.ok, false, 'Stage40 T4: ambiguous reject should not be ok');
  assert.equal(rejectAmbiguous.reason, 'ambiguous_multiple', 'Stage40 T4: reason should be ambiguous_multiple');
  assert.ok(s40T4SendText && /multiple/i.test(s40T4SendText), 'Stage40 T4: reply should mention multiple pending');

  // Stage 40 Test 5: "REJECT <unknown-id>" -> not_found.
  clearAllQueue();
  const s40T5FixturePath = path.join(__dirname, 'fixtures', '_tmp_reject_notfound.json');
  const s40T5Body = JSON.stringify({
    update_id: 900016,
    message: { message_id: 4016, date: 1781741500,
      chat: { id: 710001, type: 'private' },
      from: { id: 510001, is_bot: false, first_name: 'Founder' },
      text: 'REJECT tel_upd_999999' },
  });
  fs.writeFileSync(s40T5FixturePath, s40T5Body, 'utf8');
  let s40T5SendText = null;
  const rejectNotFound = await runner.runWithArgs(
    ['--fixture', 'scripts/fixtures/_tmp_reject_notfound.json', '--send'],
    s39BaseEnv,
    makeDeps({
      telegramSendMessage: async (token, chatId, text) => {
        s40T5SendText = text;
        return { message_id: 3007 };
      },
    }),
  );
  fs.writeFileSync(s40T5FixturePath, '{}', 'utf8');  // VirtioFS-safe cleanup
  assert.equal(rejectNotFound.mode, 'rejection_executed', 'Stage40 T5: mode should be rejection_executed');
  assert.equal(rejectNotFound.ok, false, 'Stage40 T5: reject with unknown id should not be ok');
  assert.equal(rejectNotFound.reason, 'not_found', 'Stage40 T5: reason should be not_found');

  const auditLines = readAuditLines();
  assert.ok(auditLines.length >= 12, 'audit log should contain one line per actionable run');

  cleanupAudit();
  console.log('PASS chintu-telegram-runner.test.js');
})().catch((error) => {
  cleanupAudit();
  console.error('FAIL: ' + error.message);
  process.exit(1);
});
