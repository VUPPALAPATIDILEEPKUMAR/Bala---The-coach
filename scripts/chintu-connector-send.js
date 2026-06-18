#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('node:https');

const repoRoot = path.resolve(__dirname, '..');
const outboxDir = path.join(repoRoot, 'CHINTU_OUTBOX');
const readinessPath = path.join(outboxDir, 'latest_connector_readiness.json');
const previewPath = path.join(outboxDir, 'latest_connector_preview.json');
const auditLogPath = path.join(outboxDir, 'connector_audit.log.jsonl');
const sentLogPath = path.join(outboxDir, 'connector_sent.log.jsonl');
const globalPausePath = path.join(outboxDir, 'CONNECTORS_GLOBAL_PAUSE');

const DEFAULT_APPROVAL_ENV = 'CHINTU_CONNECTOR_APPROVAL_PHRASE';
const DEFAULT_MODE = 'dry-run';
const DRY_RUN_LABEL = 'DRY RUN ONLY';
const SAFETY_FOOTER =
  'BALA is a health-awareness companion. It does not diagnose, treat, predict, prevent, replace doctors, or provide emergency monitoring.';
const HEALTH_DATA_PATTERNS = [
  /\bheart rate\b/i,
  /\brhr\b/i,
  /\bhrv\b/i,
  /\bspo2\b/i,
  /\bblood oxygen\b/i,
  /\bsleep\b/i,
  /\bsteps\b/i,
  /\bglucose\b/i,
  /\bblood pressure\b/i,
  /\bweight\b/i,
  /\bsymptom\b/i,
  /\bchest pain\b/i,
];

const CONNECTORS = {
  telegram: {
    priority: 1,
    mode: 'send-capable',
    requiredEnv: ['CHINTU_TG_BOT_TOKEN', 'CHINTU_TG_CHAT_ID', 'CHINTU_TG_TARGET', 'CHINTU_TG_ALLOWLIST'],
    allowlistEnv: 'CHINTU_TG_ALLOWLIST',
    recipientEnv: 'CHINTU_TG_TARGET',
    pauseFile: path.join(outboxDir, 'CONNECTOR_telegram_PAUSE'),
    previewCommand: 'node scripts/chintu-connector-send.js --preview --connector telegram --body "..."',
    buildRequest(env, payload) {
      return {
        url: `https://api.telegram.org/bot${env.CHINTU_TG_BOT_TOKEN}/sendMessage`,
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chat_id: env.CHINTU_TG_CHAT_ID,
          disable_web_page_preview: true,
          text: payload.body,
        }),
      };
    },
  },
  discord: {
    priority: 2,
    mode: 'send-capable',
    requiredEnv: ['CHINTU_DISCORD_WEBHOOK_URL', 'CHINTU_DISCORD_TARGET', 'CHINTU_DISCORD_ALLOWLIST'],
    allowlistEnv: 'CHINTU_DISCORD_ALLOWLIST',
    recipientEnv: 'CHINTU_DISCORD_TARGET',
    pauseFile: path.join(outboxDir, 'CONNECTOR_discord_PAUSE'),
    previewCommand: 'node scripts/chintu-connector-send.js --preview --connector discord --body "..."',
    buildRequest(env, payload) {
      return {
        url: env.CHINTU_DISCORD_WEBHOOK_URL,
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          content: payload.body,
          allowed_mentions: { parse: [] },
        }),
      };
    },
  },
  slack: {
    priority: 3,
    mode: 'send-capable',
    requiredEnv: ['CHINTU_SLACK_WEBHOOK_URL', 'CHINTU_SLACK_TARGET', 'CHINTU_SLACK_ALLOWLIST'],
    allowlistEnv: 'CHINTU_SLACK_ALLOWLIST',
    recipientEnv: 'CHINTU_SLACK_TARGET',
    pauseFile: path.join(outboxDir, 'CONNECTOR_slack_PAUSE'),
    previewCommand: 'node scripts/chintu-connector-send.js --preview --connector slack --body "..."',
    buildRequest(env, payload) {
      return {
        url: env.CHINTU_SLACK_WEBHOOK_URL,
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text: payload.body,
        }),
      };
    },
  },
  gmail: {
    priority: 4,
    mode: 'architecture-only',
    requiredEnv: ['CHINTU_GMAIL_TARGET', 'CHINTU_GMAIL_ALLOWLIST', 'CHINTU_GMAIL_FROM'],
    allowlistEnv: 'CHINTU_GMAIL_ALLOWLIST',
    recipientEnv: 'CHINTU_GMAIL_TARGET',
    pauseFile: path.join(outboxDir, 'CONNECTOR_gmail_PAUSE'),
    previewCommand: 'node scripts/chintu-connector-send.js --preview --connector gmail --body "..."',
    buildRequest() {
      return null;
    },
  },
};

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

function ensureOutbox() {
  if (!fs.existsSync(outboxDir)) {
    fs.mkdirSync(outboxDir, { recursive: true });
  }
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function readEnv(name) {
  return String(process.env[name] || '').trim();
}

function csvEnv(name) {
  return readEnv(name)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function getMode() {
  const mode = readEnv('CHINTU_CONNECTOR_MODE').toLowerCase();
  return mode || DEFAULT_MODE;
}

function getApprovalPhrase() {
  return readEnv(DEFAULT_APPROVAL_ENV);
}

function connectorState(name) {
  const connector = CONNECTORS[name];
  if (!connector) {
    throw new Error(`Unknown connector "${name}".`);
  }
  const envSnapshot = {};
  for (const key of connector.requiredEnv) {
    envSnapshot[key] = readEnv(key);
  }
  const allowlist = csvEnv(connector.allowlistEnv);
  const recipient = readEnv(connector.recipientEnv);
  const missing = connector.requiredEnv.filter((key) => !envSnapshot[key]);
  const isPaused = fs.existsSync(globalPausePath) || fs.existsSync(connector.pauseFile);
  return {
    name,
    connector,
    mode: getMode(),
    approvalPhraseConfigured: Boolean(getApprovalPhrase()),
    allowlist,
    recipient,
    envSnapshot,
    missing,
    isPaused,
  };
}

function validateMessageBody(body) {
  const trimmed = String(body || '').trim();
  if (!trimmed) {
    throw new Error('Message body is required.');
  }
  for (const re of HEALTH_DATA_PATTERNS) {
    if (re.test(trimmed)) {
      throw new Error(`Outgoing connector payload blocked by health-data guard: ${re}`);
    }
  }
  if (/diagnose|treat|predict|prevent|emergency monitoring/i.test(trimmed)) {
    throw new Error('Outgoing connector payload blocked by medical-claims guard.');
  }
  return trimmed;
}

function buildReadinessEntry(name) {
  const state = connectorState(name);
  const enabled = state.missing.length === 0;
  const recipientAllowed = state.recipient ? state.allowlist.includes(state.recipient) : false;
  const canPreview = true;
  const canSend =
    state.connector.mode === 'send-capable' &&
    state.mode === 'active' &&
    state.approvalPhraseConfigured &&
    enabled &&
    recipientAllowed &&
    !state.isPaused;

  return {
    connector: name,
    priority: state.connector.priority,
    adapter_mode: state.connector.mode,
    current_mode: state.mode || DEFAULT_MODE,
    default_behavior: DRY_RUN_LABEL,
    activation_off_by_default: state.mode !== 'active',
    preview_before_send_required: true,
    approval_phrase_required: true,
    allowlist_required: true,
    local_only_until_active: state.mode !== 'active',
    paused: state.isPaused,
    required_env_vars: state.connector.requiredEnv,
    missing_env_vars: state.missing,
    allowlist_env_var: state.connector.allowlistEnv,
    allowlist_entries: state.allowlist,
    configured_recipient: state.recipient || null,
    recipient_allowlisted: recipientAllowed,
    can_preview: canPreview,
    can_send_now: canSend,
    notes:
      name === 'gmail'
        ? 'Gmail remains architecture-only in this stage. Draft/send wiring is documented but not enabled.'
        : 'Active send still requires explicit approval, allowlist match, preview file, and active mode.',
  };
}

function buildReadinessReport() {
  return {
    _label: DRY_RUN_LABEL,
    generated_at: new Date().toISOString(),
    connector_mode: getMode() || DEFAULT_MODE,
    active_send_requires: {
      env_var_mode: 'CHINTU_CONNECTOR_MODE=active',
      approval_phrase_env: DEFAULT_APPROVAL_ENV,
      explicit_approval_argument: '--approval',
      preview_file: previewPath,
      allowlist_match: true,
    },
    local_logs: {
      preview: path.relative(repoRoot, previewPath).replace(/\\/g, '/'),
      audit: path.relative(repoRoot, auditLogPath).replace(/\\/g, '/'),
      sent: path.relative(repoRoot, sentLogPath).replace(/\\/g, '/'),
    },
    hard_stops: [
      'Default mode is dry-run.',
      'No secrets are committed to the repo.',
      'No health data is allowed in outgoing connector payloads by default.',
      'No real send happens unless CHINTU_CONNECTOR_MODE=active and explicit approval is provided.',
    ],
    connectors: Object.keys(CONNECTORS)
      .map((name) => buildReadinessEntry(name))
      .sort((a, b) => a.priority - b.priority),
    bala_safety_footer: SAFETY_FOOTER,
  };
}

function writeJson(filePath, value) {
  ensureOutbox();
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function appendJsonl(filePath, value) {
  ensureOutbox();
  fs.appendFileSync(filePath, JSON.stringify(value) + '\n', 'utf8');
}

function buildPreview({ connector, body }) {
  const cleanedBody = validateMessageBody(body);
  const entry = buildReadinessEntry(connector);
  return {
    _label: DRY_RUN_LABEL,
    connector,
    preview_only: true,
    created_at: new Date().toISOString(),
    connector_mode: getMode() || DEFAULT_MODE,
    approval_required: true,
    allowlist_required: true,
    recipient: entry.configured_recipient,
    recipient_allowlisted: entry.recipient_allowlisted,
    body: cleanedBody,
    body_sha256: sha256(cleanedBody),
    no_real_send_reason:
      entry.current_mode !== 'active'
        ? 'CHINTU_CONNECTOR_MODE is not active'
        : 'Preview step completed; explicit send still requires approval phrase',
    bala_safety_footer: SAFETY_FOOTER,
  };
}

function loadPreview(filePath) {
  const target = filePath || previewPath;
  if (!fs.existsSync(target)) {
    throw new Error(`Preview file missing: ${target}`);
  }
  return JSON.parse(fs.readFileSync(target, 'utf8'));
}

function auditRecord(event, details) {
  return {
    timestamp: new Date().toISOString(),
    event,
    connector: details.connector,
    connector_mode: getMode() || DEFAULT_MODE,
    recipient: details.recipient || null,
    recipient_allowlisted: details.recipientAllowlisted ?? false,
    approval_phrase_present: Boolean(details.approvalProvided),
    preview_sha256: details.previewSha || null,
    outcome: details.outcome,
    reason: details.reason || null,
  };
}

function sentRecord(details) {
  return {
    timestamp: new Date().toISOString(),
    connector: details.connector,
    recipient: details.recipient || null,
    preview_sha256: details.previewSha || null,
    body_sha256: details.bodySha || null,
    http_status: details.httpStatus || null,
    request_id: details.requestId || null,
  };
}

function dispatchRequest(requestConfig) {
  return new Promise((resolve, reject) => {
    if (!requestConfig) {
      reject(new Error('Connector request config is unavailable.'));
      return;
    }
    const url = new URL(requestConfig.url);
    const req = https.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        path: `${url.pathname}${url.search}`,
        method: requestConfig.method,
        headers: requestConfig.headers,
        timeout: 10000,
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 0,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error('Connector request timed out.')));
    req.on('error', reject);
    req.write(requestConfig.body || '');
    req.end();
  });
}

async function attemptSend({ connector, previewFile, approval }) {
  const state = connectorState(connector);
  const preview = loadPreview(previewFile);
  const recipientAllowlisted = state.recipient ? state.allowlist.includes(state.recipient) : false;
  const previewSha = preview.body_sha256 || null;
  const baseAudit = {
    connector,
    recipient: state.recipient,
    recipientAllowlisted,
    approvalProvided: approval,
    previewSha,
  };

  if (preview.connector !== connector) {
    throw new Error(`Preview connector mismatch: expected ${connector}, found ${preview.connector}`);
  }
  if (preview.preview_only !== true) {
    throw new Error('Preview file is not marked preview_only.');
  }
  if (state.mode !== 'active') {
    appendJsonl(
      auditLogPath,
      auditRecord('blocked_send', {
        ...baseAudit,
        outcome: 'blocked',
        reason: 'CHINTU_CONNECTOR_MODE is not active',
      })
    );
    return { status: 'blocked', reason: 'CHINTU_CONNECTOR_MODE is not active' };
  }
  if (state.isPaused) {
    appendJsonl(
      auditLogPath,
      auditRecord('blocked_send', {
        ...baseAudit,
        outcome: 'blocked',
        reason: 'Connector pause file is present',
      })
    );
    return { status: 'blocked', reason: 'Connector pause file is present' };
  }
  if (state.missing.length) {
    appendJsonl(
      auditLogPath,
      auditRecord('blocked_send', {
        ...baseAudit,
        outcome: 'blocked',
        reason: `Missing env vars: ${state.missing.join(', ')}`,
      })
    );
    return { status: 'blocked', reason: `Missing env vars: ${state.missing.join(', ')}` };
  }
  if (!recipientAllowlisted) {
    appendJsonl(
      auditLogPath,
      auditRecord('blocked_send', {
        ...baseAudit,
        outcome: 'blocked',
        reason: 'Recipient is not allowlisted',
      })
    );
    return { status: 'blocked', reason: 'Recipient is not allowlisted' };
  }
  if (!getApprovalPhrase() || approval !== getApprovalPhrase()) {
    appendJsonl(
      auditLogPath,
      auditRecord('blocked_send', {
        ...baseAudit,
        outcome: 'blocked',
        reason: 'Approval phrase missing or mismatched',
      })
    );
    return { status: 'blocked', reason: 'Approval phrase missing or mismatched' };
  }
  if (state.connector.mode !== 'send-capable') {
    appendJsonl(
      auditLogPath,
      auditRecord('blocked_send', {
        ...baseAudit,
        outcome: 'blocked',
        reason: 'Connector is architecture-only in this stage',
      })
    );
    return { status: 'blocked', reason: 'Connector is architecture-only in this stage' };
  }

  const requestConfig = state.connector.buildRequest(state.envSnapshot, preview);
  const response = await dispatchRequest(requestConfig);
  appendJsonl(
    sentLogPath,
    sentRecord({
      connector,
      recipient: state.recipient,
      previewSha,
      bodySha: preview.body_sha256,
      httpStatus: response.statusCode,
    })
  );
  appendJsonl(
    auditLogPath,
    auditRecord('active_send', {
      ...baseAudit,
      outcome: 'sent',
      reason: `HTTP ${response.statusCode}`,
    })
  );
  return { status: 'sent', httpStatus: response.statusCode };
}

function printUsage() {
  console.log('Usage:');
  console.log('  node scripts/chintu-connector-send.js --check');
  console.log('  node scripts/chintu-connector-send.js --preview --connector telegram --body "..."');
  console.log('  node scripts/chintu-connector-send.js --send --connector telegram --preview-file CHINTU_OUTBOX/latest_connector_preview.json --approval "..."');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.check) {
    const report = buildReadinessReport();
    writeJson(readinessPath, report);
    console.log(`Connector readiness written: ${path.relative(repoRoot, readinessPath).replace(/\\/g, '/')}`);
    console.log('Mode: DRY RUN ONLY. No network call made.');
    return;
  }
  if (args.preview) {
    if (!args.connector) {
      throw new Error('--connector is required for --preview');
    }
    const preview = buildPreview({
      connector: String(args.connector).toLowerCase(),
      body: args.body || '',
    });
    writeJson(previewPath, preview);
    console.log(`Connector preview written: ${path.relative(repoRoot, previewPath).replace(/\\/g, '/')}`);
    console.log('Preview only. No network call made.');
    return;
  }
  if (args.send) {
    if (!args.connector) {
      throw new Error('--connector is required for --send');
    }
    const result = await attemptSend({
      connector: String(args.connector).toLowerCase(),
      previewFile: args['preview-file'],
      approval: String(args.approval || ''),
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  printUsage();
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`FAIL: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  CONNECTORS,
  buildPreview,
  buildReadinessReport,
  attemptSend,
  validateMessageBody,
  paths: {
    readinessPath,
    previewPath,
    auditLogPath,
    sentLogPath,
  },
};
