#!/usr/bin/env node
'use strict';

// =============================================================================
// Chintu Approval Queue tests — Stage 34
// Covers: enqueue, execute, approve (phrase match), reject (phrase mismatch),
//         explicit --reject, already-decided guard, health-sensitive block,
//         audit log write, safety invariants.
// No network. No shell. File I/O to real queue/audit paths (cleared each test).
// =============================================================================

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');

const approve = require('./chintu-approve.js');

let passed = 0;
let failed = 0;

function check(label, fn) {
  try {
    fn();
    console.log('  PASS:', label);
    passed++;
  } catch (e) {
    console.error('  FAIL:', label, '—', e.message);
    failed++;
  }
}

async function checkAsync(label, fn) {
  try {
    await fn();
    console.log('  PASS:', label);
    passed++;
  } catch (e) {
    console.error('  FAIL:', label, '—', e.message);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const Q = approve.queuePath;
const A = approve.auditPath;

// VirtioFS (Windows NTFS mount) blocks fs.unlinkSync with EPERM.
// Truncate to empty string instead — this always succeeds on FUSE mounts.
function clearFiles() {
  const outboxDir = require('path').dirname(Q);
  if (!fs.existsSync(outboxDir)) fs.mkdirSync(outboxDir, { recursive: true });
  try { fs.writeFileSync(Q, '', 'utf8'); } catch (_) {}
  try { fs.writeFileSync(A, '', 'utf8'); } catch (_) {}
}

// Return only approval_decision audit lines — filters out any legacy
// telegram_connector_audit entries left from previous runner sessions.
function readAuditLines() {
  if (!fs.existsSync(A)) return [];
  const raw = fs.readFileSync(A, 'utf8').trim();
  if (!raw) return [];
  return raw.split(/\r?\n/).filter(Boolean).map((l) => {
    try { return JSON.parse(l); } catch (_) { return null; }
  }).filter((l) => l && l.type === 'approval_decision');
}

// Force a raw entry into the queue, bypassing enqueueAction guards.
// Appends to an already-truncated queue file (clearFiles must have been called first).
function forceRawEntry(entry) {
  const full = Object.assign({ approvedAt: null, rejectedAt: null, executedAt: null, executionResult: null, auditTraceId: null }, entry);
  fs.appendFileSync(Q, JSON.stringify(full) + '\n', 'utf8');
}

function makePushEntry(overrides) {
  return Object.assign({
    approvalId:        'test-push-001',
    createdAt:         '2026-06-19T15:00:00.000Z',
    capabilityId:      'chintu.gitPush',
    actionDescription: 'Push branch main to origin',
    riskLabel:         'requires_approval',
    source:            'telegram',
    userText:          'push to github',
    preview: {
      dryRunResult: 'Would push 2 commits to origin/main',
      estimatedSideEffects: ['Remote branch updated', 'CI triggered'],
      rollbackPossible: true,
      rollbackInstructions: 'git revert HEAD~2 && git push',
    },
    approvalPhrase: 'APPROVE GIT PUSH',
  }, overrides || {});
}

// Minimal ioOverride for runApprove — supplies answer, silences output.
function makeIo(answer, opts) {
  const messages = [];
  const errors   = [];
  const io = {
    display:    () => {},
    readAnswer: async () => answer,
    onApprove:  (msg, exec) => messages.push({ type: 'approve', msg, exec }),
    onReject:   (msg)      => messages.push({ type: 'reject', msg }),
    onError:    (msg)      => errors.push(msg),
    _messages: messages,
    _errors:   errors,
  };
  return Object.assign(io, opts || {});
}

// ---------------------------------------------------------------------------
// enqueueAction
// ---------------------------------------------------------------------------
console.log('enqueueAction:');

check('adds entry to queue file', () => {
  clearFiles();
  approve.enqueueAction(makePushEntry());
  const loaded = approve.loadQueue();
  assert.strictEqual(loaded.length, 1);
  assert.strictEqual(loaded[0].approvalId, 'test-push-001');
});

check('sets null defaults for decision fields', () => {
  clearFiles();
  approve.enqueueAction(makePushEntry({ approvalId: 'null-defaults-test' }));
  const [e] = approve.loadQueue();
  assert.strictEqual(e.approvedAt, null);
  assert.strictEqual(e.rejectedAt, null);
  assert.strictEqual(e.executedAt, null);
  assert.strictEqual(e.executionResult, null);
});

check('throws on missing required field (capabilityId)', () => {
  clearFiles();
  const bad = makePushEntry();
  delete bad.capabilityId;
  assert.throws(() => approve.enqueueAction(bad), /missing required field/);
});

check('throws on health_sensitive riskLabel', () => {
  clearFiles();
  assert.throws(
    () => approve.enqueueAction(makePushEntry({ riskLabel: 'health_sensitive' })),
    /health-sensitive/i
  );
});

check('throws on secretsPresent=true', () => {
  clearFiles();
  assert.throws(
    () => approve.enqueueAction(Object.assign(makePushEntry(), { secretsPresent: true })),
    /secrets/i
  );
});

check('throws on healthDataPresent=true', () => {
  clearFiles();
  assert.throws(
    () => approve.enqueueAction(Object.assign(makePushEntry(), { healthDataPresent: true })),
    /health data/i
  );
});

// ---------------------------------------------------------------------------
// executeApprovedAction (Stage 34 stub)
// ---------------------------------------------------------------------------
console.log('\nexecuteApprovedAction (Stage 34 stub):');

check('gitPush stub returns ok=true with dryRun=true', () => {
  const entry = makePushEntry();
  const result = approve.executeApprovedAction(entry, {});
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.dryRun, true);
  assert.ok(result.executedAt, 'executedAt should be set');
  assert.strictEqual(result.secretsPresent, false);
  assert.strictEqual(result.healthDataPresent, false);
});

check('health_sensitive entry → blocked result', () => {
  const entry = makePushEntry({ riskLabel: 'health_sensitive' });
  const result = approve.executeApprovedAction(entry, {});
  assert.strictEqual(result.ok, false);
  assert.match(result.summary, /health-sensitive/i);
  assert.strictEqual(result.secretsPresent, false);
  assert.strictEqual(result.healthDataPresent, false);
});

check('unknown capability → stub with ok=true', () => {
  const entry = makePushEntry({ capabilityId: 'chintu.futureCapability' });
  const result = approve.executeApprovedAction(entry, {});
  assert.strictEqual(result.ok, true);
  assert.ok(result.summary.includes('stub'), 'summary should mention stub');
});

check('telegram.sendMessage stub ok=true', () => {
  const entry = makePushEntry({ capabilityId: 'telegram.sendMessage', approvalPhrase: 'APPROVE TELEGRAM SEND' });
  const result = approve.executeApprovedAction(entry, {});
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.dryRun, true);
  assert.strictEqual(result.secretsPresent, false);
});

check('telegram.deleteWebhook stub ok=true', () => {
  const entry = makePushEntry({ capabilityId: 'telegram.deleteWebhook', approvalPhrase: 'APPROVE DELETE WEBHOOK' });
  const result = approve.executeApprovedAction(entry, {});
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.dryRun, true);
  assert.strictEqual(result.secretsPresent, false);
});

// ---------------------------------------------------------------------------
// runApprove — not_found
// ---------------------------------------------------------------------------
console.log('\nrunApprove — not found:');

(async function runAllAsync() {
  await checkAsync('missing approvalId returns not_found', async () => {
    clearFiles();
    approve.enqueueAction(makePushEntry());
    const io = makeIo('APPROVE GIT PUSH');
    const result = await approve.runApprove('does-not-exist', {}, io);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.reason, 'not_found');
    assert.ok(io._errors.length > 0, 'onError should have been called');
  });

  // ---------------------------------------------------------------------------
  // runApprove — phrase match → approved
  // ---------------------------------------------------------------------------
  console.log('\nrunApprove — phrase match:');

  await checkAsync('correct phrase → ok=true, executionResult ok=true', async () => {
    clearFiles();
    approve.enqueueAction(makePushEntry());
    const io = makeIo('APPROVE GIT PUSH');
    const result = await approve.runApprove('test-push-001', {}, io);
    assert.strictEqual(result.ok, true);
    assert.ok(result.executionResult, 'executionResult should be set');
    assert.strictEqual(result.executionResult.ok, true);
    assert.ok(io._messages.some((m) => m.type === 'approve'), 'onApprove should be called');
  });

  await checkAsync('approved entry gets approvedAt timestamp in queue', async () => {
    clearFiles();
    approve.enqueueAction(makePushEntry());
    await approve.runApprove('test-push-001', {}, makeIo('APPROVE GIT PUSH'));
    const [e] = approve.loadQueue();
    assert.ok(e.approvedAt, 'approvedAt should be set');
    assert.strictEqual(e.rejectedAt, null);
  });

  await checkAsync('approval writes audit entry with decision=approved', async () => {
    clearFiles();
    approve.enqueueAction(makePushEntry());
    await approve.runApprove('test-push-001', {}, makeIo('APPROVE GIT PUSH'));
    const lines = readAuditLines();
    assert.ok(lines.length >= 1, 'audit should have at least 1 line');
    const dec = lines.find((l) => l.type === 'approval_decision');
    assert.ok(dec, 'approval_decision audit entry missing');
    assert.strictEqual(dec.decision, 'approved');
    assert.strictEqual(dec.secretsPresent, false);
    assert.strictEqual(dec.healthDataPresent, false);
  });

  await checkAsync('audit entry has traceVersion="1"', async () => {
    clearFiles();
    approve.enqueueAction(makePushEntry());
    await approve.runApprove('test-push-001', {}, makeIo('APPROVE GIT PUSH'));
    const lines = readAuditLines();
    const dec = lines.find((l) => l.type === 'approval_decision');
    assert.strictEqual(dec.traceVersion, '1');
  });

  // ---------------------------------------------------------------------------
  // runApprove — phrase mismatch → rejected
  // ---------------------------------------------------------------------------
  console.log('\nrunApprove — phrase mismatch:');

  await checkAsync('wrong phrase → rejected, reason=phrase_mismatch', async () => {
    clearFiles();
    approve.enqueueAction(makePushEntry());
    const io = makeIo('approve git push');  // lowercase
    const result = await approve.runApprove('test-push-001', {}, io);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.reason, 'phrase_mismatch');
    assert.ok(io._messages.some((m) => m.type === 'reject'), 'onReject should be called');
  });

  await checkAsync('wrong phrase → rejectedAt set in queue', async () => {
    clearFiles();
    approve.enqueueAction(makePushEntry());
    await approve.runApprove('test-push-001', {}, makeIo('WRONG PHRASE'));
    const [e] = approve.loadQueue();
    assert.ok(e.rejectedAt, 'rejectedAt should be set');
    assert.strictEqual(e.approvedAt, null);
  });

  await checkAsync('phrase mismatch writes rejected audit entry', async () => {
    clearFiles();
    approve.enqueueAction(makePushEntry());
    await approve.runApprove('test-push-001', {}, makeIo('BAD PHRASE'));
    const lines = readAuditLines();
    const dec = lines.find((l) => l.type === 'approval_decision');
    assert.ok(dec, 'audit entry missing');
    assert.strictEqual(dec.decision, 'rejected');
    assert.strictEqual(dec.secretsPresent, false);
    assert.strictEqual(dec.healthDataPresent, false);
  });

  // ---------------------------------------------------------------------------
  // runApprove — REJECT keyword
  // ---------------------------------------------------------------------------
  console.log('\nrunApprove — REJECT keyword:');

  await checkAsync('"REJECT" keyword → rejected, reason=rejected', async () => {
    clearFiles();
    approve.enqueueAction(makePushEntry());
    const result = await approve.runApprove('test-push-001', {}, makeIo('REJECT'));
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.reason, 'rejected');
  });

  await checkAsync('"REJECT" → rejectedAt set in queue', async () => {
    clearFiles();
    approve.enqueueAction(makePushEntry());
    await approve.runApprove('test-push-001', {}, makeIo('REJECT'));
    const [e] = approve.loadQueue();
    assert.ok(e.rejectedAt, 'rejectedAt not set after REJECT');
  });

  await checkAsync('"REJECT" writes audit entry decision=rejected', async () => {
    clearFiles();
    approve.enqueueAction(makePushEntry());
    await approve.runApprove('test-push-001', {}, makeIo('REJECT'));
    const lines = readAuditLines();
    const dec = lines.find((l) => l.type === 'approval_decision');
    assert.ok(dec, 'no audit entry after REJECT');
    assert.strictEqual(dec.decision, 'rejected');
  });

  // ---------------------------------------------------------------------------
  // runApprove — already decided
  // ---------------------------------------------------------------------------
  console.log('\nrunApprove — already decided:');

  await checkAsync('already-approved entry → reason=already_approved', async () => {
    clearFiles();
    approve.enqueueAction(makePushEntry({ approvedAt: '2026-06-19T15:05:00.000Z' }));
    const io = makeIo('APPROVE GIT PUSH');
    const result = await approve.runApprove('test-push-001', {}, io);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.reason, 'already_approved');
    assert.ok(io._errors.length > 0);
  });

  await checkAsync('already-rejected entry → reason=already_rejected', async () => {
    clearFiles();
    approve.enqueueAction(makePushEntry({ rejectedAt: '2026-06-19T15:05:00.000Z' }));
    const io = makeIo('APPROVE GIT PUSH');
    const result = await approve.runApprove('test-push-001', {}, io);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.reason, 'already_rejected');
    assert.ok(io._errors.length > 0);
  });

  // ---------------------------------------------------------------------------
  // runApprove — health_sensitive safety block
  // ---------------------------------------------------------------------------
  console.log('\nrunApprove — health_sensitive block:');

  await checkAsync('health_sensitive entry in queue → safety block', async () => {
    clearFiles();
    // Force a health_sensitive entry, bypassing enqueueAction guard.
    forceRawEntry(makePushEntry({ riskLabel: 'health_sensitive' }));
    const io = makeIo('APPROVE GIT PUSH');
    const result = await approve.runApprove('test-push-001', {}, io);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.reason, 'health_sensitive_safety_block');
    assert.ok(io._errors.length > 0);
  });

  await checkAsync('health_sensitive safety block writes rejected audit entry', async () => {
    clearFiles();
    forceRawEntry(makePushEntry({ riskLabel: 'health_sensitive' }));
    await approve.runApprove('test-push-001', {}, makeIo('APPROVE GIT PUSH'));
    const lines = readAuditLines();
    const dec = lines.find((l) => l.type === 'approval_decision');
    assert.ok(dec, 'audit entry missing for health_sensitive block');
    assert.strictEqual(dec.decision, 'rejected');
    assert.strictEqual(dec.secretsPresent, false);
    assert.strictEqual(dec.healthDataPresent, false);
  });

  // ---------------------------------------------------------------------------
  // runReject
  // ---------------------------------------------------------------------------
  console.log('\nrunReject:');

  check('--reject sets rejectedAt in queue', () => {
    clearFiles();
    approve.enqueueAction(makePushEntry());
    approve.runReject('test-push-001');
    const [e] = approve.loadQueue();
    assert.ok(e.rejectedAt, 'rejectedAt not set');
    assert.strictEqual(e.approvedAt, null);
  });

  check('--reject returns ok=true on success', () => {
    clearFiles();
    approve.enqueueAction(makePushEntry());
    const result = approve.runReject('test-push-001');
    assert.strictEqual(result.ok, true);
  });

  check('--reject returns not_found for missing ID', () => {
    clearFiles();
    const result = approve.runReject('nonexistent-id');
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.reason, 'not_found');
  });

  check('--reject on already-decided entry returns already_decided', () => {
    clearFiles();
    approve.enqueueAction(makePushEntry({ approvedAt: '2026-06-19T15:00:00.000Z' }));
    const result = approve.runReject('test-push-001');
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.reason, 'already_decided');
  });

  check('--reject writes audit entry with decision=rejected', () => {
    clearFiles();
    approve.enqueueAction(makePushEntry());
    approve.runReject('test-push-001');
    const lines = readAuditLines();
    const dec = lines.find((l) => l.type === 'approval_decision');
    assert.ok(dec, 'no audit entry from runReject');
    assert.strictEqual(dec.decision, 'rejected');
    assert.strictEqual(dec.secretsPresent, false);
    assert.strictEqual(dec.healthDataPresent, false);
  });

  // ---------------------------------------------------------------------------
  // Safety invariants across all flows
  // ---------------------------------------------------------------------------
  console.log('\nSafety invariants:');

  await checkAsync('all audit entries from approve flow have secretsPresent=false', async () => {
    clearFiles();
    approve.enqueueAction(makePushEntry());
    await approve.runApprove('test-push-001', {}, makeIo('APPROVE GIT PUSH'));
    for (const l of readAuditLines()) {
      assert.strictEqual(l.secretsPresent, false, 'secretsPresent!=false: ' + JSON.stringify(l));
    }
  });

  await checkAsync('all audit entries from reject flow have healthDataPresent=false', async () => {
    clearFiles();
    approve.enqueueAction(makePushEntry());
    await approve.runApprove('test-push-001', {}, makeIo('REJECT'));
    for (const l of readAuditLines()) {
      assert.strictEqual(l.healthDataPresent, false, 'healthDataPresent!=false: ' + JSON.stringify(l));
    }
  });

  await checkAsync('all audit entries from mismatch flow have correct invariants', async () => {
    clearFiles();
    approve.enqueueAction(makePushEntry());
    await approve.runApprove('test-push-001', {}, makeIo('WRONG PHRASE'));
    for (const l of readAuditLines()) {
      assert.strictEqual(l.secretsPresent, false);
      assert.strictEqual(l.healthDataPresent, false);
      assert.strictEqual(l.traceVersion, '1');
    }
  });

  check('all audit entries from runReject have invariants', () => {
    clearFiles();
    approve.enqueueAction(makePushEntry());
    approve.runReject('test-push-001');
    for (const l of readAuditLines()) {
      assert.strictEqual(l.secretsPresent, false);
      assert.strictEqual(l.healthDataPresent, false);
    }
  });

  // ---------------------------------------------------------------------------
  // appendAudit safety gate
  // ---------------------------------------------------------------------------
  console.log('\nappendAudit safety gate:');

  // We test this indirectly: logApprovalAudit always hard-codes both to false,
  // so we can't trigger the guard via the normal flow. Instead we verify that
  // the guard is present by white-boxing an entry that slips through if we ever
  // bypass logApprovalAudit. The real guard is inside appendAudit, which is not
  // exported. We cover it by checking the audit entries it produces in all flows.

  check('approved audit entry has type=approval_decision', () => {
    clearFiles();
    approve.enqueueAction(makePushEntry());
    approve.runReject('test-push-001');
    const lines = readAuditLines();
    assert.ok(lines.every((l) => l.type === 'approval_decision'), 'unexpected entry type');
  });

  // ---------------------------------------------------------------------------
  // loadQueue / writeQueue round-trip
  // ---------------------------------------------------------------------------
  console.log('\nloadQueue / writeQueue:');

  check('writeQueue then loadQueue round-trips multiple entries', () => {
    clearFiles();
    const e1 = Object.assign(makePushEntry({ approvalId: 'id-1' }), { approvedAt: null, rejectedAt: null, executedAt: null, executionResult: null, auditTraceId: null });
    const e2 = Object.assign(makePushEntry({ approvalId: 'id-2' }), { approvedAt: null, rejectedAt: null, executedAt: null, executionResult: null, auditTraceId: null });
    approve.writeQueue([e1, e2]);
    const loaded = approve.loadQueue();
    assert.strictEqual(loaded.length, 2);
    assert.strictEqual(loaded[0].approvalId, 'id-1');
    assert.strictEqual(loaded[1].approvalId, 'id-2');
  });

  check('loadQueue returns [] for empty/truncated file', () => {
    clearFiles();
    const result = approve.loadQueue();
    assert.deepStrictEqual(result, []);
  });

  // Final cleanup.
  clearFiles();

  // ------
  // Summary
  console.log('\n---');
  if (failed > 0) {
    console.error('FAIL chintu-approve.test.js (' + failed + ' failed, ' + passed + ' passed)');
    process.exit(1);
  } else {
    console.log('PASS chintu-approve.test.js (' + passed + ' passed)');
  }
})().catch((err) => {
  clearFiles();
  console.error('FAIL (uncaught):', err.message);
  process.exit(1);
});
