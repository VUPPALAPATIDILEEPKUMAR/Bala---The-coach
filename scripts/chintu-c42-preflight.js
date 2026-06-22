#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const net = require('net');

const repoRoot = path.resolve(__dirname, '..');
const outboxDir = path.join(repoRoot, 'CHINTU_OUTBOX');
const telegramAuditPath = path.join(outboxDir, 'telegram_connector_audit.jsonl');
const gitignorePath = path.join(repoRoot, '.gitignore');

const BRIDGE_HOST = '127.0.0.1';
const BRIDGE_PORT = 18791;
const RUNTIME_HOST = 'localhost';
const RUNTIME_PORT = 18791;

const READINESS_STATES = [
  'TOKEN_MISSING',
  'READY_FOR_IDENTITY_CHECK',
  'READY_FOR_ID_DISCOVERY',
  'READY_FOR_DRY_RUN',
  'READY_FOR_EXECUTE_LOCAL_PROOF',
  'LIVE_PROOF_UNCONFIRMED',
];

function parseArgs(argv) {
  const flags = new Set(argv);
  return {
    status: flags.has('--status'),
    json: flags.has('--json'),
    help: flags.has('--help') || flags.has('-h'),
  };
}

function csvConfigured(envValue) {
  return String(envValue || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean).length > 0;
}

function isSendEnabled(env) {
  return String(env.CHINTU_TELEGRAM_SEND_ENABLED || '').trim() === '1';
}

function safeReadJsonl(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  return fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch (_) {
        return null;
      }
    })
    .filter(Boolean);
}

function getRequiredFilesStatus(deps) {
  const required = [
    'scripts/chintu-telegram-runner.js',
    'scripts/chintu-local-bridge.js',
    'scripts/chintu-release-guard.ps1',
  ];
  const missing = required.filter((relativePath) => !deps.exists(path.join(repoRoot, relativePath)));
  return {
    ok: missing.length === 0,
    missing,
  };
}

function gitignoreHasAuditPath(deps) {
  if (!deps.exists(gitignorePath)) {
    return false;
  }
  const text = deps.readText(gitignorePath);
  return /CHINTU_OUTBOX\/telegram_connector_audit\.jsonl/i.test(text);
}

function sanitizeEvidenceLabel(label) {
  return String(label || '').replace(/\s+/g, ' ').trim();
}

function deriveEvidence(entries) {
  let tokenIdentityVerified = false;
  let dryRunSeen = false;
  let executeLocalSeen = false;
  const safeEvidence = [];

  for (const entry of entries) {
    if (!tokenIdentityVerified && entry.mode === 'token-check' && entry.ok === true) {
      tokenIdentityVerified = true;
      safeEvidence.push('Local audit shows a successful token identity check.');
    }

    if (!dryRunSeen && (
      (entry.sourceMode === 'poll-once' && entry.executeLocalPerformed !== true) ||
      (entry.traceVersion === '1' && entry.source === 'telegram' && entry.executed !== true)
    )) {
      dryRunSeen = true;
      safeEvidence.push('Local audit shows a Telegram poll-once dry run.');
    }

    if (!executeLocalSeen && (
      entry.executeLocalPerformed === true ||
      (entry.traceVersion === '1' && entry.source === 'telegram' && entry.executed === true)
    )) {
      executeLocalSeen = true;
      safeEvidence.push('Local audit shows a Telegram command reaching the local runtime.');
    }
  }

  return {
    tokenIdentityVerified,
    dryRunSeen,
    executeLocalSeen,
    safeEvidence: safeEvidence.map(sanitizeEvidenceLabel),
  };
}

function assertLocalHost(host) {
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error('Only localhost bridge probes are allowed.');
  }
}

function parseHttpJsonResponse(raw) {
  const headerEnd = raw.indexOf('\r\n\r\n');
  if (headerEnd === -1) {
    return { ok: false, statusCode: 0, json: null, error: 'Incomplete HTTP response.' };
  }

  const headerText = raw.slice(0, headerEnd);
  const body = raw.slice(headerEnd + 4);
  const statusLine = headerText.split('\r\n')[0] || '';
  const match = statusLine.match(/^HTTP\/1\.[01]\s+(\d{3})/i);
  const statusCode = match ? Number(match[1]) : 0;

  try {
    return {
      ok: statusCode >= 200 && statusCode < 300,
      statusCode,
      json: body ? JSON.parse(body) : null,
      error: null,
    };
  } catch (_) {
    return {
      ok: false,
      statusCode,
      json: null,
      error: 'Non-JSON localhost response.',
    };
  }
}

function probeLocalJson(host, port, route, timeoutMs) {
  assertLocalHost(host);
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const chunks = [];
    let settled = false;

    function finish(result) {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      resolve(result);
    }

    socket.setTimeout(timeoutMs || 1200);
    socket.on('connect', () => {
      socket.write(
        'GET ' + route + ' HTTP/1.1\r\n' +
        'Host: ' + host + '\r\n' +
        'Connection: close\r\n\r\n'
      );
    });
    socket.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    socket.on('timeout', () => finish({
      ok: false,
      statusCode: 0,
      json: null,
      error: 'Localhost probe timed out.',
    }));
    socket.on('error', (error) => finish({
      ok: false,
      statusCode: 0,
      json: null,
      error: error && error.message ? error.message : 'Localhost probe failed.',
    }));
    socket.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      finish(parseHttpJsonResponse(raw));
    });
  });
}

async function defaultBridgeProbe() {
  return probeLocalJson(BRIDGE_HOST, BRIDGE_PORT, '/api/health', 1200);
}

async function defaultRuntimeProbe() {
  return probeLocalJson(RUNTIME_HOST, RUNTIME_PORT, '/api/runtime-status', 1200);
}

function buildBlockers(snapshot) {
  const blockers = [];

  if (!snapshot.tokenConfigured) {
    blockers.push('TELEGRAM_BOT_TOKEN is not configured in the local shell.');
  }
  if (!snapshot.allowlistConfigured) {
    blockers.push('Telegram allowlist env vars are not configured yet.');
  }
  if (!snapshot.requiredRunnerFiles.ok) {
    blockers.push('Required Chintu runner files are missing.');
  }
  if (!snapshot.auditPathIgnored) {
    blockers.push('Telegram audit path is not ignored by Git.');
  }
  if (!snapshot.bridgeStatus.reachable) {
    blockers.push('Local bridge is not reachable on 127.0.0.1:18791.');
  }
  if (!snapshot.runtimeStatusReachable) {
    blockers.push('/api/runtime-status is not reachable on localhost.');
  }
  if (snapshot.sendEnabled) {
    blockers.push('Telegram send gate is enabled; keep it disabled for live-proof preflight.');
  }

  return blockers;
}

function determineReadinessState(snapshot) {
  if (!snapshot.tokenConfigured) {
    return 'TOKEN_MISSING';
  }
  if (!snapshot.identityVerified) {
    return 'READY_FOR_IDENTITY_CHECK';
  }
  if (!snapshot.allowlistConfigured) {
    return 'READY_FOR_ID_DISCOVERY';
  }
  if (!snapshot.dryRunEvidenceSeen) {
    return 'READY_FOR_DRY_RUN';
  }
  if (snapshot.bridgeStatus.reachable && snapshot.runtimeStatusReachable && !snapshot.telegramLiveProven) {
    return 'READY_FOR_EXECUTE_LOCAL_PROOF';
  }
  return 'LIVE_PROOF_UNCONFIRMED';
}

function nextStepsFor(state, snapshot) {
  switch (state) {
    case 'TOKEN_MISSING':
      return {
        nextSafeCommand: 'node scripts\\chintu-telegram-runner.js --setup-check',
        nextHumanAction: 'Set TELEGRAM_BOT_TOKEN only in the local shell, then rerun the setup check.',
      };
    case 'READY_FOR_IDENTITY_CHECK':
      return {
        nextSafeCommand: 'node scripts\\chintu-telegram-runner.js --token-check',
        nextHumanAction: 'Verify bot identity and webhook state without printing the token.',
      };
    case 'READY_FOR_ID_DISCOVERY':
      return {
        nextSafeCommand: 'node scripts\\chintu-telegram-runner.js --poll-once --dry-run --discover-ids',
        nextHumanAction: 'Send one founder Telegram message to the bot, discover IDs once, then set the allowlist env vars locally.',
      };
    case 'READY_FOR_DRY_RUN':
      return {
        nextSafeCommand: 'node scripts\\chintu-telegram-runner.js --poll-once --dry-run',
        nextHumanAction: 'Run one allowlisted dry run before attempting local execution.',
      };
    case 'READY_FOR_EXECUTE_LOCAL_PROOF':
      return {
        nextSafeCommand: 'node scripts\\chintu-telegram-runner.js --poll-once --dry-run --execute-local',
        nextHumanAction: 'Send a safe founder command like "check everything" and verify it reaches the local bridge and Runtime Reality panel while Telegram send stays disabled.',
      };
    case 'LIVE_PROOF_UNCONFIRMED':
    default:
      return snapshot.telegramLiveProven
        ? {
            nextSafeCommand: 'node scripts\\chintu-c42-preflight.js --json',
            nextHumanAction: 'Review the stored local proof evidence and keep Telegram send disabled; setup-ready does not mean live-proven.',
          }
        : {
            nextSafeCommand: 'node scripts\\chintu-telegram-runner.js --poll-once --dry-run --execute-local',
            nextHumanAction: 'There is still no trustworthy local live-proof signal, so run one safe execute-local proof after bridge truth checks are green.',
          };
  }
}

function formatStatus(report) {
  const lines = [
    'Chintu C42.1 Telegram Live-Proof Preflight Inspector',
    '  readinessState: ' + report.readinessState,
    '  tokenConfigured: ' + report.tokenConfigured,
    '  allowlistConfigured: ' + report.allowlistConfigured,
    '  sendEnabled: ' + report.sendEnabled,
    '  bridgeStatus: ' + report.bridgeStatus.label,
    '  runtimeStatusReachable: ' + report.runtimeStatusReachable,
    '  telegramLiveProven: ' + report.telegramLiveProven,
    '  nextSafeCommand: ' + report.nextSafeCommand,
    '  nextHumanAction: ' + report.nextHumanAction,
    '  blockers:',
  ];

  if (report.blockers.length === 0) {
    lines.push('    - none');
  } else {
    for (const blocker of report.blockers) {
      lines.push('    - ' + blocker);
    }
  }

  if (report.safeProofEvidence.length > 0) {
    lines.push('  safeProofEvidence:');
    for (const evidence of report.safeProofEvidence) {
      lines.push('    - ' + evidence);
    }
  }

  lines.push('  safetyNotes:');
  for (const note of report.safetyNotes) {
    lines.push('    - ' + note);
  }

  return lines.join('\n');
}

async function inspectPreflight(env, deps) {
  const mergedDeps = Object.assign({
    exists: fs.existsSync,
    readText: (filePath) => fs.readFileSync(filePath, 'utf8'),
    readAuditEntries: safeReadJsonl,
    probeBridge: defaultBridgeProbe,
    probeRuntimeStatus: defaultRuntimeProbe,
  }, deps || {});

  const tokenConfigured = Boolean(String(env.TELEGRAM_BOT_TOKEN || '').trim());
  const allowedChatIdsConfigured = csvConfigured(env.CHINTU_TELEGRAM_ALLOWED_CHAT_IDS);
  const allowedSenderIdsConfigured = csvConfigured(env.CHINTU_TELEGRAM_ALLOWED_SENDER_IDS);
  const allowlistConfigured = allowedChatIdsConfigured || allowedSenderIdsConfigured;
  const sendEnabled = isSendEnabled(env);

  const bridgeProbe = await mergedDeps.probeBridge();
  const runtimeProbe = await mergedDeps.probeRuntimeStatus();
  const auditEntries = mergedDeps.readAuditEntries(telegramAuditPath);
  const evidence = deriveEvidence(auditEntries);
  const requiredRunnerFiles = getRequiredFilesStatus(mergedDeps);
  const auditPathIgnored = gitignoreHasAuditPath(mergedDeps);
  const runtimeStatusReachable = Boolean(runtimeProbe && runtimeProbe.ok && runtimeProbe.json && runtimeProbe.json.ok === true);
  const bridgeReachable = Boolean(bridgeProbe && bridgeProbe.ok && bridgeProbe.json && bridgeProbe.json.ok === true);
  const telegramLiveProven = evidence.executeLocalSeen;

  const snapshot = {
    tokenConfigured,
    allowedChatIdsConfigured,
    allowedSenderIdsConfigured,
    allowlistConfigured,
    sendEnabled,
    bridgeStatus: {
      reachable: bridgeReachable,
      host: BRIDGE_HOST,
      port: BRIDGE_PORT,
      label: bridgeReachable ? 'reachable on 127.0.0.1:18791' : 'offline on 127.0.0.1:18791',
    },
    runtimeStatusReachable,
    runtimeStatusCode: runtimeProbe ? runtimeProbe.statusCode : 0,
    requiredRunnerFiles,
    auditPathIgnored,
    identityVerified: evidence.tokenIdentityVerified,
    dryRunEvidenceSeen: evidence.dryRunSeen || evidence.executeLocalSeen,
    telegramLiveProven,
    safeProofEvidence: evidence.safeEvidence,
  };

  const readinessState = determineReadinessState(snapshot);
  const nextSteps = nextStepsFor(readinessState, snapshot);
  const blockers = buildBlockers(snapshot);
  const safetyNotes = [
    'This preflight never prints TELEGRAM_BOT_TOKEN, Telegram chat IDs, or Telegram sender IDs.',
    'This preflight never sends Telegram messages, never calls getUpdates, and never changes webhook state.',
    'Bridge checks are localhost-only and limited to 127.0.0.1:18791 plus /api/runtime-status on localhost.',
    'Setup-ready does not mean live-proven.',
  ];

  return {
    readinessState,
    tokenConfigured,
    allowlistConfigured,
    allowedChatIdsConfigured,
    allowedSenderIdsConfigured,
    sendEnabled,
    bridgeStatus: snapshot.bridgeStatus,
    runtimeStatusReachable,
    telegramLiveProven,
    blockers,
    nextSafeCommand: nextSteps.nextSafeCommand,
    nextHumanAction: nextSteps.nextHumanAction,
    safetyNotes,
    requiredRunnerFilesOk: requiredRunnerFiles.ok,
    auditPathIgnored,
    safeProofEvidence: snapshot.safeProofEvidence,
  };
}

function printUsage() {
  console.log('Chintu C42.1 preflight inspector');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/chintu-c42-preflight.js --status');
  console.log('  node scripts/chintu-c42-preflight.js --json');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || (!args.status && !args.json) || (args.status && args.json)) {
    printUsage();
    process.exit(args.help ? 0 : 1);
  }

  const report = await inspectPreflight(process.env);

  if (!READINESS_STATES.includes(report.readinessState)) {
    throw new Error('Unexpected readiness state: ' + report.readinessState);
  }

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(formatStatus(report));
}

if (require.main === module) {
  main().catch((error) => {
    console.error('FAIL: ' + (error && error.message ? error.message : String(error)));
    process.exit(1);
  });
}

module.exports = {
  BRIDGE_HOST,
  BRIDGE_PORT,
  RUNTIME_HOST,
  RUNTIME_PORT,
  READINESS_STATES,
  parseArgs,
  deriveEvidence,
  probeLocalJson,
  inspectPreflight,
  formatStatus,
};
