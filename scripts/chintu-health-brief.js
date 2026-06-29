#!/usr/bin/env node
// chintu-health-brief.js -- C68: Morning BALA Health Brief
//
// Reads ~/bala-daily-snapshot.json (exported from BALA via B68 export button).
// Calls Groq llama-3.3-70b-versatile to generate a warm 2-3 paragraph brief.
// Sends via Telegram. Always exits 0 (safe for Task Scheduler).
//
// Required env vars (same as existing Chintu setup):
//   TELEGRAM_BOT_TOKEN + CHINTU_TELEGRAM_ALLOWED_CHAT_IDS + CHINTU_TELEGRAM_SEND_ENABLED=1
//                                        -- Telegram delivery through the shared helper
//   GROQ_KEY or GROQ_API_KEY            -- Groq AI brief generation (optional,
//                                          falls back to plain-text digest if absent)
//
// Egress: api.groq.com (Groq AI brief), api.telegram.org (send only)
// Privacy: health values never logged to console. No external upload of data.

'use strict';

const fs    = require('fs');
const https = require('https');
const os    = require('os');
const path  = require('path');

const { sendTelegramMessage } = require('./chintu-send-telegram.js');

const SNAPSHOT_PATH = path.join(os.homedir(), 'bala-daily-snapshot.json');

function safeExit() { process.exit(0); }

// ─── Telegram ────────────────────────────────────────────────────────────────
async function sendTelegram(text) {
  return sendTelegramMessage(
    String(text || '')
      .replace(/<code>/g, '')
      .replace(/<\/code>/g, '')
      .replace(/<b>/g, '')
      .replace(/<\/b>/g, '')
      .replace(/<i>/g, '')
      .replace(/<\/i>/g, '')
  );
}

// ─── Groq AI brief ───────────────────────────────────────────────────────────
async function callGroq(prompt) {
  const key = process.env.GROQ_KEY || process.env.GROQ_API_KEY;
  if (!key) return null;                  // gate: optional

  const body = JSON.stringify({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: [
          'You are BALA, a calm health-awareness companion built by a founder in memory of his father Balaji.',
          'Write a warm morning brief of 2-3 short paragraphs, strictly under 120 words.',
          'NEVER diagnose, prescribe, treat, predict, or claim to prevent any medical condition.',
          'NEVER mention cardiac arrest or heart attack prediction.',
          'Use safe language only: guide, signals, awareness, recovery, balance, check-in.',
          'If any urgent symptom appears, say: "seek emergency care or call your local emergency services."',
          'End with exactly one calm, practical tip for the day.',
        ].join(' '),
      },
      { role: 'user', content: prompt },
    ],
    max_tokens: 220,
    temperature: 0.65,
  });

  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: 'api.groq.com',
        path: '/openai/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          try { resolve(JSON.parse(data).choices?.[0]?.message?.content || null); }
          catch { resolve(null); }
        });
      }
    );
    req.on('error', () => resolve(null));
    req.setTimeout(15000, () => { req.destroy(); resolve(null); });
    req.write(body);
    req.end();
  });
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  try {
    // 1. Read snapshot
    let snap = null;
    if (fs.existsSync(SNAPSHOT_PATH)) {
      try { snap = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8')); } catch {}
    }

    // 2. No data yet -- gentle nudge
    if (!snap) {
      await sendTelegram(
        '<b>Good morning!</b>\n\n' +
        'BALA does not have your health snapshot yet.\n\n' +
        'To enable your daily morning brief:\n' +
        '1. Open the BALA app\n' +
        '2. Add a check-in with today\'s data\n' +
        '3. Tap <b>Export for Chintu</b> in the Data section\n' +
        '4. Save the file to your home folder as <code>bala-daily-snapshot.json</code>\n\n' +
        '<i>BALA -- health awareness companion. Not medical advice.</i>'
      );
      return safeExit();
    }

    // 3. Build context for Groq (numbers only -- no raw secrets or personal IDs)
    const date  = snap.date  || new Date().toISOString().slice(0, 10);
    const score = snap.score ?? 'unknown';
    const delta = snap.scoreDelta != null
      ? (snap.scoreDelta >= 0 ? '+' : '') + snap.scoreDelta + ' from previous check-in'
      : 'first data point';
    const trend = snap.trend  || 'stable';
    const hrv   = snap.hrv   != null ? snap.hrv   + ' ms'    : 'no data';
    const rhr   = snap.rhr   != null ? snap.rhr   + ' bpm'   : 'no data';
    const sleep = snap.sleep != null ? snap.sleep + ' hours' : 'no data';
    const steps = snap.steps != null
      ? Number(snap.steps).toLocaleString() + ' steps'
      : 'no data';

    const prompt = [
      `Date: ${date}.`,
      `BALA Score: ${score}/100 (${delta}).`,
      `Overall trend: ${trend}.`,
      `HRV: ${hrv}.`,
      `Resting heart rate: ${rhr}.`,
      `Sleep duration: ${sleep}.`,
      `Steps yesterday: ${steps}.`,
      'Write a warm, calm 2-3 paragraph morning health awareness brief.',
      'Include one practical awareness tip for today based on the trend.',
    ].join(' ');

    // 4. Get AI brief (with fallback)
    const brief = await callGroq(prompt);

    const trendEmoji = trend === 'improving' ? '📈' : trend === 'declining' ? '📉' : '➡';
    const fallback = [
      `<b>Good morning!</b> ${trendEmoji}`,
      '',
      `<b>BALA Score:</b> ${score}/100 (${delta})`,
      `<b>HRV:</b> ${hrv}    <b>Sleep:</b> ${sleep}`,
      `<b>RHR:</b> ${rhr}    <b>Steps:</b> ${steps}`,
      `<b>Trend:</b> ${trend}`,
      '',
      '<i>BALA -- health awareness only, not medical advice.</i>',
    ].join('\n');

    const message = brief
      ? `<b>Good morning!</b> ${trendEmoji}\n\n${brief}\n\n<i>BALA -- awareness only, not medical advice.</i>`
      : fallback;

    await sendTelegram(message);
    safeExit();
  } catch (err) {
    // Silent fail -- never crash the Task Scheduler job
    try {
      const msg = String(err?.message || err).slice(0, 120);
      await sendTelegram(`[BALA Brief] Skipped: ${msg}`);
    } catch {}
    safeExit();
  }
}

main();
