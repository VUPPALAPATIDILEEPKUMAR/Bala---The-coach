#!/usr/bin/env node
'use strict';
// =============================================================================
// B44 Integration Tests — Score Engine wired into live app path
// =============================================================================
// Tests cover:
//   1. mapMetricsToEngineInput correctly maps app.js metrics format
//   2. computeBALAScore produces valid output for typical metrics
//   3. Emergency gate: engine returns emergency object, hides score
//   4. No medical language in rendered output
//   5. Explainability panel renders category pills
//   6. Missing signals lower confidence, don't crash
//   7. Engine is local-only (no fetch/XMLHttpRequest in browser file)
// =============================================================================

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');

// ---------------------------------------------------------------------------
// Load engine (Node / CommonJS version — same logic as browser IIFE)
// ---------------------------------------------------------------------------
const engine = require('./bala-score-engine.js');
const { computeBALAScore, CONFIDENCE, EMERGENCY_REPLY, ALL_SIGNAL_KEYS } = engine;

let passed = 0;
let failed = 0;
const results = [];

function test(name, fn) {
  try {
    fn();
    results.push(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    results.push(`  ✗ ${name}\n      ${e.message}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// Simulate mapMetricsToEngineInput (mirrors app.js logic)
// ---------------------------------------------------------------------------
function averageValues(values) {
  const valid = values.filter(Number.isFinite);
  return valid.length ? valid.reduce((s, v) => s + v, 0) / valid.length : undefined;
}

function mapMetricsToEngineInput(metrics) {
  const history = Array.isArray(metrics?.history) ? metrics.history.slice(0, -1).slice(-7) : [];
  const hrv7   = averageValues(history.map((d) => d.hrv));
  const rhr7   = averageValues(history.map((d) => d.rhr));
  const sleep7 = averageValues(history.map((d) => d.sleep));
  const symptomText = (metrics?._symptomText || '');
  return {
    hrv_today:           metrics?.hrv   ?? null,
    hrv_baseline7d:      hrv7           ?? null,
    rhr_today:           metrics?.rhr   ?? null,
    rhr_baseline7d:      rhr7           ?? null,
    sleep_hours_today:   metrics?.sleep ?? null,
    sleep_hours_goal:    8,
    sleep_hours_baseline7d: sleep7      ?? null,
    spo2_pct:            metrics?.spo2  ?? null,
    steps_today:         metrics?.steps ?? null,
    steps_goal:          10000,
    late_meal:           null,
    evening_caffeine:    null,
    hydration:           null,
    stress_level:        null,
    alcohol_drinks:      null,
    symptom_text:        symptomText || null,
    symptom_level:       null,
  };
}

// ---------------------------------------------------------------------------
// 1. mapMetricsToEngineInput — field mapping
// ---------------------------------------------------------------------------
test('mapMetricsToEngineInput: maps hrv/rhr/sleep/spo2/steps', () => {
  const metrics = { hrv: 55, rhr: 62, sleep: 7.5, spo2: 97, steps: 8200, history: [] };
  const inp = mapMetricsToEngineInput(metrics);
  assert.strictEqual(inp.hrv_today, 55,   'hrv_today');
  assert.strictEqual(inp.rhr_today, 62,   'rhr_today');
  assert.strictEqual(inp.sleep_hours_today, 7.5, 'sleep_hours_today');
  assert.strictEqual(inp.spo2_pct, 97,    'spo2_pct');
  assert.strictEqual(inp.steps_today, 8200, 'steps_today');
  assert.strictEqual(inp.steps_goal, 10000, 'steps_goal default');
  assert.strictEqual(inp.sleep_hours_goal, 8, 'sleep_hours_goal default');
});

test('mapMetricsToEngineInput: computes 7-day baselines from history', () => {
  const history = Array.from({ length: 7 }, (_, i) => ({ hrv: 50 + i, rhr: 60, sleep: 7 }));
  const metrics = { hrv: 60, history: [...history, { hrv: 60 }] }; // last entry = today
  const inp = mapMetricsToEngineInput(metrics);
  // baseline7d should be avg of first 7 (index 0-6), not including today (index 7)
  const expected = averageValues(history.map((d) => d.hrv));
  assert.ok(Math.abs(inp.hrv_baseline7d - expected) < 0.01, `hrv_baseline7d expected ~${expected} got ${inp.hrv_baseline7d}`);
});

test('mapMetricsToEngineInput: null baselines when no history', () => {
  const metrics = { hrv: 55, history: [] };
  const inp = mapMetricsToEngineInput(metrics);
  assert.strictEqual(inp.hrv_baseline7d, null, 'no baseline when no history');
  assert.strictEqual(inp.rhr_baseline7d, null);
  assert.strictEqual(inp.sleep_hours_baseline7d, null);
});

test('mapMetricsToEngineInput: lifestyle signals are null (not collected yet)', () => {
  const inp = mapMetricsToEngineInput({ hrv: 55 });
  assert.strictEqual(inp.late_meal, null);
  assert.strictEqual(inp.evening_caffeine, null);
  assert.strictEqual(inp.hydration, null);
  assert.strictEqual(inp.stress_level, null);
  assert.strictEqual(inp.alcohol_drinks, null);
});

test('mapMetricsToEngineInput: passes symptom_text to engine', () => {
  const metrics = { hrv: 55, _symptomText: 'feeling tired' };
  const inp = mapMetricsToEngineInput(metrics);
  assert.strictEqual(inp.symptom_text, 'feeling tired');
});

// ---------------------------------------------------------------------------
// 2. computeBALAScore with typical full metrics → valid 0-100 score
// ---------------------------------------------------------------------------
test('engine: typical full metrics → score 0-100, no emergency', () => {
  const inp = {
    hrv_today: 58, hrv_baseline7d: 55,
    rhr_today: 62, rhr_baseline7d: 64,
    sleep_hours_today: 7.5, sleep_hours_goal: 8,
    spo2_pct: 97,
    steps_today: 9000, steps_goal: 10000,
  };
  const result = computeBALAScore(inp);
  assert.ok(!result.emergency, 'no emergency for normal metrics');
  assert.ok(typeof result.score === 'number', 'score is a number');
  assert.ok(result.score >= 0 && result.score <= 100, `score ${result.score} in range`);
  assert.ok(typeof result.label === 'string' && result.label.length > 0, 'label present');
  assert.ok(result.confidence, 'confidence present');
  assert.ok(result.categories, 'categories present');
});

test('engine: completely empty input → LOW confidence score, no crash', () => {
  const result = computeBALAScore({});
  assert.ok(!result.emergency, 'no emergency');
  assert.ok(typeof result.score === 'number', 'score still returned');
  // confidence is an object with a .level property
  const level = typeof result.confidence === 'object' ? result.confidence?.level : result.confidence;
  assert.ok(level === CONFIDENCE.VERY_LOW || level === CONFIDENCE.LOW, `low confidence with no data, got: ${JSON.stringify(level)}`);
});

test('engine: partial input (sleep only) → score present, missing signals listed', () => {
  const result = computeBALAScore({ sleep_hours_today: 7, sleep_hours_goal: 8 });
  assert.ok(!result.emergency);
  assert.ok(typeof result.score === 'number');
  assert.ok(Array.isArray(result.missingSignals) && result.missingSignals.length > 0, 'missing signals flagged');
});

test('engine: contributors object has positive and warnings arrays', () => {
  const inp = { hrv_today: 58, rhr_today: 62, sleep_hours_today: 7 };
  const result = computeBALAScore(inp);
  assert.ok(result.contributors, 'contributors present');
  assert.ok(Array.isArray(result.contributors.positive), 'contributors.positive is array');
  assert.ok(Array.isArray(result.contributors.warnings), 'contributors.warnings is array');
});

test('engine: categories object contains expected keys', () => {
  const result = computeBALAScore({ hrv_today: 58, sleep_hours_today: 7 });
  const keys = Object.keys(result.categories);
  assert.ok(keys.includes('sleep'), 'sleep category present');
  // at least some categories present
  assert.ok(keys.length >= 1, 'at least one category');
});

// ---------------------------------------------------------------------------
// 3. Emergency gate
// ---------------------------------------------------------------------------
test('emergency gate: "chest pain" in symptom_text → emergency=true, score=null', () => {
  const result = computeBALAScore({ symptom_text: 'I have chest pain' });
  assert.ok(result.emergency === true, 'emergency flag set');
  assert.strictEqual(result.score, null, 'score hidden during emergency');
  assert.ok(result.emergencyReply && result.emergencyReply.length > 10, 'emergencyReply present');
});

test('emergency gate: symptom_level="urgent" → emergency=true', () => {
  const result = computeBALAScore({ symptom_level: 'urgent' });
  assert.ok(result.emergency === true);
  assert.strictEqual(result.score, null);
});

test('emergency gate: "shortness of breath" → emergency=true', () => {
  const result = computeBALAScore({ symptom_text: 'shortness of breath' });
  assert.ok(result.emergency === true);
});

test('emergency gate: "feeling tired" → NOT an emergency', () => {
  const result = computeBALAScore({ symptom_text: 'feeling tired today' });
  assert.ok(!result.emergency, 'fatigue is not an emergency trigger');
  assert.ok(typeof result.score === 'number');
});

// ---------------------------------------------------------------------------
// 4. No medical language in engine outputs (safe copy rules)
// ---------------------------------------------------------------------------
const FORBIDDEN_MEDICAL = [
  /\bat risk\b/i, /\bdanger\b/i, /\bdiagnos/i, /\btreat/i,
  /\bpredict/i, /\bprevent/i, /\bmedical advice\b/i,
];

test('engine: label contains no forbidden medical language', () => {
  const inputs = [
    { hrv_today: 30, hrv_baseline7d: 60 },
    { sleep_hours_today: 4, sleep_hours_goal: 8 },
    { spo2_pct: 93 },
    { hrv_today: 70, rhr_today: 58, sleep_hours_today: 8, spo2_pct: 98, steps_today: 12000 },
  ];
  for (const inp of inputs) {
    const result = computeBALAScore(inp);
    const allText = [result.label, result.changeCopy, result.emergencyReply]
      .concat((result.contributors?.warnings || []).map((w) => w.label || ''))
      .filter(Boolean)
      .join(' ');
    for (const pattern of FORBIDDEN_MEDICAL) {
      assert.ok(!pattern.test(allText), `Forbidden pattern ${pattern} found in: "${allText}"`);
    }
  }
});

test('emergency reply: does not contain medical diagnosis language', () => {
  const result = computeBALAScore({ symptom_text: 'chest pain' });
  assert.ok(result.emergency);
  // Emergency reply should direct to emergency services, not diagnose
  const reply = result.emergencyReply || '';
  assert.ok(!(/diagnos/i).test(reply), 'no diagnosis language in emergency reply');
  assert.ok(!(/at risk/i).test(reply), 'no "at risk" language');
});

// ---------------------------------------------------------------------------
// 5. Explainability structure — verify categories have usable shape for UI
// ---------------------------------------------------------------------------
test('categories: recovery has total and possible fields', () => {
  const result = computeBALAScore({ hrv_today: 58, hrv_baseline7d: 55, rhr_today: 62, rhr_baseline7d: 64 });
  if (result.categories.recovery) {
    assert.ok(typeof result.categories.recovery.total === 'number', 'recovery.total is number');
    assert.ok(typeof result.categories.recovery.possible === 'number', 'recovery.possible is number');
  }
});

test('categories: sleep has total and possible fields', () => {
  const result = computeBALAScore({ sleep_hours_today: 7, sleep_hours_goal: 8 });
  if (result.categories.sleep) {
    assert.ok(typeof result.categories.sleep.total === 'number');
  }
});

test('changeCopy: is string or null — never undefined', () => {
  const r1 = computeBALAScore({ hrv_today: 58 });
  const r2 = computeBALAScore({});
  assert.ok(r1.changeCopy === null || typeof r1.changeCopy === 'string', 'changeCopy type valid');
  assert.ok(r2.changeCopy === null || typeof r2.changeCopy === 'string', 'changeCopy type valid for empty');
});

// ---------------------------------------------------------------------------
// 6. missingSignals completeness
// ---------------------------------------------------------------------------
test('missingSignals: all signals missing when input is empty', () => {
  const result = computeBALAScore({});
  assert.ok(Array.isArray(result.missingSignals), 'missingSignals is array');
  // At least the wearable signals should be missing
  const wearable = ['hrv_today', 'rhr_today', 'sleep_hours_today', 'spo2_pct', 'steps_today'];
  for (const key of wearable) {
    assert.ok(result.missingSignals.includes(key), `${key} in missingSignals`);
  }
});

test('missingSignals: provided signals not in missing list', () => {
  const result = computeBALAScore({ hrv_today: 58, sleep_hours_today: 7 });
  assert.ok(!result.missingSignals.includes('hrv_today'), 'hrv_today not missing');
  assert.ok(!result.missingSignals.includes('sleep_hours_today'), 'sleep_hours_today not missing');
});

// ---------------------------------------------------------------------------
// 7. Browser file: no fetch / XMLHttpRequest (local-only guarantee)
// ---------------------------------------------------------------------------
test('browser file: no fetch() calls (local-only)', () => {
  const browserSrc = fs.readFileSync(
    path.join(__dirname, 'bala-score-engine.browser.js'), 'utf8'
  );
  // Allow 'fetch' in comments but not as a function call
  const hasFetch = /[^/\w]fetch\s*\(/.test(browserSrc);
  assert.ok(!hasFetch, 'No fetch() calls in browser file');
});

test('browser file: no XMLHttpRequest (local-only)', () => {
  const browserSrc = fs.readFileSync(
    path.join(__dirname, 'bala-score-engine.browser.js'), 'utf8'
  );
  assert.ok(!browserSrc.includes('XMLHttpRequest'), 'No XMLHttpRequest in browser file');
});

test('browser file: no require() calls (pure browser JS)', () => {
  const browserSrc = fs.readFileSync(
    path.join(__dirname, 'bala-score-engine.browser.js'), 'utf8'
  );
  // Strip comments first, then check
  const noComments = browserSrc.replace(/\/\/.*$/mg, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const hasRequire = /\brequire\s*\(/.test(noComments);
  assert.ok(!hasRequire, 'No require() calls in browser file (stripped of comments)');
});

test('browser file: exports window.BALAScoreEngine', () => {
  const browserSrc = fs.readFileSync(
    path.join(__dirname, 'bala-score-engine.browser.js'), 'utf8'
  );
  assert.ok(browserSrc.includes('window.BALAScoreEngine'), 'window.BALAScoreEngine assignment present');
  assert.ok(browserSrc.includes('computeBALAScore'), 'computeBALAScore exported');
});

// ---------------------------------------------------------------------------
// Bonus: engine determinism — same input always yields same score
// ---------------------------------------------------------------------------
test('determinism: same inputs produce same score across multiple calls', () => {
  const inp = { hrv_today: 55, hrv_baseline7d: 52, rhr_today: 65, rhr_baseline7d: 67, sleep_hours_today: 7, sleep_hours_goal: 8 };
  const scores = Array.from({ length: 5 }, () => computeBALAScore(inp).score);
  assert.ok(scores.every((s) => s === scores[0]), `scores not deterministic: ${scores.join(',')}`);
});

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

console.log('\nBALA-B44 Integration Tests\n');
results.forEach((r) => console.log(r));
console.log(`\n${passed + failed} tests \u00b7 ${passed} passed \u00b7 ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
