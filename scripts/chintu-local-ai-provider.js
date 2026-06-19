#!/usr/bin/env node
'use strict';

// =============================================================================
// Chintu Local AI Provider layer — Stage 24
// -----------------------------------------------------------------------------
// Reasoning in Chintu is DETERMINISTIC by default (the brain router). This layer
// only *detects* whether optional local model providers are available, so the
// Allegro UI can show their status. It never changes how Chintu reasons in this
// stage, and it NEVER sends anything off-box.
//
// Provider order (preference, for a future opt-in stage):
//   1. deterministic brain router            — always active
//   2. Ollama          — only if running on 127.0.0.1:11434
//   3. OpenClaw gateway — only if running on 127.0.0.1:18789
//   4. no cloud provider, ever, by default
//
// Hard properties (see scripts/chintu-local-ai-provider.test.js):
//   * Detection is a LOCAL LOOPBACK TCP probe only (net module, 127.0.0.1).
//     No HTTP client, no fetch, no payload is sent — we open a socket, see if
//     the port accepts, and immediately close it. This is not network egress.
//   * Never throws. Any error/timeout => that provider is "unavailable".
//   * No API keys required or read. No secrets printed. No BALA health data
//     is ever sent to any provider.
//   * Synchronous status (no probe) is also available for fast UI paint.
// =============================================================================

const net = require('net');

const LOOPBACK = '127.0.0.1';
const PROBE_TIMEOUT_MS = 300;

const PROVIDERS = [
  { id: 'deterministic', label: 'Deterministic brain router', kind: 'builtin', port: null },
  { id: 'ollama', label: 'Ollama (local model)', kind: 'local-model', port: 11434 },
  { id: 'openclaw', label: 'OpenClaw gateway', kind: 'local-gateway', port: 18789 },
];

// Probe a single local TCP port. Resolves true if something is listening on
// 127.0.0.1:<port>, false otherwise. Never rejects. Sends no data.
function probePort(port) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (val) => {
      if (done) return;
      done = true;
      try { socket.destroy(); } catch (_) {}
      resolve(val);
    };
    const socket = new net.Socket();
    socket.setTimeout(PROBE_TIMEOUT_MS);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    try {
      socket.connect(port, LOOPBACK);
    } catch (_) {
      finish(false);
    }
  });
}

// Full async provider status. The deterministic brain is always active; the
// two optional local providers are probed in parallel.
async function detect() {
  const results = [];
  const probes = PROVIDERS.map(async (p) => {
    if (p.kind === 'builtin') {
      return { id: p.id, label: p.label, kind: p.kind, available: true, detail: 'always active' };
    }
    const available = await probePort(p.port).catch(() => false);
    return {
      id: p.id,
      label: p.label,
      kind: p.kind,
      port: p.port,
      available,
      detail: available ? 'reachable on ' + LOOPBACK + ':' + p.port : 'not detected on ' + LOOPBACK + ':' + p.port,
    };
  });
  const settled = await Promise.all(probes);
  for (const r of settled) results.push(r);

  return {
    ok: true,
    activeProvider: 'deterministic',
    reasoning: 'deterministic',
    cloud: false,
    note: 'Reasoning is deterministic. Optional local providers are detected for status only; no data leaves this machine.',
    providers: results,
    time: new Date().toISOString(),
  };
}

// Synchronous status without any probe — for instant UI paint before detect()
// resolves. Optional providers are reported as "unknown" until probed.
function statusSync() {
  return {
    ok: true,
    activeProvider: 'deterministic',
    cloud: false,
    providers: PROVIDERS.map((p) => ({
      id: p.id,
      label: p.label,
      kind: p.kind,
      port: p.port || null,
      available: p.kind === 'builtin' ? true : null, // null => not yet probed
    })),
    time: new Date().toISOString(),
  };
}

async function cli() {
  const out = await detect();
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
}

module.exports = { detect, statusSync, probePort, PROVIDERS, LOOPBACK };

if (require.main === module) {
  cli();
}
