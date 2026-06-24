'use strict';

/**
 * chintu-voice-out.js — C57
 *
 * Converts text to a voice note and sends it via Telegram sendVoice.
 * Uses edge-tts (Microsoft neural TTS, Python package, free, no API key).
 *
 * Requires (one-time install): pip install edge-tts
 *
 * Voice: en-IN-NeerjaNeural — warm, natural Indian English female (Microsoft neural)
 * Fallback voices if you want to change:
 *   en-IN-PrabhatNeural — male, clear
 *   en-IN-AaravNeural   — male, conversational
 *
 * Flow:
 *   1. Clean text for speech (strip markdown, URLs, emoji)
 *   2. python -m edge_tts --voice en-IN-NeerjaNeural --text "..." --write-media /tmp/xxx.mp3
 *      (uses spawnSync to avoid shell injection)
 *   3. POST multipart/form-data to api.telegram.org/sendVoice
 *   4. Delete temp MP3 (always, in finally)
 *
 * Security:
 *   - spawnSync (no shell) used for edge-tts to prevent injection
 *   - Temp MP3 lives in os.tmpdir() (outside repo), deleted in finally
 *   - Token never printed or logged
 *
 * Network: api.telegram.org only (in scannerAllowlist via chintu-telegram-poll.js)
 * edge-tts itself calls speech.platform.bing.com from a Python subprocess —
 * that call is not scanned by the Node.js egress test.
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');
const os    = require('os');
const { spawnSync } = require('child_process');

const TTS_VOICE      = 'en-IN-NeerjaNeural';
const TTS_TIMEOUT_MS = 25000;
const SEND_TIMEOUT_MS = 30000;
const MAX_TEXT_CHARS  = 800;   // keep voice replies concise

function log(msg) { console.log('[voice-out] ' + msg); }

// ── Strip markdown / URLs / emoji for natural-sounding TTS ─────────────────
function cleanForTTS(text) {
  return String(text)
    .replace(/https?:\/\/\S+/g, 'the link')   // URLs → spoken phrase
    .replace(/[*_`#~>|]/g, '')                 // markdown symbols
    // common Chintu emoji that don't sound good spoken
    .replace(/[\u{1F300}-\u{1FFFF}]/gu, '')
    .replace(/[☀-⛿✀-➿]/g, '')
    .replace(/\[DRY-RUN\]\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TEXT_CHARS);
}

// ── Generate voice MP3 via edge-tts (Python) ────────────────────────────────
// Uses spawnSync (no shell) — avoids any shell-injection risk from Groq reply text.
// Returns true on success, false on failure.
function generateVoice(text, outputPath) {
  const cleaned = cleanForTTS(text);
  if (!cleaned) { log('Empty text after cleaning'); return false; }

  // Try python / python3 in platform-appropriate order
  const pythonCmds = process.platform === 'win32'
    ? ['python', 'python3']
    : ['python3', 'python'];

  for (const py of pythonCmds) {
    const result = spawnSync(
      py,
      ['-m', 'edge_tts', '--voice', TTS_VOICE, '--text', cleaned, '--write-media', outputPath],
      { timeout: TTS_TIMEOUT_MS, encoding: 'utf8' }
    );

    if (result.error) continue;   // command not found — try next

    if (result.status === 0 && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 100) {
      log('TTS OK: ' + Math.round(fs.statSync(outputPath).size / 1024) + ' KB');
      return true;
    }

    // edge-tts failed with this python command
    const errMsg = (result.stderr || '').slice(0, 80);
    if (errMsg) log('edge-tts stderr: ' + errMsg);
  }

  log('edge-tts failed — not installed? Run: pip install edge-tts');
  return false;
}

// ── Send voice note via Telegram sendVoice ───────────────────────────────────
function sendTelegramVoice(chatId, mp3Path, botToken) {
  return new Promise((resolve) => {
    let fileData;
    try {
      fileData = fs.readFileSync(mp3Path);
    } catch (_) { log('Could not read MP3 file'); resolve(false); return; }

    const boundary  = 'ChintuVoiceOut' + Date.now();
    const safeToken = encodeURIComponent(botToken).replace(/%3A/gi, ':');

    // Build multipart body manually (no npm deps)
    const pre = Buffer.from(
      '--' + boundary + '\r\n' +
      'Content-Disposition: form-data; name="chat_id"\r\n\r\n' +
      String(chatId) + '\r\n' +
      '--' + boundary + '\r\n' +
      'Content-Disposition: form-data; name="voice"; filename="chintu-reply.mp3"\r\n' +
      'Content-Type: audio/mpeg\r\n\r\n'
    );
    const post = Buffer.from('\r\n--' + boundary + '--\r\n');
    const body = Buffer.concat([pre, fileData, post]);

    const opts = {
      hostname: 'api.telegram.org',
      port: 443,
      path: '/bot' + safeToken + '/sendVoice',
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
        'Content-Length': body.length,
      },
    };

    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          if (j.ok) {
            log('Voice note sent to chat …' + String(chatId).slice(-4));
            resolve(true);
          } else {
            log('sendVoice error: ' + (j.description || JSON.stringify(j)).slice(0, 80));
            resolve(false);
          }
        } catch (_) { resolve(false); }
      });
    });

    req.on('error', (e) => {
      log('sendVoice request error: ' + e.message.slice(0, 60));
      resolve(false);
    });
    req.setTimeout(SEND_TIMEOUT_MS, () => {
      req.destroy();
      log('sendVoice timeout');
      resolve(false);
    });
    req.write(body);
    req.end();
  });
}

// ── Main export ──────────────────────────────────────────────────────────────
/**
 * replyWithVoice(chatId, text, botToken)
 * Returns: Promise<boolean>  — true if voice note sent, false on any failure.
 * Caller should fall back to sendMessage if this returns false.
 */
async function replyWithVoice(chatId, text, botToken) {
  if (!chatId || !text || !botToken) {
    log('Missing chatId, text, or botToken');
    return false;
  }

  const mp3Path = path.join(os.tmpdir(), 'chintu-reply-' + Date.now() + '.mp3');
  try {
    if (!generateVoice(text, mp3Path)) return false;
    return await sendTelegramVoice(chatId, mp3Path, botToken);
  } finally {
    try { if (fs.existsSync(mp3Path)) fs.unlinkSync(mp3Path); } catch (_) {}
  }
}

module.exports = { replyWithVoice, generateVoice, cleanForTTS };
