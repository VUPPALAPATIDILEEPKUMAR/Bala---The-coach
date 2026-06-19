#!/usr/bin/env node
'use strict';

// =============================================================================
// Chintu Local AI Provider test — Stage 24
// Verifies provider detection is safe, never throws, and never claims cloud.
// Uses a transient local loopback server to prove "available" detection works.
// =============================================================================

const net = require('net');
const provider = require('./chintu-local-ai-provider.js');

let fails = 0;
function ok(cond, msg) {
  if (cond) { console.log('  PASS: ' + msg); }
  else { fails++; console.error('  FAIL: ' + msg); }
}

(async function run() {
  console.log('Chintu Local AI Provider test\n');

  // --- Sync status ----------------------------------------------------------
  console.log('Sync status:');
  const sync = provider.statusSync();
  ok(sync.ok === true, 'statusSync returns ok');
  ok(sync.cloud === false, 'no cloud provider by default');
  ok(sync.activeProvider === 'deterministic', 'deterministic brain is the active provider');
  const det = sync.providers.find((p) => p.id === 'deterministic');
  ok(det && det.available === true, 'deterministic provider is always available');

  // --- Async detect (real probe; optional providers likely down) -----------
  console.log('\nAsync detect:');
  const d = await provider.detect();
  ok(d.ok === true, 'detect returns ok');
  ok(d.cloud === false, 'detect reports no cloud');
  ok(Array.isArray(d.providers) && d.providers.length >= 3, 'detect lists all providers');
  ok(d.providers.find((p) => p.id === 'ollama') != null, 'ollama is listed');
  ok(d.providers.find((p) => p.id === 'openclaw') != null, 'openclaw is listed');
  ok(d.providers.every((p) => typeof p.available === 'boolean'), 'every provider has a boolean availability');

  // --- Probe never throws on a closed port ---------------------------------
  console.log('\nProbe safety:');
  const closed = await provider.probePort(1); // port 1 is essentially never open
  ok(closed === false, 'probe of a closed port resolves false (never throws)');

  // --- Probe detects a real local listener ---------------------------------
  console.log('\nLive probe:');
  const srv = net.createServer(() => {});
  await new Promise((res) => srv.listen(0, '127.0.0.1', res));
  const livePort = srv.address().port;
  try {
    const up = await provider.probePort(livePort);
    ok(up === true, 'probe detects a live local listener');
  } finally {
    srv.close();
  }

  console.log('');
  if (fails === 0) {
    console.log('Local AI provider: PASS');
    process.exit(0);
  } else {
    console.error('Local AI provider: FAIL (' + fails + ' issue(s))');
    process.exit(1);
  }
})().catch((e) => { console.error('FAIL: ' + (e && e.stack || e)); process.exit(1); });
