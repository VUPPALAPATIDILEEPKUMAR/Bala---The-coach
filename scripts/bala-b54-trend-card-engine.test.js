// BALA-B54 Weekly Trend Card Engine — test suite
'use strict';

var {
  TREND_SIGNALS, TREND_THRESHOLD,
  computeSignalAvg, computeSignalDir,
  computeTrendRow, buildTrendCardHTML,
} = require('./bala-b54-trend-card-engine');

var passed = 0;
var failed = 0;

function assertEq(label, got, exp) {
  if (got === exp) { passed++; }
  else { failed++; console.error('FAIL [' + label + '] exp=' + JSON.stringify(exp) + ' got=' + JSON.stringify(got)); }
}
function assertTrue(label, v) {
  if (v) { passed++; }
  else { failed++; console.error('FAIL [' + label + '] expected truthy, got ' + JSON.stringify(v)); }
}
function assertNull(label, v) {
  if (v === null) { passed++; }
  else { failed++; console.error('FAIL [' + label + '] expected null, got ' + JSON.stringify(v)); }
}
function assertRange(label, got, lo, hi) {
  if (Number.isFinite(got) && got >= lo && got <= hi) { passed++; }
  else { failed++; console.error('FAIL [' + label + '] exp [' + lo + ',' + hi + '] got=' + got); }
}
function assertContains(label, str, sub) {
  if (typeof str === 'string' && str.includes(sub)) { passed++; }
  else { failed++; console.error('FAIL [' + label + '] missing ' + JSON.stringify(sub) + ' in ' + JSON.stringify((str || '').slice(0,120))); }
}
function assertNotContains(label, str, sub) {
  if (typeof str === 'string' && !str.includes(sub)) { passed++; }
  else { failed++; console.error('FAIL [' + label + '] unexpectedly contains ' + JSON.stringify(sub)); }
}

// ── Fixtures ──────────────────────────────────────────────────────────────────
var DEMO = [
  { date: '2026-06-08', sleep: 6.8, rhr: 65, hrv: 40, spo2: 97, steps: 5900, exercise: 18 },
  { date: '2026-06-09', sleep: 7.1, rhr: 64, hrv: 42, spo2: 97, steps: 7600, exercise: 27 },
  { date: '2026-06-10', sleep: 6.6, rhr: 66, hrv: 39, spo2: 96, steps: 5100, exercise: 14 },
  { date: '2026-06-11', sleep: 7.3, rhr: 62, hrv: 45, spo2: 97, steps: 8900, exercise: 36 },
  { date: '2026-06-12', sleep: 7.6, rhr: 61, hrv: 48, spo2: 98, steps: 9400, exercise: 41 },
  { date: '2026-06-13', sleep: 7.2, rhr: 62, hrv: 44, spo2: 97, steps: 7200, exercise: 29 },
  { date: '2026-06-14', sleep: 7.4, rhr: 61, hrv: 46, spo2: 97, steps: 6842, exercise: 32 },
];

// Flat data: all identical values
var FLAT = DEMO.map(function(e) {
  return { date: e.date, sleep: 7.0, rhr: 65, hrv: 45, spo2: 97, steps: 8000, exercise: 30 };
});

// Declining data: each value lower than previous
var DECLINING = [
  { date: '2026-06-08', sleep: 8.0, rhr: 58, hrv: 55, spo2: 98, steps: 10000, exercise: 45 },
  { date: '2026-06-09', sleep: 7.8, rhr: 59, hrv: 53, spo2: 98, steps: 9500, exercise: 42 },
  { date: '2026-06-10', sleep: 7.5, rhr: 60, hrv: 50, spo2: 97, steps: 9000, exercise: 38 },
  { date: '2026-06-11', sleep: 7.2, rhr: 61, hrv: 47, spo2: 97, steps: 8500, exercise: 34 },
  { date: '2026-06-12', sleep: 6.9, rhr: 63, hrv: 44, spo2: 96, steps: 7000, exercise: 25 },
  { date: '2026-06-13', sleep: 6.5, rhr: 65, hrv: 40, spo2: 96, steps: 5000, exercise: 18 },
  { date: '2026-06-14', sleep: 6.0, rhr: 68, hrv: 36, spo2: 95, steps: 3000, exercise: 10 },
];

// ── Suite 1: computeSignalAvg ─────────────────────────────────────────────────
console.log('Suite: computeSignalAvg');
// DEMO sleep average = (6.8+7.1+6.6+7.3+7.6+7.2+7.4)/7 = 50.0/7 = 7.142...
var sleepAvg = computeSignalAvg(DEMO, 'sleep', 7);
assertRange('DEMO sleep avg ~7.14', sleepAvg, 7.13, 7.16);
assertRange('DEMO hrv avg ~43.4', computeSignalAvg(DEMO, 'hrv', 7), 43.0, 44.0);
assertRange('DEMO rhr avg ~63', computeSignalAvg(DEMO, 'rhr', 7), 62.5, 63.5);

// n=3 uses only last 3 entries
var sleep3 = computeSignalAvg(DEMO, 'sleep', 3);
var expSleep3 = (7.6 + 7.2 + 7.4) / 3; // last 3
assertRange('last-3 sleep avg', sleep3, expSleep3 - 0.01, expSleep3 + 0.01);

// Empty array → null
assertNull('empty → null', computeSignalAvg([], 'sleep', 7));
assertNull('null → null', computeSignalAvg(null, 'sleep', 7));

// Missing key → null (no finite values)
assertNull('unknown key → null', computeSignalAvg(DEMO, 'nonexistent', 7));

// Mix of valid and null values
var mixed = [
  { sleep: 7.0 }, { sleep: null }, { sleep: 7.4 }, { sleep: undefined }, { sleep: 6.8 }
];
assertRange('mixed nulls avg', computeSignalAvg(mixed, 'sleep', 7), 7.0, 7.1);

// ── Suite 2: computeSignalDir ─────────────────────────────────────────────────
console.log('Suite: computeSignalDir');
// DEMO: sleep improves over the week (first half lower, second half higher)
assertEq('DEMO sleep → up', computeSignalDir(DEMO, 'sleep', 7), 'up');

// DEMO: hrv improves (first half ~41, second half ~46)
assertEq('DEMO hrv → up', computeSignalDir(DEMO, 'hrv', 7), 'up');

// DEMO: rhr improves (decreasing, first half ~65, second half ~61)
assertEq('DEMO rhr → down', computeSignalDir(DEMO, 'rhr', 7), 'down');

// Flat data → flat
assertEq('flat sleep → flat', computeSignalDir(FLAT, 'sleep', 7), 'flat');
assertEq('flat hrv → flat', computeSignalDir(FLAT, 'hrv', 7), 'flat');

// Declining data → down for sleep
assertEq('declining sleep → down', computeSignalDir(DECLINING, 'sleep', 7), 'down');

// Only 1 valid entry → flat
var single = [{ sleep: 7.0 }];
assertEq('single entry → flat', computeSignalDir(single, 'sleep', 7), 'flat');

// Empty → flat
assertEq('empty → flat', computeSignalDir([], 'sleep', 7), 'flat');
assertEq('null → flat', computeSignalDir(null, 'sleep', 7), 'flat');

// ── Suite 3: computeTrendRow ──────────────────────────────────────────────────
console.log('Suite: computeTrendRow');
var sleepCfg = { key: 'sleep', label: 'Sleep', unit: 'h', polarity: 'up', decimals: 1 };
var rhrCfg   = { key: 'rhr',   label: 'Resting HR', unit: 'bpm', polarity: 'down', decimals: 0 };
var stepsCfg = { key: 'steps', label: 'Steps', unit: '', polarity: 'up', decimals: 0 };

var sleepRow = computeTrendRow(DEMO, sleepCfg);
assertTrue('sleep row not null', sleepRow !== null);
assertEq('sleep row key', sleepRow.key, 'sleep');
assertEq('sleep row label', sleepRow.label, 'Sleep');
assertEq('sleep row dir (up)', sleepRow.dir, 'up');
assertEq('sleep up+up polarity → tc-good', sleepRow.cls, 'tc-good');
assertEq('sleep icon ↑', sleepRow.icon, '↑');
assertEq('sleep trendLabel improving', sleepRow.trendLabel, 'improving');
assertContains('sleep formattedAvg has h', sleepRow.formattedAvg, 'h');

var rhrRow = computeTrendRow(DEMO, rhrCfg);
assertTrue('rhr row not null', rhrRow !== null);
assertEq('rhr dir (down)', rhrRow.dir, 'down');
assertEq('rhr down+down polarity → tc-good', rhrRow.cls, 'tc-good');
assertEq('rhr icon ↓', rhrRow.icon, '↓');
assertEq('rhr trendLabel improving', rhrRow.trendLabel, 'improving');

// Flat data: sleep → flat direction
var flatSleepRow = computeTrendRow(FLAT, sleepCfg);
assertTrue('flat sleep row not null', flatSleepRow !== null);
assertEq('flat sleep dir → flat', flatSleepRow.dir, 'flat');
assertEq('flat sleep cls → tc-flat', flatSleepRow.cls, 'tc-flat');
assertEq('flat sleep icon →', flatSleepRow.icon, '→');
assertEq('flat sleep trendLabel steady', flatSleepRow.trendLabel, 'steady');

// Declining sleep (polarity=up, dir=down) → tc-watch
var declSleepRow = computeTrendRow(DECLINING, sleepCfg);
assertTrue('declining sleep row not null', declSleepRow !== null);
assertEq('declining sleep cls → tc-watch', declSleepRow.cls, 'tc-watch');
assertEq('declining trendLabel elevated', declSleepRow.trendLabel, 'elevated');

// Insufficient data → null
var oneEntry = [{ sleep: 7.0, rhr: 65, hrv: 45 }];
assertNull('1 entry → null', computeTrendRow(oneEntry, sleepCfg));
assertNull('empty → null', computeTrendRow([], sleepCfg));

// Steps formatted as locale string
var stepsRow = computeTrendRow(DEMO, stepsCfg);
assertTrue('steps row not null', stepsRow !== null);
assertNotContains('steps has no unit space', stepsRow.formattedAvg, ' ');

// ── Suite 4: buildTrendCardHTML — structure ───────────────────────────────────
console.log('Suite: buildTrendCardHTML structure');
var html = buildTrendCardHTML(DEMO);
assertContains('has trend-card', html, 'trend-card');
assertContains('has trend-card-header', html, 'trend-card-header');
assertContains('has trend-card-title', html, 'trend-card-title');
assertContains('has 7-day signals', html, '7-day signals');
assertContains('has tc-table', html, 'tc-table');
assertContains('has tc-row', html, 'tc-row');
assertContains('has tc-label', html, 'tc-label');
assertContains('has tc-avg', html, 'tc-avg');
assertContains('has tc-trend', html, 'tc-trend');
assertContains('has note', html, 'trend-card-note');
assertContains('closes div', html, '</div>');
assertContains('closes table', html, '</table>');

// ── Suite 5: buildTrendCardHTML — content ─────────────────────────────────────
console.log('Suite: buildTrendCardHTML content');
// DEMO has sleep, hrv, rhr, steps, exercise all with 7 entries → 5 rows
var trCount = (html.match(/<tr/g) || []).length;
assertEq('DEMO → 5 signal rows', trCount, 5);

// Sleep and HRV are improving (up) → should contain tc-good
assertContains('has tc-good', html, 'tc-good');
assertContains('has improving', html, 'improving');

// Has signal labels
assertContains('has Sleep', html, 'Sleep');
assertContains('has HRV', html, 'HRV');
assertContains('has Resting HR', html, 'Resting HR');
assertContains('has Steps', html, 'Steps');
assertContains('has Cardio', html, 'Cardio');

// Declining data: sleep/hrv/steps declining → should show elevated or tc-watch
var htmlDecl = buildTrendCardHTML(DECLINING);
assertContains('declining has tc-watch', htmlDecl, 'tc-watch');
assertContains('declining has elevated', htmlDecl, 'elevated');

// Flat data: all steady
var htmlFlat = buildTrendCardHTML(FLAT);
assertContains('flat has tc-flat', htmlFlat, 'tc-flat');
assertContains('flat has steady', htmlFlat, 'steady');
assertNotContains('flat has no improving', htmlFlat, 'improving');

// ── Suite 6: buildTrendCardHTML — empty/invalid ───────────────────────────────
console.log('Suite: buildTrendCardHTML empty/invalid');
assertEq('empty [] → empty', buildTrendCardHTML([]), '');
assertEq('null → empty', buildTrendCardHTML(null), '');
assertEq('undefined → empty', buildTrendCardHTML(undefined), '');
assertEq('1 entry → empty', buildTrendCardHTML([DEMO[0]]), '');
assertEq('string → empty', buildTrendCardHTML('foo'), '');
assertEq('number → empty', buildTrendCardHTML(42), '');

// 2 entries: borderline — should produce output
var html2 = buildTrendCardHTML(DEMO.slice(0, 2));
assertTrue('2 entries → non-empty', html2.length > 0);

// Entries with all-null values → returns empty (no signal rows)
var allNull = [
  { date: '2026-06-13', sleep: null, rhr: null, hrv: null, steps: null, exercise: null },
  { date: '2026-06-14', sleep: null, rhr: null, hrv: null, steps: null, exercise: null },
];
assertEq('all-null entries → empty', buildTrendCardHTML(allNull), '');

// ── Suite 7: TREND_SIGNALS config ────────────────────────────────────────────
console.log('Suite: TREND_SIGNALS config');
assertEq('5 signals defined', TREND_SIGNALS.length, 5);
var keys = TREND_SIGNALS.map(function(s) { return s.key; });
assertTrue('has sleep', keys.includes('sleep'));
assertTrue('has hrv', keys.includes('hrv'));
assertTrue('has rhr', keys.includes('rhr'));
assertTrue('has steps', keys.includes('steps'));
assertTrue('has exercise', keys.includes('exercise'));
// Polarity checks
var rhrSig = TREND_SIGNALS.find(function(s) { return s.key === 'rhr'; });
assertEq('rhr polarity down', rhrSig.polarity, 'down');
var sleepSig = TREND_SIGNALS.find(function(s) { return s.key === 'sleep'; });
assertEq('sleep polarity up', sleepSig.polarity, 'up');

// ── Suite 8: exports ──────────────────────────────────────────────────────────
console.log('Suite: exports');
var mod = require('./bala-b54-trend-card-engine');
assertEq('exports TREND_SIGNALS', typeof mod.TREND_SIGNALS, 'object');
assertEq('exports TREND_THRESHOLD', typeof mod.TREND_THRESHOLD, 'number');
assertEq('exports computeSignalAvg', typeof mod.computeSignalAvg, 'function');
assertEq('exports computeSignalDir', typeof mod.computeSignalDir, 'function');
assertEq('exports computeTrendRow', typeof mod.computeTrendRow, 'function');
assertEq('exports buildTrendCardHTML', typeof mod.buildTrendCardHTML, 'function');

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n=============================');
console.log('BALA-B54: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exit(1);
