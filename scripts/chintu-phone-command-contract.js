#!/usr/bin/env node
'use strict';

// =============================================================================
// Chintu Phone Command Contract - Stage 29
// -----------------------------------------------------------------------------
// Pure local helpers for normalizing phone/Telegram-shaped command payloads
// before any real connector is activated.
//
// Hard properties:
//   * No network, no fs, no shell, no side effects.
//   * Sender allowlist denies by default.
//   * Classification reuses the deterministic brain router where practical.
//   * External-send style requests stay parked and require approval.
//   * Health-sensitive messages never run local actions.
//   * Any eventual execution stays behind the existing bridge allowlists.
// =============================================================================

const brain = require('./chintu-brain-router.js');

const DEFAULT_CHANNEL = 'telegram';
const TYPE = brain.TYPE;
const RISK = brain.RISK;

const EXTERNAL_SEND_PHRASES = [
  'send telegram',
  'send a telegram',
  'telegram me',
  'message me',
  'text me',
  'notify me',
  'ping my phone',
  'send heartbeat',
  'send status',
  'send update',
  'send alert',
  'phone command send',
];

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function normalizeId(value) {
  if (value == null) return '';
  return String(value).trim();
}

function normalizeText(value) {
  if (value == null) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function normalizeName(value) {
  if (value == null) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function normalizeIsoTimestamp(value) {
  if (value == null || value === '') return null;

  let date = null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    date = new Date(value * 1000);
  } else {
    const raw = String(value).trim();
    if (/^\d+$/.test(raw)) {
      date = new Date(Number(raw) * 1000);
    } else {
      date = new Date(raw);
    }
  }

  if (!date || Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function normalizePhoneCommandPayload(payload) {
  const root = asObject(payload);
  if (!root) {
    return {
      ok: false,
      channel: DEFAULT_CHANNEL,
      source: DEFAULT_CHANNEL,
      shape: 'unsupported',
      chatId: '',
      senderId: '',
      senderName: '',
      text: '',
      textNormalized: '',
      timestamp: null,
      issues: ['invalid_payload'],
    };
  }

  let source = DEFAULT_CHANNEL;
  let shape = 'generic';
  let chatId = '';
  let senderId = '';
  let senderName = '';
  let text = '';
  let timestamp = null;

  if (asObject(root.message)) {
    const message = root.message;
    const chat = asObject(message.chat);
    const from = asObject(message.from);

    shape = 'telegram_update';
    source = DEFAULT_CHANNEL;
    chatId = normalizeId(chat && chat.id);
    senderId = normalizeId(from && from.id);
    senderName = normalizeName(
      (from && (from.first_name || from.username || from.last_name)) ||
      root.senderName
    );
    text = normalizeText(message.text);
    timestamp = normalizeIsoTimestamp(message.date);
  } else {
    source = normalizeText(root.source || DEFAULT_CHANNEL).toLowerCase() || DEFAULT_CHANNEL;
    chatId = normalizeId(root.chatId);
    senderId = normalizeId(root.senderId);
    senderName = normalizeName(root.senderName);
    text = normalizeText(root.text);
    timestamp = normalizeIsoTimestamp(root.timestamp);
  }

  const issues = [];
  if (!chatId) issues.push('missing_chat_id');
  if (!senderId) issues.push('missing_sender_id');
  if (!text) issues.push('missing_text');
  if (!timestamp) issues.push('missing_timestamp');

  return {
    ok: true,
    channel: DEFAULT_CHANNEL,
    source,
    shape,
    chatId,
    senderId,
    senderName,
    text,
    textNormalized: brain.normalize(text),
    timestamp,
    issues,
  };
}

function toIdSet(values) {
  const set = new Set();
  if (!Array.isArray(values)) return set;
  for (const value of values) {
    const id = normalizeId(value);
    if (id) set.add(id);
  }
  return set;
}

function isAllowedPhoneSender(payload, options) {
  const normalized = payload && payload.channel === DEFAULT_CHANNEL && Array.isArray(payload.issues)
    ? payload
    : normalizePhoneCommandPayload(payload);
  const senderIds = toIdSet(options && options.allowedSenderIds);
  const chatIds = toIdSet(options && options.allowedChatIds);

  if (!normalized.ok) {
    return {
      ok: false,
      allowed: false,
      reason: 'invalid_payload',
      normalized,
    };
  }

  if (senderIds.size === 0 && chatIds.size === 0) {
    return {
      ok: true,
      allowed: false,
      reason: 'allowlist_required',
      normalized,
    };
  }

  if (normalized.senderId && senderIds.has(normalized.senderId)) {
    return {
      ok: true,
      allowed: true,
      reason: 'sender_id_allowed',
      normalized,
    };
  }

  if (normalized.chatId && chatIds.has(normalized.chatId)) {
    return {
      ok: true,
      allowed: true,
      reason: 'chat_id_allowed',
      normalized,
    };
  }

  if (!normalized.senderId && !normalized.chatId) {
    return {
      ok: true,
      allowed: false,
      reason: 'missing_sender_and_chat',
      normalized,
    };
  }

  return {
    ok: true,
    allowed: false,
    reason: 'sender_not_allowlisted',
    normalized,
  };
}

function hasAny(text, phrases) {
  for (const phrase of phrases) {
    if (text.indexOf(phrase) !== -1) return true;
  }
  return false;
}

function isExternalSendStyle(textNormalized) {
  if (!textNormalized) return false;
  if (hasAny(textNormalized, EXTERNAL_SEND_PHRASES)) return true;
  return /\bsend\b/.test(textNormalized) && /\b(telegram|message|text|notify|phone|alert|status|heartbeat|update)\b/.test(textNormalized);
}

function filterAllowlistedActions(actions) {
  if (!Array.isArray(actions)) return [];
  return actions.filter((action) => brain.KNOWN_ACTIONS.indexOf(action) !== -1);
}

function buildActionSummary(result) {
  if (!result.allowed) {
    return 'Blocked before any local action handoff.';
  }
  if (result.sequence) {
    return 'Would hand off the "' + result.sequence + '" sequence to the localhost bridge allowlist.';
  }
  if (Array.isArray(result.actions) && result.actions.length > 0) {
    return 'Would hand off allowlisted bridge actions: ' + result.actions.join(', ') + '.';
  }
  return 'Reply-only classification. No local bridge action would run.';
}

function buildAuditHint(result) {
  if (!result.allowed) {
    return 'Blocked locally: sender not allowlisted. No Telegram send performed.';
  }
  if (result.requiresApproval) {
    return 'Approval gate remains closed. No Telegram send performed.';
  }
  if (result.risk === RISK.HEALTH) {
    return 'Health-sensitive text parked locally. No local bridge action or Telegram send performed.';
  }
  return 'Stage 29 local-only preview. Any future execution stays behind bridge allowlists and no Telegram send was performed.';
}

function scrubReplyText(value) {
  let text = String(value == null ? '' : value);
  text = text.replace(/\b\d{6,}:[A-Za-z0-9_-]{20,}\b/g, '[REDACTED_TOKEN]');
  text = text.replace(/https?:\/\/\S+/gi, '[REDACTED_URL]');
  text = text.replace(/api\.telegram\.org/gi, '[REDACTED_URL]');
  return text;
}

function finalizeClassification(base, partial) {
  const actions = filterAllowlistedActions(partial.actions);
  const sequence = partial.sequence && Object.prototype.hasOwnProperty.call(brain.KNOWN_SEQUENCES, partial.sequence)
    ? partial.sequence
    : null;
  const result = {
    ok: base.ok,
    allowed: base.allowed,
    allowReason: base.allowReason,
    normalized: base.normalized,
    intent: partial.intent,
    track: partial.track,
    risk: partial.risk,
    responseType: partial.responseType,
    actions,
    sequence,
    reply: partial.reply,
    safeToRun: Boolean(partial.safeToRun),
    requiresApproval: Boolean(partial.requiresApproval),
  };
  result.actionSummary = buildActionSummary(result);
  result.auditHint = buildAuditHint(result);
  return result;
}

function classifyPhoneCommand(payload, options) {
  const allow = isAllowedPhoneSender(payload, options);
  const normalized = allow.normalized;
  const base = {
    ok: allow.ok,
    allowed: allow.allowed,
    allowReason: allow.reason,
    normalized,
  };

  if (!allow.ok) {
    return finalizeClassification(base, {
      intent: 'invalid_payload',
      track: 'chintu',
      risk: RISK.READ,
      responseType: TYPE.PARKED,
      actions: [],
      sequence: null,
      reply: 'I could not normalize that phone command payload safely, so nothing ran.',
      safeToRun: false,
      requiresApproval: false,
    });
  }

  if (brain.isEmergency(normalized.textNormalized)) {
    return finalizeClassification(base, {
      intent: 'health_emergency',
      track: 'bala',
      risk: RISK.HEALTH,
      responseType: TYPE.PARKED,
      actions: [],
      sequence: null,
      reply: brain.route(normalized.text).reply,
      safeToRun: false,
      requiresApproval: false,
    });
  }

  if (!normalized.text) {
    return finalizeClassification(base, {
      intent: 'missing_text',
      track: 'chintu',
      risk: RISK.READ,
      responseType: TYPE.CONVERSATION,
      actions: [],
      sequence: null,
      reply: 'I did not receive a command text yet. Send something like "hi", "check everything", or "validate Bala".',
      safeToRun: false,
      requiresApproval: false,
    });
  }

  if (!allow.allowed) {
    return finalizeClassification(base, {
      intent: 'blocked_sender',
      track: 'chintu',
      risk: RISK.READ,
      responseType: TYPE.PARKED,
      actions: [],
      sequence: null,
      reply: 'This sender is not on the phone-command allowlist, so nothing will run. Add the sender ID or chat ID explicitly before enabling this path.',
      safeToRun: false,
      requiresApproval: false,
    });
  }

  if (isExternalSendStyle(normalized.textNormalized)) {
    return finalizeClassification(base, {
      intent: 'external_send_request',
      track: 'chintu',
      risk: RISK.SEND,
      responseType: TYPE.PARKED,
      actions: [],
      sequence: null,
      reply: 'Phone send-style commands stay parked in Stage 29. This contract only prepares local payload handling; any real Telegram send remains disabled and founder-approval gated.',
      safeToRun: false,
      requiresApproval: true,
    });
  }

  const routed = brain.route(normalized.text);
  const actions = routed.risk === RISK.HEALTH ? [] : filterAllowlistedActions(routed.actions);
  const sequence = routed.risk === RISK.HEALTH ? null : routed.sequence;
  const safeToRun = routed.intent !== 'missing_text' &&
    routed.risk !== RISK.HEALTH &&
    routed.risk !== RISK.SEND &&
    routed.responseType !== TYPE.PARKED;

  return finalizeClassification(base, {
    intent: routed.intent,
    track: routed.track,
    risk: routed.risk,
    responseType: routed.responseType,
    actions,
    sequence,
    reply: routed.reply,
    safeToRun,
    requiresApproval: false,
  });
}

function buildPhoneReplyEnvelope(result, options) {
  const normalized = result && result.normalized && result.normalized.channel === DEFAULT_CHANNEL
    ? result.normalized
    : normalizePhoneCommandPayload(options && options.payload);
  const text = scrubReplyText(result && result.reply);
  const actionSummary = scrubReplyText(
    (result && result.actionSummary) || buildActionSummary(result || {
      allowed: false,
      sequence: null,
      actions: [],
    })
  );
  const auditHint = scrubReplyText(
    (result && result.auditHint) || buildAuditHint(result || {
      allowed: false,
      requiresApproval: false,
      risk: RISK.READ,
    })
  );

  return {
    ok: Boolean(result && result.ok && text),
    channel: DEFAULT_CHANNEL,
    chatId: normalizeId((options && options.chatId) || (normalized && normalized.chatId)) || null,
    text,
    actionSummary,
    requiresApproval: Boolean(result && result.requiresApproval),
    auditHint,
  };
}

module.exports = {
  normalizePhoneCommandPayload,
  isAllowedPhoneSender,
  classifyPhoneCommand,
  buildPhoneReplyEnvelope,
};
