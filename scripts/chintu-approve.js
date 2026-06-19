#!/usr/bin/env node
'use strict';

// =============================================================================
// Chintu Approval Queue CLI — Stage 34
// -----------------------------------------------------------------------------
// Usage:
//   node scripts/chintu-approve.js <approvalId>
//   node scripts/chintu-approve.js --list
//   node scripts/chintu-approve.js --reject <approvalId>
//
// Flow:
//   1. Load CHINTU_OUTBOX/pending_approvals.jsonl
//   2. Find entry with matching approvalId
//   3. Display dry-run preview and required approval phrase
//   4. Wait for founder to type the phrase in the terminal
//   5. Phrase match → set approvedAt, mark executed, log result
//   6. Phrase mismatch or 'REJECT' → set rejectedAt, log, exit
//   7. Ctrl-C → rejectedAt logged, exit
//
// Safety rules:
//   * No auto-approve — system never approves on behalf of founder.
//   * No timeout-approve — pending entries stay indefinitely.
//   * Exact phrase required — case-sensitive, no partial match.
//   * Health-sensitive actions are BLOCKED, not queued (enforced upstream).
//   * TELEGRAM_BOT_TOKEN never printed or written to queue entries.
//   * No network calls. No shell exec. No fs writes except CHINTU_OUTBOX.
// =============================================================================

const fs   = require('fs');
const path = require('path');
const readline = require('readline');

const repoRoot    = path.resolve(__dirname, '..');
const outboxDir   = path.join(repoRoot, 'CHINTU_OUTBOX');
const queuePath   = path.join(outboxDir, 'pending_approvals.jsonl');
const auditPath   = path.join(outboxDir, 'telegram_connector_audit.jsonl');

// ---------------------------------------------------------------------------
// Queue I/O helpers
// ---------------------------------------------------------------------------

function ensureOutbox() {
  if (!fs.existsSync(outboxDir)) {
    fs.mkdirSync(outboxDir, { recursive: true });
  }
}

function loadQueue() {
  if (!fs.existsSync(queuePath)) return [];
  const raw = fs.readFileSync(queuePath, 'utf8').trim();
  if (!raw) return [];
  return raw.split(/\r?\n/).filter(Boolean).map((line, idx) => {
    try {
      return JSON.parse(line);
    } catch (_) {
      console.error('  Warning: malformed queue entry at line ' + (idx + 1) + ' — skipped.');
      return null;
    }
  }).filter(Boolean);
}

function writeQueue(entries) {
  ensureOutbox();
  fs.writeFileSync(queuePath, entries.map((e) => JSON.stringify(e)).join('\n') + '\n', 'utf8');
}

function appendAudit(entry) {
  ensureOutbox();
  // Safety gate: never write secrets or health data to audit log.
  if (entry.secretsPresent || entry.healthDataPresent) {
    throw new Error('SAFETY: Refused to write approval audit entry containing secrets or health data.');
  }
  fs.appendFileSync(auditPath, JSON.stringify(entry) + '\n', 'utf8');
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

function hr() {
  console.log('─'.repeat(60));
}

function displayEntry(entry) {
  hr();
  console.log('Pending action: ' + entry.capabilityId);
  console.log('  Approval ID:  ' + entry.approvalId);
  console.log('  Created:      ' + entry.createdAt);
  console.log('  Source:       ' + entry.source);
  console.log('  User text:    ' + (entry.userText || '(none)'));
  console.log('  Description:  ' + (entry.actionDescription || '(none)'));
  console.log('  Risk:         ' + entry.riskLabel);
  console.log('');
  console.log('Dry-run preview:');
  const p = entry.preview || {};
  console.log('  ' + (p.dryRunResult || '(no preview)'));
  if (Array.isArray(p.estimatedSideEffects) && p.estimatedSideEffects.length) {
    console.log('');
    console.log('Side effects:');
    for (const se of p.estimatedSideEffects) {
      console.log('  • ' + se);
    }
  }
  if (p.rollbackPossible != null) {
    console.log('');
    console.log('Rollback possible: ' + p.rollbackPossible);
    if (p.rollbackInstructions) {
      console.log('  ' + p.rollbackInstructions);
    }
  }
  hr();
}

function listQueue(entries) {
  const pending = entries.filter((e) => !e.approvedAt && !e.rejectedAt);
  if (pending.length === 0) {
    console.log('No pending approval entries in queue.');
    return;
  }
  console.log('Pending approvals (' + pending.length + '):');
  hr();
  for (const e of pending) {
    console.log('ID:  ' + e.approvalId);
    console.log('Cap: ' + e.capabilityId + '  |  Risk: ' + e.riskLabel);
    console.log('At:  ' + e.createdAt);
    console.log('Msg: ' + (e.userText || '(none)'));
    console.log('');
  }
}

// ---------------------------------------------------------------------------
// Approval / rejection logic
// ---------------------------------------------------------------------------

function logApprovalAudit(entry, decision, executionResult) {
  const auditEntry = {
    traceVersion:    '1',
    type:            'approval_decision',
    approvalId:      entry.approvalId,
    capabilityId:    entry.capabilityId,
    riskLabel:       entry.riskLabel,
    source:          entry.source,
    userText:        entry.userText,
    decision,                                // 'approved' | 'rejected'
    approvedAt:      entry.approvedAt || null,
    rejectedAt:      entry.rejectedAt || null,
    executedAt:      entry.executedAt || null,
    executionResult: executionResult || null,
    auditTraceId:    entry.auditTraceId || null,
    secretsPresent:  false,
    healthDataPresent: false,
  };
  appendAudit(auditEntry);
}

async function promptLine(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer));
  });
}

async function runApprove(approvalId, env, ioOverride) {
  // ioOverride is used in tests to avoid real stdin/stdout.
  const io = ioOverride || {};

  const entries = loadQueue();
  const idx = entries.findIndex((e) => e.approvalId === approvalId);

  if (idx === -1) {
    const msg = 'Approval ID not found in queue: ' + approvalId + '\n'
      + 'Run with --list to see pending entries.';
    if (io.onError) io.onError(msg);
    else console.error(msg);
    return { ok: false, reason: 'not_found' };
  }

  const entry = entries[idx];

  if (entry.approvedAt) {
    const msg = 'This entry was already approved at ' + entry.approvedAt + '. Nothing to do.';
    if (io.onError) io.onError(msg);
    else console.error(msg);
    return { ok: false, reason: 'already_approved' };
  }

  if (entry.rejectedAt) {
    const msg = 'This entry was already rejected at ' + entry.rejectedAt + '. Nothing to do.';
    if (io.onError) io.onError(msg);
    else console.error(msg);
    return { ok: false, reason: 'already_rejected' };
  }

  // Health-sensitive actions must never be in the approval queue.
  if (entry.riskLabel === 'health_sensitive') {
    const msg = 'SAFETY: Health-sensitive entries must never reach the approval queue. Rejecting.';
    if (io.onError) io.onError(msg);
    else console.error(msg);
    entries[idx] = Object.assign({}, entry, {
      rejectedAt: new Date().toISOString(),
      executionResult: { ok: false, reason: 'health_sensitive_safety_block' },
    });
    writeQueue(entries);
    logApprovalAudit(entries[idx], 'rejected', entries[idx].executionResult);
    return { ok: false, reason: 'health_sensitive_safety_block' };
  }

  // Display the entry.
  if (io.display) {
    io.display(entry);
  } else {
    displayEntry(entry);
    console.log('');
    console.log('Type exactly to approve: ' + entry.approvalPhrase);
    console.log('Type REJECT to cancel.');
    console.log('');
  }

  // Read the approval phrase.
  let answer;
  if (io.readAnswer) {
    answer = await io.readAnswer(entry);
  } else {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    // Handle Ctrl-C gracefully — reject entry, exit cleanly.
    rl.on('SIGINT', () => {
      console.log('\nInterrupted. Rejecting entry.');
      entries[idx] = Object.assign({}, entry, {
        rejectedAt: new Date().toISOString(),
        executionResult: { ok: false, reason: 'interrupted' },
      });
      writeQueue(entries);
      logApprovalAudit(entries[idx], 'rejected', entries[idx].executionResult);
      rl.close();
      process.exit(0);
    });
    answer = await promptLine(rl, '> ');
    rl.close();
  }

  answer = (answer || '').trim();

  // REJECT path.
  if (answer === 'REJECT') {
    entries[idx] = Object.assign({}, entry, {
      rejectedAt: new Date().toISOString(),
      executionResult: { ok: false, reason: 'founder_rejected' },
    });
    writeQueue(entries);
    logApprovalAudit(entries[idx], 'rejected', entries[idx].executionResult);
    const msg = 'Rejected. Action not executed.';
    if (io.onReject) io.onReject(msg);
    else console.log(msg);
    return { ok: false, reason: 'rejected' };
  }

  // Phrase mismatch path.
  if (answer !== entry.approvalPhrase) {
    entries[idx] = Object.assign({}, entry, {
      rejectedAt: new Date().toISOString(),
      executionResult: { ok: false, reason: 'phrase_mismatch' },
    });
    writeQueue(entries);
    logApprovalAudit(entries[idx], 'rejected', entries[idx].executionResult);
    const msg = 'Approval phrase incorrect. Action rejected.';
    if (io.onReject) io.onReject(msg);
    else console.log(msg);
    return { ok: false, reason: 'phrase_mismatch' };
  }

  // Phrase matched — proceed to execution stub.
  // Stage 34: execution is stubbed. Real execution of each capability
  // (e.g. chintu.gitPush, telegram.sendMessage) is wired in Stage 35.
  // The approval itself is recorded; the stub returns a dry-run result.
  const now = new Date().toISOString();
  const executionResult = executeApprovedAction(entry, env);

  entries[idx] = Object.assign({}, entry, {
    approvedAt: now,
    executedAt: executionResult.executedAt,
    executionResult,
  });
  writeQueue(entries);
  logApprovalAudit(entries[idx], 'approved', executionResult);

  const msg = [
    'Approval accepted.',
    '  Capability: ' + entry.capabilityId,
    '  Result: ' + executionResult.summary,
    'Approval logged. Execution logged.',
  ].join('\n');

  if (io.onApprove) io.onApprove(msg, executionResult);
  else console.log(msg);

  return { ok: true, executionResult };
}

// ---------------------------------------------------------------------------
// Execution stub (Stage 34)
// Real per-capability execution wired in Stage 35.
// ---------------------------------------------------------------------------

function executeApprovedAction(entry, env) {
  const now = new Date().toISOString();

  // Safety: never execute if health-sensitive (belt+suspenders).
  if (entry.riskLabel === 'health_sensitive') {
    return {
      ok: false,
      executedAt: now,
      summary: 'Blocked: health-sensitive actions never execute via approval queue.',
      secretsPresent: false,
      healthDataPresent: false,
    };
  }

  // In Stage 34 all executions are dry-run stubs.
  // Each capability will get a real executor in Stage 35.
  const STUB_RESULTS = {
    'chintu.gitPush': {
      ok: true,
      summary: '[Stage 34 stub] Git push dry-run — real execution wired in Stage 35.',
      note: 'Run: git push origin main  (manually, from your Windows terminal)',
    },
    'telegram.sendMessage': {
      ok: true,
      summary: '[Stage 34 stub] Telegram send dry-run — real execution wired in Stage 35.',
      note: 'Use --send flag with poll-once to enable real send.',
    },
    'telegram.deleteWebhook': {
      ok: true,
      summary: '[Stage 34 stub] Delete webhook dry-run — real execution wired in Stage 35.',
      note: 'Use --delete-webhook flag in chintu-telegram-runner.js.',
    },
  };

  const stub = STUB_RESULTS[entry.capabilityId] || {
    ok: true,
    summary: '[Stage 34 stub] Execution stub — capability "' + entry.capabilityId + '" not yet wired.',
    note: 'Wire real execution for this capability in Stage 35.',
  };

  return Object.assign({}, stub, {
    executedAt: now,
    dryRun: true,
    secretsPresent: false,
    healthDataPresent: false,
  });
}

// ---------------------------------------------------------------------------
// --reject flag: reject an entry without interactive prompt
// ---------------------------------------------------------------------------

function runReject(approvalId) {
  const entries = loadQueue();
  const idx = entries.findIndex((e) => e.approvalId === approvalId);
  if (idx === -1) {
    console.error('Approval ID not found: ' + approvalId);
    return { ok: false, reason: 'not_found' };
  }
  const entry = entries[idx];
  if (entry.approvedAt || entry.rejectedAt) {
    console.error('Entry already decided (approved or rejected). Nothing to do.');
    return { ok: false, reason: 'already_decided' };
  }
  entries[idx] = Object.assign({}, entry, {
    rejectedAt: new Date().toISOString(),
    executionResult: { ok: false, reason: 'manually_rejected_via_cli' },
  });
  writeQueue(entries);
  logApprovalAudit(entries[idx], 'rejected', entries[idx].executionResult);
  console.log('Rejected approval ID: ' + approvalId);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Enqueue helper (used by other modules to add entries to the queue).
// ---------------------------------------------------------------------------

function enqueueAction(entry) {
  // Validate required fields.
  const REQUIRED = [
    'approvalId', 'createdAt', 'capabilityId', 'actionDescription',
    'riskLabel', 'source', 'userText', 'preview', 'approvalPhrase',
  ];
  for (const f of REQUIRED) {
    if (!entry[f]) throw new Error('enqueueAction: missing required field: ' + f);
  }
  // Safety: never enqueue health-sensitive actions.
  if (entry.riskLabel === 'health_sensitive') {
    throw new Error('enqueueAction: health-sensitive actions must never be queued.');
  }
  // Safety: never enqueue entries with secrets or health data.
  if (entry.secretsPresent || entry.healthDataPresent) {
    throw new Error('enqueueAction: refused to enqueue entry with secrets or health data.');
  }
  const full = Object.assign({
    approvedAt: null,
    rejectedAt: null,
    executedAt: null,
    executionResult: null,
    auditTraceId: null,
  }, entry);
  ensureOutbox();
  fs.appendFileSync(queuePath, JSON.stringify(full) + '\n', 'utf8');
  return full;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

async function main(argv, env) {
  argv = argv || process.argv.slice(2);
  env  = env  || process.env;

  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    console.log('Chintu Approval Queue CLI');
    console.log('');
    console.log('Usage:');
    console.log('  node scripts/chintu-approve.js <approvalId>   — review and approve/reject one entry');
    console.log('  node scripts/chintu-approve.js --list         — list all pending entries');
    console.log('  node scripts/chintu-approve.js --reject <id>  — reject an entry without prompt');
    console.log('');
    console.log('Safety rules:');
    console.log('  * Exact approval phrase required (case-sensitive).');
    console.log('  * No auto-approve. No timeout-approve.');
    console.log('  * Health-sensitive entries are blocked, not queued.');
    return { ok: true, mode: 'help' };
  }

  if (argv[0] === '--list') {
    const entries = loadQueue();
    listQueue(entries);
    return { ok: true, mode: 'list' };
  }

  if (argv[0] === '--reject') {
    if (!argv[1]) {
      console.error('Usage: --reject <approvalId>');
      process.exit(1);
    }
    return runReject(argv[1]);
  }

  // Default: interactive approve flow.
  const approvalId = argv[0];
  return runApprove(approvalId, env);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('FAIL: ' + (error && error.message ? error.message : String(error)));
    process.exit(1);
  });
}

module.exports = {
  loadQueue,
  writeQueue,
  enqueueAction,
  runApprove,
  runReject,
  executeApprovedAction,
  queuePath,
  auditPath,
};
