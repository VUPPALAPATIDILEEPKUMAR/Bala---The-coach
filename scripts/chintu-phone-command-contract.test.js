#!/usr/bin/env node
'use strict';

const assert = require('assert');
const contract = require('./chintu-phone-command-contract.js');

let fails = 0;
function ok(condition, message) {
  if (condition) {
    console.log('  PASS: ' + message);
  } else {
    fails++;
    console.error('  FAIL: ' + message);
  }
}

const genericPayload = {
  source: 'telegram',
  chatId: '12345',
  senderId: '67890',
  senderName: 'Chintu',
  text: 'check everything',
  timestamp: '2026-06-18T23:00:00Z',
};

const telegramUpdatePayload = {
  message: {
    chat: { id: 12345 },
    from: { id: 67890, first_name: 'Chintu' },
    text: 'validate Bala',
    date: 1780000000,
  },
};

console.log('Chintu Phone Command Contract test\n');

console.log('Normalization:');
const generic = contract.normalizePhoneCommandPayload(genericPayload);
ok(generic.ok === true, 'generic payload normalizes successfully');
ok(generic.shape === 'generic', 'generic payload shape is generic');
ok(generic.chatId === '12345', 'generic payload chatId is preserved');
ok(generic.senderId === '67890', 'generic payload senderId is preserved');
ok(generic.senderName === 'Chintu', 'generic payload senderName is preserved');
ok(generic.text === 'check everything', 'generic payload text is preserved');
ok(generic.timestamp === '2026-06-18T23:00:00.000Z', 'generic payload timestamp is normalized to ISO');

const tg = contract.normalizePhoneCommandPayload(telegramUpdatePayload);
ok(tg.ok === true, 'Telegram-like update normalizes successfully');
ok(tg.shape === 'telegram_update', 'Telegram-like update shape is telegram_update');
ok(tg.chatId === '12345', 'Telegram-like update chatId is stringified');
ok(tg.senderId === '67890', 'Telegram-like update senderId is stringified');
ok(tg.senderName === 'Chintu', 'Telegram-like update senderName comes from first_name');
ok(tg.text === 'validate Bala', 'Telegram-like update text is preserved');
ok(tg.timestamp === new Date(1780000000 * 1000).toISOString(), 'Telegram-like update Unix timestamp becomes ISO');

const missingText = contract.normalizePhoneCommandPayload({
  source: 'telegram',
  chatId: '12345',
  senderId: '67890',
  senderName: 'Chintu',
  timestamp: '2026-06-18T23:00:00Z',
});
ok(missingText.issues.indexOf('missing_text') !== -1, 'missing text is flagged during normalization');

console.log('\nAllowlist:');
const deniedByDefault = contract.isAllowedPhoneSender(genericPayload, {});
ok(deniedByDefault.allowed === false, 'unknown sender is denied by default');
ok(deniedByDefault.reason === 'allowlist_required', 'deny-by-default requires an explicit allowlist');

const senderAllowed = contract.isAllowedPhoneSender(genericPayload, { allowedSenderIds: ['67890'] });
ok(senderAllowed.allowed === true, 'sender ID allowlist grants access');
ok(senderAllowed.reason === 'sender_id_allowed', 'sender ID allow reason is explicit');

const chatAllowed = contract.isAllowedPhoneSender(genericPayload, { allowedChatIds: ['12345'] });
ok(chatAllowed.allowed === true, 'chat ID allowlist grants access');
ok(chatAllowed.reason === 'chat_id_allowed', 'chat ID allow reason is explicit');

const noAllowAllDefault = contract.isAllowedPhoneSender(genericPayload, { allowAll: true });
ok(noAllowAllDefault.allowed === false, 'allow-all is not enabled by default and explicit IDs are still required');

console.log('\nClassification:');
const blocked = contract.classifyPhoneCommand(genericPayload, {});
ok(blocked.allowed === false, 'unknown sender classification stays blocked');
ok(blocked.safeToRun === false, 'unknown sender cannot run anything');
ok(blocked.actions.length === 0, 'unknown sender yields no actions');

const hi = contract.classifyPhoneCommand(
  { ...genericPayload, text: 'hi' },
  { allowedSenderIds: ['67890'] }
);
ok(hi.intent === 'greeting', '"hi" is classified as greeting');
ok(hi.responseType === 'conversational_reply', '"hi" remains conversational');
ok(hi.safeToRun === true, '"hi" is safe to classify and reply to');

const checkEverything = contract.classifyPhoneCommand(genericPayload, { allowedSenderIds: ['67890'] });
ok(checkEverything.intent === 'check_everything', '"check everything" stays on the router sequence path');
ok(checkEverything.sequence === 'check_everything', '"check everything" resolves to the check_everything sequence');
ok(checkEverything.safeToRun === true, '"check everything" is safe to hand off locally');

const validateBala = contract.classifyPhoneCommand(
  { ...genericPayload, text: 'validate Bala' },
  { allowedSenderIds: ['67890'] }
);
ok(validateBala.intent === 'validate_bala', '"validate Bala" is classified safely');
ok(validateBala.sequence === 'bala_health_check', '"validate Bala" maps to bala_health_check');
ok(validateBala.safeToRun === true, '"validate Bala" stays safe to run locally');

const runValidator = contract.classifyPhoneCommand(
  { ...genericPayload, text: 'run validator' },
  { allowedSenderIds: ['67890'] }
);
ok(runValidator.intent === 'run_validator', '"run validator" is classified safely');
ok(runValidator.actions[0] === 'run_validator_dry_run', '"run validator" maps to run_validator_dry_run');
ok(runValidator.safeToRun === true, '"run validator" is safe to run locally');

const checkConnectors = contract.classifyPhoneCommand(
  { ...genericPayload, text: 'check connectors' },
  { allowedSenderIds: ['67890'] }
);
ok(checkConnectors.intent === 'check_connectors', '"check connectors" is classified safely');
ok(checkConnectors.actions[0] === 'connector_readiness', '"check connectors" maps to connector_readiness');
ok(checkConnectors.safeToRun === true, '"check connectors" is safe to run locally');

const unknown = contract.classifyPhoneCommand(
  { ...genericPayload, text: 'unknown text' },
  { allowedSenderIds: ['67890'] }
);
ok(unknown.intent === 'unknown', 'unknown command gets the guiding fallback');
ok(/dont have a confident action|don.t have a confident action/i.test(unknown.reply), 'unknown command gets a guiding reply');
ok(unknown.actions.length === 0, 'unknown command does not fake execution');

const emergency = contract.classifyPhoneCommand(
  { ...genericPayload, text: 'I have chest pain' },
  { allowedSenderIds: ['67890'] }
);
ok(emergency.intent === 'health_emergency', 'emergency phrase is classified as health_emergency');
ok(emergency.risk === 'health_sensitive', 'emergency phrase is marked health_sensitive');
ok(emergency.safeToRun === false, 'emergency phrase never runs local actions');
ok(emergency.actions.length === 0, 'emergency phrase yields no actions');

const externalSend = contract.classifyPhoneCommand(
  { ...genericPayload, text: 'send status to telegram' },
  { allowedSenderIds: ['67890'] }
);
ok(externalSend.intent === 'external_send_request', 'external send-style text is parked explicitly');
ok(externalSend.requiresApproval === true, 'external send-style text requires approval');
ok(externalSend.safeToRun === false, 'external send-style text does not run in Stage 29');

console.log('\nReply envelope:');
const envelope = contract.buildPhoneReplyEnvelope({
  ok: true,
  allowed: true,
  requiresApproval: false,
  normalized: { channel: 'telegram', chatId: '12345' },
  reply: 'Open https://api.telegram.org/bot123456789:ABCDEFGHIJKLMNOPQRST/sendMessage',
  actionSummary: 'Token 123456789:ABCDEFGHIJKLMNOPQRST should never leak.',
  auditHint: 'No URL should survive here either: https://api.telegram.org',
});
ok(envelope.channel === 'telegram', 'reply envelope channel is telegram');
ok(envelope.chatId === '12345', 'reply envelope carries chatId');
ok(!/api\.telegram\.org/i.test(envelope.text), 'reply envelope text excludes Telegram API URLs');
ok(!/\b\d{6,}:[A-Za-z0-9_-]{20,}\b/.test(envelope.text), 'reply envelope text excludes token-shaped strings');
ok(!/api\.telegram\.org/i.test(envelope.actionSummary), 'reply envelope actionSummary excludes Telegram API URLs');
ok(!/\b\d{6,}:[A-Za-z0-9_-]{20,}\b/.test(envelope.actionSummary), 'reply envelope actionSummary excludes token-shaped strings');
ok(!/api\.telegram\.org/i.test(envelope.auditHint), 'reply envelope auditHint excludes Telegram API URLs');

console.log('');
if (fails === 0) {
  console.log('Phone command contract: PASS');
  process.exit(0);
} else {
  console.error('Phone command contract: FAIL (' + fails + ' issue(s))');
  process.exit(1);
}
