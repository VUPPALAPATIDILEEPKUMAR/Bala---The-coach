#!/usr/bin/env node
'use strict';

// Stage 31 note:
// Network calls are allowed in this file only, and only for:
//   1. Telegram Bot API getUpdates/sendMessage with explicit env gates.
//   2. Local bridge checks against 127.0.0.1 only when --execute-local is set.

const fs = require('fs');
const path = require('path');
const http = require('node:http');
const https = require('node:https');

const adapter = require('./chintu-telegram-adapter.js');

const repoRoot = path.resolve(__dirname, '..');
const outboxDir = path.join(repoRoot, 'CHINTU_OUTBOX');
const auditPath = path.join(outboxDir, 'telegram_connector_audit.jsonl');
const LOCAL_BRIDGE_HOST = '127.0.0.1';
const LOCAL_BRIDGE_PORTS = [18791, 18792, 18793, 18794, 18795, 18796];
const TELEGRAM_TIMEOUT_MS = 10000;

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const part = argv[i];
    if (!part.startsWith('--')) {
      args._.push(part);
      continue;
    }
    const eq = part.indexOf('=');
    if (eq !== -1) {
      args[part.slice(2, eq)] = part.slice(eq + 1);
      continue;
    }
    const key = part.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    i++;
  }
  return args;
}

function normalizeId(value) {
  if (value == null) return '';
  return String(value).trim();
}

function csvEnv(env, name) {
  return String(env[name] || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function redactText(value) {
  let text = String(value == null ? '' : value);
  text = text.replace(/\b\d{6,}:[A-Za-z0-9_-]{20,}\b/g, '[REDACTED_TOKEN]');
  text = text.replace(/https:\/\/api\.telegram\.org\/bot[^\s"']+/gi, '[REDACTED_URL]');
  text = text.replace(/TELEGRAM_BOT_TOKEN[=:]\S+/gi, 'TELEGRAM_BOT_TOKEN=[REDACTED]');
  return text;
}

function ensureOutbox() {
  if (!fs.existsSync(outboxDir)) {
    fs.mkdirSync(outboxDir, { recursive: true });
  }
}

function appendAudit(entry) {
  ensureOutbox();
  fs.appendFileSync(auditPath, JSON.stringify(entry) + '\n', 'utf8');
}

function requestJson(transport, options, body) {
  return new Promise((resolve, reject) => {
    const req = transport.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try {
          json = raw ? JSON.parse(raw) : null;
        } catch (_) {
          reject(new Error('Received a non-JSON response.'));
          return;
        }
        resolve({ statusCode: res.statusCode || 0, json });
      });
    });
    req.setTimeout(TELEGRAM_TIMEOUT_MS, () => req.destroy(new Error('Request timed out.')));
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function telegramGetUpdates(token, offset) {
  const query = [
    'timeout=1',
    'limit=5',
    'allowed_updates=%5B%22message%22%2C%22edited_message%22%5D',
  ];
  if (Number.isFinite(offset)) query.push('offset=' + String(offset));
  const response = await requestJson(https, {
    protocol: 'https:',
    hostname: 'api.telegram.org',
    path: '/bot' + token + '/getUpdates?' + query.join('&'),
    method: 'GET',
  });
  if (response.statusCode !== 200 || !response.json || response.json.ok !== true) {
    throw new Error('Telegram getUpdates failed with HTTP ' + response.statusCode + '.');
  }
  return response.json.result || [];
}

async function telegramSendMessage(token, chatId, text) {
  const payload = JSON.stringify({
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  });
  const response = await requestJson(https, {
    protocol: 'https:',
    hostname: 'api.telegram.org',
    path: '/bot' + token + '/sendMessage',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
  }, payload);
  if (response.statusCode !== 200 || !response.json || response.json.ok !== true) {
    throw new Error('Telegram sendMessage failed with HTTP ' + response.statusCode + '.');
  }
  return response.json.result || {};
}

async function localBridgeRequest(port, route, body) {
  const payload = body ? JSON.stringify(body) : null;
  const response = await requestJson(http, {
    protocol: 'http:',
    hostname: LOCAL_BRIDGE_HOST,
    port,
    path: route,
    method: payload ? 'POST' : 'GET',
    headers: payload ? {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    } : undefined,
  }, payload);
  return response;
}

async function probeLocalBridge() {
  for (const port of LOCAL_BRIDGE_PORTS) {
    try {
      const response = await localBridgeRequest(port, '/api/health');
      if (response.statusCode === 200 && response.json && response.json.ok) {
        return { ok: true, port };
      }
    } catch (_) {
      // Keep probing.
    }
  }
  return { ok: false, port: null };
}

async function executeLocalBridgeChat(port, message) {
  const response = await localBridgeRequest(port, '/api/chat', { message });
  if (response.statusCode !== 200 || !response.json || response.json.ok !== true) {
    throw new Error('Local bridge /api/chat returned HTTP ' + response.statusCode + '.');
  }
  return response.json;
}

function loadFixture(filePath) {
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(repoRoot, filePath);
  const raw = fs.readFileSync(fullPath, 'utf8');
  const parsed = JSON.parse(raw);
  return {
    fullPath,
    updates: normalizeFixtureUpdates(parsed),
  };
}

function normalizeFixtureUpdates(parsed) {
  if (Array.isArray(parsed)) return parsed.slice();
  if (parsed && parsed.ok === true && Array.isArray(parsed.result)) return parsed.result.slice();
  return [parsed];
}

function selectUpdate(updates) {
  if (!Array.isArray(updates) || updates.length === 0) {
    return { update: null, count: 0, nextOffset: null };
  }
  const candidate = updates[0];
  const ids = updates
    .map((item) => Number(item && item.update_id))
    .filter((value) => Number.isFinite(value));
  const nextOffset = ids.length ? Math.max.apply(null, ids) + 1 : null;
  return {
    update: candidate,
    count: updates.length,
    nextOffset,
  };
}

function buildAuditEntry(result, context) {
  const preview = result.preview || {};
  return {
    timestamp: new Date().toISOString(),
    sourceMode: result.sourceMode,
    updateId: preview.updateId || null,
    updateType: preview.updateType || null,
    senderId: preview.commandSummary ? preview.commandSummary.senderId || null : null,
    chatId: preview.commandSummary ? preview.commandSummary.chatId || null : null,
    textSha256: preview.textSha256 || null,
    allowlisted: preview.allowlisted === true,
    allowReason: preview.allowReason || null,
    intent: preview.intent || null,
    risk: preview.risk || null,
    wouldRunSequence: preview.wouldRunSequence || null,
    wouldRunActions: Array.isArray(preview.wouldRunActions) ? preview.wouldRunActions.slice() : [],
    executeLocalRequested: Boolean(context.executeLocalRequested),
    executeLocalPerformed: Boolean(result.bridge && result.bridge.executed),
    sendRequested: Boolean(context.sendRequested),
    sendPerformed: Boolean(result.send && result.send.sent),
    sendStatus: result.send ? result.send.status : 'not_requested',
    sendReason: result.send ? result.send.reason : null,
    discoveryMode: Boolean(context.discoveryMode),
  };
}

function getAllowlistOptions(env) {
  return {
    allowedChatIds: csvEnv(env, 'CHINTU_TELEGRAM_ALLOWED_CHAT_IDS'),
    allowedSenderIds: csvEnv(env, 'CHINTU_TELEGRAM_ALLOWED_SENDER_IDS'),
  };
}

function hasConfiguredAllowlist(options) {
  return options.allowedChatIds.length > 0 || options.allowedSenderIds.length > 0;
}

function maskId(value) {
  const id = normalizeId(value);
  if (!id) return '(missing)';
  if (id.length <= 4) return id;
  return id.slice(0, 2) + '...' + id.slice(-2);
}

function describeSetup(env, options, bridgeStatus) {
  const sendEnabled = String(env.CHINTU_TELEGRAM_SEND_ENABLED || '').trim() === '1';
  return {
    tokenConfigured: Boolean(String(env.TELEGRAM_BOT_TOKEN || '').trim()),
    allowlistConfigured: hasConfiguredAllowlist(options),
    allowedChatCount: options.allowedChatIds.length,
    allowedSenderCount: options.allowedSenderIds.length,
    sendEnabled,
    defaultMode: 'dry-run',
    bridgeOnline: Boolean(bridgeStatus && bridgeStatus.ok),
    bridgePort: bridgeStatus && bridgeStatus.ok ? bridgeStatus.port : null,
    sendMode: sendEnabled ? 'gated-ready' : 'disabled',
  };
}

async function buildSetupCheck(env, deps) {
  const options = getAllowlistOptions(env);
  const bridge = await deps.probeLocalBridge();
  const setup = describeSetup(env, options, bridge);
  const lines = [
    'Chintu Telegram setup check',
    '  token: ' + (setup.tokenConfigured ? 'configured' : 'missing'),
    '  allowlist: ' + (setup.allowlistConfigured
      ? 'configured (' + setup.allowedChatCount + ' chat ID(s), ' + setup.allowedSenderCount + ' sender ID(s))'
      : 'missing'),
    '  default mode: ' + setup.defaultMode,
    '  send: ' + (setup.sendEnabled ? 'enabled only when --send is passed' : 'disabled until CHINTU_TELEGRAM_SEND_ENABLED=1'),
    '  bridge: ' + (setup.bridgeOnline ? ('connected on 127.0.0.1:' + setup.bridgePort) : 'offline'),
    '  safe next step: ' + (
      !setup.tokenConfigured
        ? 'Set TELEGRAM_BOT_TOKEN only in your local shell, then rerun --setup-check.'
        : !setup.allowlistConfigured
          ? 'Use --poll-once --dry-run --discover-ids, then set allowlist env vars.'
          : 'Run --poll-once --dry-run. Add --execute-local only after the bridge is running.'
    ),
  ];
  return {
    ok: true,
    mode: 'setup-check',
    setup,
    lines,
  };
}

function extractDiscoveryIds(preview) {
  return {
    chatId: preview && preview.commandSummary ? preview.commandSummary.chatId || null : null,
    senderId: preview && preview.commandSummary ? preview.commandSummary.senderId || null : null,
    senderName: preview && preview.commandSummary ? preview.commandSummary.senderName || '' : '',
  };
}

async function maybeExecuteLocal(preview, requested, deps) {
  if (!requested) {
    return { attempted: false, executed: false, reason: 'execute-local not requested' };
  }
  if (!adapter.canExecuteLocally(preview)) {
    return { attempted: true, executed: false, reason: 'preview is not eligible for localhost bridge execution' };
  }
  const bridge = await deps.probeLocalBridge();
  if (!bridge.ok || !bridge.port) {
    return { attempted: true, executed: false, reason: 'localhost bridge is offline' };
  }
  const chat = await deps.executeLocalBridgeChat(bridge.port, preview.text);
  return {
    attempted: true,
    executed: true,
    port: bridge.port,
    intent: chat.intent || null,
    risk: chat.risk || null,
    ranLive: Boolean(chat.ranLive),
    resultsCount: Array.isArray(chat.results) ? chat.results.length : 0,
    nextSuggestedAction: chat.nextSuggestedAction || null,
    reply: chat.reply || '',
  };
}

async function maybeSend(preview, sendRequested, env, deps) {
  if (!sendRequested) {
    return { status: 'not_requested', sent: false, reason: 'send flag not requested' };
  }
  if (!preview.replyEnvelope || !preview.replyEnvelope.ok) {
    return { status: 'blocked', sent: false, reason: 'reply preview was not generated safely' };
  }
  if (!preview.allowlisted) {
    return { status: 'blocked', sent: false, reason: 'sender is not allowlisted' };
  }
  if (preview.healthSensitive) {
    return { status: 'blocked', sent: false, reason: 'health-sensitive commands never send replies' };
  }
  if (!preview.replyEnvelope.chatId) {
    return { status: 'blocked', sent: false, reason: 'reply envelope is missing a chat ID' };
  }
  const token = String(env.TELEGRAM_BOT_TOKEN || '').trim();
  if (!token) {
    return { status: 'blocked', sent: false, reason: 'TELEGRAM_BOT_TOKEN is not set' };
  }
  const allowlistOptions = getAllowlistOptions(env);
  if (!hasConfiguredAllowlist(allowlistOptions)) {
    return { status: 'blocked', sent: false, reason: 'Telegram allowlist env vars are not configured' };
  }
  if (String(env.CHINTU_TELEGRAM_SEND_ENABLED || '').trim() !== '1') {
    return { status: 'blocked', sent: false, reason: 'CHINTU_TELEGRAM_SEND_ENABLED is not 1' };
  }
  const sent = await deps.telegramSendMessage(token, preview.replyEnvelope.chatId, preview.replyEnvelope.text);
  return {
    status: 'sent',
    sent: true,
    reason: null,
    messageId: sent && sent.message_id != null ? sent.message_id : null,
  };
}

function requireAllowlistForPollOnce(args, options) {
  if (args.fixture) return;
  if (args['discover-ids']) return;
  if (hasConfiguredAllowlist(options)) return;
  throw new Error('Telegram allowlist env vars are required for --poll-once. Use --discover-ids first to learn chat/sender IDs safely.');
}

async function runWithArgs(argv, env, deps) {
  const args = parseArgs(argv);
  const sendRequested = Boolean(args.send);
  const executeLocalRequested = Boolean(args['execute-local']);
  const discoveryMode = Boolean(args['discover-ids']);
  const dryRun = sendRequested ? false : true;
  const allowlistOptions = getAllowlistOptions(env);
  let sourceMode = '';
  let selected = null;

  if (args['setup-check']) {
    return buildSetupCheck(env, deps);
  }

  if (args.fixture) {
    const fixture = loadFixture(String(args.fixture));
    selected = selectUpdate(fixture.updates);
    sourceMode = 'fixture';
    selected.fixturePath = path.relative(repoRoot, fixture.fullPath).replace(/\\/g, '/');
  } else if (args['poll-once']) {
    const token = String(env.TELEGRAM_BOT_TOKEN || '').trim();
    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN is required for --poll-once.');
    }
    requireAllowlistForPollOnce(args, allowlistOptions);
    const offset = args.offset == null ? null : Number(args.offset);
    if (args.offset != null && !Number.isFinite(offset)) {
      throw new Error('--offset must be a number.');
    }
    const updates = await deps.telegramGetUpdates(token, Number.isFinite(offset) ? offset : null);
    selected = selectUpdate(updates);
    sourceMode = discoveryMode ? 'poll-once-discovery' : 'poll-once';
    selected.offset = Number.isFinite(offset) ? offset : null;
  } else {
    throw new Error('Choose one source: --fixture <path>, --poll-once, or --setup-check.');
  }

  if (!selected || !selected.update) {
    const noUpdateResult = {
      ok: true,
      sourceMode,
      dryRun,
      sendRequested,
      executeLocalRequested,
      updatesSeen: selected ? selected.count : 0,
      nextOffset: selected ? selected.nextOffset : null,
      message: 'No Telegram updates were available.',
      auditLog: path.relative(repoRoot, auditPath).replace(/\\/g, '/'),
    };
    appendAudit({
      timestamp: new Date().toISOString(),
      sourceMode,
      updateId: null,
      updateType: null,
      senderId: null,
      chatId: null,
      textSha256: null,
      allowlisted: false,
      allowReason: 'no_updates',
      intent: 'no_updates',
      risk: null,
      wouldRunSequence: null,
      wouldRunActions: [],
      executeLocalRequested,
      executeLocalPerformed: false,
      sendRequested,
      sendPerformed: false,
      sendStatus: 'not_requested',
      sendReason: 'no_updates',
      discoveryMode,
    });
    return noUpdateResult;
  }

  const preview = adapter.buildTelegramDryRunPreview(selected.update, allowlistOptions);
  let bridge;
  if (discoveryMode) {
    bridge = { attempted: false, executed: false, reason: 'discover-ids mode never executes locally' };
  } else {
    try {
      bridge = await maybeExecuteLocal(preview, executeLocalRequested, deps);
    } catch (error) {
      bridge = {
        attempted: executeLocalRequested,
        executed: false,
        reason: redactText(error && error.message ? error.message : String(error)),
      };
    }
  }

  let send;
  if (discoveryMode) {
    send = { status: 'blocked', sent: false, reason: 'discover-ids mode never sends replies' };
  } else {
    try {
      send = await maybeSend(preview, sendRequested, env, deps);
    } catch (error) {
      send = {
        status: 'error',
        sent: false,
        reason: redactText(error && error.message ? error.message : String(error)),
      };
    }
  }

  const result = {
    ok: true,
    sourceMode,
    dryRun,
    sendRequested,
    executeLocalRequested,
    discoveryMode,
    updatesSeen: selected.count,
    nextOffset: selected.nextOffset,
    fixturePath: selected.fixturePath || null,
    offset: selected.offset != null ? selected.offset : null,
    preview,
    bridge,
    send,
    auditLog: path.relative(repoRoot, auditPath).replace(/\\/g, '/'),
  };

  if (discoveryMode) {
    result.discovery = extractDiscoveryIds(preview);
    result.discoverySummary = [
      'Discovery mode captured one Telegram update safely.',
      '  chat ID: ' + maskId(result.discovery.chatId),
      '  sender ID: ' + maskId(result.discovery.senderId),
      '  sender name: ' + (result.discovery.senderName || '(missing)'),
      'Set CHINTU_TELEGRAM_ALLOWED_CHAT_IDS / CHINTU_TELEGRAM_ALLOWED_SENDER_IDS in your local shell before normal poll-once runs.',
    ];
  }

  appendAudit(buildAuditEntry(result, { sendRequested, executeLocalRequested, discoveryMode }));
  return result;
}

function printUsage() {
  console.log('Chintu Telegram runner');
  console.log('');
  console.log('Modes:');
  console.log('  --setup-check');
  console.log('    Print a safe readiness checklist. No network send. No token printing.');
  console.log('');
  console.log('  --fixture <path> --dry-run');
  console.log('    Run a local JSON fixture only.');
  console.log('');
  console.log('  --poll-once --dry-run');
  console.log('    Read Telegram getUpdates once. Requires TELEGRAM_BOT_TOKEN and an allowlist.');
  console.log('');
  console.log('  --poll-once --dry-run --discover-ids');
  console.log('    Read one update without an allowlist so you can discover chat/sender IDs safely.');
  console.log('');
  console.log('  --poll-once --dry-run --execute-local');
  console.log('    Hand allowlisted safe commands to the localhost bridge only if it is online.');
  console.log('');
  console.log('  --poll-once --send');
  console.log('    Still gated. Requires TELEGRAM_BOT_TOKEN, allowlist env, CHINTU_TELEGRAM_SEND_ENABLED=1, and a safe allowlisted message.');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/chintu-telegram-runner.js --setup-check');
  console.log('  node scripts/chintu-telegram-runner.js --fixture scripts\\fixtures\\telegram-check-everything.json --dry-run');
  console.log('  node scripts/chintu-telegram-runner.js --poll-once --dry-run --discover-ids');
  console.log('  node scripts/chintu-telegram-runner.js --poll-once --dry-run --execute-local');
  console.log('  node scripts/chintu-telegram-runner.js --poll-once --send');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h || Object.keys(args).length === 1 && Array.isArray(args._) && args._.length === 0) {
    printUsage();
    return;
  }

  const result = await runWithArgs(process.argv.slice(2), process.env, {
    telegramGetUpdates,
    telegramSendMessage,
    probeLocalBridge,
    executeLocalBridgeChat,
  });

  if (result.mode === 'setup-check') {
    console.log(result.lines.join('\n'));
    return;
  }

  if (result.discoverySummary) {
    console.log(result.discoverySummary.join('\n'));
    console.log('');
  }

  console.log(redactText(JSON.stringify(result, null, 2)));
}

if (require.main === module) {
  main().catch((error) => {
    console.error('FAIL: ' + redactText(error && error.message ? error.message : String(error)));
    process.exit(1);
  });
}

module.exports = {
  parseArgs,
  redactText,
  runWithArgs,
  requestJson,
  telegramGetUpdates,
  telegramSendMessage,
  probeLocalBridge,
  executeLocalBridgeChat,
  buildSetupCheck,
  paths: {
    auditPath,
  },
};
