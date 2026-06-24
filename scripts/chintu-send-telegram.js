#!/usr/bin/env node
'use strict';
/**
 * chintu-send-telegram.js -- Stage C51
 *
 * Shared Telegram send utility.
 * Required by:
 *   chintu-autonomous-brain.js  -> proactive morning push (no typing needed from phone)
 *   chintu-telegram-poll.js     -> (imports separately -- this module is optional dep)
 *
 * Security rules:
 *   - Token NEVER printed, logged, or stored to disk.
 *   - Chat IDs only revealed as masked (last 3 digits) in logs.
 *   - sendTelegramMessage() returns false (not throw) on skip/error -- always safe to call.
 *   - Only sends to CHINTU_TELEGRAM_ALLOWED_CHAT_IDS[0] (the founder's chat).
 *   - CHINTU_TELEGRAM_SEND_ENABLED=1 required gate -- always respected.
 *
 * Usage:
 *   const { sendTelegramMessage } = require('./chintu-send-telegram.js');
 *   await sendTelegramMessage('Hello from Chintu!');
 *
 *   // With explicit chatId override (optional):
 *   await sendTelegramMessage('Hello!', { chatId: '970688582' });
 */

const https = require('https');

// ── Token helpers (never print) ────────────────────────────────────────────
function loadToken() {
  return String(process.env.TELEGRAM_BOT_TOKEN || '').trim()
    .replace(/^["']|["']$/g, '')
    .replace(/^bot/i, '');
}

function redactToken(str, token) {
  if (!token || token.length < 8) return String(str);
  return String(str).replace(
    new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
    '[REDACTED]'
  );
}

function maskId(id) {
  const s = String(id || '');
  if (s.length <= 3) return '***';
  return '*'.repeat(s.length - 3) + s.slice(-3);
}

// ── Telegram HTTP helper ───────────────────────────────────────────────────
function telegramPost(token, method, params) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(params);
    // URL-encode token; allow colon through (Telegram token format: NNNNNN:hash)
    const encodedToken = encodeURIComponent(token).replace(/%3A/gi, ':');
    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: '/bot' + encodedToken + '/' + method,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (_e) { reject(new Error('Parse error: ' + data.slice(0, 200))); }
      });
    });
    req.on('error', (e) => reject(new Error(redactToken(e.message, token))));
    req.setTimeout(15000, () => { req.destroy(new Error('Telegram request timeout')); });
    req.write(body);
    req.end();
  });
}

// ── Main export ────────────────────────────────────────────────────────────
/**
 * Send a Telegram message to the founder's chat.
 *
 * @param {string} text     -- message text (auto-truncated to 4000 chars)
 * @param {object} opts     -- optional: { chatId: '...' } to override chat ID
 * @returns {Promise<boolean>} true = sent, false = skipped or error
 *
 * Skips silently (returns false) when:
 *   - TELEGRAM_BOT_TOKEN not set
 *   - CHINTU_TELEGRAM_SEND_ENABLED != '1'
 *   - CHINTU_TELEGRAM_ALLOWED_CHAT_IDS not configured
 */
async function sendTelegramMessage(text, opts) {
  const options    = opts || {};
  const token      = loadToken();
  const sendEnabled = String(process.env.CHINTU_TELEGRAM_SEND_ENABLED || '').trim() === '1';

  if (!token) {
    console.log('[chintu-send-telegram] SKIP: TELEGRAM_BOT_TOKEN not set');
    return false;
  }
  if (!sendEnabled) {
    console.log('[chintu-send-telegram] SKIP: CHINTU_TELEGRAM_SEND_ENABLED != 1');
    return false;
  }

  // Resolve chat ID
  let chatId = options.chatId;
  if (!chatId) {
    const ids = String(process.env.CHINTU_TELEGRAM_ALLOWED_CHAT_IDS || '')
      .split(',').map(s => s.trim()).filter(Boolean);
    if (!ids.length) {
      console.log('[chintu-send-telegram] SKIP: CHINTU_TELEGRAM_ALLOWED_CHAT_IDS not configured');
      return false;
    }
    chatId = ids[0];
  }

  const safeText = String(text || '').slice(0, 4000);

  try {
    const result = await telegramPost(token, 'sendMessage', {
      chat_id: chatId,
      text: safeText,
    });
    if (result.ok) {
      console.log('[chintu-send-telegram] Sent to chat ' + maskId(chatId) + ' (' + safeText.length + ' chars)');
      return true;
    } else {
      console.log('[chintu-send-telegram] API error: ' + JSON.stringify(result).slice(0, 200));
      return false;
    }
  } catch (e) {
    console.log('[chintu-send-telegram] Error: ' + redactToken(e.message, token));
    return false;
  }
}

module.exports = { sendTelegramMessage };
