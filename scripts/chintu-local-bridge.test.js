#!/usr/bin/env node
'use strict';

// =============================================================================
// Chintu Local Bridge test — Stage 23
// Proves the bridge's safety contract. Read-only except for a transient
// loopback server it starts and stops itself. Makes no outbound network calls.
// (Excluded from the no-network-egress scan because it is a *.test.js file.)
// =============================================================================

const http = require('http');
const assert = require('assert');
const bridge = require('./chintu-local-bridge.js');

let fails = 0;
function ok(cond, msg) {
  if (cond) { console.log('  PASS: ' + msg); }
  else { fails++; console.error('  FAIL: ' + msg); }
}

function request(port, method, path, bodyObj, headers) {
  return new Promise((resolve, reject) => {
    const data = bodyObj ? JSON.stringify(bodyObj) : null;
    const req = http.request(
      { host: '127.0.0.1', port, method, path, headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}) },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          let json = null;
          try { json = raw ? JSON.parse(raw) : null; } catch (_) {}
          resolve({ status: res.statusCode, json, headers: res.headers });
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

(async function run() {
  console.log('Chintu Local Bridge test\n');

  // --- Static contract checks (no server needed) ---------------------------
  console.log('Action map contract:');
  const names = Object.keys(bridge.ACTIONS);
  ok(names.length > 0, 'action map is non-empty (' + names.length + ' actions)');

  const allowedBinaries = new Set(['git', process.execPath, 'node', 'powershell', 'pwsh', 'cmd', 'open', 'xdg-open']);
  let allBinariesSafe = true;
  let anyPush = false;
  let anyShellMeta = false;
  for (const name of names) {
    const { cmd, args } = bridge.ACTIONS[name].build();
    if (!allowedBinaries.has(cmd)) { allBinariesSafe = false; console.error('    unexpected binary for ' + name + ': ' + cmd); }
    const joined = [cmd].concat(args).join(' ');
    if (/\bpush\b/.test(joined)) anyPush = true;
    if (/[;&|`$><]/.test(args.join(' ').replace(/start ''/, ''))) anyShellMeta = true;
  }
  ok(allBinariesSafe, 'every action uses an allowlisted binary only');
  ok(!anyPush, 'no action runs a git push');
  ok(!anyShellMeta, 'no action argv contains shell metacharacters');

  // --- Secret redaction ----------------------------------------------------
  console.log('\nSecret redaction:');
  const fakeTg = bridge.redact('token 123456789:AAEjklmnopQRSTUvwxyz1234567890abcd done');
  ok(!/AAEjklmnopQRST/.test(fakeTg) && /REDACTED/.test(fakeTg), 'telegram-style token is redacted');
  const fakeGh = bridge.redact('ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789');
  ok(/REDACTED/.test(fakeGh) && !/ABCDEFGHIJKLMNOP/.test(fakeGh), 'github token is redacted');
  const fakeEnv = bridge.redact('CHINTU_TG_BOT_TOKEN=supersecretvalue');
  ok(/REDACTED/.test(fakeEnv) && !/supersecretvalue/.test(fakeEnv), 'secret env assignment is redacted');

  // --- Origin gate ---------------------------------------------------------
  console.log('\nOrigin gate:');
  ok(bridge.originAllowed(null), 'null origin (file://) allowed');
  ok(bridge.originAllowed('http://127.0.0.1:18791'), 'localhost origin allowed');
  ok(!bridge.originAllowed('https://evil.example.com'), 'cross-site origin rejected');

  // --- Live server checks --------------------------------------------------
  console.log('\nLive server:');
  const server = http.createServer(bridge.handler);
  await new Promise((res) => server.listen(0, '127.0.0.1', res));
  const port = server.address().port;
  ok(server.address().address === '127.0.0.1', 'server bound to 127.0.0.1 only');

  try {
    const health = await request(port, 'GET', '/api/health');
    ok(health.status === 200 && health.json && health.json.ok === true, 'health endpoint returns ok');

    const status = await request(port, 'GET', '/api/status');
    ok(status.status === 200 && Array.isArray(status.json.actions) && status.json.actions.length === names.length, 'status endpoint lists actions');

    const unknown = await request(port, 'POST', '/api/action', { action: 'definitely_not_real' });
    ok(unknown.status === 400 && unknown.json.ok === false, 'unknown action is rejected (400)');

    const injection = await request(port, 'POST', '/api/action', { action: 'status; rm -rf /' });
    ok(injection.status === 400 && injection.json.ok === false, 'command-injection string is rejected (not a valid key)');

    const rawCmd = await request(port, 'POST', '/api/action', { action: 'git status --short' });
    ok(rawCmd.status === 400, 'raw command string is rejected (only action names accepted)');

    const statusAction = await request(port, 'POST', '/api/action', { action: 'status' });
    ok(statusAction.status === 200 && statusAction.json.action === 'status' && typeof statusAction.json.stdout === 'string', 'status action runs and returns JSON result');
    ok(typeof statusAction.json.nextSuggestedAction === 'string', 'result includes a next suggested action');

    const crossSite = await request(port, 'POST', '/api/action', { action: 'status' }, { Origin: 'https://evil.example.com' });
    ok(crossSite.status === 403, 'cross-site origin is blocked at the request layer');

    // --- Stage 24: new action exists ---------------------------------------
    ok(Object.prototype.hasOwnProperty.call(bridge.ACTIONS, 'agent_orchestrator_dry_run'),
      'agent_orchestrator_dry_run action exists');

    // --- Stage 24: provider status -----------------------------------------
    const prov = await request(port, 'GET', '/api/providers/status');
    ok(prov.status === 200 && prov.json && prov.json.cloud === false, 'providers/status returns no-cloud status');
    ok(Array.isArray(prov.json.providers) && prov.json.providers.find((p) => p.id === 'deterministic'),
      'providers/status lists the deterministic brain');

    // --- Stage 24: chat (greeting runs no actions) -------------------------
    const chatHi = await request(port, 'POST', '/api/chat', { message: 'hi' });
    ok(chatHi.status === 200 && /chintu is live/i.test(chatHi.json.reply), 'chat "hi" returns the live greeting');
    ok(chatHi.json.intent === 'greeting' && chatHi.json.ranLive === false, 'chat "hi" runs no live actions');

    // --- Stage 24: chat with a real read action ----------------------------
    const chatGit = await request(port, 'POST', '/api/chat', { message: 'check git' });
    ok(chatGit.status === 200 && Array.isArray(chatGit.json.results) && chatGit.json.results.length >= 1,
      'chat "check git" runs git_status live and returns results');

    const seqGood = await request(port, 'POST', '/api/sequence', { sequence: 'chintu_health_check' });
    ok(seqGood.status === 200 && seqGood.json.sequence === 'chintu_health_check' &&
      Array.isArray(seqGood.json.results) && seqGood.json.results.length === bridge.SEQUENCES.chintu_health_check.steps.length,
      'named sequence runs and returns one result per allowlisted step');

    // --- Stage 24: emergency override never runs actions -------------------
    const chatEmg = await request(port, 'POST', '/api/chat', { message: 'I have chest pain' });
    ok(chatEmg.json.intent === 'health_emergency' && chatEmg.json.results.length === 0,
      'chat emergency phrase runs no actions and routes to care');

    // --- Stage 24: sequence accepts only named sequences -------------------
    const seqBad = await request(port, 'POST', '/api/sequence', { sequence: 'rm_everything' });
    ok(seqBad.status === 400 && seqBad.json.ok === false, 'unknown sequence is rejected (400)');

    const seqList = await request(port, 'POST', '/api/sequence', { sequence: ['git_status'] });
    ok(seqList.status === 400, 'an arbitrary list (not a named sequence) is rejected');
  } finally {
    server.close();
  }

  console.log('');
  if (fails === 0) {
    console.log('Local bridge: PASS');
    process.exit(0);
  } else {
    console.error('Local bridge: FAIL (' + fails + ' issue(s))');
    process.exit(1);
  }
})().catch((e) => { console.error('FAIL: ' + (e && e.stack || e)); process.exit(1); });
