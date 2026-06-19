#!/usr/bin/env node
'use strict';

// =============================================================================
// Chintu Agent Orchestrator — Stage 30
// -----------------------------------------------------------------------------
// Coordinates a fixed board of predefined Chintu agents and writes an operator
// summary. The summary is intentionally coordination-only:
//
//   * Dry-run / reporting only. No file edits, no git push, no real connector
//     send, no arbitrary job input.
//   * Jobs remain fixed and each maps to one allowlisted bridge action.
//   * Parallel-safe jobs are grouped into the first wave; gate/report jobs stay
//     sequential.
//   * `--summary` prints a richer operator summary while keeping the same safety
//     boundary.
//
// No network. fs only. (See scripts/chintu-no-network-egress.test.js.)
// =============================================================================

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const runsDir = path.join(repoRoot, 'CHINTU_AGENT_RUNS');
const jsonPath = path.join(runsDir, 'latest_orchestrator_summary.json');
const mdPath = path.join(runsDir, 'latest_orchestrator_summary.md');

// The fixed agent board. Each job:
//   id, label, track, mode ('read'|'dry-run'), parallelSafe, bridgeAction,
//   gates, approval ('none'|'human'), outcome
const JOBS = [
  {
    id: 'validator-agent',
    label: 'Validator Agent',
    track: 'both',
    mode: 'dry-run',
    parallelSafe: true,
    bridgeAction: 'run_validator_dry_run',
    summary: 'Runs the validator as a dry run. No files changed.',
    gates: ['Dry run only', 'No file edits', 'No push'],
    approval: 'none',
    outcome: 'Validation-only operator signal.',
  },
  {
    id: 'connector-safety-agent',
    label: 'Connector Safety Agent',
    track: 'chintu',
    mode: 'read',
    parallelSafe: true,
    bridgeAction: 'connector_readiness',
    summary: 'Reports connector readiness. Real sends stay parked behind explicit activation.',
    gates: ['Read-only', 'No external send', 'No secrets printed'],
    approval: 'none',
    outcome: 'Connector readiness report.',
  },
  {
    id: 'bala-ux-agent',
    label: 'BALA UX Agent',
    track: 'bala',
    mode: 'read',
    parallelSafe: true,
    bridgeAction: 'validate_app',
    summary: 'Validates the BALA app (structure + safe-copy gates). Read-only.',
    gates: ['Read-only', 'No medical claims', 'Mobile-first preserved'],
    approval: 'none',
    outcome: 'BALA production-safe validation signal.',
  },
  {
    id: 'prompt-engineer-agent',
    label: 'Prompt Engineer Agent',
    track: 'both',
    mode: 'dry-run',
    parallelSafe: true,
    bridgeAction: 'prompt_xml_bala',
    summary: 'Generates a structured XML build prompt. Produces text only.',
    gates: ['Generates text only', 'No code change'],
    approval: 'none',
    outcome: 'Prompt artifact only.',
  },
  {
    id: 'release-manager-agent',
    label: 'Release Manager Agent',
    track: 'both',
    mode: 'read',
    parallelSafe: false, // run last; it is the gate everything else feeds
    bridgeAction: 'release_guard',
    summary: 'Runs the release guard to report whether a push would be safe. Never pushes.',
    gates: ['Read-only', 'Never pushes', 'Reports gate status only'],
    approval: 'human',
    outcome: 'Final release recommendation only.',
  },
];

// Plan the run: parallel-safe jobs first (as one wave), then sequential jobs.
function planRun() {
  const parallel = JOBS.filter((j) => j.parallelSafe);
  const sequential = JOBS.filter((j) => !j.parallelSafe);
  const waves = [];
  if (parallel.length) waves.push({ mode: 'parallel', jobs: parallel.map((j) => j.id) });
  for (const j of sequential) waves.push({ mode: 'sequential', jobs: [j.id] });
  return waves;
}

// Build the dry-run summary object. No job is executed here — the orchestrator
// reports the plan and the bridge action each job maps to.
function buildSummary(options) {
  const summaryMode = options && options.summaryMode === 'operator-summary'
    ? 'operator-summary'
    : 'dry-run';
  const waves = planRun();
  const safeJobs = JOBS.filter((j) => j.mode === 'read' || j.mode === 'dry-run').map((j) => j.id);
  const approvalRequired = [
    'Any real connector send',
    'Any file edit path',
    'Any push or branch release action',
  ];
  return {
    ok: true,
    runType: 'dry-run',
    summaryMode,
    generatedAt: new Date().toISOString(),
    note: 'Dry run: this board coordinates and reports. It does not edit files, push, or send. ' +
      'Use the named bridge action to actually run a job.',
    jobCount: JOBS.length,
    safeJobs,
    dryRunOnly: true,
    approvalRequired,
    waves,
    jobs: JOBS.map((j) => ({
      id: j.id,
      label: j.label,
      track: j.track,
      mode: j.mode,
      parallelSafe: j.parallelSafe,
      bridgeAction: j.bridgeAction,
      summary: j.summary,
      gates: j.gates,
      approval: j.approval,
      outcome: j.outcome,
      status: 'planned',
    })),
    nextSuggestedAction: 'connector_readiness',
  };
}

function toMarkdown(s) {
  const lines = [];
  lines.push('# Chintu Agent Orchestrator — Latest Summary');
  lines.push('');
  lines.push('- Generated: ' + s.generatedAt);
  lines.push('- Run type: **' + s.runType + '** (no edits, no push, no send)');
  lines.push('- Summary mode: **' + s.summaryMode + '**');
  lines.push('- Jobs on board: ' + s.jobCount);
  lines.push('');
  lines.push('> ' + s.note);
  lines.push('');
  lines.push('## Safe jobs');
  lines.push('');
  lines.push('- ' + s.safeJobs.join(', '));
  lines.push('');
  lines.push('## Run plan');
  lines.push('');
  s.waves.forEach((w, i) => {
    lines.push((i + 1) + '. **' + w.mode + '** — ' + w.jobs.join(', '));
  });
  lines.push('');
  lines.push('## Jobs');
  lines.push('');
  lines.push('| Agent | Track | Mode | Bridge action | Approval | Status |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const j of s.jobs) {
    lines.push('| ' + j.label + ' | ' + j.track + ' | ' + j.mode + ' | `' + j.bridgeAction + '` | ' + j.approval + ' | ' + j.status + ' |');
  }
  lines.push('');
  lines.push('## Job outcomes');
  lines.push('');
  for (const j of s.jobs) {
    lines.push('- **' + j.label + '** — ' + j.outcome);
  }
  lines.push('');
  lines.push('## Safety gates (per job)');
  lines.push('');
  for (const j of s.jobs) {
    lines.push('- **' + j.label + '** — ' + j.gates.join('; '));
  }
  lines.push('');
  lines.push('## Requires approval');
  lines.push('');
  for (const item of s.approvalRequired) {
    lines.push('- ' + item);
  }
  lines.push('');
  lines.push('_Next suggested action: `' + s.nextSuggestedAction + '`_');
  lines.push('');
  return lines.join('\n');
}

// Write the summary files. Returns the summary object plus where it was written.
function run(options) {
  const summary = buildSummary(options);
  try {
    if (!fs.existsSync(runsDir)) fs.mkdirSync(runsDir, { recursive: true });
    fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2));
    fs.writeFileSync(mdPath, toMarkdown(summary));
    summary.wrote = [
      path.relative(repoRoot, jsonPath).replace(/\\/g, '/'),
      path.relative(repoRoot, mdPath).replace(/\\/g, '/'),
    ];
  } catch (e) {
    summary.ok = false;
    summary.error = 'could not write summary: ' + (e && e.message);
  }
  return summary;
}

function cli() {
  const summaryMode = process.argv.slice(2).indexOf('--summary') !== -1
    ? 'operator-summary'
    : 'dry-run';
  const summary = run({ summaryMode });
  // Human-friendly console output for the bridge to capture as stdout.
  console.log('Chintu Agent Orchestrator — ' + summary.summaryMode);
  console.log('  Jobs planned: ' + summary.jobCount);
  console.log('  Safe jobs: ' + summary.safeJobs.join(', '));
  for (const w of summary.waves) console.log('  ' + w.mode + ': ' + w.jobs.join(', '));
  console.log('  Approval required: ' + summary.approvalRequired.join(' | '));
  if (summary.wrote) {
    console.log('  Wrote: ' + summary.wrote.join(', '));
  } else if (summary.error) {
    console.log('  ' + summary.error);
  }
  console.log('  Next suggested action: ' + summary.nextSuggestedAction);
  process.exit(summary.ok ? 0 : 1);
}

module.exports = { JOBS, planRun, buildSummary, toMarkdown, run, jsonPath, mdPath };

if (require.main === module) {
  cli();
}
