#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const repoRoot = path.resolve(__dirname, '..');
const boardPath = path.join(repoRoot, 'CHINTU_AGENT_BOARD.md');
const packetDir = path.join(repoRoot, 'CHINTU_AGENT_PACKETS');

assert.ok(fs.existsSync(boardPath), 'CHINTU_AGENT_BOARD.md should exist');
assert.ok(fs.existsSync(packetDir), 'CHINTU_AGENT_PACKETS should exist');

const packetFiles = fs.readdirSync(packetDir).filter((file) => file.endsWith('.md')).sort();
assert.ok(packetFiles.length >= 5, 'expected at least five packet files');

const requiredSections = [
  '## Mission',
  '## Files To Inspect',
  '## Protected Files',
  '## Allowed Actions',
  '## Forbidden Actions',
  '## Validation Commands',
  '## Suggested Commit Name',
  '## Stop Condition',
  '## Copy-Paste Prompt For Codex/Claude',
];

for (const file of packetFiles) {
  const text = fs.readFileSync(path.join(packetDir, file), 'utf8');
  for (const section of requiredSections) {
    assert.ok(text.includes(section), `${file} is missing section: ${section}`);
  }
}

console.log('PASS chintu-agent-board.test.js');
