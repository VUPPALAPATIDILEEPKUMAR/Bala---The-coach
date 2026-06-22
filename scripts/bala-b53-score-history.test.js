// BALA-B53 Score History Engine — test suite
'use strict';

var {
  escHtml, formatShortDate,
  scoreForEntry, scoreTier, buildScoreHistoryHTML
} = require('./bala-b53-score-history');

var passed = 0;
var failed = 0;

function assertEq(label, got, exp) {
  if (got === exp) {
    passed++;
  } else {
    failed++;
    console.error('FAIL [' + label + '] expected=' + JSON.stringify(exp) + ' got=' + JSON.stringify(got));
  }
}
function assertTrue(label, got) {
  if (got) { passed++; }
  else { failed++; console.error('FAIL [' + label + '] expected truthy, got=' + JSON.stringify(got)); }
}
function assertRange(label, got, lo, hi) {
  if (Number.isFinite(got) && got >= lo && got <= hi) { passed++; }
  else { failed++; console.error('FAIL [' + label + '] expected [' + lo + ',' + hi + '], got=' + got); }
}
function assertContains(label, str, sub) {
  if (typeof str === 'string' && str.includes(sub)) { passed++; }
  else { failed++; console.error('FAIL [' + label + '] expected to contain ' + JSON.stringify(sub) + ' in ' + JSON.stringify(str && str.slice(0,120))); }
}
function assertNotContains(label, str, sub) {
  if (typeof str === 'string' && !str.includes(sub)) { passed++; }
  else { failed++; console.error('FAIL [' + label + '] expected NOT to contain ' + JSON.stringify(sub)); }
}

// ── Shared fixtures ───────────────────────────────────────────────────────────
var DEMO = [
  { date: '2026-06-08', sleep: 6.8, rhr: 65, hrv: 40, spo2: 97, steps: 5900, exercise: 18, breathing: 13.2, temperature: 0.1 },
  { date: '2026-06-09', sleep: 7.1, rhr: 64, hrv: 42, spo2: 97, steps: 7600, exercise: 27, breathing: 13.0, temperature: 0.2 },
  { date: '2026-06-10', sleep: 6.6, rhr: 66, hrv: 39, spo2: 96, steps: 5100, exercise: 14, breathing: 13.5, temperature: -0.1 },
  { date: '2026-06-11', sleep: 7.3, rhr: 62, hrv: 45, spo2: 97, steps: 8900, exercise: 36, breathing: 12.8, temperature: 0.0 },
  { date: '2026-06-12', sleep: 7.6, rhr: 61, hrv: 48, spo2: 98, steps: 9400, exercise: 41, breathing: 12.5, temperature: 0.1 },
  { date: '2026-06-13', sleep: 7.2, rhr: 62, hrv: 44, spo2: 97, steps: 7200, exercise: 29, breathing: 13.0, temperature: 0.1 },
  { date: '2026-06-14', sleep: 7.4, rhr: 61, hrv: 46, spo2: 97, steps: 6842, exercise: 32, breathing: 13.1, temperature: 0.1 },
];

// ── Suite 1: escHtml ──────────────────────────────────────────────────────────
console.log('Suite: escHtml');
assertEq('escapes &',    escHtml('a & b'),      'a &amp; b');
assertEq('escapes <',    escHtml('<script>'),   '&lt;script&gt;');
assertEq('escapes >',    escHtml('>end'),       '&gt;end');
assertEq('escapes "',    escHtml('"q"'),        '&quot;q&quot;');
assertEq('clean passthrough', escHtml('hello'), 'hello');
assertEq('coerces number', escHtml(42),         '42');
assertEq('empty string',   escHtml(''),         '');
assertEq('multiple ampers', escHtml('&&&'),     '&amp;&amp;&amp;');

// ── Suite 2: formatShortDate ──────────────────────────────────────────────────
console.log('Suite: formatShortDate');
assertEq('Jan 1',  formatShortDate('2026-01-01'), 'Jan 1');
assertEq('Jun 14', formatShortDate('2026-06-14'), 'Jun 14');
assertEq('Dec 31', formatShortDate('2025-12-31'), 'Dec 31');
assertEq('non-string', formatShortDate(12345),    '12345');
assertEq('bad format', formatShortDate('2026/06/14'), '2026/06/14');
assertEq('empty',      formatShortDate(''),        '');
assertEq('month 0 guard', formatShortDate('2026-00-01'), '2026-00-01');
assertEq('day 0 guard',   formatShortDate('2026-06-00'), '2026-06-00');
assertEq('month 13 guard', formatShortDate('2026-13-01'), '2026-13-01');

// ── Suite 3: scoreForEntry — basic scoring ────────────────────────────────────
console.log('Suite: scoreForEntry basic');
// All fields, no prior — uses fallback baselines
var e0 = DEMO[0];
var s0 = scoreForEntry(e0, []);
assertRange('DEMO[0] in range', s0, 60, 95);
assertEq('returns integer', s0, Math.round(s0));

// Perfect sleep scores higher
var sleepGood = { sleep: 8, hrv: 50, rhr: 55, spo2: 98, steps: 10000, exercise: 45 };
var sleepBad  = { sleep: 5, hrv: 50, rhr: 55, spo2: 98, steps: 10000, exercise: 45 };
assertTrue('8h sleep > 5h sleep', scoreForEntry(sleepGood, []) > scoreForEntry(sleepBad, []));

// Low RHR vs baseline scores higher than elevated RHR
var baseEntries = [{ rhr: 65, hrv: 45 }, { rhr: 65, hrv: 45 }];
var lowRhr  = { sleep: 7, rhr: 60, hrv: 45, spo2: 97, steps: 8000, exercise: 30 };
var highRhr = { sleep: 7, rhr: 72, hrv: 45, spo2: 97, steps: 8000, exercise: 30 };
assertTrue('low rhr scores higher', scoreForEntry(lowRhr, baseEntries) > scoreForEntry(highRhr, baseEntries));

// Improved HRV vs baseline scores higher
var highHrv = { sleep: 7, rhr: 65, hrv: 55, spo2: 97, steps: 8000, exercise: 30 };
var lowHrv  = { sleep: 7, rhr: 65, hrv: 35, spo2: 97, steps: 8000, exercise: 30 };
assertTrue('high hrv scores higher', scoreForEntry(highHrv, baseEntries) > scoreForEntry(lowHrv, baseEntries));

// High steps scores higher activity
var highSteps = { sleep: 7, rhr: 65, hrv: 45, spo2: 97, steps: 12000, exercise: 40 };
var lowSteps  = { sleep: 7, rhr: 65, hrv: 45, spo2: 97, steps: 2000,  exercise: 5 };
assertTrue('high steps scores higher', scoreForEntry(highSteps, []) > scoreForEntry(lowSteps, []));

// spo2 < 95 scores lower
var goodSpo2 = { sleep: 7, rhr: 65, hrv: 45, spo2: 98, steps: 8000, exercise: 30 };
var badSpo2  = { sleep: 7, rhr: 65, hrv: 45, spo2: 91, steps: 8000, exercise: 30 };
assertTrue('high spo2 scores higher', scoreForEntry(goodSpo2, []) > scoreForEntry(badSpo2, []));

// Output clamped 25–100
assertRange('clamp high', scoreForEntry(sleepGood, []), 25, 100);
assertRange('clamp low',  scoreForEntry(sleepBad, []),  25, 100);

// ── Suite 4: scoreForEntry — edge cases ──────────────────────────────────────
console.log('Suite: scoreForEntry edge cases');

// Null/undefined entry → 70 default
assertEq('null entry', scoreForEntry(null, []), 70);
assertEq('undefined entry', scoreForEntry(undefined, []), 70);
assertEq('empty object', scoreForEntry({}, []), 70);

// Missing individual fields
var noSleep = { rhr: 65, hrv: 45, spo2: 97, steps: 8000, exercise: 30 };
assertRange('no sleep still scores', scoreForEntry(noSleep, []), 25, 100);
var noHrv = { sleep: 7, rhr: 65, spo2: 97, steps: 8000, exercise: 30 };
assertRange('no hrv still scores', scoreForEntry(noHrv, []), 25, 100);
var noActivity = { sleep: 7, hrv: 45, rhr: 65, spo2: 97 };
assertRange('no activity still scores', scoreForEntry(noActivity, []), 25, 100);

// NaN / Infinity in fields → ignored
var nanEntry = { sleep: NaN, hrv: Infinity, rhr: -Infinity, spo2: 97, steps: 8000, exercise: 30 };
assertRange('NaN/Inf fields handled', scoreForEntry(nanEntry, []), 25, 100);

// priorEntries not array → treated as empty
var s_noarr = scoreForEntry(DEMO[1], null);
assertRange('null prior ok', s_noarr, 25, 100);
assertEq('null prior same as empty', s_noarr, scoreForEntry(DEMO[1], []));

// Extra unknown fields ignored safely
var extraFields = { sleep: 7, rhr: 65, hrv: 45, spo2: 97, steps: 8000, exercise: 30, foo: 'bar', xss: '<script>' };
assertRange('extra fields safe', scoreForEntry(extraFields, []), 25, 100);

// ── Suite 5: scoreTier ────────────────────────────────────────────────────────
console.log('Suite: scoreTier');
assertEq('80 → good',  scoreTier(80),  'good');
assertEq('81 → good',  scoreTier(81),  'good');
assertEq('100 → good', scoreTier(100), 'good');
assertEq('79 → watch', scoreTier(79),  'watch');
assertEq('65 → watch', scoreTier(65),  'watch');
assertEq('64 → low',   scoreTier(64),  'low');
assertEq('0 → low',    scoreTier(0),   'low');
assertEq('25 → low',   scoreTier(25),  'low');
assertEq('NaN → watch', scoreTier(NaN), 'watch');

// ── Suite 6: buildScoreHistoryHTML — basic structure ──────────────────────────
console.log('Suite: buildScoreHistoryHTML structure');
var html7 = buildScoreHistoryHTML(DEMO);
assertContains('has hist-block',   html7, 'hist-block');
assertContains('has hist-table',   html7, 'hist-table');
assertContains('has hist-header',  html7, 'hist-header');
assertContains('has hist-label',   html7, 'hist-label');
assertContains('has READINESS HISTORY label', html7, 'READINESS HISTORY');
assertContains('has hist-date',    html7, 'hist-date');
assertContains('has hist-val',     html7, 'hist-val');
assertContains('has score-bar',    html7, 'score-bar');
assertContains('has score-fill',   html7, 'score-fill');
assertContains('has width%',       html7, 'width:');
assertContains('closes table',     html7, '</table>');
assertContains('closes div',       html7, '</div>');

// ── Suite 7: buildScoreHistoryHTML — row count ────────────────────────────────
console.log('Suite: buildScoreHistoryHTML rows');
// Count <tr> occurrences
var trCount7 = (html7.match(/<tr>/g) || []).length;
assertEq('7 history entries → 7 rows', trCount7, 7);

// 3-entry history → 3 rows
var html3 = buildScoreHistoryHTML(DEMO.slice(0, 3));
var trCount3 = (html3.match(/<tr>/g) || []).length;
assertEq('3 entries → 3 rows', trCount3, 3);

// 8-entry history → only last 7 shown
var hist8 = [{ date: '2026-06-07', sleep: 6.5, rhr: 68, hrv: 38, spo2: 97, steps: 4800, exercise: 12 }].concat(DEMO);
var html8 = buildScoreHistoryHTML(hist8);
var trCount8 = (html8.match(/<tr>/g) || []).length;
assertEq('8 entries → 7 rows', trCount8, 7);

// 1-entry history → 1 row
var html1 = buildScoreHistoryHTML([DEMO[0]]);
var trCount1 = (html1.match(/<tr>/g) || []).length;
assertEq('1 entry → 1 row', trCount1, 1);

// ── Suite 8: buildScoreHistoryHTML — tier colors ──────────────────────────────
console.log('Suite: buildScoreHistoryHTML tier colors');
// DEMO has some good/watch entries
assertTrue('html contains some color class', 
  html7.includes('hist-good') || html7.includes('hist-watch') || html7.includes('hist-low'));

// Force a 'good' entry (score ≥ 80)
var goodEntry = [{ date: '2026-06-14', sleep: 8, rhr: 55, hrv: 60, spo2: 99, steps: 12000, exercise: 50 }];
var htmlGood = buildScoreHistoryHTML(goodEntry);
assertContains('good entry → hist-good', htmlGood, 'hist-good');

// Force a 'low' entry (score < 65)
var lowEntry = [{ date: '2026-06-14', sleep: 4, rhr: 85, hrv: 20, spo2: 90, steps: 500, exercise: 0 }];
var htmlLow = buildScoreHistoryHTML(lowEntry);
assertContains('low entry → hist-low', htmlLow, 'hist-low');

// Watch entry
var watchEntry = [{ date: '2026-06-14', sleep: 6.5, rhr: 68, hrv: 38, spo2: 96, steps: 4000, exercise: 15 }];
var htmlWatch = buildScoreHistoryHTML(watchEntry);
assertTrue('watch or low tier present', htmlWatch.includes('hist-watch') || htmlWatch.includes('hist-low'));

// ── Suite 9: buildScoreHistoryHTML — empty / invalid input ────────────────────
console.log('Suite: buildScoreHistoryHTML empty/invalid');
assertEq('empty array → empty string', buildScoreHistoryHTML([]), '');
assertEq('null → empty string',        buildScoreHistoryHTML(null), '');
assertEq('undefined → empty string',   buildScoreHistoryHTML(undefined), '');
assertEq('non-array → empty string',   buildScoreHistoryHTML('string'), '');
assertEq('number → empty string',      buildScoreHistoryHTML(42), '');

// ── Suite 10: Adversarial safety ─────────────────────────────────────────────
console.log('Suite: adversarial safety');

// XSS in date field must be escaped
var xssHist = [{ date: '<script>alert(1)</script>', sleep: 7, rhr: 65, hrv: 45, spo2: 97, steps: 8000, exercise: 30 }];
var xssOut = buildScoreHistoryHTML(xssHist);
assertNotContains('XSS script tag absent', xssOut, '<script>');
assertContains('XSS date escaped', xssOut, '&lt;script&gt;');

// XSS in date with quotes
var xssHist2 = [{ date: '"><img src=x onerror=alert(1)>', sleep: 7, rhr: 65, hrv: 45, spo2: 97, steps: 8000, exercise: 30 }];
var xssOut2 = buildScoreHistoryHTML(xssHist2);
assertNotContains('XSS img tag absent', xssOut2, '<img');
assertContains('XSS quote escaped', xssOut2, '&quot;');

// All null fields → uses 70 default, still renders
var nullEntry = [{ date: '2026-06-14', sleep: null, rhr: null, hrv: null, spo2: null, steps: null, exercise: null }];
var nullOut = buildScoreHistoryHTML(nullEntry);
assertTrue('null fields → still renders', nullOut.length > 0);
assertContains('null fields → contains 70', nullOut, '>70<');

// Negative sleep → clamped to 25 floor
var negSleep = [{ date: '2026-06-14', sleep: -2, rhr: 90, hrv: 15, spo2: 88, steps: 0, exercise: 0 }];
var negOut = buildScoreHistoryHTML(negSleep);
assertTrue('negative sleep renders', negOut.length > 0);

// History entries with Infinity → treated as missing (not finite)
var infEntry = [{ date: '2026-06-14', sleep: Infinity, rhr: -Infinity, hrv: NaN, spo2: 97, steps: 8000, exercise: 30 }];
var infOut = buildScoreHistoryHTML(infEntry);
assertTrue('Infinity fields render safely', infOut.length > 0);

// Width percentage clamped 0–100
assertNotContains('no width > 100%', xssOut, 'width:101');
assertNotContains('no negative width', nullOut, 'width:-');

// ── Suite 11: Score trajectory with DEMO data ─────────────────────────────────
console.log('Suite: score trajectory');

// All DEMO scores should be valid
var allScores = DEMO.map(function(entry, i) {
  var prior = DEMO.slice(0, i);
  return scoreForEntry(entry, prior);
});
allScores.forEach(function(sc, i) {
  assertRange('DEMO[' + i + '] score in range', sc, 40, 100);
});

// Later entries (better metrics) should trend ≥ earlier on average
var early = allScores.slice(0, 3).reduce(function(s, v) { return s + v; }, 0) / 3;
var late  = allScores.slice(4, 7).reduce(function(s, v) { return s + v; }, 0) / 3;
assertTrue('later DEMO scores >= earlier on average', late >= early);

// ── Suite 12: exports structure ───────────────────────────────────────────────
console.log('Suite: exports');
var mod = require('./bala-b53-score-history');
assertEq('exports escHtml', typeof mod.escHtml, 'function');
assertEq('exports formatShortDate', typeof mod.formatShortDate, 'function');
assertEq('exports scoreForEntry', typeof mod.scoreForEntry, 'function');
assertEq('exports scoreTier', typeof mod.scoreTier, 'function');
assertEq('exports buildScoreHistoryHTML', typeof mod.buildScoreHistoryHTML, 'function');

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n=============================');
console.log('BALA-B53: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exit(1);
