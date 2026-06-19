#!/usr/bin/env node
'use strict';

const crypto = require('crypto');

const brain = require('./chintu-brain-router.js');
const contract = require('./chintu-phone-command-contract.js');

const CHANNEL = 'telegram';
const SUPPORTED_UPDATE_FIELDS = ['message', 'edited_message'];
const BLOCKED_UPDATE_FIELDS = ['callback_query', 'channel_post', 'edited_channel_post', 'inline_query'];

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function normalizeId(value) {
  if (value == null) return '';
  return String(value).trim();
}

function normalizeName(value) {
  if (value == null) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function normalizeText(value) {
  if (value == null) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value == null ? '' : value)).digest('hex');
}

function buildGenericPayload(message) {
  const chat = asObject(message.chat);
  const from = asObject(message.from);
  const senderName = normalizeName(
    [
      from && from.first_name,
      from && from.last_name,
    ].filter(Boolean).join(' ') || (from && from.username) || ''
  );

  return {
    source: CHANNEL,
    chatId: normalizeId(chat && chat.id),
    senderId: normalizeId(from && from.id),
    senderName,
    text: normalizeText(message.text),
    timestamp: message && message.date != null ? message.date : null,
  };
}

function buildReplyEnvelope(chatId, reply, actionSummary, auditHint) {
  return contract.buildPhoneReplyEnvelope({
    ok: true,
    allowed: false,
    requiresApproval: false,
    normalized: { channel: CHANNEL, chatId: normalizeId(chatId) },
    reply,
    actionSummary,
    auditHint,
  });
}

function normalizeTelegramUpdate(update) {
  const root = asObject(update);
  if (!root) {
    return {
      ok: false,
      channel: CHANNEL,
      supported: false,
      reason: 'invalid_update_payload',
      updateType: 'unknown',
      updateId: '',
      genericPayload: null,
      normalizedPhonePayload: null,
    };
  }

  const updateId = normalizeId(root.update_id);

  for (const field of BLOCKED_UPDATE_FIELDS) {
    if (asObject(root[field])) {
      const blocked = asObject(root[field]);
      const chat = asObject(blocked.message && blocked.message.chat) || asObject(blocked.chat);
      const from = asObject(blocked.from);
      return {
        ok: true,
        channel: CHANNEL,
        supported: false,
        reason: 'unsupported_update_type',
        updateType: field,
        updateId,
        genericPayload: {
          source: CHANNEL,
          chatId: normalizeId(chat && chat.id),
          senderId: normalizeId(from && from.id),
          senderName: normalizeName(from && (from.first_name || from.username || from.last_name)),
          text: '',
          timestamp: null,
        },
        normalizedPhonePayload: null,
      };
    }
  }

  for (const field of SUPPORTED_UPDATE_FIELDS) {
    if (!asObject(root[field])) continue;
    const message = root[field];
    const genericPayload = buildGenericPayload(message);
    if (typeof message.text !== 'string' || !normalizeText(message.text)) {
      return {
        ok: true,
        channel: CHANNEL,
        supported: false,
        reason: 'non_text_message',
        updateType: field,
        updateId,
        genericPayload,
        normalizedPhonePayload: contract.normalizePhoneCommandPayload(genericPayload),
      };
    }

    return {
      ok: true,
      channel: CHANNEL,
      supported: true,
      reason: null,
      updateType: field,
      updateId,
      genericPayload,
      normalizedPhonePayload: contract.normalizePhoneCommandPayload(genericPayload),
    };
  }

  return {
    ok: true,
    channel: CHANNEL,
    supported: false,
    reason: 'unsupported_update_shape',
    updateType: 'unknown',
    updateId,
    genericPayload: {
      source: CHANNEL,
      chatId: '',
      senderId: '',
      senderName: '',
      text: '',
      timestamp: null,
    },
    normalizedPhonePayload: null,
  };
}

function buildUnsupportedPreview(normalizedUpdate) {
  const reason = normalizedUpdate && normalizedUpdate.reason ? normalizedUpdate.reason : 'unsupported_update_shape';
  const updateType = normalizedUpdate && normalizedUpdate.updateType ? normalizedUpdate.updateType : 'unknown';
  const generic = normalizedUpdate && normalizedUpdate.genericPayload ? normalizedUpdate.genericPayload : {};
  let reply = 'That Telegram payload could not be normalized safely, so nothing ran.';
  let actionSummary = 'Blocked before any local bridge handoff.';
  let auditHint = 'Telegram preview only. No local bridge action or Telegram send was performed.';

  if (reason === 'unsupported_update_type') {
    reply = 'That Telegram update type is parked in Stage 30. Chintu only accepts direct text messages and edited text messages on the phone path.';
    actionSummary = 'Blocked update type: ' + updateType + '. No action or sequence would run.';
  } else if (reason === 'non_text_message') {
    reply = 'I only accept text commands on the Telegram phone path right now. Non-text updates stay parked.';
    actionSummary = 'Blocked non-text Telegram update. No action or sequence would run.';
  }

  return {
    ok: true,
    channel: CHANNEL,
    supported: false,
    previewMode: 'dry-run',
    updateType,
    updateId: normalizedUpdate && normalizedUpdate.updateId ? normalizedUpdate.updateId : '',
    text: '',
    textSha256: sha256(''),
    normalizedPhonePayload: normalizedUpdate && normalizedUpdate.normalizedPhonePayload,
    allowlisted: false,
    allowReason: reason,
    intent: reason,
    track: 'chintu',
    risk: brain.RISK.READ,
    responseType: brain.TYPE.PARKED,
    safeToRun: false,
    healthSensitive: false,
    requiresApproval: false,
    wouldRunActions: [],
    wouldRunSequence: null,
    bridgeHandoffSummary: actionSummary,
    replyEnvelope: buildReplyEnvelope(
      generic.chatId,
      reply,
      actionSummary,
      auditHint
    ),
    commandSummary: {
      senderId: normalizeId(generic.senderId),
      chatId: normalizeId(generic.chatId),
      senderName: normalizeName(generic.senderName),
      textPreview: '',
    },
  };
}

function buildTelegramDryRunPreview(update, options) {
  const normalizedUpdate = normalizeTelegramUpdate(update);
  if (!normalizedUpdate.ok || !normalizedUpdate.supported) {
    return buildUnsupportedPreview(normalizedUpdate);
  }

  const classification = contract.classifyPhoneCommand(normalizedUpdate.genericPayload, {
    allowedSenderIds: options && options.allowedSenderIds,
    allowedChatIds: options && options.allowedChatIds,
  });
  const replyEnvelope = contract.buildPhoneReplyEnvelope(classification, {
    chatId: normalizedUpdate.genericPayload.chatId,
    payload: normalizedUpdate.genericPayload,
  });
  const text = normalizedUpdate.genericPayload.text || '';

  return {
    ok: true,
    channel: CHANNEL,
    supported: true,
    previewMode: 'dry-run',
    updateType: normalizedUpdate.updateType,
    updateId: normalizedUpdate.updateId,
    text,
    textSha256: sha256(text),
    normalizedPhonePayload: classification.normalized,
    allowlisted: Boolean(classification.allowed),
    allowReason: classification.allowReason,
    intent: classification.intent,
    track: classification.track,
    risk: classification.risk,
    responseType: classification.responseType,
    safeToRun: Boolean(classification.safeToRun),
    healthSensitive: classification.risk === brain.RISK.HEALTH,
    requiresApproval: Boolean(classification.requiresApproval),
    wouldRunActions: Array.isArray(classification.actions) ? classification.actions.slice() : [],
    wouldRunSequence: classification.sequence || null,
    bridgeHandoffSummary: classification.actionSummary,
    replyEnvelope,
    commandSummary: {
      senderId: classification.normalized.senderId,
      chatId: classification.normalized.chatId,
      senderName: classification.normalized.senderName,
      textPreview: text.slice(0, 120),
    },
  };
}

function canExecuteLocally(preview) {
  if (!preview || !preview.ok || !preview.supported) return false;
  if (!preview.allowlisted) return false;
  if (!preview.safeToRun) return false;
  if (preview.healthSensitive) return false;
  if (preview.requiresApproval) return false;
  return true;
}

module.exports = {
  normalizeTelegramUpdate,
  buildTelegramDryRunPreview,
  canExecuteLocally,
};
