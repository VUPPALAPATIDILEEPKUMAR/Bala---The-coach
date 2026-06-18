#!/usr/bin/env node
// Chintu generated-files-map integrity test.
//
// Parses CHINTU_GENERATED_FILES_MAP.md sections 1 (gitignored) and 2
// (tracked) to extract `(generated file, generator script)` pairs and
// verifies:
//
//   1. Every generator script exists in scripts/.
//   2. Every tracked generated file (section 2) exists at repo root.
//   3. No protected BALA file appears as a generated output.
//
// Read-only. No network. No edits.

'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const mapPath = path.join(repoRoot, 'CHINTU_GENERATED_FILES_MAP.md');

const PROTECTED_BALA = [
  'app.js',
  'index.html',
  'styles.css',
  'sw.js',
  'coach.js',
  'manifest.webmanifest',
  'privacy.html',
  'functions/api/coach.js',
];

let fails = 0;
function fail(msg) {
  fails++;
  console.error('FAIL: ' + msg);
}

if (!fs.existsSync(mapPath)) {
  fail('CHINTU_GENERATED_FILES_MAP.md missing');
  process.exit(1);
}

const text = fs.readFileSync(mapPath, 'utf8');

// Split into sections by H2 (## N. Heading).
const sectionRe = /^##\s+(\d+)\.\s+([^\n]+)$/gm;
const sections = [];
let m;
while ((m = sectionRe.exec(text)) !== null) {
  sections.push({ num: m[1], heading: m[2].trim(), start: m.index });
}
for (let i = 0; i < sections.length; i++) {
  sections[i].end = i + 1 < sections.length ? sections[i + 1].start : text.length;
  sections[i].body = text.slice(sections[i].start, sections[i].end);
}

function sectionBody(numPrefix) {
  const s = sections.find((x) => x.num === String(numPrefix));
  return s ? s.body : '';
}

// Parse pairs from a markdown table: backtick file | backtick script | ...
const rowRe = /\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|/g;

function parsePairs(body) {
  const pairs = [];
  let r;
  while ((r = rowRe.exec(body)) !== null) {
    pairs.push({ file: r[1].trim(), generator: r[2].trim() });
  }
  return pairs;
}

const gitignoredBody = sectionBody(1);
const trackedBody = sectionBody(2);

const gitignoredPairs = parsePairs(gitignoredBody);
const trackedPairs = parsePairs(trackedBody);

if (gitignoredPairs.length === 0) {
  fail('section 1 (gitignored) has no parsed pairs');
}
if (trackedPairs.length === 0) {
  fail('section 2 (tracked) has no parsed pairs');
}

const allPairs = gitignoredPairs.concat(trackedPairs);

for (const { file, generator } of allPairs) {
  // 1. Generator must exist.
  const genRel = generator.replace(/\\/g, '/');
  const genPath = path.join(repoRoot, genRel);
  if (!fs.existsSync(genPath)) {
    fail(`generator missing on disk: ${generator} (for ${file})`);
  }
  // 3. No protected BALA file as output.
  const fileNorm = file.replace(/\\/g, '/');
  if (PROTECTED_BALA.includes(fileNorm)) {
    fail(`protected BALA file listed as generated output: ${file}`);
  }
}

for (const { file } of trackedPairs) {
  // 2. Tracked generated files must exist at repo root.
  const filePath = path.join(repoRoot, file);
  if (!fs.existsSync(filePath)) {
    fail(`tracked generated file missing on disk: ${file}`);
  }
}

if (fails > 0) {
  console.error(`\n${fails} failure(s) in chintu-generated-files-map.test.js`);
  process.exit(1);
}

console.log(
  `PASS chintu-generated-files-map.test.js (${gitignoredPairs.length} gitignored, ${trackedPairs.length} tracked)`
);
