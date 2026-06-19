#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const adapter = require('./chintu-telegram-adapter.js');

const repoRoot = path.resolve(__dirname, '..');

function fixture(name) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, 'scripts', 'fixtures', name), 'utf8'));
}

const allow = {
  allowedChatIds: ['710001'],
  allowedSenderIds: ['510001'],
};

const hi = adapter.buildTelegramDryRunPreview(fixture('telegram-hi.json'), allow);
assert.equal(hi.ok, true);
assert.equal(hi.supported, true);
assert.equal(hi.intent, 'greeting');
assert.equal(hi.allowlisted, true);
assert.equal(hi.wouldRunSequence, null);
assert.deepEqual(hi.wouldRunActions, []);
assert.match(hi.replyEnvelope.text, /Chintu is live/i);

const checkEverything = adapter.buildTelegramDryRunPreview(fixture('telegram-check-everything.json'), allow);
assert.equal(checkEverything.intent, 'check_everything');
assert.equal(checkEverything.wouldRunSequence, 'check_everything');
assert.equal(checkEverything.safeToRun, true);
assert.equal(adapter.canExecuteLocally(checkEverything), true);

const denied = adapter.buildTelegramDryRunPreview(fixture('telegram-denied-sender.json'), allow);
assert.equal(denied.allowlisted, false);
assert.equal(denied.intent, 'blocked_sender');
assert.equal(denied.safeToRun, false);
assert.match(denied.replyEnvelope.text, /not on the phone-command allowlist/i);

const emergency = adapter.buildTelegramDryRunPreview(fixture('telegram-emergency.json'), allow);
assert.equal(emergency.intent, 'health_emergency');
assert.equal(emergency.healthSensitive, true);
assert.equal(emergency.safeToRun, false);
assert.equal(adapter.canExecuteLocally(emergency), false);

const edited = adapter.buildTelegramDryRunPreview({
  update_id: 900005,
  edited_message: {
    message_id: 4005,
    date: 1781741040,
    chat: { id: 710001, type: 'private' },
    from: { id: 510001, first_name: 'Founder' },
    text: 'check connectors',
  },
}, allow);
assert.equal(edited.updateType, 'edited_message');
assert.equal(edited.intent, 'check_connectors');
assert.deepEqual(edited.wouldRunActions, ['connector_readiness']);

const callbackBlocked = adapter.buildTelegramDryRunPreview({
  update_id: 900006,
  callback_query: {
    id: 'cb-1',
    from: { id: 510001, first_name: 'Founder' },
    message: { chat: { id: 710001 } },
  },
}, allow);
assert.equal(callbackBlocked.supported, false);
assert.equal(callbackBlocked.allowReason, 'unsupported_update_type');
assert.match(callbackBlocked.replyEnvelope.text, /only accepts direct text messages/i);

const photoBlocked = adapter.buildTelegramDryRunPreview({
  update_id: 900007,
  message: {
    message_id: 4007,
    date: 1781741100,
    chat: { id: 710001, type: 'private' },
    from: { id: 510001, first_name: 'Founder' },
    photo: [{ file_id: 'abc' }],
  },
}, allow);
assert.equal(photoBlocked.supported, false);
assert.equal(photoBlocked.allowReason, 'non_text_message');
assert.match(photoBlocked.replyEnvelope.text, /only accept text commands/i);

console.log('PASS chintu-telegram-adapter.test.js');
