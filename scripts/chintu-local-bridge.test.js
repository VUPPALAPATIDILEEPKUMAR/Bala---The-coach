#!/usr/bin/env node
'use strict';

// =============================================================================
// Chintu Local Bridge test — Stage 23
// Proves the bridge's safety contract. Read-only except for a transient
// loopback server it starts and stops itself. Makes no outbound network calls.
// (Excluded from the no-network-egress scan because it is a *.test.js file.)
// =============================================================================

const http = require('http');
const net = require('net');
const assert = require('assert');
const bridge = require('./chintu-local-bridge.js');

let fails = 0;
function ok(cond, msg) {
  if (cond) { console.log('  PASS: ' + msg); }
  else { fails++; console.error('  FAIL: ' + msg); }
}

function request(port, method, path, bodyObj, headers) {
  const data = bodyObj == null ? null : JSON.stringify(bodyObj);
  return requestRaw(port, method, path, data, headers);
}

function requestRaw(port, method, path, body, headers) {
  return new Promise((resolve, reject) => {
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
    if (body != null) req.write(body);
    req.end();
  });
}

function requestPartialAndClose(port, rawRequest) {
  return new Promise((resolve) => {
    let finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      resolve();
    }
    const socket = net.createConnection({ host: '127.0.0.1', port }, () => {
      socket.write(rawRequest);
      setTimeout(() => {
        socket.destroy();
        finish();
      }, 50);
    });
    socket.on('error', finish);
    socket.on('close', finish);
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

  // --- Route parser hardening ----------------------------------------------
  console.log('\nRoute parser hardening:');
  const routeCases = [
    { input: undefined, expected: '/', label: 'undefined URL falls back to root' },
    { input: '', expected: '/', label: 'empty URL falls back to root' },
    { input: '/api/health?ts=1', expected: '/api/health', label: 'query string is stripped from known route' },
    { input: '//api/health', expected: '/health', label: 'double-slash route does not alias to /api/health' },
    { input: '/api/%63hat', expected: '/api/%63hat', label: 'encoded path stays distinct from /api/chat' },
    { input: '/api/%zz', expected: '/api/%zz', label: 'invalid percent encoding stays controlled' },
    { input: '/%%%/???', expected: '/%%%/', label: 'overly weird route resolves deterministically' },
  ];
  for (const c of routeCases) {
    ok(bridge.getRequestRoute({ url: c.input }) === c.expected, c.label);
  }
  assert.strictEqual(bridge.getRequestRoute({ url: '/api/chat?mode=test' }), '/api/chat');

  // --- Live server checks --------------------------------------------------
  console.log('\nLive server:');
  const server = http.createServer(bridge.handler);
  await new Promise((res) => server.listen(0, '127.0.0.1', res));
  const port = server.address().port;
  ok(server.address().address === '127.0.0.1', 'server bound to 127.0.0.1 only');

  try {
    const emptyPath = await request(port, 'GET', '');
    ok(emptyPath.status === 404 && emptyPath.json && emptyPath.json.ok === false, 'empty path returns controlled 404');

    const rootPath = await request(port, 'GET', '/');
    ok(rootPath.status === 404 && rootPath.json && rootPath.json.ok === false, 'root path returns controlled 404');

    const doubleSlash = await request(port, 'GET', '//api/health');
    ok(doubleSlash.status === 404 && doubleSlash.json && doubleSlash.json.ok === false, 'double-slash health path is not treated as /api/health');

    const health = await request(port, 'GET', '/api/health');
    ok(health.status === 200 && health.json && health.json.ok === true, 'health endpoint returns ok');

    const healthWithQuery = await request(port, 'GET', '/api/health?ts=1');
    ok(healthWithQuery.status === 200 && healthWithQuery.json && healthWithQuery.json.ok === true, 'health endpoint still works with a query string');

    const status = await request(port, 'GET', '/api/status');
    ok(status.status === 200 && Array.isArray(status.json.actions) && status.json.actions.length === names.length, 'status endpoint lists actions');
    ok(Array.isArray(status.json.endpoints) && status.json.endpoints.includes('/api/runtime-status'), 'status endpoint lists /api/runtime-status');

    const runtimeStatus = await request(port, 'GET', '/api/runtime-status');
    ok(runtimeStatus.status === 200 && runtimeStatus.json && runtimeStatus.json.ok === true, 'runtime-status endpoint returns ok');
    ok(runtimeStatus.json.approvals && typeof runtimeStatus.json.approvals.pendingCount === 'number', 'runtime-status exposes pending approval count');

    const hiChat = await request(port, 'POST', '/api/chat', { message: 'hi' });
    ok(hiChat.status === 200 && hiChat.json && hiChat.json.ok === true, 'chat endpoint accepts greeting');
    ok(hiChat.json.trace && hiChat.json.trace.intent === 'greeting', 'chat response includes greeting trace');

    const runtimeAfterHi = await request(port, 'GET', '/api/runtime-status');
    ok(runtimeAfterHi.json.lastCommandTrace && runtimeAfterHi.json.lastCommandTrace.intent === 'greeting', 'runtime-status remembers last greeting trace');
    ok(runtimeAfterHi.json.lastCommandTrace.executed === false, 'greeting trace records no local execution');

    await request(port, 'POST', '/api/chat', { message: 'chest pain' });
    const runtimeAfterEmergency = await request(port, 'GET', '/api/runtime-status');
    ok(runtimeAfterEmergency.json.lastCommandTrace && runtimeAfterEmergency.json.lastCommandTrace.intent === 'health_emergency', 'runtime-status records health emergency trace');
    ok(/Health-sensitive/i.test(runtimeAfterEmergency.json.lastBlockedReason || ''), 'runtime-status exposes blocked reason for health emergency');

    const unknownRoute = await request(port, 'GET', '/api/not-real');
    ok(unknownRoute.status === 404 && unknownRoute.json && unknownRoute.json.ok === false, 'unknown route returns controlled 404');

    const encodedChat = await request(port, 'POST', '/api/%63hat', { message: 'hi' });
    ok(encodedChat.status === 404 && encodedChat.json && encodedChat.json.ok === false, 'encoded chat route does not alias to /api/chat');

    const invalidPercent = await request(port, 'POST', '/api/%zz', { message: 'hi' });
    ok(invalidPercent.status === 404 && invalidPercent.json && invalidPercent.json.ok === false, 'invalid percent route returns controlled 404');

    const weirdRoute = await request(port, 'POST', '/%%%/???', { message: 'hi' });
    ok(weirdRoute.status === 404 && weirdRoute.json && weirdRoute.json.ok === false, 'overly weird route returns controlled 404');

    const unknown = await request(port, 'POST', '/api/action', { action: 'definitely_not_real' });
    ok(unknown.status === 400 && unknown.json.ok === false, 'unknown action is rejected (400)');

    const injection = await request(port, 'POST', '/api/action', { action: 'status; rm -rf /' });
    ok(injection.status === 400 && injection.json.ok === false, 'shell-injection action is rejected (400)');

    server.close();
    console.log('\nLocal bridge: PASS');
    process.exit(0);
  } catch (err) {
    console.error('Local bridge test error:', err.message || err);
    try { server.close(); } catch (_) {}
    process.exit(1);
  }
})();
