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
const { buildTrace } = require('./chintu-action-trace.js');
const { enqueueAction, loadQueue, APPROVAL_PHRASES } = require('./chintu-approve.js');

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

function normalizeToken(raw) {
  // Trim whitespace and surrounding quotes; strip optional leading 'bot' prefix.
  return String(raw || '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/^bot/i, '');
}

async function telegramGetMe(token) {
  const response = await requestJson(https, {
    protocol: 'https:',
    hostname: 'api.telegram.org',
    path: '/bot' + token + '/getMe',
    method: 'GET',
  });
  if (response.statusCode !== 200 || !response.json || response.json.ok !== true) {
    throw new Error('Telegram getMe failed with HTTP ' + response.statusCode + '.');
  }
  return response.json.result || {};
}

async function telegramGetWebhookInfo(token) {
  const response = await requestJson(https, {
    protocol: 'https:',
    hostname: 'api.telegram.org',
    path: '/bot' + token + '/getWebhookInfo',
    method: 'GET',
  });
  if (response.statusCode !== 200 || !response.json || response.json.ok !== true) {
    throw new Error('Telegram getWebhookInfo failed with HTTP ' + response.statusCode + '.');
  }
  return response.json.result || {};
}

async function telegramGetUpdatesDebug(token) {
  // timeout=0, limit=10 — never sets offset, never drops updates.
  const response = await requestJson(https, {
    protocol: 'https:',
    hostname: 'api.telegram.org',
    path: '/bot' + token + '/getUpdates?timeout=0&limit=10',
    method: 'GET',
  });
  if (response.statusCode !== 200 || !response.json || response.json.ok !== true) {
    throw new Error('Telegram getUpdates debug call failed with HTTP ' + response.statusCode + '.');
  }
  return response.json.result || [];
}

async function telegramDeleteWebhook(token, dropPendingUpdates) {
  const payload = JSON.stringify({ drop_pending_updates: dropPendingUpdates === true });
  const response = await requestJson(https, {
    protocol: 'https:',
    hostname: 'api.telegram.org',
    path: '/bot' + token + '/deleteWebhook',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
  }, payload);
  if (response.statusCode !== 200 || !response.json || response.json.ok !== true) {
    throw new Error('Telegram deleteWebhook failed with HTTP ' + response.statusCode + '.');
  }
  return response.json;
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

async function buildTokenCheck(env, deps) {
  const token = normalizeToken(env.TELEGRAM_BOT_TOKEN);
  if (!token) {
    return {
      ok: false,
      mode: 'token-check',
      error: 'TELEGRAM_BOT_TOKEN is not set.',
      lines: ['Token check: FAIL — TELEGRAM_BOT_TOKEN is not set.'],
    };
  }
  const shape = token.length >= 8
    ? token.slice(0, 4) + '...' + token.slice(-4)
    : '***';
  const lines = [
    'Chintu Telegram token check',
    '  token shape: ' + shape + ' (' + token.length + ' chars) — never printed in full',
  ];

  let me = {};
  try {
    me = await deps.telegramGetMe(token);
    lines.push('  getMe: OK');
    lines.push('    id: ' + (me.id != null ? me.id : '(missing)'));
    lines.push('    username: @' + (me.username || '(missing)'));
    lines.push('    first_name: ' + (me.first_name || '(missing)'));
  } catch (err) {
    lines.push('  getMe: FAIL — ' + redactText(err && err.message ? err.message : String(err)));
    return { ok: false, mode: 'token-check', error: redactText(err && err.message ? err.message : String(err)), lines };
  }

  let webhook = {};
  try {
    webhook = await deps.telegramGetWebhookInfo(token);
    const webhookSet = Boolean(webhook.url);
    if (webhookSet) {
      lines.push('  webhook: SET (url redacted)');
      lines.push('  WARNING: Webhook is active. getUpdates returns NOTHING while a webhook is set.');
      lines.push('     Run --delete-webhook --dry-run to preview removal.');
      lines.push('     Then run --delete-webhook to clear it (drop_pending_updates: false).');
    } else {
      lines.push('  webhook: not set (good — --poll-once will work)');
    }
    lines.push('  pending_update_count: ' + (webhook.pending_update_count || 0));
    if (webhook.last_error_message) {
      lines.push('  last_error: ' + webhook.last_error_message);
    }
    if (webhook.allowed_updates && webhook.allowed_updates.length) {
      lines.push('  allowed_updates: ' + webhook.allowed_updates.join(', '));
    }
  } catch (err) {
    lines.push('  getWebhookInfo: FAIL — ' + redactText(err && err.message ? err.message : String(err)));
  }

  return {
    ok: true,
    mode: 'token-check',
    botId: me.id != null ? me.id : null,
    username: me.username || null,
    firstName: me.first_name || null,
    webhookSet: Boolean(webhook.url),
    pendingUpdateCount: webhook.pending_update_count || 0,
    lastErrorMessage: webhook.last_error_message || null,
    allowedUpdates: webhook.allowed_updates || [],
    lines,
  };
}

async function buildGetUpdatesDebug(env, deps) {
  const token = normalizeToken(env.TELEGRAM_BOT_TOKEN);
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is required for --get-updates-debug.');
  }

  const lines = [
    'Chintu Telegram getUpdates debug (timeout=0, limit=10)',
    '  note: no offset set — updates are NOT consumed, safe to call repeatedly',
  ];

  const updates = await deps.telegramGetUpdatesDebug(token);
  lines.push('  updates received: ' + updates.length);

  if (updates.length === 0) {
    lines.push('  -> No updates found.');
    lines.push('  Possible causes:');
    lines.push('    1. A webhook is active (run --token-check to confirm).');
    lines.push('    2. No messages have been sent to the bot yet.');
    lines.push('    3. A prior getUpdates call set a high offset that consumed all pending updates.');
    lines.push('  Next step: run --token-check to inspect webhook status.');
  }

  const summaries = updates.map(function(u) {
    const msg = u.message || u.edited_message || {};
    const chat = msg.chat || {};
    const from = msg.from || {};
    return {
      update_id: u.update_id,
      chat_id: chat.id != null ? chat.id : null,
      chat_type: chat.type || null,
      sender_id: from.id != null ? from.id : null,
      sender_username: from.username || null,
      text: msg.text || null,
      date: msg.date || null,
    };
  });

  for (const s of summaries) {
    lines.push('');
    lines.push('  update_id: ' + s.update_id);
    lines.push('  chat_id: ' + (s.chat_id != null ? s.chat_id : '(missing)'));
    lines.push('  chat_type: ' + (s.chat_type || '(missing)'));
    lines.push('  sender_id: ' + (s.sender_id != null ? s.sender_id : '(missing)'));
    lines.push('  sender_username: ' + (s.sender_username ? '@' + s.sender_username : '(missing)'));
    lines.push('  text: ' + (s.text != null ? s.text : '(no text)'));
    lines.push('  date: ' + (s.date != null ? new Date(s.date * 1000).toISOString() : '(missing)'));
  }

  return {
    ok: true,
    mode: 'get-updates-debug',
    updateCount: updates.length,
    updates: summaries,
    lines,
    note: 'No offset set. Updates not consumed. Safe to call repeatedly.',
  };
}

async function buildDeleteWebhook(env, args, deps) {
  const dryRun = Boolean(args['dry-run']);
  const token = normalizeToken(env.TELEGRAM_BOT_TOKEN);
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is required for --delete-webhook.');
  }

  const webhook = await deps.telegramGetWebhookInfo(token);
  const webhookSet = Boolean(webhook && webhook.url);

  const lines = [
    'Chintu Telegram delete-webhook',
    '  current webhook: ' + (webhookSet ? 'SET' : 'not set'),
    '  drop_pending_updates: false (hardcoded — updates are preserved, never dropped)',
  ];

  if (dryRun) {
    lines.push('  mode: DRY RUN — no webhook will be deleted.');
    if (webhookSet) {
      lines.push('  would delete: YES (webhook is currently set)');
      lines.push('  to actually delete: rerun without --dry-run');
    } else {
      lines.push('  would delete: NO (webhook was already not set)');
    }
    return {
      ok: true,
      mode: 'delete-webhook-dry-run',
      webhookSet,
      wouldDelete: webhookSet,
      dropPendingUpdates: false,
      lines,
    };
  }

  if (!webhookSet) {
    lines.push('  result: nothing to delete (webhook was already not set).');
    return {
      ok: true,
      mode: 'delete-webhook',
      webhookSet: false,
      deleted: false,
      reason: 'webhook was not set',
      lines,
    };
  }

  const result = await deps.telegramDeleteWebhook(token, false);
  lines.push('  result: ' + (result.ok ? 'deleted OK' : 'FAIL'));
  lines.push('  next step: run --poll-once --dry-run to verify getUpdates now returns updates.');

  return {
    ok: Boolean(result.ok),
    mode: 'delete-webhook',
    webhookSet: true,
    deleted: Boolean(result.ok),
    dropPendingUpdates: false,
    apiResult: { ok: Boolean(result.ok) },
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

  if (args['token-check']) {
    return buildTokenCheck(env, deps);
  }

  if (args['get-updates-debug']) {
    return buildGetUpdatesDebug(env, deps);
  }

  if (args['delete-webhook']) {
    return buildDeleteWebhook(env, args, deps);
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
    throw new Error('Choose one source: --fixture <path>, --poll-once, --setup-check, --token-check, --get-updates-debug, or --delete-webhook.');
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
      message: 'No Telegram updates were available. If unexpected, run --token-check (an active webhook causes getUpdates to return nothing).',
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

  // Stage 34: append canonical action trace v1 alongside the legacy audit entry.
  // Unsupported/blocked updates (e.g. no text) still produce a preview but with
  // ok=true,supported=false — skip tracing those to avoid spurious entries.
  if (preview && preview.ok && preview.supported) {
    const syntheticRouteResult = {
      intent: preview.intent,
      risk: preview.risk,
      message: preview.text || '',
      sequence: preview.wouldRunSequence || null,
    };
    const sendEnabled = String(env.CHINTU_TELEGRAM_SEND_ENABLED || '').trim() === '1';
    const traceSource = sourceMode === 'fixture' ? 'fixture' : 'telegram';
    const trace = buildTrace(syntheticRouteResult, {
      source: traceSource,
      dryRun,
      executed: Boolean(result.bridge && result.bridge.executed),
      endpoint: (result.bridge && result.bridge.endpoint) || null,
      bridgeResult: (result.bridge && result.bridge.ok === true)
        ? { ok: true, port: result.bridge.port || null }
        : null,
      sendFlag: sendRequested,
      sendEnabled,
      auditPath,
    });
    appendAudit(trace);

    // Stage 35: Enqueue requires_approval actions for founder review.
    // Only enqueue when sender is allowlisted, not in discovery mode, and
    // trace.risk is requires_approval. Use update_id for deduplication so
    // repeated poll-once calls on the same update don't create duplicate entries.
    if (trace.risk === 'requires_approval' && preview.allowlisted && !discoveryMode) {
      const updateId = selected && selected.update && selected.update.update_id;
      const enqueueApprovalId = updateId
        ? 'tel_upd_' + String(updateId)
        : 'tel_' + trace.actionId;
      const phrase = APPROVAL_PHRASES[trace.capabilityId]
        || ('APPROVE ' + String(trace.capabilityId || '').toUpperCase().replace(/\./g, '_'));
      try {
        // Dedup: skip if this update was already enqueued.
        const existingQueue = loadQueue();
        const alreadyQueued = existingQueue.some(function(e) { return e.approvalId === enqueueApprovalId; });
        if (alreadyQueued) {
          result.enqueued      = false;
          result.enqueueSkipped = 'Already queued: ' + enqueueApprovalId;
        } else {
          enqueueAction({
            approvalId:        enqueueApprovalId,
            createdAt:         trace.timestamp,
            capabilityId:      trace.capabilityId,
            actionDescription: 'Telegram-triggered: ' + trace.intent,
            riskLabel:         trace.risk,
            source:            trace.source,
            userText:          trace.userText,
            preview: {
              dryRunResult:        'Would execute ' + trace.capabilityId + ' (intent: ' + trace.intent + ')',
              estimatedSideEffects: [],
              rollbackPossible:    trace.capabilityId === 'chintu.gitPush',
              rollbackInstructions: trace.capabilityId === 'chintu.gitPush'
                ? 'git revert HEAD && git push'
                : null,
            },
            approvalPhrase: phrase,
          });
          result.enqueued      = true;
          result.enqueueId     = enqueueApprovalId;
          result.enqueuePhrase = phrase;
        }
      } catch (enqueueErr) {
        result.enqueued     = false;
        result.enqueueError = String(enqueueErr && enqueueErr.message ? enqueueErr.message : enqueueErr);
      }
    }

    // Stage 37: BALA Ask Skill dispatch.
    // When intent is bala_ask and sender is allowlisted, call respondToBALAQuery
    // for a calm, safe health-awareness reply. Optionally sends via Telegram if
    // send is enabled and requested. Pure-logic skill: no network, no fs, no shell.
    // Emergency phrases are handled inside the skill with urgent-care reply.
    if (trace.intent === 'bala_ask' && preview.allowlisted && !discoveryMode) {
      const balaSkill = require('./chintu-bala-skill.js');
      const queryText = (preview && preview.text) || '';
      const skillResult = balaSkill.respondToBALAQuery(queryText);
      result.balaSkillResult = {
        safetyTag:    skillResult.safetyTag,
        emergency:    skillResult.emergency,
        capabilityId: skillResult.capabilityId,
        reply:        skillResult.reply,
        footer:       skillResult.footer,
      };
      if (sendRequested && sendEnabled) {
        const replyText = skillResult.reply + '\n\n\u2014 ' + skillResult.footer;
        const chatId = preview.replyEnvelope && preview.replyEnvelope.chatId;
        if (chatId) {
          const balaToken = String(env.TELEGRAM_BOT_TOKEN || '').trim();
          try {
            await deps.telegramSendMessage(balaToken, chatId, replyText);
            result.balaSkillSent = true;
          } catch (balaErr) {
            result.balaSkillSent = false;
            result.balaSkillSendError = String(balaErr && balaErr.message ? balaErr.message : balaErr);
          }
        }
      }
    }
  }

  // Stage 35: Surface pending approval count so the founder knows what's waiting.
  try {
    const queue = loadQueue();
    result.pendingApprovalCount = queue.filter(function(e) { return !e.approvedAt && !e.rejectedAt; }).length;
  } catch (_) {
    result.pendingApprovalCount = null;
  }

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
  console.log('');
  console.log('  --token-check');
  console.log('    Check token: getMe + getWebhookInfo. Prints bot id/username/first_name + webhook status.');
  console.log('    Never prints token. No send. No secrets. Local diagnostic only.');
  console.log('');
  console.log('  --get-updates-debug');
  console.log('    getUpdates with timeout=0, limit=10. Prints update details. No offset set.');
  console.log('    Updates NOT consumed. Safe to call repeatedly. No send. No token printed.');
  console.log('');
  console.log('  --delete-webhook --dry-run');
  console.log('    Preview webhook deletion only. No actual delete. Shows current webhook state.');
  console.log('');
  console.log('  --delete-webhook');
  console.log('    Delete the configured webhook. drop_pending_updates=false (updates preserved).');
  console.log('    Run --dry-run first to preview. Requires TELEGRAM_BOT_TOKEN in env.');
  console.log('');
  console.log('Extra examples:');
  console.log('  node scripts/chintu-telegram-runner.js --token-check');
  console.log('  node scripts/chintu-telegram-runner.js --get-updates-debug');
  console.log('  node scripts/chintu-telegram-runner.js --delete-webhook --dry-run');
  console.log('  node scripts/chintu-telegram-runner.js --delete-webhook');
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
    telegramGetMe,
    telegramGetWebhookInfo,
    telegramGetUpdatesDebug,
    telegramDeleteWebhook,
  });

  const LINES_ONLY_MODES = ['setup-check', 'token-check', 'get-updates-debug', 'delete-webhook-dry-run', 'delete-webhook'];
  if (result.lines && Array.isArray(result.lines) && LINES_ONLY_MODES.indexOf(result.mode) !== -1) {
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
  normalizeToken,
  telegramGetUpdates,
  telegramGetMe,
  telegramGetWebhookInfo,
  telegramGetUpdatesDebug,
  telegramDeleteWebhook,
  telegramSendMessage,
  probeLocalBridge,
  executeLocalBridgeChat,
  buildSetupCheck,
  buildTokenCheck,
  buildGetUpdatesDebug,
  buildDeleteWebhook,
  paths: {
    auditPath,
  },
};
