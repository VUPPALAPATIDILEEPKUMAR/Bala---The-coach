#!/usr/bin/env node
'use strict';

// =============================================================================
// Chintu Action Trace test — Stage 34
// Verifies that every trace built by chintu-action-trace.js satisfies the
// CHINTU_ACTION_TRACE_CONTRACT.md invariants. No network, no shell, no fs writes.
// =============================================================================

const assert = require('assert');
const brain = require('./chintu-brain-router.js');
const { buildTrace, validateTrace, makeActionId, INTENT_TO_CAPABILITY } = require('./chintu-action-trace.js');

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

const FIXED_NOW = '2026-06-19T14:23:00.000Z';

// ---------------------------------------------------------------------------
// Helper: build a trace from a natural-language message
// ---------------------------------------------------------------------------
function traceFor(message, opts) {
  const result = brain.route(message);
  return buildTrace(result, Object.assign({ nowIso: FIXED_NOW }, opts || {}));
}

console.log('Chintu Action Trace test\n');

// ---------------------------------------------------------------------------
// Shape — all required fields present
// ---------------------------------------------------------------------------
console.log('Trace shape:');
const REQUIRED_FIELDS = [
  'traceVersion', 'actionId', 'timestamp', 'source', 'userText', 'intent',
  'risk', 'allowed', 'allowedReason', 'blockedReason', 'dryRun', 'executed',
  'capabilityId', 'endpoint', 'sequence', 'resultSummary', 'bridgeResult',
  'healthSensitive', 'sendStatus', 'sendBlockedReason', 'safetyNotes',
  'auditPath', 'secretsPresent', 'healthDataPresent',
];
const sampleTrace = traceFor('check everything');
for (const f of REQUIRED_FIELDS) {
  check('trace has field: ' + f, () => {
    assert.ok(Object.prototype.hasOwnProperty.call(sampleTrace, f), 'missing field: ' + f);
  });
}

// ---------------------------------------------------------------------------
// Invariants — always-false safety fields
// ---------------------------------------------------------------------------
console.log('\nSafety invariants:');
const allMessages = [
  'hi', 'check everything', 'validate bala', 'run validator',
  'make bala better', 'github status', 'check connectors',
  'asdf qwerty', 'I have chest pain', 'trouble breathing',
];

check('secretsPresent is always false', () => {
  for (const m of allMessages) {
    const t = traceFor(m);
    assert.strictEqual(t.secretsPresent, false, 'secretsPresent!=false for: ' + m);
  }
});
check('healthDataPresent is always false', () => {
  for (const m of allMessages) {
    const t = traceFor(m);
    assert.strictEqual(t.healthDataPresent, false, 'healthDataPresent!=false for: ' + m);
  }
});
check('traceVersion is always "1"', () => {
  for (const m of allMessages) {
    const t = traceFor(m);
    assert.strictEqual(t.traceVersion, '1', 'wrong traceVersion for: ' + m);
  }
});

// ---------------------------------------------------------------------------
// Health-sensitive traces
// ---------------------------------------------------------------------------
console.log('\nHealth-sensitive traces:');
const emergencyMessages = ['I have chest pain', 'cant breathe', 'someone is fainting', 'stroke'];
for (const em of emergencyMessages) {
  check('"' + em + '" → allowed=false', () => {
    const t = traceFor(em);
    assert.strictEqual(t.allowed, false, 'health emergency allowed was ' + t.allowed);
  });
  check('"' + em + '" → healthSensitive=true', () => {
    const t = traceFor(em);
    assert.strictEqual(t.healthSensitive, true);
  });
  check('"' + em + '" → sendStatus=blocked', () => {
    const t = traceFor(em);
    assert.strictEqual(t.sendStatus, 'blocked');
  });
  check('"' + em + '" → risk=health_sensitive', () => {
    const t = traceFor(em);
    assert.strictEqual(t.risk, 'health_sensitive');
  });
  check('"' + em + '" → blockedReason present', () => {
    const t = traceFor(em);
    assert.ok(t.blockedReason && t.blockedReason.length > 0, 'no blockedReason for emergency');
  });
}

// ---------------------------------------------------------------------------
// Safe-read traces
// ---------------------------------------------------------------------------
console.log('\nSafe-read traces:');
check('"hi" → allowed=true', () => {
  const t = traceFor('hi');
  assert.strictEqual(t.allowed, true);
});
check('"hi" → blockedReason=null', () => {
  const t = traceFor('hi');
  assert.strictEqual(t.blockedReason, null);
});
check('"check everything" → allowed=true', () => {
  const t = traceFor('check everything');
  assert.strictEqual(t.allowed, true);
});
check('"check everything" → risk=dry_run (mapped from safe_read intent → dry_run capability)', () => {
  const t = traceFor('check everything');
  // check_everything maps to chintu.checkEverything which is dry_run risk level
  assert.ok(['safe_read', 'dry_run'].includes(t.risk), 'unexpected risk: ' + t.risk);
});
check('"check everything" → sequence is array', () => {
  const t = traceFor('check everything');
  assert.ok(Array.isArray(t.sequence), 'sequence not an array');
  assert.ok(t.sequence.length > 0, 'sequence is empty');
});

// ---------------------------------------------------------------------------
// Risk mapping
// ---------------------------------------------------------------------------
console.log('\nRisk mapping:');
check('safe_read router risk → safe_read or dry_run trace risk', () => {
  const t = traceFor('hi'); // greeting is safe_read
  assert.ok(['safe_read', 'dry_run'].includes(t.risk), 'got: ' + t.risk);
});
check('health_sensitive router risk → health_sensitive trace risk', () => {
  const t = traceFor('chest pain');
  assert.strictEqual(t.risk, 'health_sensitive');
});

// ---------------------------------------------------------------------------
// blockedReason consistency
// ---------------------------------------------------------------------------
console.log('\nblocked/allowed consistency:');
check('allowed=false always has non-empty blockedReason', () => {
  const traces = allMessages.map((m) => traceFor(m));
  for (const t of traces) {
    if (!t.allowed) {
      assert.ok(t.blockedReason && t.blockedReason.length > 0,
        'missing blockedReason for allowed=false trace: intent=' + t.intent);
    }
  }
});
check('allowed=true always has blockedReason=null', () => {
  const traces = allMessages.map((m) => traceFor(m));
  for (const t of traces) {
    if (t.allowed) {
      assert.strictEqual(t.blockedReason, null, 'non-null blockedReason when allowed=true: intent=' + t.intent);
    }
  }
});

// ---------------------------------------------------------------------------
// validateTrace helper agrees
// ---------------------------------------------------------------------------
console.log('\nvalidateTrace:');
check('validateTrace passes for all sample traces', () => {
  const violations = [];
  for (const m of allMessages) {
    const t = traceFor(m);
    const v = validateTrace(t);
    if (!v.ok) {
      violations.push(m + ': ' + v.violations.join('; '));
    }
  }
  assert.deepStrictEqual(violations, [], 'violations: ' + violations.join(' | '));
});
check('validateTrace detects secretsPresent=true', () => {
  const t = traceFor('hi');
  t.secretsPresent = true;
  const v = validateTrace(t);
  assert.strictEqual(v.ok, false);
  assert.ok(v.violations.some((x) => x.includes('secretsPresent')), 'wrong violation');
});
check('validateTrace detects allowed=false without blockedReason', () => {
  const t = traceFor('hi');
  t.allowed = false;
  t.blockedReason = null;
  const v = validateTrace(t);
  assert.strictEqual(v.ok, false);
  assert.ok(v.violations.some((x) => x.includes('blockedReason')), 'wrong violation');
});
check('validateTrace detects invalid risk', () => {
  const t = traceFor('hi');
  t.risk = 'completely_unknown_risk';
  const v = validateTrace(t);
  assert.strictEqual(v.ok, false);
});

// ---------------------------------------------------------------------------
// Source field
// ---------------------------------------------------------------------------
console.log('\nSource field:');
check('default source is "cli"', () => {
  const t = traceFor('hi');
  assert.strictEqual(t.source, 'cli');
});
check('source can be set to "telegram"', () => {
  const t = traceFor('hi', { source: 'telegram' });
  assert.strictEqual(t.source, 'telegram');
});
check('source can be set to "fixture"', () => {
  const t = traceFor('hi', { source: 'fixture' });
  assert.strictEqual(t.source, 'fixture');
});

// ---------------------------------------------------------------------------
// actionId format
// ---------------------------------------------------------------------------
console.log('\nactionId format:');
check('actionId starts with intent slug', () => {
  const t = traceFor('check everything', { nowIso: FIXED_NOW });
  assert.ok(t.actionId.startsWith('check_everything_'), 'actionId: ' + t.actionId);
});
check('makeActionId is deterministic', () => {
  const a = makeActionId('test_intent', FIXED_NOW);
  const b = makeActionId('test_intent', FIXED_NOW);
  assert.strictEqual(a, b);
});
check('makeActionId encodes timestamp without colons or dots', () => {
  const id = makeActionId('foo', '2026-06-19T14:23:00.000Z');
  assert.ok(!id.includes(':'), 'colon found in: ' + id);
  assert.ok(!id.includes('.'), 'dot found in: ' + id);
});

// ---------------------------------------------------------------------------
// send status paths
// ---------------------------------------------------------------------------
console.log('\nSend status:');
check('default sendStatus is not_requested', () => {
  const t = traceFor('check everything');
  assert.strictEqual(t.sendStatus, 'not_requested');
});
check('sendFlag=true, sendEnabled=false → sendStatus=blocked', () => {
  const t = traceFor('check everything', { sendFlag: true, sendEnabled: false });
  assert.strictEqual(t.sendStatus, 'blocked');
  assert.ok(t.sendBlockedReason, 'no sendBlockedReason');
});
check('sendFlag=true, sendEnabled=true, dryRun=true → sendStatus=dry_run', () => {
  const t = traceFor('check everything', { sendFlag: true, sendEnabled: true, dryRun: true });
  assert.strictEqual(t.sendStatus, 'dry_run');
});

// ---------------------------------------------------------------------------
// capabilityId mapping
// ---------------------------------------------------------------------------
console.log('\nCapability mapping:');
check('"check everything" capabilityId is chintu.checkEverything', () => {
  const t = traceFor('check everything');
  assert.strictEqual(t.capabilityId, 'chintu.checkEverything');
});
check('"I have chest pain" capabilityId is chintu.healthEmergencyAction', () => {
  const t = traceFor('I have chest pain');
  assert.strictEqual(t.capabilityId, 'chintu.healthEmergencyAction');
});
check('"github status" capabilityId is chintu.githubStatusDryRun', () => {
  const t = traceFor('github status');
  assert.strictEqual(t.capabilityId, 'chintu.githubStatusDryRun');
});

// ---------------------------------------------------------------------------
// dryRun / executed defaults
// ---------------------------------------------------------------------------
console.log('\ndryRun / executed:');
check('dryRun defaults to true', () => {
  const t = traceFor('check everything');
  assert.strictEqual(t.dryRun, true);
});
check('executed defaults to false', () => {
  const t = traceFor('check everything');
  assert.strictEqual(t.executed, false);
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n---');
if (failed > 0) {
  console.error('FAIL chintu-action-trace.test.js (' + failed + ' failed, ' + passed + ' passed)');
  process.exit(1);
} else {
  console.log('PASS chintu-action-trace.test.js (' + passed + ' passed)');
}
