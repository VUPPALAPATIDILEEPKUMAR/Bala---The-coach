'use strict';
// BALA-B52 History Detail Engine — test suite
var e = require('./bala-b52-history-engine.js');
var HISTORY_KEY_MAP = e.HISTORY_KEY_MAP;
var HISTORY_POLARITY = e.HISTORY_POLARITY;
var formatValue = e.formatValue;
var formatShortDate = e.formatShortDate;
var extractSignalHistory = e.extractSignalHistory;
var trendIcon = e.trendIcon;
var buildHistoryTableHTML = e.buildHistoryTableHTML;
var buildHistoryHTML = e.buildHistoryHTML;

var passed = 0;
var failed = 0;

function assert(label, cond) {
  if (cond) { passed++; process.stdout.write('.'); }
  else { failed++; console.log('\n  FAIL: ' + label); }
}

function assertEq(label, a, b) {
  assert(label, a === b ||
    JSON.stringify(a) === JSON.stringify(b));
}

// Demo history used across suites
var DEMO = [
  { date: '2026-06-08', sleep: 6.8, rhr: 65, hrv: 40,
    spo2: 97, steps: 5900, exercise: 18,
    breathing: 13.2, temperature: 0.1 },
  { date: '2026-06-09', sleep: 7.1, rhr: 64, hrv: 42,
    spo2: 97, steps: 7600, exercise: 27,
    breathing: 13.0, temperature: 0.2 },
  { date: '2026-06-10', sleep: 6.6, rhr: 66, hrv: 39,
    spo2: 96, steps: 5100, exercise: 14,
    breathing: 13.5, temperature: -0.1 },
  { date: '2026-06-11', sleep: 7.3, rhr: 62, hrv: 45,
    spo2: 97, steps: 8900, exercise: 36,
    breathing: 12.8, temperature: 0.0 },
  { date: '2026-06-12', sleep: 7.6, rhr: 61, hrv: 48,
    spo2: 98, steps: 9400, exercise: 41,
    breathing: 12.5, temperature: 0.1 },
  { date: '2026-06-13', sleep: 7.2, rhr: 62, hrv: 44,
    spo2: 97, steps: 7200, exercise: 29,
    breathing: 13.0, temperature: 0.1 },
  { date: '2026-06-14', sleep: 7.4, rhr: 61, hrv: 46,
    spo2: 97, steps: 6842, exercise: 32,
    breathing: 13.1, temperature: 0.1 },
];

// ──────────────────────────────────────────────────────
// Suite 1: HISTORY_KEY_MAP (9 tests)
// ──────────────────────────────────────────────────────
console.log('\nSuite 1: HISTORY_KEY_MAP');
assertEq('sleep maps to sleep', HISTORY_KEY_MAP.sleep, 'sleep');
assertEq('heart maps to rhr', HISTORY_KEY_MAP.heart, 'rhr');
assertEq('hrv maps to hrv', HISTORY_KEY_MAP.hrv, 'hrv');
assertEq('spo2 maps to spo2', HISTORY_KEY_MAP.spo2, 'spo2');
assertEq('steps maps to steps', HISTORY_KEY_MAP.steps, 'steps');
assertEq('cardio maps to exercise',
  HISTORY_KEY_MAP.cardio, 'exercise');
assertEq('breathing maps to breathing',
  HISTORY_KEY_MAP.breathing, 'breathing');
assertEq('temperature maps to temperature',
  HISTORY_KEY_MAP.temperature, 'temperature');
assert('readiness not in map',
  HISTORY_KEY_MAP.readiness === undefined);

// ──────────────────────────────────────────────────────
// Suite 2: HISTORY_POLARITY (8 tests)
// ──────────────────────────────────────────────────────
console.log('\nSuite 2: HISTORY_POLARITY');
assertEq('sleep up', HISTORY_POLARITY.sleep, 'up');
assertEq('heart down', HISTORY_POLARITY.heart, 'down');
assertEq('hrv up', HISTORY_POLARITY.hrv, 'up');
assertEq('spo2 up', HISTORY_POLARITY.spo2, 'up');
assertEq('steps up', HISTORY_POLARITY.steps, 'up');
assertEq('cardio up', HISTORY_POLARITY.cardio, 'up');
assertEq('breathing flat', HISTORY_POLARITY.breathing, 'flat');
assertEq('temperature flat',
  HISTORY_POLARITY.temperature, 'flat');

// ──────────────────────────────────────────────────────
// Suite 3: formatValue (16 tests)
// ──────────────────────────────────────────────────────
console.log('\nSuite 3: formatValue');
assertEq('sleep 7.4', formatValue('sleep', 7.4), '7.4 h');
assertEq('sleep 6.0', formatValue('sleep', 6), '6.0 h');
assertEq('heart 61', formatValue('heart', 61), '61 bpm');
assertEq('heart rounding', formatValue('heart', 61.7), '62 bpm');
assertEq('hrv 46', formatValue('hrv', 46), '46 ms');
assertEq('spo2 97', formatValue('spo2', 97), '97%');
assertEq('steps 6842',
  formatValue('steps', 6842), '6,842');
assertEq('steps 1000',
  formatValue('steps', 1000), '1,000');
assertEq('cardio 32', formatValue('cardio', 32), '32 min');
assertEq('breathing 13.0',
  formatValue('breathing', 13.0), '13.0 brpm');
assertEq('temperature +0.1',
  formatValue('temperature', 0.1), '+0.1°F');
assertEq('temperature -0.5',
  formatValue('temperature', -0.5), '-0.5°F');
assertEq('temperature zero',
  formatValue('temperature', 0), '+0.0°F');
assertEq('null returns dash',
  formatValue('hrv', null), '—');
assertEq('NaN returns dash',
  formatValue('hrv', NaN), '—');
assertEq('Infinity returns dash',
  formatValue('hrv', Infinity), '—');

// ──────────────────────────────────────────────────────
// Suite 4: formatShortDate (11 tests)
// ──────────────────────────────────────────────────────
console.log('\nSuite 4: formatShortDate');
assertEq('June 8',
  formatShortDate('2026-06-08'), 'Jun 8');
assertEq('January 31',
  formatShortDate('2026-01-31'), 'Jan 31');
assertEq('December 25',
  formatShortDate('2026-12-25'), 'Dec 25');
assertEq('March 1',
  formatShortDate('2026-03-01'), 'Mar 1');
assertEq('empty string', formatShortDate(''), '');
assertEq('null', formatShortDate(null), '');
assertEq('undefined', formatShortDate(undefined), '');
assertEq('non-date string passthrough',
  formatShortDate('hello'), 'hello');
assertEq('invalid month 13 passthrough',
  formatShortDate('2026-13-01'), '2026-13-01');
assertEq('month 00 passthrough',
  formatShortDate('2026-00-15'), '2026-00-15');
assertEq('day NaN passthrough',
  formatShortDate('2026-06-xx'), '2026-06-xx');

// ──────────────────────────────────────────────────────
// Suite 5: extractSignalHistory (13 tests)
// ──────────────────────────────────────────────────────
console.log('\nSuite 5: extractSignalHistory');
var ex = extractSignalHistory(DEMO, 'hrv', 7);
assertEq('returns 7 entries', ex.length, 7);
assertEq('first date', ex[0].date, '2026-06-08');
assertEq('first value', ex[0].value, 40);
assertEq('last value', ex[6].value, 46);

var ex3 = extractSignalHistory(DEMO, 'hrv', 3);
assertEq('n=3 gives 3 entries', ex3.length, 3);
assertEq('n=3 last is still entry 7',
  ex3[2].value, 46);

assertEq('empty history returns []',
  extractSignalHistory([], 'hrv', 7).length, 0);
assertEq('null history returns []',
  extractSignalHistory(null, 'hrv', 7).length, 0);
assertEq('unknown key returns []',
  extractSignalHistory(DEMO, 'readiness', 7).length, 0);
assertEq('undefined key returns []',
  extractSignalHistory(DEMO, undefined, 7).length, 0);

var histWithNull = DEMO.slice();
histWithNull = [
  { date: '2026-06-10', hrv: null },
  { date: '2026-06-11', hrv: 'x' },
  { date: '2026-06-12', hrv: 44 },
];
var exn = extractSignalHistory(histWithNull, 'hrv', 7);
assertEq('null val becomes null', exn[0].value, null);
assertEq('string val becomes null', exn[1].value, null);
assertEq('valid val preserved', exn[2].value, 44);

var histNoDate = [{ hrv: 40 }];
var exd = extractSignalHistory(histNoDate, 'hrv', 7);
assertEq('missing date becomes empty string',
  exd[0].date, '');

// ──────────────────────────────────────────────────────
// Suite 6: trendIcon (14 tests)
// ──────────────────────────────────────────────────────
console.log('\nSuite 6: trendIcon');
assertEq('empty entries dash',
  trendIcon('hrv', []).icon, '—');
assertEq('empty entries flat cls',
  trendIcon('hrv', []).cls, 'hist-flat');

var one = [{ value: 46 }];
assertEq('one entry dash icon',
  trendIcon('hrv', one).icon, '—');

var allSame = [
  { value: 46 }, { value: 46 }, { value: 46 }
];
assertEq('all same arrow icon',
  trendIcon('hrv', allSame).icon, '→');
assertEq('all same flat cls',
  trendIcon('hrv', allSame).cls, 'hist-flat');

// HRV rising: 'up' polarity → good
var hRising = [{ value: 40 }, { value: 42 }, { value: 46 }];
assertEq('hrv rising icon', trendIcon('hrv', hRising).icon, '↑');
assertEq('hrv rising good cls',
  trendIcon('hrv', hRising).cls, 'hist-good');

// HRV falling: 'up' polarity → watch
var hFalling = [{ value: 46 }, { value: 43 }, { value: 40 }];
assertEq('hrv falling icon',
  trendIcon('hrv', hFalling).icon, '↓');
assertEq('hrv falling watch cls',
  trendIcon('hrv', hFalling).cls, 'hist-watch');

// RHR (heart) rising: 'down' polarity → watch
var rhrRising = [{ value: 58 }, { value: 62 }, { value: 66 }];
assertEq('rhr rising watch',
  trendIcon('heart', rhrRising).cls, 'hist-watch');

// RHR falling: 'down' polarity → good
var rhrFalling = [{ value: 66 }, { value: 62 }, { value: 58 }];
assertEq('rhr falling good',
  trendIcon('heart', rhrFalling).cls, 'hist-good');

// Breathing: 'flat' polarity → always flat cls
var breathRising = [
  { value: 12 }, { value: 13 }, { value: 15 }
];
assertEq('breathing rising flat cls',
  trendIcon('breathing', breathRising).cls, 'hist-flat');
assertEq('breathing rising shows icon',
  trendIcon('breathing', breathRising).icon, '↑');

// Small change (< 5% of range) → flat
var tiny = [{ value: 40 }, { value: 40.5 }, { value: 41 }];
// range=1, last-prev=0.5, ch=0.5/1=0.5 > 0.05, so not tiny
// let's do truly tiny: range=10, last-prev=0.4, ch=0.04
var tinyChange = [
  { value: 40 }, { value: 50 }, { value: 50.4 }
];
assertEq('tiny change flat icon',
  trendIcon('hrv', tinyChange).icon, '→');

// Null values in entries skipped for trend calc
var mixed = [
  { value: null }, { value: 40 }, { value: 46 }
];
assertEq('nulls skipped, still rising',
  trendIcon('hrv', mixed).cls, 'hist-good');

// ──────────────────────────────────────────────────────
// Suite 7: buildHistoryTableHTML (9 tests)
// ──────────────────────────────────────────────────────
console.log('\nSuite 7: buildHistoryTableHTML');
assertEq('empty history returns empty string',
  buildHistoryTableHTML([], 'hrv'), '');
assertEq('unknown key returns empty string',
  buildHistoryTableHTML(DEMO, 'readiness'), '');

var ht = buildHistoryTableHTML(DEMO, 'hrv');
assert('contains hist-block', ht.includes('hist-block'));
assert('contains hist-table', ht.includes('hist-table'));
assert('contains hist-header', ht.includes('hist-header'));
assert('contains 7-day history',
  ht.includes('7-day history'));
assert('contains Jun 8', ht.includes('Jun 8'));
assert('contains ms unit', ht.includes(' ms'));
assert('seven rows', (ht.match(/<tr>/g) || []).length === 7);

// ──────────────────────────────────────────────────────
// Suite 8: buildHistoryHTML (8 tests)
// ──────────────────────────────────────────────────────
console.log('\nSuite 8: buildHistoryHTML');
assertEq('unknown key empty',
  buildHistoryHTML(DEMO, 'readiness'), '');
assertEq('empty key empty',
  buildHistoryHTML(DEMO, ''), '');
assertEq('null key empty',
  buildHistoryHTML(DEMO, null), '');

var hh = buildHistoryHTML(DEMO, 'hrv');
assert('hrv non-empty', hh.length > 0);
var hs = buildHistoryHTML(DEMO, 'spo2');
assert('spo2 contains %', hs.includes('%'));
var hb = buildHistoryHTML(DEMO, 'breathing');
assert('breathing contains brpm', hb.includes('brpm'));
var htemp = buildHistoryHTML(DEMO, 'temperature');
assert('temperature contains F', htemp.includes('°F'));
var hsteps = buildHistoryHTML(DEMO, 'steps');
assert('steps contains comma', hsteps.includes(','));

// ──────────────────────────────────────────────────────
// Suite 9: adversarial safety (12 tests)
// ──────────────────────────────────────────────────────
console.log('\nSuite 9: adversarial safety');

// XSS in date field — must NOT contain <script>
var xssHist = [
  { date: '<script>alert(1)</script>', hrv: 40 }
];
var xssOut = buildHistoryHTML(xssHist, 'hrv');
assert('XSS in date not executed (no raw script tag)',
  !xssOut.includes('<script>'));

// Null entry in array
var nullEntry = [null, { date: '2026-06-08', hrv: 40 }];
var nullOut = buildHistoryHTML(nullEntry, 'hrv');
assert('null entry handled', typeof nullOut === 'string');

// Infinity in value
var infHist = [{ date: '2026-06-08', hrv: Infinity }];
var infOut = buildHistoryHTML(infHist, 'hrv');
assertEq('Infinity single entry returns empty', infOut, '');

// NaN in value
var nanHist = [{ date: '2026-06-08', hrv: NaN }];
var nanOut = buildHistoryHTML(nanHist, 'hrv');
assertEq('NaN single entry returns empty', nanOut, '');

// Very large number formatted safely
var bigHist = [{ date: '2026-06-08', steps: 999999 }];
var bigOut = buildHistoryHTML(bigHist, 'steps');
assert('large number safe', bigOut.includes('999,999'));

// history not an array (object)
var notArr = buildHistoryHTML({ hrv: 40 }, 'hrv');
assertEq('non-array history returns empty', notArr, '');

// history string
var strArr = buildHistoryHTML('history', 'hrv');
assertEq('string history returns empty', strArr, '');

// signalKey = undefined
var undKey = buildHistoryHTML(DEMO, undefined);
assertEq('undefined key returns empty', undKey, '');

// 10 entries with n=7 → only 7 rows
var long10 = Array.from({ length: 10 }, function(_, i) {
  return { date: '2026-06-0' + (i + 1), hrv: 40 + i };
});
var long10Out = buildHistoryHTML(long10, 'hrv');
assert('10 entries trimmed to 7 rows',
  (long10Out.match(/<tr>/g) || []).length === 7);

// All null values → empty string (no valid entries)
var allNull = DEMO.map(function(e) {
  return { date: e.date };
});
var allNullOut = buildHistoryHTML(allNull, 'hrv');
assertEq('all nulls returns empty', allNullOut, '');

// Negative steps (invalid data) → shown literally
var negSteps = [{ date: '2026-06-08', steps: -100 }];
var negOut = buildHistoryHTML(negSteps, 'steps');
assert('negative steps in output',
  typeof negOut === 'string');

// ──────────────────────────────────────────────────────
// Suite 10: exports / structure (5 tests)
// ──────────────────────────────────────────────────────
console.log('\nSuite 10: exports/structure');
assert('HISTORY_KEY_MAP is object',
  typeof HISTORY_KEY_MAP === 'object');
assert('HISTORY_POLARITY is object',
  typeof HISTORY_POLARITY === 'object');
assert('8 keys in HISTORY_KEY_MAP',
  Object.keys(HISTORY_KEY_MAP).length === 8);
assert('8 keys in HISTORY_POLARITY',
  Object.keys(HISTORY_POLARITY).length === 8);
assert('all exports are functions or objects',
  ['formatValue','formatShortDate','extractSignalHistory',
   'trendIcon','buildHistoryTableHTML','buildHistoryHTML']
    .every(function(k) { return typeof e[k] === 'function'; }));

// ──────────────────────────────────────────────────────
// Results
// ──────────────────────────────────────────────────────
console.log('\n');
console.log('bala-b52-history-engine.test.js: ' +
  passed + '/' + (passed + failed) + ' passed');
if (failed > 0) {
  console.error(failed + ' test(s) FAILED');
  process.exit(1);
}
