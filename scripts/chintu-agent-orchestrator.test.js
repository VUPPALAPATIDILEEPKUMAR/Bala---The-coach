#!/usr/bin/env node
'use strict';

// =============================================================================
// Chintu Agent Orchestrator test — Stage 24
// Verifies the board is safe (dry-run only), plans correctly, names only real
// bridge actions, and writes its summary files.
// =============================================================================

const fs = require('fs');
const orch = require('./chintu-agent-orchestrator.js');
const bridge = require('./chintu-local-bridge.js');

let fails = 0;
function ok(cond, msg) {
  if (cond) { console.log('  PASS: ' + msg); }
  else { fails++; console.error('  FAIL: ' + msg); }
}

console.log('Chintu Agent Orchestrator test\n');

// --- Board safety -----------------------------------------------------------
console.log('Board safety:');
ok(orch.JOBS.length >= 5, 'board has the predefined agents (' + orch.JOBS.length + ')');
ok(orch.JOBS.every((j) => j.mode === 'read' || j.mode === 'dry-run'), 'every job is read or dry-run (no destructive mode)');

const ids = orch.JOBS.map((j) => j.id);
for (const expected of ['validator-agent', 'connector-safety-agent', 'bala-ux-agent', 'prompt-engineer-agent', 'release-manager-agent']) {
  ok(ids.indexOf(expected) !== -1, 'board includes ' + expected);
}

// --- Only names real bridge actions ----------------------------------------
console.log('\nBridge action integrity:');
let allReal = true;
for (const j of orch.JOBS) {
  if (!Object.prototype.hasOwnProperty.call(bridge.ACTIONS, j.bridgeAction)) {
    allReal = false; console.error('    job ' + j.id + ' names unknown action ' + j.bridgeAction);
  }
}
ok(allReal, 'every job maps to a real allowlisted bridge action');

// --- Plan -------------------------------------------------------------------
console.log('\nRun plan:');
const waves = orch.planRun();
ok(Array.isArray(waves) && waves.length >= 1, 'plan produces waves');
ok(waves[0].mode === 'parallel', 'first wave is the parallel-safe group');
const lastWave = waves[waves.length - 1];
ok(lastWave.jobs.indexOf('release-manager-agent') !== -1, 'release manager runs last (sequential)');

// --- Summary shape ----------------------------------------------------------
console.log('\nSummary:');
const summary = orch.buildSummary({ summaryMode: 'operator-summary' });
ok(summary.runType === 'dry-run', 'summary run type is dry-run');
ok(summary.summaryMode === 'operator-summary', 'summary mode can switch to operator-summary');
ok(summary.jobs.every((j) => j.status === 'planned'), 'no job claims it executed (status=planned)');
ok(summary.safeJobs.length === orch.JOBS.length, 'safe jobs lists the coordination-only board');
ok(summary.approvalRequired.indexOf('Any real connector send') !== -1, 'summary names approval-gated actions');
ok(typeof orch.toMarkdown(summary) === 'string' && orch.toMarkdown(summary).indexOf('Requires approval') !== -1, 'markdown renders operator summary sections');

// --- Actually writes files --------------------------------------------------
console.log('\nWrite:');
const res = orch.run({ summaryMode: 'operator-summary' });
ok(res.ok === true, 'run() completes ok');
ok(fs.existsSync(orch.jsonPath), 'writes latest_orchestrator_summary.json');
ok(fs.existsSync(orch.mdPath), 'writes latest_orchestrator_summary.md');
const written = JSON.parse(fs.readFileSync(orch.jsonPath, 'utf8'));
ok(written.runType === 'dry-run', 'written summary is a dry run');
ok(written.summaryMode === 'operator-summary', 'written summary records operator-summary mode');

console.log('');
if (fails === 0) {
  console.log('Agent orchestrator: PASS');
  process.exit(0);
} else {
  console.error('Agent orchestrator: FAIL (' + fails + ' issue(s))');
  process.exit(1);
}
