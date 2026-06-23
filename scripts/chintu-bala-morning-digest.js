#!/usr/bin/env node
'use strict';

// =============================================================================
// C44 — Chintu BALA Morning Digest
// =============================================================================
// Reads your BALA health export, computes today's BALA score, and sends a
// calm morning summary via ntfy.sh — free, private, no cloud sync.
//
// SETUP (5 minutes):
//   1. In BALA: click "Export JSON" → save bala-export-YYYY-MM-DD.json
//   2. Copy to a stable path, e.g. C:\Users\Chintu\Desktop\test\bala-export.json
//   3. Set env vars:
//        CHINTU_NTFY_TOPIC       (your ntfy topic — see CHINTU_ALLEGRO.html)
//        CHINTU_BALA_EXPORT_PATH (full path to your bala-export*.json)
//        CHINTU_CONNECTOR_APPROVAL_PHRASE  (any phrase → enables live send)
//
// RUN:
//   node scripts/chintu-bala-morning-digest.js
//
//   Dry-run by default (no CHINTU_CONNECTOR_APPROVAL_PHRASE set).
//   Schedule in Windows Task Scheduler for daily 7am delivery.
//
// PRIVACY:
//   All data stays local. ntfy sends only the formatted score summary text.
//   No raw health values are sent unless you include them in the message.
//   No API keys in this file. No external services except ntfy.sh (your topic).
//
// SAFETY:
//   BALA is a health-awareness guide. Not a medical device.
//   This script never sends emergency advice — it surfaces the BALA safety
//   note if the score is very low or if urgent symptoms are detected.
// =============================================================================

const fs   = require('fs');
const path = require('path');
const https = require('node:https');

// ── Config ──────────────────────────────────────────────────────────────────
const NTFY_TOPIC      = process.env.CHINTU_NTFY_TOPIC || '';
const EXPORT_PATH_ENV = process.env.CHINTU_BALA_EXPORT_PATH || '';
const APPROVAL_PHRASE = process.env.CHINTU_CONNECTOR_APPROVAL_PHRASE || '';
const DRY_RUN         = !APPROVAL_PHRASE;

const REPO_ROOT       = path.resolve(__dirname, '..');
const DEFAULT_EXPORT  = path.join(REPO_ROOT, 'bala-export.json');
const EXPORT_PATH     = EXPORT_PATH_ENV || DEFAULT_EXPORT;

const SAFETY_FOOTER =
  'BALA is a health-awareness guide. Not a medical measurement. Not a replacement for professional care.';

// ── Score engine ─────────────────────────────────────────────────────────────
const { computeBALAScore } = require('./bala-score-engine.js');

// ── Load BALA export ─────────────────────────────────────────────────────────
function loadBALAExport(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `BALA export not found at: ${filePath}\n` +
      'In BALA: click "Export JSON" in the Timeline section, save as bala-export.json\n' +
      `Then set CHINTU_BALA_EXPORT_PATH or copy to: ${DEFAULT_EXPORT}`
    );
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(raw);

  // Support two export formats:
  // Format A: bala-export-*.json (B62 simple export)
  //   { exportVersion:2, today:{sleep,rhr,...}, history:[...] }
  // Format B: bala-data-*.json (existing full BALA export)
  //   { format:'bala-export-v1', data:{ health:{ sleep,rhr,..., history:[...] } } }
  if (parsed.exportVersion === 2 && parsed.today !== undefined) {
    return { today: parsed.today, history: parsed.history || [], source: parsed.dataSource };
  }
  if (parsed.format && parsed.data && parsed.data.health) {
    const h = parsed.data.health;
    return { today: h, history: h.history || [], source: h.source };
  }
  throw new Error(
    'Unrecognised BALA export format. Export using the "Export JSON" button in BALA (Timeline section) or "Export BALA Data" in Settings.'
  );
}

// ── Build score inputs from BALA metrics ──────────────────────────────────────
function avg(arr) {
  const nums = arr.filter((v) => typeof v === 'number' && Number.isFinite(v));
  return nums.length ? nums.reduce((s, v) => s + v, 0) / nums.length : null;
}

function buildScoreInputs(today, history) {
  const recent7 = Array.isArray(history) ? history.slice(-7) : [];
  return {
    hrv_today:              today.hrv   ?? null,
    hrv_baseline7d:         avg(recent7.map((d) => d.hrv)),
    rhr_today:              today.rhr   ?? null,
    rhr_baseline7d:         avg(recent7.map((d) => d.rhr)),
    sleep_hours_today:      today.sleep ?? null,
    sleep_hours_goal:       8,
    sleep_hours_baseline7d: avg(recent7.map((d) => d.sleep)),
    spo2_pct:               today.spo2  ?? null,
    steps_today:            today.steps ?? null,
    steps_goal:             10000,
    weekly_cardio_pct:      today.exercise ? Math.min(100, Math.round(today.exercise / 30 * 100)) : null,
    workout_logged:         today.exercise > 0 ? true : null,
    late_meal:              null,
    evening_caffeine:       null,
    hydration:              null,
    stress_level:           null,
    symptom_text:           '',
  };
}

// ── Format morning message ────────────────────────────────────────────────────
function formatDigest(result, today, missingSignals, source, exportDate) {
  const dateStr = exportDate || new Date().toISOString().slice(0, 10);
  const [yyyy, mm, dd] = dateStr.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const humanDate = `${months[parseInt(mm, 10) - 1]} ${parseInt(dd, 10)}`;

  if (result.emergency) {
    return {
      title: `⚠️ BALA · ${humanDate}`,
      body:  `Urgent signals detected. Please seek care if you feel unwell.\n\n${SAFETY_FOOTER}`,
      tags:  'warning',
    };
  }

  const lines = [];
  lines.push(`Score: ${result.score}/100 — ${result.label}`);

  // Signal summary row
  const signals = [];
  if (today.sleep  != null) signals.push(`Sleep ${today.sleep.toFixed(1)}h`);
  if (today.rhr    != null) signals.push(`RHR ${Math.round(today.rhr)} bpm`);
  if (today.hrv    != null) signals.push(`HRV ${Math.round(today.hrv)} ms`);
  if (today.spo2   != null) signals.push(`SpO₂ ${Math.round(today.spo2)}%`);
  if (today.steps  != null) signals.push(`Steps ${Math.round(today.steps).toLocaleString()}`);
  if (signals.length) lines.push(signals.join('  ·  '));

  // Confidence
  const conf = result.confidence || 'UNKNOWN';
  lines.push(`Confidence: ${conf.charAt(0) + conf.slice(1).toLowerCase()} (${5 - missingSignals.length}/5 signals)`);

  // Top positive contributor
  if (result.contributors?.positive?.length) {
    lines.push(`↑ ${result.contributors.positive[0]}`);
  }

  // Missing signal nudge
  if (missingSignals.length) {
    const missing = missingSignals
      .map((k) => ({ hrv_today:'HRV', sleep_hours_today:'Sleep', rhr_today:'RHR', spo2_pct:'SpO₂', steps_today:'Steps' }[k] || k))
      .join(', ');
    lines.push(`Missing: ${missing} → add via BALA CSV template`);
  }

  lines.push('');
  lines.push(SAFETY_FOOTER);

  const emoji = result.score >= 75 ? '☀️' : result.score >= 55 ? '🌤' : '🌧';
  return {
    title: `${emoji} BALA Morning · ${humanDate}`,
    body:  lines.join('\n'),
    tags:  'health',
  };
}

// ── Send via ntfy ─────────────────────────────────────────────────────────────
function sendNtfy(topic, title, body, tags) {
  return new Promise((resolve, reject) => {
    const payload = Buffer.from(body, 'utf-8');
    const req = https.request(
      {
        hostname: 'ntfy.sh',
        path:     `/${encodeURIComponent(topic)}`,
        method:   'POST',
        headers: {
          'Content-Type':   'text/plain; charset=utf-8',
          'Content-Length': payload.length,
          'X-Title':        title,
          'X-Priority':     '3',
          'X-Tags':         tags,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(data);
          else reject(new Error(`ntfy returned ${res.statusCode}: ${data}`));
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  C44 — Chintu BALA Morning Digest                    ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');

  if (DRY_RUN) {
    console.log('Mode: DRY RUN (set CHINTU_CONNECTOR_APPROVAL_PHRASE to enable live send)');
  } else {
    console.log('Mode: LIVE — will send via ntfy');
  }

  // Validate ntfy topic
  if (!DRY_RUN && !NTFY_TOPIC) {
    console.error('\nERROR: CHINTU_NTFY_TOPIC is not set.');
    console.error('Set it in System env: CHINTU_NTFY_TOPIC=bala-yourname-2026');
    console.error('Guide: see CHINTU_ALLEGRO.html → Free Connector Setup → ntfy');
    process.exit(1);
  }

  // Load export
  let exportData;
  try {
    exportData = loadBALAExport(EXPORT_PATH);
    console.log(`Loaded: ${EXPORT_PATH}`);
    console.log(`Source: ${exportData.source || 'BALA'} · ${exportData.history.length} history days`);
  } catch (err) {
    console.error(`\nFailed to load BALA export:\n${err.message}`);
    process.exit(1);
  }

  // Compute score
  const { today, history } = exportData;
  const inputs = buildScoreInputs(today, history);
  const result = computeBALAScore(inputs);
  const missingSignals = result.missingSignals || [];

  console.log('');
  console.log(`Score:      ${result.score ?? 'n/a'} / 100`);
  console.log(`Label:      ${result.label || 'n/a'}`);
  console.log(`Confidence: ${result.confidence || 'n/a'}`);
  console.log(`Missing:    ${missingSignals.length ? missingSignals.join(', ') : 'none'}`);

  // Build message
  const exportDate = exportData.today?.date || new Date().toISOString().slice(0, 10);
  const { title, body, tags } = formatDigest(result, today, missingSignals, exportData.source, exportDate);

  console.log('');
  console.log('── Message ─────────────────────────────────────────────');
  console.log(`Title: ${title}`);
  console.log('Body:');
  console.log(body);
  console.log('────────────────────────────────────────────────────────');

  if (DRY_RUN) {
    console.log('\nDRY RUN: message not sent.');
    console.log('To send live: set CHINTU_CONNECTOR_APPROVAL_PHRASE=any-phrase');
    console.log(`             set CHINTU_NTFY_TOPIC=your-topic`);
    return;
  }

  // Live send
  try {
    console.log(`\nSending to ntfy.sh/${NTFY_TOPIC} …`);
    await sendNtfy(NTFY_TOPIC, title, body, tags);
    console.log('Sent. Check your ntfy app for the morning digest.');
  } catch (err) {
    console.error(`ntfy send failed: ${err.message}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
