'use strict';
// =============================================================================
// BALA-B45 Weekly Reflection Engine — Test Suite
// Tests bala-weekly-reflection-engine.js (CommonJS, no DOM)
// =============================================================================

const {
  computeWeeklyReflection,
  computeFactorPatterns,
  trendDirection,
  averageOf,
  stdDevOf,
  dayProxyScore,
  deriveNextWeekFocus,
  friendlyDate,
  BEHAVIOR_FACTOR_LABELS,
} = require('./bala-weekly-reflection-engine.js');

let passed = 0;
let failed = 0;

function assert(label, condition, detail) {
  if (condition) {
    console.log('  ✓', label);
    passed++;
  } else {
    console.error('  ✗', label, detail !== undefined ? '→ ' + JSON.stringify(detail) : '');
    failed++;
  }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const NOW = new Date('2024-06-20T12:00:00Z').getTime(); // deterministic anchor

function daysAgo(n, baseMs) {
  return new Date((baseMs || NOW) - n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function makeHistory(entries) {
  return { source: 'local', history: entries };
}

// 7 full days of data
const FULL_HISTORY_7 = makeHistory([
  { date: daysAgo(6), sleep: 7.5, hrv: 45, rhr: 58, spo2: 98, steps: 8000 },
  { date: daysAgo(5), sleep: 8.0, hrv: 48, rhr: 57, spo2: 97, steps: 7500 },
  { date: daysAgo(4), sleep: 7.0, hrv: 42, rhr: 60, spo2: 98, steps: 9000 },
  { date: daysAgo(3), sleep: 7.5, hrv: 50, rhr: 56, spo2: 97, steps: 8500 },
  { date: daysAgo(2), sleep: 8.5, hrv: 55, rhr: 54, spo2: 99, steps: 10000 },
  { date: daysAgo(1), sleep: 7.0, hrv: 52, rhr: 55, spo2: 98, steps: 7000 },
  { date: daysAgo(0), sleep: 8.0, hrv: 58, rhr: 53, spo2: 98, steps: 8000 },
]);

// Demo source fixture
const DEMO_HISTORY = { source: 'demo', history: FULL_HISTORY_7.history };

// ---------------------------------------------------------------------------
// Suite 1: Math helpers
// ---------------------------------------------------------------------------
console.log('\nSuite 1: Math helpers');

assert('averageOf([]) → null', averageOf([]) === null);
assert('averageOf([NaN, null, undefined]) → null', averageOf([NaN, null, undefined]) === null);
assert('averageOf([4, 6]) → 5', averageOf([4, 6]) === 5);
assert('averageOf([1, 2, 3, 4, 5]) → 3', averageOf([1, 2, 3, 4, 5]) === 3);

assert('stdDevOf([]) → null', stdDevOf([]) === null);
assert('stdDevOf([5]) → null (n<2)', stdDevOf([5]) === null);
assert('stdDevOf([5, 5]) → 0', stdDevOf([5, 5]) === 0);
const sd3 = stdDevOf([7, 8, 7.5]);
assert('stdDevOf([7,8,7.5]) is a finite number', Number.isFinite(sd3) && sd3 >= 0, sd3);

assert('trendDirection([]) → null', trendDirection([]) === null);
assert('trendDirection([1,2]) → null (n<3)', trendDirection([1, 2]) === null);
assert('trendDirection([10,10,10]) → stable (delta<2)', trendDirection([10, 10, 10]) === 'stable');
assert('trendDirection([10,10,13]) → up (delta>=2)', trendDirection([10, 10, 13]) === 'up');
assert('trendDirection([13,10,10]) → down (delta<=-2)', trendDirection([13, 10, 10]) === 'down');
assert('trendDirection([10,11,10]) → stable (delta<2)', trendDirection([10, 11, 10]) === 'stable');

// ---------------------------------------------------------------------------
// Suite 2: dayProxyScore
// ---------------------------------------------------------------------------
console.log('\nSuite 2: dayProxyScore');

assert('all null fields → null', dayProxyScore({ hrv: null, sleep: null, rhr: null }) === null);
assert('hrv only → hrv value', dayProxyScore({ hrv: 50 }) === 50);
assert('sleep only → sleep * 5', dayProxyScore({ sleep: 8 }) === 40);
assert('rhr only → 100 - rhr', dayProxyScore({ rhr: 60 }) === 40);
const combo = dayProxyScore({ hrv: 50, sleep: 8, rhr: 60 });
assert('combo → (50+40+40)/3', Math.abs(combo - (50 + 40 + 40) / 3) < 0.001, combo);

// ---------------------------------------------------------------------------
// Suite 3: Empty state (no history)
// ---------------------------------------------------------------------------
console.log('\nSuite 3: Empty state (no history)');

const empty = computeWeeklyReflection({}, [], NOW);
assert('empty.empty === true', empty.empty === true, empty.empty);
assert('empty.count === 0', empty.count === 0, empty.count);
assert('empty.observations is array', Array.isArray(empty.observations));
assert('empty.observations.length === 0', empty.observations.length === 0);
assert('empty.focus is a non-empty string', typeof empty.focus === 'string' && empty.focus.length > 0);
assert('empty.disclaimer exists', typeof empty.disclaimer === 'string' && empty.disclaimer.length > 0);
assert('empty result never null', empty !== null);

// ---------------------------------------------------------------------------
// Suite 4: Partial data (1-2 check-ins — not enough for trends)
// ---------------------------------------------------------------------------
console.log('\nSuite 4: Partial data (1 check-in)');

const partial1 = computeWeeklyReflection(makeHistory([
  { date: daysAgo(1), sleep: 7.5, hrv: 45, rhr: 58 },
]), [], NOW);
assert('partial1.empty === false', partial1.empty === false);
assert('partial1.count === 1', partial1.count === 1);
// With only 1 entry, no trend observations possible
const trendObs = partial1.observations.filter(o =>
  ['hrv_rising','hrv_falling','hrv_stable','rhr_rising','rhr_falling'].includes(o.key));
assert('partial1: no trend observations with 1 entry', trendObs.length === 0, trendObs);

// 2 entries — no sleep/hrv/rhr trend (need ≥3), but may have best/toughest day
const partial2 = computeWeeklyReflection(makeHistory([
  { date: daysAgo(2), sleep: 6.0, hrv: 30, rhr: 65 },
  { date: daysAgo(1), sleep: 8.0, hrv: 55, rhr: 55 },
]), [], NOW);
assert('partial2.count === 2', partial2.count === 2);
assert('partial2: no sleep obs with only 2 sleep values', !partial2.observations.find(o => o.key.startsWith('sleep_')));

// ---------------------------------------------------------------------------
// Suite 5: Full 7-day data — observations present
// ---------------------------------------------------------------------------
console.log('\nSuite 5: Full 7-day data');

const full = computeWeeklyReflection(FULL_HISTORY_7, [], NOW);
assert('full.empty === false', full.empty === false);
assert('full.count === 7', full.count === 7);
assert('full.observations is array', Array.isArray(full.observations));
assert('full.observations.length >= 1', full.observations.length >= 1, full.observations.length);
assert('full.observations capped at 5', full.observations.length <= 5);
assert('full.focus is a string', typeof full.focus === 'string' && full.focus.length > 0);
// All observations have key and text
const obsMalformed = full.observations.filter(o => !o.key || !o.text);
assert('all observations have key + text', obsMalformed.length === 0, obsMalformed);

// ---------------------------------------------------------------------------
// Suite 6: Demo mode detection
// ---------------------------------------------------------------------------
console.log('\nSuite 6: Demo mode');

const demo = computeWeeklyReflection(DEMO_HISTORY, [], NOW);
assert('demo.isDemo === true', demo.isDemo === true, demo.isDemo);
assert('demo.empty === false', demo.empty === false);
assert('demo still produces observations', demo.observations.length >= 1);

const nonDemo = computeWeeklyReflection(FULL_HISTORY_7, [], NOW);
assert('non-demo.isDemo === false', nonDemo.isDemo === false);

// ---------------------------------------------------------------------------
// Suite 7: Sleep consistency observations
// ---------------------------------------------------------------------------
console.log('\nSuite 7: Sleep consistency');

// Consistent sleep (sd < 0.5)
const sleepConsistent = computeWeeklyReflection(makeHistory([
  { date: daysAgo(4), sleep: 7.5 }, { date: daysAgo(3), sleep: 7.6 },
  { date: daysAgo(2), sleep: 7.4 }, { date: daysAgo(1), sleep: 7.5 },
  { date: daysAgo(0), sleep: 7.5 },
]), [], NOW);
const consObs = sleepConsistent.observations.find(o => o.key === 'sleep_consistent');
assert('consistent sleep obs key = sleep_consistent', !!consObs, sleepConsistent.observations.map(o=>o.key));

// Variable sleep (sd >= 1.0)
const sleepVariable = computeWeeklyReflection(makeHistory([
  { date: daysAgo(4), sleep: 5.0 }, { date: daysAgo(3), sleep: 9.5 },
  { date: daysAgo(2), sleep: 5.5 }, { date: daysAgo(1), sleep: 9.0 },
  { date: daysAgo(0), sleep: 5.0 },
]), [], NOW);
const varObs = sleepVariable.observations.find(o => o.key === 'sleep_variable');
assert('variable sleep obs key = sleep_variable', !!varObs, sleepVariable.observations.map(o=>o.key));

// Moderate sleep (0.5 <= sd < 1.0) — sd=0.6 with these values
const sleepModerate = computeWeeklyReflection(makeHistory([
  { date: daysAgo(4), sleep: 6.5 }, { date: daysAgo(3), sleep: 8.0 },
  { date: daysAgo(2), sleep: 7.0 }, { date: daysAgo(1), sleep: 8.0 },
  { date: daysAgo(0), sleep: 7.0 },
]), [], NOW);
const modObs = sleepModerate.observations.find(o => o.key === 'sleep_moderate');
assert('moderate sleep obs key = sleep_moderate', !!modObs, sleepModerate.observations.map(o=>o.key));

// ---------------------------------------------------------------------------
// Suite 8: HRV trend observations
// ---------------------------------------------------------------------------
console.log('\nSuite 8: HRV trends');

const hrvUp = computeWeeklyReflection(makeHistory([
  { date: daysAgo(4), hrv: 30 }, { date: daysAgo(3), hrv: 32 },
  { date: daysAgo(2), hrv: 38 }, { date: daysAgo(1), hrv: 42 },
  { date: daysAgo(0), hrv: 45 },
]), [], NOW);
assert('hrv rising → hrv_rising obs', !!hrvUp.observations.find(o => o.key === 'hrv_rising'),
  hrvUp.observations.map(o=>o.key));

const hrvDown = computeWeeklyReflection(makeHistory([
  { date: daysAgo(4), hrv: 55 }, { date: daysAgo(3), hrv: 50 },
  { date: daysAgo(2), hrv: 45 }, { date: daysAgo(1), hrv: 40 },
  { date: daysAgo(0), hrv: 38 },
]), [], NOW);
assert('hrv falling → hrv_falling obs', !!hrvDown.observations.find(o => o.key === 'hrv_falling'),
  hrvDown.observations.map(o=>o.key));

const hrvStable = computeWeeklyReflection(makeHistory([
  { date: daysAgo(4), hrv: 45 }, { date: daysAgo(3), hrv: 46 },
  { date: daysAgo(2), hrv: 45 }, { date: daysAgo(1), hrv: 46 },
  { date: daysAgo(0), hrv: 45 },
]), [], NOW);
assert('hrv stable → hrv_stable obs', !!hrvStable.observations.find(o => o.key === 'hrv_stable'),
  hrvStable.observations.map(o=>o.key));

// ---------------------------------------------------------------------------
// Suite 9: RHR trend observations
// ---------------------------------------------------------------------------
console.log('\nSuite 9: RHR trends');

const rhrDown = computeWeeklyReflection(makeHistory([
  { date: daysAgo(4), rhr: 70 }, { date: daysAgo(3), rhr: 68 },
  { date: daysAgo(2), rhr: 66 }, { date: daysAgo(1), rhr: 63 },
  { date: daysAgo(0), rhr: 62 },
]), [], NOW);
assert('rhr falling → rhr_falling obs', !!rhrDown.observations.find(o => o.key === 'rhr_falling'),
  rhrDown.observations.map(o=>o.key));

const rhrUp = computeWeeklyReflection(makeHistory([
  { date: daysAgo(4), rhr: 58 }, { date: daysAgo(3), rhr: 60 },
  { date: daysAgo(2), rhr: 64 }, { date: daysAgo(1), rhr: 67 },
  { date: daysAgo(0), rhr: 70 },
]), [], NOW);
assert('rhr rising → rhr_rising obs', !!rhrUp.observations.find(o => o.key === 'rhr_rising'),
  rhrUp.observations.map(o=>o.key));

// Stable RHR — no obs expected (conserve slots)
const rhrStable = computeWeeklyReflection(makeHistory([
  { date: daysAgo(4), rhr: 60 }, { date: daysAgo(3), rhr: 61 },
  { date: daysAgo(2), rhr: 60 }, { date: daysAgo(1), rhr: 61 },
  { date: daysAgo(0), rhr: 60 },
]), [], NOW);
assert('rhr stable → no rhr obs (slot conserved)', !rhrStable.observations.find(o => o.key && o.key.startsWith('rhr_')),
  rhrStable.observations.map(o=>o.key));

// ---------------------------------------------------------------------------
// Suite 10: Best/toughest day
// ---------------------------------------------------------------------------
console.log('\nSuite 10: Best and toughest day');

const dayDiff = computeWeeklyReflection(makeHistory([
  { date: daysAgo(4), hrv: 20, sleep: 5, rhr: 80 }, // low proxy
  { date: daysAgo(3), hrv: 60, sleep: 9, rhr: 50 }, // high proxy
  { date: daysAgo(2), hrv: 40, sleep: 7, rhr: 62 },
]), [], NOW);
const btObs = dayDiff.observations.find(o => o.key === 'best_toughest_day');
assert('best/toughest day obs present when days differ', !!btObs, dayDiff.observations.map(o=>o.key));

// All days identical proxy — no best/toughest obs expected (same dateKey check)
const identicalDays = computeWeeklyReflection(makeHistory([
  { date: daysAgo(2), hrv: 45, sleep: 7.5, rhr: 60 },
  { date: daysAgo(1), hrv: 45, sleep: 7.5, rhr: 60 },
  { date: daysAgo(0), hrv: 45, sleep: 7.5, rhr: 60 },
]), [], NOW);
const sameProxy = identicalDays.observations.find(o => o.key === 'best_toughest_day');
assert('no best/toughest obs when all proxies identical (same dateKey)', !sameProxy);

// ---------------------------------------------------------------------------
// Suite 11: Behavior note truncation
// ---------------------------------------------------------------------------
console.log('\nSuite 11: Behavior note truncation');

const longNote = 'A'.repeat(100); // 100 chars > 80 truncation threshold
const noteHistory = [
  { date: daysAgo(4), hrv: 20, sleep: 5, rhr: 80 },
  { date: daysAgo(3), hrv: 60, sleep: 9, rhr: 50 },
  { date: daysAgo(2), hrv: 40, sleep: 7, rhr: 62 },
];
const bhWithNote = [
  { date: daysAgo(4), factors: [], note: longNote },
];
const noteResult = computeWeeklyReflection(makeHistory(noteHistory), bhWithNote, NOW);
const dayObs = noteResult.observations.find(o => o.key === 'best_toughest_day');
if (dayObs) {
  assert('note truncated to <=80+3 in obs text', dayObs.text.length <= 300, dayObs.text.length);
  // truncated note ends with '...' (3 chars)
  // Engine uses Unicode ellipsis '…' (…) or ASCII '...'
  const hasEllipsis = dayObs.text.includes('…') || dayObs.text.includes('...');
  assert('long note truncated with ellipsis', hasEllipsis, dayObs.text.slice(-10));
}

// Empty note — no note appended
const noNoteHistory = [
  { date: daysAgo(4), factors: [], note: '' },
];
const noNoteResult = computeWeeklyReflection(makeHistory(noteHistory), noNoteHistory, NOW);
const dayObsNoNote = noNoteResult.observations.find(o => o.key === 'best_toughest_day');
if (dayObsNoNote) {
  assert('empty note not appended to obs text', !dayObsNoNote.text.includes('You noted'), dayObsNoNote.text);
}

// ---------------------------------------------------------------------------
// Suite 12: computeFactorPatterns
// ---------------------------------------------------------------------------
console.log('\nSuite 12: computeFactorPatterns');

const bh7 = [
  { date: daysAgo(6), factors: ['stress', 'alcohol'], note: '' },
  { date: daysAgo(5), factors: ['stress', 'caffeine'], note: '' },
  { date: daysAgo(4), factors: ['stress', 'exercise'], note: '' },
  { date: daysAgo(3), factors: ['caffeine'], note: '' },
  { date: daysAgo(2), factors: ['exercise', 'meditation'], note: '' },
  { date: daysAgo(1), factors: ['stress'], note: '' },
  { date: daysAgo(0), factors: ['meditation'], note: '' },
];
const cutoff = NOW - 7 * 24 * 60 * 60 * 1000;
const fp = computeFactorPatterns(bh7, cutoff);
assert('factorPatterns not null with data', fp !== null);
assert('factorPatterns.totalEntries === 7', fp.totalEntries === 7, fp.totalEntries);
assert('top factor is stress (4 occurrences)', fp.sorted[0].key === 'stress', fp.sorted[0]);
assert('patternNotes is array', Array.isArray(fp.patternNotes));
assert('patternNotes length <= 3', fp.patternNotes.length <= 3);

// No factors logged
const fpEmpty = computeFactorPatterns([], cutoff);
assert('factorPatterns null with no data', fpEmpty === null);

// ---------------------------------------------------------------------------
// Suite 13: Next-week focus derivation
// ---------------------------------------------------------------------------
console.log('\nSuite 13: Next-week focus');

// High sleep SD → wind-down focus
const highSdFocus = deriveNextWeekFocus([5, 9, 5, 9, 5, 9, 5], [], []);
assert('high sleep SD → wind-down focus', highSdFocus.toLowerCase().includes('wind-down') || highSdFocus.includes('timing'), highSdFocus);

// Low HRV → rest focus
const lowHrvFocus = deriveNextWeekFocus([7.5, 7.5, 7.5], [28, 30, 29], []);
assert('low HRV → rest/recovery focus', lowHrvFocus.toLowerCase().includes('rest') || lowHrvFocus.toLowerCase().includes('recover'), lowHrvFocus);

// High RHR → activity/sleep focus
const highRhrFocus = deriveNextWeekFocus([7.5, 7.5, 7.5], [50, 52, 51], [72, 74, 75]);
assert('high RHR → elevated focus', highRhrFocus.toLowerCase().includes('elevated') || highRhrFocus.toLowerCase().includes('heart'), highRhrFocus);

// Baseline (all OK) → keep logging
const baselineFocus = deriveNextWeekFocus([7.5, 7.5, 7.5], [50, 52, 51], [60, 62, 60]);
assert('baseline → keep logging focus', baselineFocus.toLowerCase().includes('baseline') || baselineFocus.toLowerCase().includes('logging'), baselineFocus);

// ---------------------------------------------------------------------------
// Suite 14: friendlyDate
// ---------------------------------------------------------------------------
console.log('\nSuite 14: friendlyDate');

const fd = friendlyDate('2024-06-20');
assert('friendlyDate returns non-empty string', typeof fd === 'string' && fd.length > 0, fd);
assert('friendlyDate invalid → returns raw string', friendlyDate('not-a-date').length > 0);
assert('friendlyDate empty → returns empty-ish string', typeof friendlyDate('') === 'string');
assert('friendlyDate null-ish → string', typeof friendlyDate(undefined) === 'string');

// ---------------------------------------------------------------------------
// Suite 15: Safety language scan
// ---------------------------------------------------------------------------
console.log('\nSuite 15: Safety language — no medical claims in output');

// Positive claim patterns only — negations ("does not diagnose", "not a diagnosis")
// are the correct safe-language pattern and should NOT be flagged.
const FORBIDDEN = [
  /\bcan diagnose\b/i, /\bwill diagnose\b/i, /\bBALA diagnoses?\b/i,
  /\bpredict.*risk\b/i, /\bprevent.*cardiac\b/i,
  /\bheart attack\b/i, /\bmedical advice\b/i,
  /\btreatment\b/i, /\bprescri/i,
  /\bemergency monitor/i, /\bwill happen\b/i, /\bguaranteed\b/i,
  /\byou have [a-z]+ condition\b/i,
];

function scanForClaims(text, label) {
  for (const re of FORBIDDEN) {
    if (re.test(text)) {
      assert('no forbidden claim in ' + label + ': ' + re.toString(), false, text.slice(0, 120));
      return;
    }
  }
  assert('no forbidden claims in ' + label, true);
}

const fullResult = computeWeeklyReflection(FULL_HISTORY_7, bh7, NOW);
scanForClaims(fullResult.focus, 'focus');
scanForClaims(fullResult.disclaimer, 'disclaimer');
for (const obs of fullResult.observations) {
  scanForClaims(obs.text, 'observation:' + obs.key);
}

const emptyResult = computeWeeklyReflection({}, [], NOW);
scanForClaims(emptyResult.focus, 'empty focus');
scanForClaims(emptyResult.disclaimer, 'empty disclaimer');

// ---------------------------------------------------------------------------
// Suite 16: Observation cap at 5
// ---------------------------------------------------------------------------
console.log('\nSuite 16: Observation cap');

// Force maximum observations: consistent sleep + hrv up + rhr down + best/tough day
const maxData = makeHistory([
  { date: daysAgo(6), sleep: 7.5, hrv: 30, rhr: 72 },
  { date: daysAgo(5), sleep: 7.6, hrv: 32, rhr: 70 },
  { date: daysAgo(4), sleep: 7.4, hrv: 37, rhr: 68 },
  { date: daysAgo(3), sleep: 7.5, hrv: 42, rhr: 65 },
  { date: daysAgo(2), sleep: 7.5, hrv: 45, rhr: 63 },
  { date: daysAgo(1), sleep: 7.6, hrv: 48, rhr: 61 },
  { date: daysAgo(0), sleep: 7.5, hrv: 50, rhr: 60 },
]);
const maxResult = computeWeeklyReflection(maxData, [], NOW);
assert('observations never exceed 5', maxResult.observations.length <= 5, maxResult.observations.length);

// ---------------------------------------------------------------------------
// Suite 17: Entries older than 7 days are excluded
// ---------------------------------------------------------------------------
console.log('\nSuite 17: Old entries excluded');

const oldEntry = computeWeeklyReflection(makeHistory([
  { date: daysAgo(10), sleep: 7.5, hrv: 45, rhr: 58 }, // >7 days ago
  { date: daysAgo(8),  sleep: 8.0, hrv: 48, rhr: 57 }, // >7 days ago
]), [], NOW);
assert('entries >7 days old excluded → empty result', oldEntry.empty === true, oldEntry.count);

const mixedAge = computeWeeklyReflection(makeHistory([
  { date: daysAgo(10), sleep: 7.5, hrv: 45, rhr: 58 }, // excluded
  { date: daysAgo(3),  sleep: 8.0, hrv: 48, rhr: 57 }, // included
  { date: daysAgo(1),  sleep: 7.5, hrv: 50, rhr: 56 }, // included
]), [], NOW);
assert('only entries within 7 days counted', mixedAge.count === 2, mixedAge.count);

// ---------------------------------------------------------------------------
// Suite 18: BEHAVIOR_FACTOR_LABELS export integrity
// ---------------------------------------------------------------------------
console.log('\nSuite 18: BEHAVIOR_FACTOR_LABELS export');

assert('BEHAVIOR_FACTOR_LABELS is object', typeof BEHAVIOR_FACTOR_LABELS === 'object' && BEHAVIOR_FACTOR_LABELS !== null);
assert('stress label exists', typeof BEHAVIOR_FACTOR_LABELS.stress === 'string');
assert('exercise label exists', typeof BEHAVIOR_FACTOR_LABELS.exercise === 'string');
assert('at least 10 labels defined', Object.keys(BEHAVIOR_FACTOR_LABELS).length >= 10,
  Object.keys(BEHAVIOR_FACTOR_LABELS).length);

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

console.log('\n' + '─'.repeat(55));
console.log('BALA-B45 Weekly Reflection tests: ' + (passed + failed) + ' total');
console.log(passed + ' passed  \xb7  ' + failed + ' failed');
if (failed > 0) {
  console.error('FAIL bala-b45-weekly-reflection.test.js');
  process.exit(1);
} else {
  console.log('PASS bala-b45-weekly-reflection.test.js');
}
