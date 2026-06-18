#!/usr/bin/env node
// Chintu command-map integrity test.
//
// Verifies that every `scripts/chintu-*.ps1` and `scripts/chintu-*.test.js`
// path referenced in CHINTU_FOUNDER_COMMAND_MAP.md actually exists on
// disk, and that every shipped `scripts/chintu-*.ps1` is mentioned at
// least once in the command map. This is a pure read-only regression
// guard: no edits, no network.

'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const mapPath = path.join(repoRoot, 'CHINTU_FOUNDER_COMMAND_MAP.md');
const scriptsDir = path.join(repoRoot, 'scripts');

let fails = 0;
function fail(msg) {
  fails++;
  console.error('FAIL: ' + msg);
}

if (!fs.existsSync(mapPath)) {
  fail('CHINTU_FOUNDER_COMMAND_MAP.md missing');
  process.exit(1);
}

const mapText = fs.readFileSync(mapPath, 'utf8');

// Extract every scripts\foo.ps1 or scripts/foo.ps1 or scripts\foo.test.js reference.
const refRe = /scripts[\\/](chintu-[a-z0-9-]+(?:\.test)?\.(?:ps1|js))/gi;
const referenced = new Set();
let m;
while ((m = refRe.exec(mapText)) !== null) {
  referenced.add(m[1].toLowerCase());
}

if (referenced.size === 0) {
  fail('no scripts referenced in command map');
}

for (const ref of referenced) {
  const p = path.join(scriptsDir, ref);
  if (!fs.existsSync(p)) {
    fail(`command map references missing script: scripts/${ref}`);
  }
}

// Every shipped chintu-*.ps1 must be referenced somewhere in the map,
// unless it is an internal helper marked with leading underscore.
const shipped = fs
  .readdirSync(scriptsDir)
  .filter((f) => /^chintu-[a-z0-9-]+\.ps1$/i.test(f))
  .map((f) => f.toLowerCase());

const unmentioned = shipped.filter((f) => !referenced.has(f));
if (unmentioned.length > 0) {
  fail('shipped script(s) not mentioned in command map: ' + unmentioned.join(', '));
}

if (fails === 0) {
  console.log(
    `Command map integrity: PASS (${referenced.size} referenced, ${shipped.length} shipped)`
  );
  process.exit(0);
}

console.error(`Command map integrity: FAIL (${fails} issue(s))`);
process.exit(1);
