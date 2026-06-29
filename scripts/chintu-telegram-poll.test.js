#!/usr/bin/env node
'use strict';

const assert = require('assert');
const poll = require('./chintu-telegram-poll.js');

async function main() {
  assert.deepStrictEqual(poll.resolveCommand('status'), { type: 'command', key: 'git_status' });
  assert.deepStrictEqual(poll.resolveCommand('what are you doing right now'), { type: 'chat', rawText: 'what are you doing right now' });

  const quotaWarning = "You've reached your Codex subscription usage limit. Next reset in 2 hours, Jun 28 at 5:04 AM EDT. Wait until the reset time, use another Codex account if available, or switch to another configured model/provider.";
  assert.strictEqual(poll.classifySystemLoopText(quotaWarning), 'codex_usage_limit');
  assert.strictEqual(poll.classifySystemLoopText('Please remind me at 5:04 AM tomorrow to run the morning checks.'), null);

  const loopReply = poll.buildSystemLoopReply('codex_usage_limit');
  assert.match(loopReply, /quota hit/i);
  assert.match(loopReply, /digest/i);
  assert.match(loopReply, /90 minutes/i);

  let loopState = { entries: {} };
  const anchorMs = Date.parse('2026-06-28T08:00:00.000Z');
  assert.strictEqual(poll.shouldSuppressSystemLoopReply(loopState, 'chat-1', 'codex_usage_limit', anchorMs), false);
  loopState = poll.rememberSystemLoopReply(loopState, 'chat-1', 'codex_usage_limit', anchorMs);
  assert.strictEqual(poll.shouldSuppressSystemLoopReply(loopState, 'chat-1', 'codex_usage_limit', anchorMs + (30 * 60 * 1000)), true);
  assert.strictEqual(poll.shouldSuppressSystemLoopReply(loopState, 'chat-1', 'codex_usage_limit', anchorMs + (91 * 60 * 1000)), false);

  const formatted = poll.formatBridgeChatReply({
    reply: 'Chintu is checking the live runtime for you.',
    results: [
      { label: 'git status --short', exitCode: 0 },
      { action: 'validate_app', exitCode: 1 },
    ],
    nextSuggestedAction: 'validate_app',
  });

  assert.match(formatted, /checking the live runtime/i);
  assert.match(formatted, /git status --short: ok/i);
  assert.match(formatted, /validate_app: exit 1/i);
  assert.match(formatted, /Next: validate_app/i);

  assert.strictEqual(poll.isRetryableTelegramError(new Error('Telegram request timed out')), true);
  assert.strictEqual(poll.isRetryableTelegramError(new Error('getUpdates failed: HTTP 502')), true);
  assert.strictEqual(poll.isRetryableTelegramError(new Error('getUpdates failed: HTTP 401')), false);

  const delays = [];
  let attempts = 0;
  const updates = await poll.getUpdatesWithRetry('123:token', 10, 5, {
    getUpdatesFn: async () => {
      attempts += 1;
      if (attempts < 3) throw new Error('socket hang up');
      return [{ update_id: 123 }];
    },
    sleepFn: async (ms) => { delays.push(ms); },
  });
  assert.deepStrictEqual(updates, [{ update_id: 123 }]);
  assert.strictEqual(attempts, 3);
  assert.deepStrictEqual(delays, [5000, 10000]);

  let nonRetryAttempts = 0;
  await assert.rejects(
    poll.getUpdatesWithRetry('123:token', null, 10, {
      getUpdatesFn: async () => {
        nonRetryAttempts += 1;
        throw new Error('getUpdates failed: HTTP 401');
      },
      sleepFn: async () => {},
    }),
    /401/
  );
  assert.strictEqual(nonRetryAttempts, 1);

  console.log('PASS chintu-telegram-poll.test.js');
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
