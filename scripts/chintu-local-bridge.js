#!/usr/bin/env node
'use strict';

// =============================================================================
// Chintu Local Bridge Runtime — Stage 23
// -----------------------------------------------------------------------------
// A localhost-only HTTP bridge that lets the Chintu Allegro UI (opened in a
// browser) trigger a FIXED, allowlisted set of safe local commands. The browser
// NEVER sends a command string. It sends only an action NAME. The bridge looks
// that name up in a hard-coded action map and runs the pre-defined argv for it.
// There is no shell interpolation and no path the caller can use to inject one.
//
// Hard safety properties (see scripts/chintu-local-bridge.test.js):
//   * Binds to 127.0.0.1 only. Never 0.0.0.0. Not reachable off-box.
//   * Only allowlisted action names run. Unknown actions are rejected (400).
//   * Commands are spawned with shell:false and a fixed argv array.
//   * No git push. No real connector send. No secret printing.
//   * Token-shaped strings + known secret env names are redacted from output.
//   * Cross-site browsers are rejected (Origin gate) — only local UI may call.
//   * Every request is written to CHINTU_OUTBOX/local_bridge_audit.jsonl.
//
// NOTE for the no-network-egress integrity test: this file is intentionally
// allowlisted there because it requires the `http` module to bind a LOCAL
// loopback server. It makes no outbound network calls of its own.
// =============================================================================

const http = require('http');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Stage 24 brain + provider layers. These are pure-local modules (no network).
const brain = require('./chintu-brain-router.js');
const aiProvider = require('./chintu-local-ai-provider.js');

const repoRoot = path.resolve(__dirname, '..');
const outboxDir = path.join(repoRoot, 'CHINTU_OUTBOX');
const auditPath = path.join(outboxDir, 'local_bridge_audit.jsonl');

const HOST = '127.0.0.1';
const DEFAULT_PORT = 18791;
const COMMAND_TIMEOUT_MS = 120000;
const MAX_OUTPUT_CHARS = 16000;

const isWin = process.platform === 'win32';
const PS = isWin ? 'powershell' : 'pwsh';

// PowerShell argv builder (kept identical across actions).
function psArgs(relScript, extra) {
  return ['-ExecutionPolicy', 'Bypass', '-File', relScript].concat(extra || []);
}

// Open a fixed, known-safe local file or known app URL in the default browser.
// Targets are constants below — never caller-supplied.
function openTarget(target) {
  if (isWin) return { cmd: 'cmd', args: ['/c', 'start', '', target] };
  if (process.platform === 'darwin') return { cmd: 'open', args: [target] };
  return { cmd: 'xdg-open', args: [target] };
}

const BALA_PUBLIC_URL = 'https://vuppalapatidileepkumar.github.io/Bala---The-coach/';

// -----------------------------------------------------------------------------
// ACTION MAP — the ONLY commands this bridge will ever run.
// Each entry: { label, build() -> {cmd,args}, track, kind }
// kind: 'read' (safe local read) | 'generate' | 'guard' | 'open'
// -----------------------------------------------------------------------------
const ACTIONS = {
  status: {
    label: 'git status --short',
    kind: 'read',
    build: () => ({ cmd: 'git', args: ['status', '--short'] }),
    next: 'git_log',
  },
  git_status: {
    label: 'git status --short',
    kind: 'read',
    build: () => ({ cmd: 'git', args: ['status', '--short'] }),
    next: 'git_log',
  },
  git_log: {
    label: 'git log --oneline -5',
    kind: 'read',
    build: () => ({ cmd: 'git', args: ['log', '--oneline', '-5'] }),
    next: 'status',
  },
  release_guard: {
    label: 'powershell scripts\\chintu-release-guard.ps1',
    kind: 'guard',
    build: () => ({ cmd: PS, args: psArgs('scripts\\chintu-release-guard.ps1') }),
    next: 'git_status',
  },
  validate_app: {
    label: 'powershell scripts\\chintu-validate.ps1',
    kind: 'guard',
    build: () => ({ cmd: PS, args: psArgs('scripts\\chintu-validate.ps1') }),
    next: 'release_guard',
  },
  run_validator_dry_run: {
    label: 'powershell scripts\\chintu-agent-runner.ps1 -Agent "validator-agent" -DryRun',
    kind: 'guard',
    build: () => ({ cmd: PS, args: psArgs('scripts\\chintu-agent-runner.ps1', ['-Agent', 'validator-agent', '-DryRun']) }),
    next: 'validate_app',
  },
  connector_readiness: {
    label: 'node scripts/chintu-connector-send.js --readiness',
    kind: 'read',
    build: () => ({ cmd: process.execPath, args: ['scripts/chintu-connector-send.js', '--readiness'] }),
    next: 'connector_status',
  },
  connector_status: {
    label: 'node scripts/chintu-connector-send.js --status',
    kind: 'read',
    build: () => ({ cmd: process.execPath, args: ['scripts/chintu-connector-send.js', '--status'] }),
    next: 'connector_readiness',
  },
  prompt_xml_bala: {
    label: 'node scripts/chintu-prompt-engine.js --framework xml --track bala',
    kind: 'generate',
    build: () => ({ cmd: process.execPath, args: ['scripts/chintu-prompt-engine.js', '--framework', 'xml', '--track', 'bala', '--task', 'Build next BALA sprint'] }),
    next: 'action_packet_bala_sprint',
  },
  prompt_xml_chintu: {
    label: 'node scripts/chintu-prompt-engine.js --framework xml --track chintu',
    kind: 'generate',
    build: () => ({ cmd: process.execPath, args: ['scripts/chintu-prompt-engine.js', '--framework', 'xml', '--track', 'chintu', '--task', 'Advance Chintu OS safely'] }),
    next: 'status',
  },
  prompt_costar_both: {
    label: 'node scripts/chintu-prompt-engine.js --framework costar --track both',
    kind: 'generate',
    build: () => ({ cmd: process.execPath, args: ['scripts/chintu-prompt-engine.js', '--framework', 'costar', '--track', 'both', '--task', 'Plan next safe stage'] }),
    next: 'status',
  },
  prompt_acr_both: {
    label: 'node scripts/chintu-prompt-engine.js --framework acr --track both',
    kind: 'generate',
    build: () => ({ cmd: process.execPath, args: ['scripts/chintu-prompt-engine.js', '--framework', 'acr', '--track', 'both', '--task', 'Plan next safe stage'] }),
    next: 'status',
  },
  action_packet_bala_sprint: {
    label: 'node scripts/chintu-action-packet.js --template bala-sprint',
    kind: 'generate',
    build: () => ({ cmd: process.execPath, args: ['scripts/chintu-action-packet.js', '--template', 'bala-sprint'] }),
    next: 'prompt_xml_bala',
  },
  action_packet_connector_check: {
    label: 'node scripts/chintu-action-packet.js --template connector-readiness',
    kind: 'generate',
    build: () => ({ cmd: process.execPath, args: ['scripts/chintu-action-packet.js', '--template', 'connector-readiness'] }),
    next: 'connector_readiness',
  },
  agent_orchestrator_dry_run: {
    label: 'node scripts/chintu-agent-orchestrator.js',
    kind: 'generate',
    build: () => ({ cmd: process.execPath, args: ['scripts/chintu-agent-orchestrator.js'] }),
    next: 'release_guard',
  },
  open_allegro: {
    label: 'open CHINTU_ALLEGRO.html',
    kind: 'open',
    build: () => openTarget(path.join(repoRoot, 'CHINTU_ALLEGRO.html')),
    next: 'status',
  },
  open_bala_local: {
    label: 'open index.html',
    kind: 'open',
    build: () => openTarget(path.join(repoRoot, 'index.html')),
    next: 'validate_app',
  },
  open_bala_public: {
    label: 'open BALA public link',
    kind: 'open',
    build: () => openTarget(BALA_PUBLIC_URL),
    next: 'status',
  },
};

// -----------------------------------------------------------------------------
// NAMED SEQUENCES — the ONLY multi-action runs this bridge will perform.
// The caller may NOT supply an arbitrary list of actions; it may only ask for
// one of these names. Each step is itself an allowlisted action above.
//   continueOnFail: if false, the sequence stops at the first failing step.
// -----------------------------------------------------------------------------
const SEQUENCES = {
  check_everything: {
    label: 'Full safe sweep',
    steps: ['git_status', 'validate_app', 'connector_readiness', 'release_guard'],
    continueOnFail: true,
  },
  bala_health_check: {
    label: 'BALA health check',
    steps: ['validate_app', 'release_guard'],
    continueOnFail: true,
  },
  chintu_health_check: {
    label: 'Chintu health check',
    steps: ['git_status', 'connector_status', 'connector_readiness'],
    continueOnFail: true,
  },
  next_sprint: {
    label: 'Next BALA sprint',
    steps: ['action_packet_bala_sprint', 'prompt_xml_bala'],
    continueOnFail: true,
  },
};

// -----------------------------------------------------------------------------
// Secret redaction — defence in depth. We never run a command that prints env,
// but we still scrub anything token-shaped before it reaches the UI or the log.
// -----------------------------------------------------------------------------
const SECRET_ENV_NAMES = [
  'CHINTU_TG_BOT_TOKEN', 'CHINTU_TG_CHAT_ID', 'CHINTU_TG_TARGET', 'CHINTU_TG_ALLOWLIST',
  'CHINTU_CONNECTOR_APPROVAL_PHRASE', 'GH_TOKEN', 'GITHUB_TOKEN', 'DISCORD_WEBHOOK',
];
function redact(text) {
  if (!text) return '';
  let out = String(text);
  // Telegram bot tokens: digits:base64-ish
  out = out.replace(/\b\d{6,}:[A-Za-z0-9_-]{20,}\b/g, '[REDACTED_TOKEN]');
  // GitHub tokens
  out = out.replace(/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, '[REDACTED_TOKEN]');
  out = out.replace(/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, '[REDACTED_TOKEN]');
  // "NAME=value" for any known secret env name
  for (const name of SECRET_ENV_NAMES) {
    const re = new RegExp('(' + name + ')\\s*[=:]\\s*\\S+', 'g');
    out = out.replace(re, '$1=[REDACTED]');
  }
  return out;
}

function clamp(text) {
  const t = redact(text);
  if (t.length <= MAX_OUTPUT_CHARS) return t;
  return t.slice(0, MAX_OUTPUT_CHARS) + '\n…[truncated ' + (t.length - MAX_OUTPUT_CHARS) + ' chars]';
}

function summarize(text, n) {
  const t = redact(text).replace(/\s+/g, ' ').trim();
  return t.length <= n ? t : t.slice(0, n) + '…';
}

// -----------------------------------------------------------------------------
// Audit log
// -----------------------------------------------------------------------------
function audit(entry) {
  try {
    if (!fs.existsSync(outboxDir)) fs.mkdirSync(outboxDir, { recursive: true });
    fs.appendFileSync(auditPath, JSON.stringify(entry) + '\n');
  } catch (_) { /* never throw from audit */ }
}

// -----------------------------------------------------------------------------
// Run an allowlisted action. `name` MUST already be a key of ACTIONS.
// -----------------------------------------------------------------------------
function runAction(name) {
  const spec = ACTIONS[name];
  const { cmd, args } = spec.build();
  const started = Date.now();
  let res;
  try {
    res = spawnSync(cmd, args, {
      cwd: repoRoot,
      timeout: COMMAND_TIMEOUT_MS,
      maxBuffer: 8 * 1024 * 1024,
      shell: false,
      encoding: 'utf8',
      windowsHide: true,
    });
  } catch (e) {
    res = { status: -1, stdout: '', stderr: String(e && e.message) };
  }
  const durationMs = Date.now() - started;
  const exitCode = res.status == null ? -1 : res.status;
  const stdout = clamp(res.stdout || '');
  const stderr = clamp(res.stderr || (res.error ? String(res.error.message) : ''));
  const ok = exitCode === 0 && !res.error;

  audit({
    timestamp: new Date().toISOString(),
    action: name,
    allowed: true,
    label: spec.label,
    exitCode,
    durationMs,
    outputSummary: summarize(stdout, 200),
    errorSummary: summarize(stderr, 200),
  });

  return {
    ok,
    action: name,
    label: spec.label,
    command: spec.label,
    exitCode,
    stdout,
    stderr,
    durationMs,
    nextSuggestedAction: spec.next || null,
  };
}

// -----------------------------------------------------------------------------
// Run a NAMED sequence (not an arbitrary list). Each step is an allowlisted
// action. Stops early if a step fails and the sequence is not continueOnFail.
// -----------------------------------------------------------------------------
function runSequence(name) {
  const seq = SEQUENCES[name];
  const results = [];
  let stopped = false;
  for (const step of seq.steps) {
    if (!Object.prototype.hasOwnProperty.call(ACTIONS, step)) {
      results.push({ ok: false, action: step, exitCode: -1, stderr: 'step not allowlisted', stdout: '' });
      stopped = true;
      break;
    }
    const r = runAction(step);
    results.push(r);
    if (!r.ok && !seq.continueOnFail) { stopped = true; break; }
  }
  const allOk = results.length > 0 && results.every((r) => r.ok);
  audit({
    timestamp: new Date().toISOString(),
    action: 'sequence:' + name,
    allowed: true,
    label: seq.label,
    exitCode: allOk ? 0 : 1,
    durationMs: results.reduce((a, r) => a + (r.durationMs || 0), 0),
    outputSummary: results.map((r) => r.action + '=' + (r.ok ? 'ok' : 'exit' + r.exitCode)).join(', ').slice(0, 200),
    errorSummary: stopped ? 'stopped early' : '',
  });
  return { ok: allOk, sequence: name, label: seq.label, stopped, steps: seq.steps.slice(), results };
}

// -----------------------------------------------------------------------------
// /api/chat — the alive layer. Route the message through the deterministic brain
// router, then (if the decision is safe) execute the actions/sequence it named
// using the SAME allowlisted runner. Never executes anything the router invents.
// -----------------------------------------------------------------------------
function handleChat(message) {
  const decision = brain.route(message);
  const results = [];

  // Only ever run actions that are real allowlisted keys. The brain already
  // filters, but we re-validate here — the bridge is the trust boundary.
  if (decision.sequence && SEQUENCES[decision.sequence]) {
    const seqRun = runSequence(decision.sequence);
    for (const r of seqRun.results) results.push(r);
  } else if (Array.isArray(decision.actions)) {
    for (const a of decision.actions) {
      if (Object.prototype.hasOwnProperty.call(ACTIONS, a)) {
        results.push(runAction(a));
      }
    }
  }

  return {
    ok: true,
    reply: decision.reply,
    intent: decision.intent,
    track: decision.track,
    risk: decision.risk,
    responseType: decision.responseType,
    sequence: decision.sequence || null,
    actions: decision.actions,
    filesLikely: decision.filesLikely,
    safetyGates: decision.safetyGates,
    results,
    ranLive: results.length > 0,
    nextSuggestedAction: decision.nextSuggestedAction,
    time: new Date().toISOString(),
  };
}

// -----------------------------------------------------------------------------
// HTTP plumbing
// -----------------------------------------------------------------------------
function originAllowed(origin) {
  // file:// pages send Origin: null. Same-machine UI is what we want.
  if (!origin || origin === 'null') return true;
  return /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(origin) || origin.startsWith('file:');
}

function sendJson(req, res, code, obj) {
  const origin = req.headers.origin;
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': origin && originAllowed(origin) ? origin : 'null',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(body);
}

function statusPayload() {
  return {
    ok: true,
    service: 'chintu-local-bridge',
    version: 1,
    host: HOST,
    port: ACTIVE_PORT,
    platform: process.platform,
    powershell: isWin,
    actions: Object.keys(ACTIONS),
    actionCount: Object.keys(ACTIONS).length,
    sequences: Object.keys(SEQUENCES),
    endpoints: ['/api/health', '/api/status', '/api/providers/status', '/api/action', '/api/chat', '/api/sequence'],
    brain: 'deterministic',
    time: new Date().toISOString(),
  };
}

let ACTIVE_PORT = DEFAULT_PORT;

function getRequestRoute(req) {
  try {
    return new URL(req.url || '/', 'http://' + HOST).pathname;
  } catch (_) {
    return '/';
  }
}

function handler(req, res) {
  const origin = req.headers.origin;
  if (req.method === 'OPTIONS') return sendJson(req, res, 204, {});

  if (!originAllowed(origin)) {
    audit({ timestamp: new Date().toISOString(), action: '(blocked-origin)', allowed: false, label: String(origin), exitCode: -1, durationMs: 0, outputSummary: '', errorSummary: 'cross-site origin rejected' });
    return sendJson(req, res, 403, { ok: false, error: 'Origin not allowed. The bridge only serves the local Chintu Allegro UI.' });
  }

  const route = getRequestRoute(req);

  if (req.method === 'GET' && route === '/api/health') {
    return sendJson(req, res, 200, { ok: true, status: 'alive', service: 'chintu-local-bridge', port: ACTIVE_PORT, time: new Date().toISOString() });
  }

  if (req.method === 'GET' && route === '/api/status') {
    return sendJson(req, res, 200, statusPayload());
  }

  if (req.method === 'GET' && route === '/api/providers/status') {
    // Deterministic brain is always active; optional local providers are probed.
    aiProvider.detect()
      .then((p) => sendJson(req, res, 200, p))
      .catch(() => sendJson(req, res, 200, aiProvider.statusSync()));
    return;
  }

  if ((req.method === 'POST') && (route === '/api/chat' || route === '/api/sequence')) {
    let raw = '';
    let tooBig = false;
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 8192) { tooBig = true; req.destroy(); }
    });
    req.on('end', () => {
      if (tooBig) return sendJson(req, res, 413, { ok: false, error: 'Request body too large.' });
      let body;
      try { body = raw ? JSON.parse(raw) : {}; }
      catch (_) { return sendJson(req, res, 400, { ok: false, error: 'Invalid JSON body.' }); }

      if (route === '/api/chat') {
        const message = body && typeof body.message === 'string' ? body.message.slice(0, 2000) : '';
        return sendJson(req, res, 200, handleChat(message));
      }

      // /api/sequence — only a NAMED sequence is accepted, never a list.
      const name = body && typeof body.sequence === 'string' ? body.sequence.trim() : '';
      if (!Object.prototype.hasOwnProperty.call(SEQUENCES, name)) {
        return sendJson(req, res, 400, {
          ok: false,
          error: 'Sequence not allowlisted. Only named sequences run.',
          allowedSequences: Object.keys(SEQUENCES),
        });
      }
      return sendJson(req, res, 200, runSequence(name));
    });
    return;
  }

  if (req.method === 'POST' && route === '/api/action') {
    let raw = '';
    let tooBig = false;
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 8192) { tooBig = true; req.destroy(); }
    });
    req.on('end', () => {
      if (tooBig) return sendJson(req, res, 413, { ok: false, error: 'Request body too large.' });
      let body;
      try { body = raw ? JSON.parse(raw) : {}; }
      catch (_) { return sendJson(req, res, 400, { ok: false, error: 'Invalid JSON body.' }); }

      const name = body && typeof body.action === 'string' ? body.action.trim() : '';

      // The ONLY thing we accept is an exact key of the action map.
      if (!Object.prototype.hasOwnProperty.call(ACTIONS, name)) {
        audit({ timestamp: new Date().toISOString(), action: name || '(empty)', allowed: false, label: 'rejected: not allowlisted', exitCode: -1, durationMs: 0, outputSummary: '', errorSummary: 'unknown or unsafe action' });
        return sendJson(req, res, 400, {
          ok: false,
          action: name,
          error: 'Action not allowlisted. The bridge only runs a fixed safe set.',
          allowedActions: Object.keys(ACTIONS),
        });
      }

      const result = runAction(name);
      return sendJson(req, res, 200, result);
    });
    return;
  }

  return sendJson(req, res, 404, { ok: false, error: 'Not found.' });
}

// -----------------------------------------------------------------------------
// Startup with port fallback (DEFAULT_PORT, then a few above it).
// -----------------------------------------------------------------------------
function start(port, attemptsLeft, cb) {
  const server = http.createServer(handler);
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && attemptsLeft > 0) {
      start(port + 1, attemptsLeft - 1, cb);
    } else {
      console.error('Bridge failed to start:', err.message);
      process.exit(1);
    }
  });
  server.listen(port, HOST, () => {
    ACTIVE_PORT = port;
    cb(server, port);
  });
  return server;
}

function main() {
  if (!fs.existsSync(outboxDir)) {
    try { fs.mkdirSync(outboxDir, { recursive: true }); } catch (_) {}
  }
  start(DEFAULT_PORT, 5, (server, port) => {
    audit({ timestamp: new Date().toISOString(), action: '(start)', allowed: true, label: 'bridge listening on ' + HOST + ':' + port, exitCode: 0, durationMs: 0, outputSummary: '', errorSummary: '' });
    console.log('Chintu Local Bridge running at http://' + HOST + ':' + port);
    console.log('  Health   : http://' + HOST + ':' + port + '/api/health');
    console.log('  Status   : http://' + HOST + ':' + port + '/api/status');
    console.log('  Providers: http://' + HOST + ':' + port + '/api/providers/status');
    console.log('  Chat     : POST /api/chat   { "message": "check everything" }');
    console.log('  Sequence : POST /api/sequence { "sequence": "check_everything" }');
    console.log('  Actions  : ' + Object.keys(ACTIONS).length + ' allowlisted · Sequences: ' + Object.keys(SEQUENCES).length);
    console.log('  Audit    : CHINTU_OUTBOX/local_bridge_audit.jsonl');
    console.log('Press Ctrl+C to stop.');
  });
}

// Export internals for the test harness; only auto-start when run directly.
module.exports = { ACTIONS, SEQUENCES, redact, originAllowed, runAction, runSequence, handleChat, statusPayload, HOST, DEFAULT_PORT, handler, start, getRequestRoute };

if (require.main === module) {
  main();
}
