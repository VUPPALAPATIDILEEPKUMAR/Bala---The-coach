#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const assert = require('assert');

const repoRoot = path.resolve(__dirname, '..');
const runnerPath = path.join(repoRoot, 'scripts', 'chintu-agent-runner.ps1');
const runsDir = path.join(repoRoot, 'CHINTU_AGENT_RUNS');
const packetsDir = path.join(repoRoot, 'CHINTU_AGENT_PACKETS');

function runRunner(args) {
  return cp.spawnSync(
    'powershell',
    ['-ExecutionPolicy', 'Bypass', '-File', runnerPath, ...args],
    { cwd: repoRoot, encoding: 'utf8', timeout: 60000 }
  );
}

// Test 1: --ListAgents shows available agents
const listResult = runRunner(['-ListAgents']);
assert.strictEqual(listResult.status, 0, `ListAgents failed: ${listResult.stderr}`);
assert.match(listResult.stdout, /validator-agent/, 'Should list validator-agent');
assert.match(listResult.stdout, /research-agent/, 'Should list research-agent');
assert.match(listResult.stdout, /Available agent packets/, 'Should show header');

// Test 2: Unknown agent exits with error
const unknownResult = runRunner(['-Agent', 'nonexistent-agent']);
assert.notStrictEqual(unknownResult.status, 0, 'Unknown agent should fail');
assert.match(unknownResult.stdout || unknownResult.stderr, /not found|Available agents/i, 'Should mention agent not found');

// Test 3: DryRun creates run folder without executing commands
const dryResult = runRunner(['-Agent', 'validator-agent', '-DryRun']);
assert.strictEqual(dryResult.status, 0, `DryRun failed: ${dryResult.stderr}`);
assert.match(dryResult.stdout, /DRY RUN|SKIPPED/i, 'Should indicate dry run');
assert.match(dryResult.stdout, /run-report/i, 'Should mention run report');

// Find the most recent run folder for validator-agent
const runFolders = fs.readdirSync(runsDir)
  .filter((name) => name.startsWith('validator-agent_'))
  .sort()
  .reverse();
assert.ok(runFolders.length > 0, 'Should create at least one run folder');

const latestRun = path.join(runsDir, runFolders[0]);
assert.ok(fs.existsSync(path.join(latestRun, 'packet.md')), 'Run folder should contain packet.md');
assert.ok(fs.existsSync(path.join(latestRun, 'run-report.md')), 'Run folder should contain run-report.md');
assert.ok(fs.existsSync(path.join(latestRun, 'run-summary.json')), 'Run folder should contain run-summary.json');

const summary = JSON.parse(fs.readFileSync(path.join(latestRun, 'run-summary.json'), 'utf8'));
assert.strictEqual(summary.agent, 'validator-agent');
assert.strictEqual(summary.dry_run, true);
assert.strictEqual(summary.overall, 'skipped');
assert.ok(summary.command_count > 0, 'Should find validation commands in packet');

// Test 4: Packet copy matches original
const originalPacket = fs.readFileSync(path.join(packetsDir, 'validator-agent.packet.md'), 'utf8');
const copiedPacket = fs.readFileSync(path.join(latestRun, 'packet.md'), 'utf8');
assert.strictEqual(copiedPacket, originalPacket, 'Copied packet should match original');

// Test 5: No network calls, no secrets, no connector activation in runner output
const fullOutput = dryResult.stdout + (dryResult.stderr || '');
assert.ok(!/https?:\/\//.test(fullOutput), 'Runner output should not contain URLs');
assert.ok(!/BOT_TOKEN|WEBHOOK_URL|API_KEY|SECRET/i.test(fullOutput), 'Runner output should not contain secret patterns');

// Cleanup test run folders
for (const folder of runFolders) {
  const folderPath = path.join(runsDir, folder);
  fs.rmSync(folderPath, { recursive: true, force: true });
}

console.log('PASS chintu-agent-runner.test.js');
