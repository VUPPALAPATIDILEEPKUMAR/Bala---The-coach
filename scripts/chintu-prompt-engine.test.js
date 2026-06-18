#!/usr/bin/env node
// chintu-prompt-engine.test.js — Stage 20
// Tests for the Chintu prompt engine. No network calls. No secrets. Read-only.
'use strict';

const assert = require('assert');
const cp = require('child_process');
const path = require('path');

const scriptPath = path.join(__dirname, 'chintu-prompt-engine.js');
const { buildXML, buildCOSTAR, buildACR } = require('./chintu-prompt-engine.js');

// ---------------------------------------------------------------------------
// Unit tests — builder functions
// ---------------------------------------------------------------------------

// XML framework — required structural tags
const xmlBoth = buildXML('Test task', 'both');
assert.ok(xmlBoth.includes('<role>'), 'XML must include <role>');
assert.ok(xmlBoth.includes('<context>'), 'XML must include <context>');
assert.ok(xmlBoth.includes('<task>'), 'XML must include <task>');
assert.ok(xmlBoth.includes('<rules>'), 'XML must include <rules>');
assert.ok(xmlBoth.includes('<validation_commands>'), 'XML must include <validation_commands>');
assert.ok(xmlBoth.includes('<output_format>'), 'XML must include <output_format>');
assert.ok(xmlBoth.includes('Test task'), 'XML must contain the task text');

// XML — BALA track includes safety reminder
const xmlBala = buildXML('Add alcohol calculator', 'bala');
assert.ok(xmlBala.includes('health-awareness companion'), 'BALA XML must include safety reminder');
assert.ok(xmlBala.includes('not medical advice'), 'BALA XML must mention not medical advice');
assert.ok(!xmlBala.includes('dry-run'), 'Pure BALA XML should not include Chintu dry-run reminder');

// XML — Chintu track includes dry-run reminder
const xmlChintu = buildXML('Improve agent runner', 'chintu');
assert.ok(xmlChintu.includes('dry-run'), 'Chintu XML must include dry-run reminder');
assert.ok(xmlChintu.includes('No secrets in repo'), 'Chintu XML must include secrets rule');

// XML — both track includes both reminders
const xmlBoth2 = buildXML('Plan sprint', 'both');
assert.ok(xmlBoth2.includes('health-awareness companion'), 'Both XML must include BALA safety');
assert.ok(xmlBoth2.includes('dry-run'), 'Both XML must include Chintu dry-run');

// COSTAR framework — all 6 sections
const costar = buildCOSTAR('Improve agent runner', 'chintu');
assert.ok(costar.includes('## Context'), 'COSTAR must include Context');
assert.ok(costar.includes('## Objective'), 'COSTAR must include Objective');
assert.ok(costar.includes('## Style'), 'COSTAR must include Style');
assert.ok(costar.includes('## Tone'), 'COSTAR must include Tone');
assert.ok(costar.includes('## Audience'), 'COSTAR must include Audience');
assert.ok(costar.includes('## Response format'), 'COSTAR must include Response format');
assert.ok(costar.includes('Improve agent runner'), 'COSTAR must contain task text');

// ACR framework — all 3 sections
const acr = buildACR('Plan next sprint', 'both');
assert.ok(acr.includes('## Action'), 'ACR must include Action');
assert.ok(acr.includes('## Context'), 'ACR must include Context');
assert.ok(acr.includes('## Result expected'), 'ACR must include Result expected');
assert.ok(acr.includes('Plan next sprint'), 'ACR must contain task text');

// No framework embeds secrets or network calls
for (const output of [xmlBoth, xmlBala, xmlChintu, costar, acr]) {
  assert.ok(!output.includes('BOT_TOKEN'), 'Prompt must not contain BOT_TOKEN');
  assert.ok(!output.includes('CHAT_ID'), 'Prompt must not contain CHAT_ID');
  assert.ok(!output.includes('fetch('), 'Prompt must not contain fetch() calls');
  assert.ok(!output.includes('https://api.telegram'), 'Prompt must not embed live API URLs');
}

// BALA safety footer always present in BALA/both tracks
assert.ok(buildXML('task', 'bala').includes('not medical advice'), 'BALA XML missing safety');
assert.ok(buildCOSTAR('task', 'bala').includes('No medical claims'), 'BALA COSTAR missing safety'); // checked via header phrase
assert.ok(buildACR('task', 'bala').includes('No medical claims'), 'BALA ACR missing safety'); // ACR uses inline phrase

// ---------------------------------------------------------------------------
// CLI integration tests — subprocess
// ---------------------------------------------------------------------------

function runCLI(args) {
  return cp.spawnSync(process.execPath, [scriptPath, ...args], {
    encoding: 'utf8',
    cwd: path.resolve(__dirname, '..'),
  });
}

// Default invocation (no args) prints XML both
let result = runCLI([]);
assert.strictEqual(result.status, 0, `Default run failed: ${result.stderr}`);
assert.ok(result.stdout.includes('<role>'), 'Default output should be XML with <role>');

// --framework costar
result = runCLI(['--framework', 'costar', '--track', 'chintu', '--task', 'Fix connector bug']);
assert.strictEqual(result.status, 0, `COSTAR run failed: ${result.stderr}`);
assert.ok(result.stdout.includes('## Context'), 'COSTAR CLI output missing Context');
assert.ok(result.stdout.includes('Fix connector bug'), 'COSTAR CLI missing task');

// --framework acr
result = runCLI(['--framework', 'acr', '--track', 'bala', '--task', 'Add weekly reflection']);
assert.strictEqual(result.status, 0, `ACR run failed: ${result.stderr}`);
assert.ok(result.stdout.includes('## Action'), 'ACR CLI output missing Action');
assert.ok(result.stdout.includes('Add weekly reflection'), 'ACR CLI missing task');

// Invalid framework exits with error
result = runCLI(['--framework', 'invalid']);
assert.notStrictEqual(result.status, 0, 'Invalid framework should exit non-zero');
assert.ok(result.stderr.includes('FAIL'), 'Invalid framework should print FAIL');

// Invalid track exits with error
result = runCLI(['--track', 'unknown']);
assert.notStrictEqual(result.status, 0, 'Invalid track should exit non-zero');

// Write to file
const os = require('os');
const tmpFile = path.join(os.tmpdir(), 'chintu-prompt-test-output.md');
result = runCLI(['--framework', 'xml', '--track', 'both', '--task', 'Test write', '--out', tmpFile]);
assert.strictEqual(result.status, 0, `--out failed: ${result.stderr}`);
const fs = require('fs');
assert.ok(fs.existsSync(tmpFile), '--out should create the file');
const written = fs.readFileSync(tmpFile, 'utf8');
assert.ok(written.includes('<role>'), 'Written file should contain XML <role>');
fs.unlinkSync(tmpFile);

console.log('PASS chintu-prompt-engine.test.js (unit + CLI)');
