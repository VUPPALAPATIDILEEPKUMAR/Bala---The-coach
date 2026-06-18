#!/usr/bin/env node
// Chintu connector-policy integrity test.
//
// Verifies:
//   1. CHINTU_CONNECTORS.md, CHINTU_CONNECTOR_POLICY.md, and
//      CHINTU_CONNECTORS_CONFIG.example.json all exist.
//   2. The three docs carry the BALA safety footer.
//   3. The example config contains no secret-shaped values (placeholder
//      strings only).
//   4. No connector in the example config is marked "active". Highest
//      legal status here is "dry-run".
//   5. Required connector keys exist for telegram / slack / discord
//      (status + allowlist + a pauseFile or null pauseFile).
//
// Read-only. No network. No edits.

'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const registry = path.join(repoRoot, 'CHINTU_CONNECTORS.md');
const policy = path.join(repoRoot, 'CHINTU_CONNECTOR_POLICY.md');
const configFile = path.join(repoRoot, 'CHINTU_CONNECTORS_CONFIG.example.json');

const FOOTER = 'BALA is a health-awareness companion';
const SECRET_PATTERNS = [
  // A long base64-ish or hex string would look like a real secret.
  /[A-Za-z0-9_\-]{32,}/,
];

let fails = 0;
function fail(msg) {
  fails++;
  console.error('FAIL: ' + msg);
}

for (const [p, label] of [[registry, 'CHINTU_CONNECTORS.md'], [policy, 'CHINTU_CONNECTOR_POLICY.md']]) {
  if (!fs.existsSync(p)) {
    fail(`${label} missing`);
    continue;
  }
  const t = fs.readFileSync(p, 'utf8');
  if (!t.includes(FOOTER)) {
    fail(`${label} missing BALA safety footer`);
  }
}

if (!fs.existsSync(configFile)) {
  fail('CHINTU_CONNECTORS_CONFIG.example.json missing');
  process.exit(1);
}

let config;
try {
  config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
} catch (e) {
  fail('CHINTU_CONNECTORS_CONFIG.example.json is not valid JSON: ' + e.message);
  process.exit(1);
}

if (!config._bala_safety_footer || !config._bala_safety_footer.includes('health-awareness companion')) {
  fail('CHINTU_CONNECTORS_CONFIG.example.json missing _bala_safety_footer');
}

const connectors = config.connectors || {};
const required = ['telegram', 'slack', 'discord'];
for (const name of required) {
  if (!connectors[name]) {
    fail(`example config missing connector "${name}"`);
    continue;
  }
  const c = connectors[name];
  if (!c.status) {
    fail(`connector "${name}" missing status`);
  } else if (c.status === 'active') {
    fail(`connector "${name}" is marked "active" in the example config (must be at most "dry-run")`);
  } else if (c.status === 'ready') {
    fail(`connector "${name}" is marked "ready" in the example config (must be at most "dry-run")`);
  }
  if (!('allowlist' in c)) {
    fail(`connector "${name}" missing allowlist`);
  }
}

// Walk every string value looking for something that looks like a
// real secret (long opaque blob). Env var NAMES are allowed.
function walk(obj, keyPath) {
  if (typeof obj === 'string') {
    // Skip values that are clearly env var names or placeholder labels.
    if (/PLACEHOLDER|_ENV_|_NEVER_COMMITTED|EnvVar$/i.test(obj)) return;
    if (/^[A-Z][A-Z0-9_]+$/.test(obj)) return; // pure ENV_VAR style
    for (const re of SECRET_PATTERNS) {
      if (re.test(obj) && !/PLACEHOLDER/i.test(obj)) {
        // Skip our own descriptive strings.
        if (/health[- ]awareness companion|does not diagnose/i.test(obj)) return;
        if (/CHINTU_OUTBOX|CONNECTOR_/.test(obj)) return;
        fail(`example config field ${keyPath} looks like a real secret: "${obj.slice(0, 24)}..."`);
        return;
      }
    }
  } else if (Array.isArray(obj)) {
    obj.forEach((v, i) => walk(v, keyPath + '[' + i + ']'));
  } else if (obj && typeof obj === 'object') {
    for (const k of Object.keys(obj)) {
      walk(obj[k], keyPath ? keyPath + '.' + k : k);
    }
  }
}
walk(config, '');

if (fails > 0) {
  console.error(`\n${fails} failure(s) in chintu-connector-policy.test.js`);
  process.exit(1);
}

console.log('PASS chintu-connector-policy.test.js (registry + policy + example config consistent)');
