#!/usr/bin/env node
'use strict';

// =============================================================================
// C44 — Chintu BALA Morning Digest
// Reads BALA JSON export → computes score → sends calm ntfy morning summary
// Dry-run by default. Set CHINTU_CONNECTOR_APPROVAL_PHRASE to enable live send.
//
// SETUP:
//   1. In BALA: click "Export JSON" in Timeline → save as bala-export.json
//   2. Set env vars (cmd): set CHINTU_NTFY_TOPIC=your-topic
//                          set CHINTU_BALA_EXPORT_PATH=C:\...\bala-export.json
//                          set CHINTU_CONNECTOR_APPROVAL_PHRASE=go
//   3. node scripts/chintu-bala-morning-digest.js
//
// PRIVACY: All data local. Only the formatted score text is sent via ntfy.
// SAFETY:  BALA is a health-awareness guide. Not a medical device.
// =============================================================================

const fs    = require('fs');
const path  = require('path');
const https = require('node:https');

// ── Config ────────────────────────────────────────────────────────────────────
const NTFY_TOPIC      = process.env.CHINTU_NTFY_TOPIC || '';
const EXPORT_PATH_ENV = process.env.CHINTU_BALA_EXPORT_PATH || '';
const APPROVAL_PHRASE = process.env.CHINTU_CONNECTOR_APPROVAL_PHRASE || '';
const DRY_RUN         = !APPROVAL_PHRASE;

const REPO_ROOT    = path.resolve(__dirname, '..');
const DEFAULT_EXPORT = path.join(REPO_ROOT, 'bala-export.json');
const EXPORT_PATH  = EXPORT_PATH_ENV || DEFAULT_EXPORT;

const SAFETY_FOOTER =
  'BALA is a health-awareness guide. Not a medical measurement. Not a replacement for professional care.';

// ── Score engine ──────────────────────────────────────────────────────────────
const { computeBALAScore } = require('./bala-score-engine.js');

// ── Load BALA export ──────────────────────────────────────────────────────────
function loadBALAExport(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `BALA export not found at: ${filePath}\n` +
      'In BALA: click "Export JSON" in the Timeline section, save as bala-export.json\n' +
      `Then set CHINTU_BALA_EXPORT_PATH or copy to: ${DEFAULT_EXPORT}`
    );
  }
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  // Format A — B62 simple export: { exportVersion:2, today:{...}, history:[...] }
  if (parsed.exportVersion === 2 && parsed.today !== undefined) {
    return { today: parsed.today, history: parsed.history || [], source: parsed.dataSource };
  }
  // Format B — full BALA backup: { format:'bala-export-v1', data:{ health:{...} } }
  if (parsed.format && parsed.data && parsed.data.health) {
    const h = parsed.data.health;
    return { today: h, history: h.history || [], source: h.source };
  }
  throw new Error(
    'Unrecognised BALA export format. Use "Export JSON" in BALA Timeline, or "Export BALA Data" in Settings.'
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function avg(arr) {
  const nums = arr.filter((v) => typeof v === 'number' && Number.isFinite(v));
  return nums.length ? nums.reduce((s, v) => s + v, 0) / nums.length : null;
}

function buildScoreInputs(today, history) {
  const r7 = Array.isArray(history) ? history.slice(-7) : [];
  return {
    hrv_today:              today.hrv   ?? null,
    hrv_baseline7d:         avg(r7.map((d) => d.hrv)),
    rhr_today:              today.rhr   ?? null,
    rhr_baseline7d:         avg(r7.map((d) => d.rhr)),
    sleep_hours_today:      today.sleep ?? null,
    sleep_hours_goal:       8,
    sleep_hours_baseline7d: avg(r7.map((d) => d.sleep)),
    spo2_pct:               today.spo2  ?? null,
    steps_today:            today.steps ?? null,
    steps_goal:             10000,
    weekly_cardio_pct: today.exercise
      ? Math.min(100, Math.round(today.exercise / 30 * 100)) : null,
    workout_logged:     today.exercise > 0 ? true : null,
    late_meal:          null,
    evening_caffeine:   null,
    hydration:          null,
    stress_level:       null,
    symptom_text:       '',
  };
}

// ── Format morning digest message ─────────────────────────────────────────────
const CORE_KEYS = {
  hrv_today:        'HRV',
  sleep_hours_today:'Sleep',
  rhr_today:        'RHR',
  spo2_pct:         'SpO₂',
  steps_today:      'Steps',
};

function formatDigest(result, today, missingSignals, exportDate) {
  const [, mm, dd] = (exportDate || new Date().toISOString().slice(0, 10)).split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const humanDate = `${months[parseInt(mm, 10) - 1]} ${parseInt(dd, 10)}`;

  if (result.emergency) {
    return {
      title: `⚠️ BALA · ${humanDate}`,
      body:  `Urgent signals noticed. Please seek care if you feel unwell.\n\n${SAFETY_FOOTER}`,
      tags:  'warning',
    };
  }

  const lines = [];
  lines.push(`Score: ${result.score}/100 — ${result.label}`);

  // Signal summary
  const signals = [];
  if (today.sleep  != null) signals.push(`Sleep ${today.sleep.toFixed(1)}h`);
  if (today.rhr    != null) signals.push(`RHR ${Math.round(today.rhr)} bpm`);
  if (today.hrv    != null) signals.push(`HRV ${Math.round(today.hrv)} ms`);
  if (today.spo2   != null) signals.push(`SpO₂ ${Math.round(today.spo2)}%`);
  if (today.steps  != null) signals.push(`Steps ${Math.round(today.steps).toLocaleString()}`);
  if (signals.length) lines.push(signals.join('  ·  '));

  // Confidence — engine returns { level, available, total, ratio }
  const confObj  = (typeof result.confidence === 'object' && result.confidence) ? result.confidence : {};
  const confLevel = confObj.level
    ? confObj.level.charAt(0) + confObj.level.slice(1).toLowerCase()
    : String(result.confidence || 'Unknown');
  const confAvail = confObj.available ?? '?';
  const confTotal = confObj.total ?? '?';
  lines.push(`Confidence: ${confLevel} (${confAvail}/${confTotal} signals)`);

  // Top contributor — array of { signal, pts, label }
  const posContribs = Array.isArray(result.contributors?.positive)
    ? result.contributors.positive : [];
  if (posContribs.length) {
    const top = posContribs[0];
    lines.push(`↑ ${typeof top === 'string' ? top : (top.label || top.signal || '')}`);
  }

  // Core signals missing nudge
  const coreMissing = (missingSignals || []).filter((k) => CORE_KEYS[k]);
  if (coreMissing.length) {
    lines.push(`Missing: ${coreMissing.map((k) => CORE_KEYS[k]).join(', ')} → add via BALA CSV template`);
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

// ── Groq tools morning brief (C61) ──────────────────────────────────────────
// Try-catch require so the file still works if chintu-groq-tools.js is absent.
let _groqTools = null;
try {
  _groqTools = require('./chintu-groq-tools.js');
} catch (_) {
  // groq-tools not available -- morning digest will use BALA-only format
}

const GROQ_MORNING_PROMPT =
  'Morning brief for Dileep. ' +
  'First call recall_preferences to know his city and budgets. ' +
  'Then call get_weather for his city. ' +
  'Then call search_deals for today deals in his location. ' +
  'Combine into a friendly 3-paragraph morning summary: weather + deals + any key preferences to note. ' +
  'Keep it warm and practical. No health data.';

async function buildGroqMorningBrief() {
  if (!_groqTools || typeof _groqTools.chatWithGroqTools !== 'function') return null;
  try {
    const result = await _groqTools.chatWithGroqTools(GROQ_MORNING_PROMPT, []);
    if (result && typeof result === 'string' && result.trim().length > 50) return result.trim();
    return null;
  } catch (_) {
    return null;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  C44 — Chintu BALA Morning Digest                    ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');
  console.log(DRY_RUN
    ? 'Mode: DRY RUN (set CHINTU_CONNECTOR_APPROVAL_PHRASE to enable live send)'
    : 'Mode: LIVE — will send via ntfy');

  if (!DRY_RUN && !NTFY_TOPIC) {
    console.error('\nERROR: CHINTU_NTFY_TOPIC is not set.');
    console.error('  cmd: set CHINTU_NTFY_TOPIC=bala-yourname-2026');
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
  const inputs  = buildScoreInputs(today, history);
  const result  = computeBALAScore(inputs);
  const missing = result.missingSignals || [];

  console.log('');
  console.log(`Score:      ${result.score ?? 'n/a'} / 100`);
  console.log(`Label:      ${result.label || 'n/a'}`);
  const confObj = (typeof result.confidence === 'object' && result.confidence) ? result.confidence : {};
  console.log(`Confidence: ${confObj.level || result.confidence || 'n/a'} (${confObj.available ?? '?'}/${confObj.total ?? '?'} signals)`);
  const coreMissing = missing.filter((k) => CORE_KEYS[k]);
  console.log(`Core missing: ${coreMissing.length ? coreMissing.map((k) => CORE_KEYS[k]).join(', ') : 'none — all 5 signals present'}`);

  // Format message
  const exportDate = exportData.today?.date || new Date().toISOString().slice(0, 10);
  const { title, body, tags } = formatDigest(result, today, missing, exportDate);

  // C61: Try Groq tools chain (recall_preferences -> get_weather -> search_deals)
  console.log('');
  console.log('Fetching Groq morning brief (weather + deals + prefs) ...');
  const groqBrief = await buildGroqMorningBrief();
  if (groqBrief) {
    console.log('[PASS] Groq morning brief received (' + groqBrief.length + ' chars)');
  } else {
    console.log('[INFO] Groq brief unavailable -- using BALA-only format');
  }

  // Build final message: if Groq brief is available, prepend it before the BALA score block
  const finalTitle = title;
  const finalBody  = groqBrief
    ? groqBrief + '\n\n--- BALA Score ---\n' + body
    : body;
  const finalTags  = tags;

  console.log('');
  console.log('── Message preview ─────────────────────────────────────');
  console.log(`Title: ${finalTitle}`);
  console.log('');
  console.log(finalBody);
  console.log('────────────────────────────────────────────────────────');

  if (DRY_RUN) {
    console.log('\nDRY RUN complete. Message not sent.');
    console.log('To send live (cmd):');
    console.log('  set CHINTU_CONNECTOR_APPROVAL_PHRASE=go');
    console.log('  set CHINTU_NTFY_TOPIC=your-topic');
    console.log('  node scripts/chintu-bala-morning-digest.js');
    return;
  }

  // Live send
  console.log(`\nSending to ntfy.sh/${NTFY_TOPIC} …`);
  await sendNtfy(NTFY_TOPIC, finalTitle, finalBody, finalTags);
  console.log('Sent. Check your ntfy app.');
}

main().catch((err) => { console.error(err); process.exit(1); });
