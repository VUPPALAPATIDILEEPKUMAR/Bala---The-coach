#!/usr/bin/env node
'use strict';

// =============================================================================
// Chintu Approval Queue CLI
// -----------------------------------------------------------------------------
// Safety rules:
//   * No auto-approve, no timeout-approve.
//   * Exact approval phrase required.
//   * Health-sensitive actions are blocked, not queued.
//   * TELEGRAM_BOT_TOKEN is never printed or written by this file.
//   * No network calls. No shell execution. Only queue/audit file writes.
//   * Stage 41 keeps approved actions as audited dry-runs only.
// =============================================================================

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const repoRoot = path.resolve(__dirname, '..');
const outboxDir = path.join(repoRoot, 'CHINTU_OUTBOX');
const queuePath = path.join(outboxDir, 'pending_approvals.jsonl');
const auditPath = path.join(outboxDir, 'telegram_connector_audit.jsonl');

function ensureOutbox() {
  if (!fs.existsSync(outboxDir)) {
    fs.mkdirSync(outboxDir, { recursive: true });
  }
}

function loadQueue() {
  if (!fs.existsSync(queuePath)) return [];
  const raw = fs.readFileSync(queuePath, 'utf8').trim();
  if (!raw) return [];
  return raw
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, idx) => {
      try {
        return JSON.parse(line);
      } catch (_) {
        console.error('Warning: malformed queue entry at line ' + (idx + 1) + ' skipped.');
        return null;
      }
    })
    .filter(Boolean);
}

function writeQueue(entries) {
  ensureOutbox();
  const body = entries.length > 0
    ? entries.map((entry) => JSON.stringify(entry)).join('\n') + '\n'
    : '';
  fs.writeFileSync(queuePath, body, 'utf8');
}

function appendAudit(entry) {
  ensureOutbox();
  if (entry.secretsPresent || entry.healthDataPresent) {
    throw new Error('SAFETY: Refused to write approval audit entry containing secrets or health data.');
  }
  fs.appendFileSync(auditPath, JSON.stringify(entry) + '\n', 'utf8');
}

function hr() {
  console.log('-'.repeat(60));
}

function displayEntry(entry) {
  const preview = entry.preview || {};
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
  console.log('  ' + (preview.dryRunResult || '(no preview)'));
  if (Array.isArray(preview.estimatedSideEffects) && preview.estimatedSideEffects.length > 0) {
    console.log('');
    console.log('Side effects:');
    for (const sideEffect of preview.estimatedSideEffects) {
      console.log('  * ' + sideEffect);
    }
  }
  if (preview.rollbackPossible != null) {
    console.log('');
    console.log('Rollback possible: ' + preview.rollbackPossible);
    if (preview.rollbackInstructions) {
      console.log('  ' + preview.rollbackInstructions);
    }
  }
  hr();
}

function listQueue(entries) {
  const pending = entries.filter((entry) => !entry.approvedAt && !entry.rejectedAt);
  if (pending.length === 0) {
    console.log('No pending approval entries in queue.');
    return;
  }

  console.log('Pending approvals (' + pending.length + '):');
  hr();
  for (const entry of pending) {
    console.log('ID:  ' + entry.approvalId);
    console.log('Cap: ' + entry.capabilityId + '  |  Risk: ' + entry.riskLabel);
    console.log('At:  ' + entry.createdAt);
    console.log('Msg: ' + (entry.userText || '(none)'));
    console.log('');
  }
}

function logApprovalAudit(entry, decision, executionResult) {
  appendAudit({
    traceVersion: '1',
    type: 'approval_decision',
    approvalId: entry.approvalId,
    capabilityId: entry.capabilityId,
    riskLabel: entry.riskLabel,
    source: entry.source,
    userText: entry.userText,
    decision,
    approvedAt: entry.approvedAt || null,
    rejectedAt: entry.rejectedAt || null,
    executedAt: entry.executedAt || null,
    executionResult: executionResult || null,
    auditTraceId: entry.auditTraceId || null,
    secretsPresent: false,
    healthDataPresent: false,
  });
}

function promptLine(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer));
  });
}

const APPROVAL_PHRASES = {
  'chintu.gitPush': 'APPROVE GIT PUSH',
  'telegram.sendMessage': 'APPROVE TELEGRAM SEND',
  'telegram.deleteWebhook': 'APPROVE DELETE WEBHOOK',
};

function executeApprovedAction(entry) {
  const now = new Date().toISOString();

  if (entry.riskLabel === 'health_sensitive') {
    return {
      ok: false,
      executedAt: now,
      dryRun: true,
      summary: 'Blocked: health-sensitive actions never execute via approval queue.',
      secretsPresent: false,
      healthDataPresent: false,
    };
  }

  if (entry.capabilityId === 'chintu.gitPush') {
    return {
      ok: true,
      executedAt: now,
      dryRun: true,
      summary: '[dry-run] Git push remains blocked until a release-safe live executor is approved.',
      note: 'Run git push manually only after the release guard is green.',
      secretsPresent: false,
      healthDataPresent: false,
    };
  }

  if (entry.capabilityId === 'telegram.sendMessage') {
    return {
      ok: true,
      executedAt: now,
      dryRun: true,
      summary: '[dry-run] Telegram sendMessage remains disabled in the approval queue for Stage 41.',
      note: 'Use chintu-telegram-runner.js for safe readiness checks without enabling send.',
      secretsPresent: false,
      healthDataPresent: false,
    };
  }

  if (entry.capabilityId === 'telegram.deleteWebhook') {
    return {
      ok: true,
      executedAt: now,
      dryRun: true,
      summary: '[dry-run] Telegram deleteWebhook remains blocked pending explicit founder approval and a dedicated live flow.',
      note: 'Use chintu-telegram-runner.js --delete-webhook --dry-run to preview the path safely.',
      secretsPresent: false,
      healthDataPresent: false,
    };
  }

  return {
    ok: true,
    executedAt: now,
    dryRun: true,
    summary: '[stub] Capability "' + entry.capabilityId + '" not yet wired for real execution.',
    note: 'Wire real execution for this capability in a future stage.',
    secretsPresent: false,
    healthDataPresent: false,
  };
}

async function runApprove(approvalId, env, ioOverride) {
  const io = ioOverride || {};
  const entries = loadQueue();
  const idx = entries.findIndex((entry) => entry.approvalId === approvalId);

  if (idx === -1) {
    const msg = 'Approval ID not found in queue: ' + approvalId + '\nRun with --list to see pending entries.';
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

  if (io.display) {
    io.display(entry);
  } else {
    displayEntry(entry);
    console.log('');
    console.log('Type exactly to approve: ' + entry.approvalPhrase);
    console.log('Type REJECT to cancel.');
    console.log('');
  }

  let answer;
  if (io.readAnswer) {
    answer = await io.readAnswer(entry);
  } else {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
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

  answer = String(answer || '').trim();

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

  const approvedAt = new Date().toISOString();
  const executionResult = executeApprovedAction(entry, env);
  entries[idx] = Object.assign({}, entry, {
    approvedAt,
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

function runReject(approvalId) {
  const entries = loadQueue();
  const idx = entries.findIndex((entry) => entry.approvalId === approvalId);
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

function enqueueAction(entry) {
  const required = [
    'approvalId',
    'createdAt',
    'capabilityId',
    'actionDescription',
    'riskLabel',
    'source',
    'userText',
    'preview',
    'approvalPhrase',
  ];
  for (const field of required) {
    if (!entry[field]) {
      throw new Error('enqueueAction: missing required field: ' + field);
    }
  }
  if (entry.riskLabel === 'health_sensitive') {
    throw new Error('enqueueAction: health-sensitive actions must never be queued.');
  }
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

async function main(argv, env) {
  argv = argv || process.argv.slice(2);
  env = env || process.env;

  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    console.log('Chintu Approval Queue CLI');
    console.log('');
    console.log('Usage:');
    console.log('  node scripts/chintu-approve.js <approvalId>   -- review and approve/reject one entry');
    console.log('  node scripts/chintu-approve.js --list         -- list all pending entries');
    console.log('  node scripts/chintu-approve.js --reject <id>  -- reject an entry without prompt');
    console.log('');
    console.log('Safety rules:');
    console.log('  * Exact approval phrase required (case-sensitive).');
    console.log('  * No auto-approve. No timeout-approve.');
    console.log('  * Health-sensitive entries are blocked, not queued.');
    return { ok: true, mode: 'help' };
  }

  if (argv[0] === '--list') {
    listQueue(loadQueue());
    return { ok: true, mode: 'list' };
  }

  if (argv[0] === '--reject') {
    if (!argv[1]) {
      console.error('Usage: --reject <approvalId>');
      process.exit(1);
    }
    return runReject(argv[1]);
  }

  return runApprove(argv[0], env);
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
  APPROVAL_PHRASES,
};
