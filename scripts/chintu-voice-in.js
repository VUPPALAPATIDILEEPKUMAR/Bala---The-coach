'use strict';

/**
 * chintu-voice-in.js — C57
 *
 * Downloads a Telegram voice message (OGG OPUS) and transcribes it via Groq Whisper.
 * No npm dependencies. Pure Node.js (https, fs, path, os, child_process).
 *
 * Flow:
 *   1. Telegram getFile(file_id)  → file_path on Telegram servers
 *   2. Download api.telegram.org/file/bot{TOKEN}/{file_path}  → .ogg temp file
 *   3. Try ffmpeg conversion OGG → MP3 (better format compat; graceful fallback to OGG)
 *   4. POST multipart/form-data to api.groq.com/openai/v1/audio/transcriptions
 *      model: whisper-large-v3-turbo, response_format: text
 *   5. Return transcript string (or null on any failure)
 *
 * Security:
 *   - No transcript stored to disk
 *   - Temp audio files live in os.tmpdir() (outside repo), deleted in finally block
 *   - Token never printed or logged
 *
 * Network: api.telegram.org + api.groq.com
 *   Both already in chintu-no-network-egress.test.js scannerAllowlist.
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');
const os    = require('os');
const { execSync, spawnSync } = require('child_process');

const GROQ_STT_MODEL = 'whisper-large-v3-turbo';
const STT_TIMEOUT_MS = 35000;   // Whisper can take a moment on longer clips
const DL_TIMEOUT_MS  = 20000;

function log(msg) { console.log('[voice-in] ' + msg); }

// ── Step 1: Get Telegram file_path from file_id ──────────────────────────────
function getTelegramFilePath(fileId, botToken) {
  return new Promise((resolve) => {
    const safeToken = encodeURIComponent(botToken).replace(/%3A/gi, ':');
    const opts = {
      hostname: 'api.telegram.org',
      port: 443,
      path: '/bot' + safeToken + '/getFile?file_id=' + encodeURIComponent(fileId),
      method: 'GET',
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          resolve((j.result && j.result.file_path) ? j.result.file_path : null);
        } catch (_) { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(10000, () => { req.destroy(); resolve(null); });
    req.end();
  });
}

// ── Step 2: Download OGG from Telegram file servers ──────────────────────────
function downloadTelegramFile(filePath, botToken, destPath) {
  return new Promise((resolve, reject) => {
    const safeToken = encodeURIComponent(botToken).replace(/%3A/gi, ':');
    const opts = {
      hostname: 'api.telegram.org',
      port: 443,
      path: '/file/bot' + safeToken + '/' + filePath,
      method: 'GET',
    };
    const file = fs.createWriteStream(destPath);
    const req = https.request(opts, (res) => {
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
      file.on('error', (e) => {
        try { fs.unlinkSync(destPath); } catch (_) {}
        reject(e);
      });
    });
    req.on('error', (e) => {
      try { fs.unlinkSync(destPath); } catch (_) {}
      reject(e);
    });
    req.setTimeout(DL_TIMEOUT_MS, () => { req.destroy(); reject(new Error('download timeout')); });
    req.end();
  });
}

// ── Step 3: Try ffmpeg OGG → MP3 (graceful fallback to raw OGG) ─────────────
// Returns { path, type, name, isMp3 }
function prepareAudio(oggPath) {
  const mp3Path = oggPath.replace(/\.[^.]+$/, '.mp3');
  try {
    // No shell injection risk: paths are under os.tmpdir()
    execSync('ffmpeg -y -i "' + oggPath + '" -ar 16000 -ac 1 "' + mp3Path + '"', {
      timeout: 15000,
      stdio: 'ignore',
    });
    if (fs.existsSync(mp3Path) && fs.statSync(mp3Path).size > 100) {
      log('ffmpeg: OGG → MP3 (' + fs.statSync(mp3Path).size + ' bytes)');
      return { path: mp3Path, type: 'audio/mpeg', name: 'audio.mp3', isMp3: true };
    }
  } catch (_) {
    log('ffmpeg not available — sending OGG directly to Groq Whisper');
  }
  return { path: oggPath, type: 'audio/ogg', name: 'audio.ogg', isMp3: false };
}

// ── Step 4: Groq Whisper transcription via multipart/form-data ───────────────
function groqWhisperTranscribe(audioPath, audioType, audioName, groqApiKey) {
  return new Promise((resolve) => {
    let fileData;
    try {
      fileData = fs.readFileSync(audioPath);
    } catch (_) { log('Could not read audio file'); resolve(null); return; }

    const boundary = 'ChintuWhisper' + Date.now();

    // Build multipart body manually (no npm deps)
    const pre = Buffer.from(
      '--' + boundary + '\r\n' +
      'Content-Disposition: form-data; name="model"\r\n\r\n' +
      GROQ_STT_MODEL + '\r\n' +
      '--' + boundary + '\r\n' +
      'Content-Disposition: form-data; name="response_format"\r\n\r\n' +
      'text\r\n' +
      '--' + boundary + '\r\n' +
      'Content-Disposition: form-data; name="file"; filename="' + audioName + '"\r\n' +
      'Content-Type: ' + audioType + '\r\n\r\n'
    );
    const post = Buffer.from('\r\n--' + boundary + '--\r\n');
    const body = Buffer.concat([pre, fileData, post]);

    const opts = {
      hostname: 'api.groq.com',
      port: 443,
      path: '/openai/v1/audio/transcriptions',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + groqApiKey,
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
        'Content-Length': body.length,
      },
    };

    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        const text = data.trim();
        if (!text) { resolve(null); return; }
        // Groq returns plain text when response_format=text
        // But may return JSON on error
        if (text.startsWith('{')) {
          try {
            const j = JSON.parse(text);
            if (j.error) log('Whisper error: ' + (j.error.message || '').slice(0, 80));
            resolve(j.text || null);
          } catch (_) { resolve(null); }
        } else {
          log('Transcript OK: "' + text.slice(0, 80) + (text.length > 80 ? '…' : '') + '"');
          resolve(text);
        }
      });
    });

    req.on('error', (e) => {
      log('Groq Whisper request error: ' + e.message.slice(0, 60));
      resolve(null);
    });
    req.setTimeout(STT_TIMEOUT_MS, () => {
      req.destroy();
      log('Groq Whisper timeout after ' + STT_TIMEOUT_MS + 'ms');
      resolve(null);
    });
    req.write(body);
    req.end();
  });
}

// ── Main export ──────────────────────────────────────────────────────────────
/**
 * transcribeVoiceMessage(fileId, botToken, groqApiKey)
 * Returns: Promise<string|null>  — transcript text, or null on any failure.
 */
async function transcribeVoiceMessage(fileId, botToken, groqApiKey) {
  if (!fileId || !botToken || !groqApiKey) {
    log('Missing fileId, botToken, or groqApiKey — aborting');
    return null;
  }

  const tmpBase = path.join(os.tmpdir(), 'chintu-voice-' + Date.now());
  const oggPath = tmpBase + '.ogg';
  let   mp3Path = null;

  try {
    // 1. Get Telegram file path
    const filePath = await getTelegramFilePath(fileId, botToken);
    if (!filePath) { log('Could not get file_path from Telegram'); return null; }

    // 2. Download OGG voice file
    await downloadTelegramFile(filePath, botToken, oggPath);
    const size = fs.statSync(oggPath).size;
    log('Downloaded OGG: ' + size + ' bytes');
    if (size < 100) { log('OGG too small — empty voice message?'); return null; }

    // 3. Convert to MP3 if ffmpeg available (otherwise use OGG directly)
    const audio = prepareAudio(oggPath);
    if (audio.isMp3) mp3Path = audio.path;

    // 4. Transcribe with Groq Whisper
    const transcript = await groqWhisperTranscribe(audio.path, audio.type, audio.name, groqApiKey);
    return transcript;

  } catch (e) {
    log('transcribeVoiceMessage error: ' + e.message.slice(0, 100));
    return null;
  } finally {
    // Always clean up temp files — transcript is never stored to disk
    try { if (fs.existsSync(oggPath)) fs.unlinkSync(oggPath); } catch (_) {}
    try { if (mp3Path && fs.existsSync(mp3Path)) fs.unlinkSync(mp3Path); } catch (_) {}
  }
}

module.exports = { transcribeVoiceMessage };
