#!/usr/bin/env node
'use strict';

const assert = require('assert');
const registry = require('./chintu-capability-registry.js');

const { CAPABILITIES, RISK_ORDER, getCapability, getCapabilitiesUpTo, checkExecutionAllowed } = registry;

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

console.log('Chintu Capability Registry test\n');

// Registry integrity
console.log('Registry integrity:');
check('registry loads without error', () => {
  assert.ok(Array.isArray(CAPABILITIES));
});
check('registry has at least 10 capabilities', () => {
  assert.ok(CAPABILITIES.length >= 10, 'Only ' + CAPABILITIES.length + ' capabilities found');
});
check('RISK_ORDER has 4 levels', () => {
  assert.deepStrictEqual(RISK_ORDER, ['safe_read', 'dry_run', 'requires_approval', 'blocked']);
});
check('validateRegistry passes (no violations)', () => {
  registry.validateRegistry();
});

// Required field presence
console.log('\nRequired fields:');
for (const cap of CAPABILITIES) {
  check(cap.id + ': has all required fields', () => {
    assert.ok(cap.id, 'missing id');
    assert.ok(cap.description, 'missing description');
    assert.ok(cap.inputShape, 'missing inputShape');
    assert.ok(cap.outputShape, 'missing outputShape');
    assert.ok(RISK_ORDER.includes(cap.riskLevel), 'invalid riskLevel: ' + cap.riskLevel);
    assert.strictEqual(typeof cap.dryRunSupported, 'boolean');
    assert.strictEqual(typeof cap.executionAllowed, 'boolean');
    assert.strictEqual(typeof cap.requiresApproval, 'boolean');
    assert.strictEqual(typeof cap.localOnly, 'boolean');
    assert.ok(cap.testFile, 'missing testFile');
  });
}

// Safety invariants
console.log('\nSafety invariants:');
check('no blocked capability has executionAllowed=true', () => {
  const violations = CAPABILITIES.filter((c) => c.riskLevel === 'blocked' && c.executionAllowed);
  assert.equal(violations.length, 0, 'Violations: ' + violations.map((c) => c.id).join(', '));
});
check('no requires_approval capability has executionAllowed=true', () => {
  const violations = CAPABILITIES.filter((c) => c.requiresApproval && c.executionAllowed);
  assert.equal(violations.length, 0, 'Violations: ' + violations.map((c) => c.id).join(', '));
});
check('health emergency action is blocked', () => {
  const cap = getCapability('chintu.healthEmergencyAction');
  assert.ok(cap, 'capability not found');
  assert.equal(cap.riskLevel, 'blocked');
  assert.equal(cap.executionAllowed, false);
});
check('bala.interpretLiveHealthData is blocked', () => {
  const cap = getCapability('bala.interpretLiveHealthData');
  assert.ok(cap, 'capability not found');
  assert.equal(cap.riskLevel, 'blocked');
  assert.equal(cap.executionAllowed, false);
});
check('connector.webhookActivation is blocked', () => {
  const cap = getCapability('connector.webhookActivation');
  assert.ok(cap, 'capability not found');
  assert.equal(cap.riskLevel, 'blocked');
  assert.equal(cap.executionAllowed, false);
});
check('chintu.gitPush requires approval and is not executable', () => {
  const cap = getCapability('chintu.gitPush');
  assert.ok(cap, 'capability not found');
  assert.equal(cap.riskLevel, 'requires_approval');
  assert.equal(cap.executionAllowed, false);
  assert.equal(cap.requiresApproval, true);
});
check('telegram.sendMessage requires approval and is not executable', () => {
  const cap = getCapability('telegram.sendMessage');
  assert.ok(cap, 'capability not found');
  assert.equal(cap.requiresApproval, true);
  assert.equal(cap.executionAllowed, false);
});

// Execution gate
console.log('\nExecution gate:');
check('checkExecutionAllowed: safe_read capability returns allowed=true', () => {
  const result = checkExecutionAllowed('chintu.status');
  assert.equal(result.allowed, true, result.reason);
});
check('checkExecutionAllowed: dry_run capability returns allowed=true', () => {
  const result = checkExecutionAllowed('chintu.checkEverything');
  assert.equal(result.allowed, true, result.reason);
});
check('checkExecutionAllowed: blocked capability returns allowed=false', () => {
  const result = checkExecutionAllowed('connector.webhookActivation');
  assert.equal(result.allowed, false);
  assert.ok(result.reason, 'no reason given');
});
check('checkExecutionAllowed: requires_approval returns allowed=false', () => {
  const result = checkExecutionAllowed('chintu.gitPush');
  assert.equal(result.allowed, false);
  assert.ok(result.reason, 'no reason given');
});
check('checkExecutionAllowed: unknown id returns allowed=false', () => {
  const result = checkExecutionAllowed('nonexistent.thing');
  assert.equal(result.allowed, false);
  assert.match(result.reason, /not registered/i);
});

// getCapabilitiesUpTo filter
console.log('\nRisk-level filtering:');
check('getCapabilitiesUpTo safe_read: only safe_read capabilities', () => {
  const list = getCapabilitiesUpTo('safe_read');
  assert.ok(list.length > 0);
  assert.ok(list.every((c) => c.riskLevel === 'safe_read'));
});
check('getCapabilitiesUpTo dry_run: includes safe_read and dry_run', () => {
  const list = getCapabilitiesUpTo('dry_run');
  const levels = [...new Set(list.map((c) => c.riskLevel))];
  assert.ok(levels.every((l) => ['safe_read', 'dry_run'].includes(l)));
});
check('getCapabilitiesUpTo blocked: includes all capabilities', () => {
  const list = getCapabilitiesUpTo('blocked');
  assert.equal(list.length, CAPABILITIES.length);
});

// BALA safety notes
console.log('\nBALA safety notes:');
check('bala.localHealthSummaryReadOnly has safetyNotes', () => {
  const cap = getCapability('bala.localHealthSummaryReadOnly');
  assert.ok(Array.isArray(cap.safetyNotes) && cap.safetyNotes.length > 0);
});
check('bala.doctorSummaryPreview safety notes mention no diagnosis', () => {
  const cap = getCapability('bala.doctorSummaryPreview');
  const combined = cap.safetyNotes.join(' ').toLowerCase();
  assert.ok(combined.includes('diagnosis') || combined.includes('diagnos'), 'no mention of diagnosis prohibition');
});

// Unique IDs
console.log('\nID uniqueness:');
check('all capability IDs are unique', () => {
  const ids = CAPABILITIES.map((c) => c.id);
  const set = new Set(ids);
  assert.equal(set.size, ids.length, 'Duplicate IDs found');
});

// Final
console.log('\n---');
if (failed > 0) {
  console.error('FAIL chintu-capability-registry.test.js (' + failed + ' failed, ' + passed + ' passed)');
  process.exit(1);
} else {
  console.log('PASS chintu-capability-registry.test.js (' + passed + ' passed)');
}
