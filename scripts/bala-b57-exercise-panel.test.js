'use strict';
var {
  WEEKLY_GOAL,
  _extractExercise,
  computeWeekSummary,
  buildExercisePanelHTML,
} = require('./bala-b57-exercise-panel.js');

var passed = 0, failed = 0;
function eq(a, b, label) {
  if (a === b) { passed++; }
  else { failed++; console.error('FAIL [' + label + '] got=' + JSON.stringify(a) + ' want=' + JSON.stringify(b)); }
}
function ok(v, label) {
  if (v) { passed++; }
  else { failed++; console.error('FAIL [' + label + ']'); }
}
function nok(v, label) { ok(!v, label); }

// ── helpers ──────────────────────────────────────────────────────────────────
function makeHist(count, startEx, step) {
  // count entries, exercise = startEx + i*step, dates ascending from 2026-06-01
  var hist = [];
  for (var i = 0; i < count; i++) {
    var d = new Date(Date.UTC(2026, 5, 1 + i));
    hist.push({ date: d.toISOString().slice(0, 10), exercise: startEx + i * step });
  }
  return hist;
}
function makeHistVals(vals) {
  // vals in ascending date order
  var hist = [];
  for (var i = 0; i < vals.length; i++) {
    var d = new Date(Date.UTC(2026, 5, 1 + i));
    hist.push({ date: d.toISOString().slice(0, 10), exercise: vals[i] });
  }
  return hist;
}

// ══════════════════════════════════════════════════════════════════
// Suite 1: WEEKLY_GOAL constant
// ══════════════════════════════════════════════════════════════════
console.log('Suite 1: WEEKLY_GOAL constant');
eq(typeof WEEKLY_GOAL, 'number', 'goal is number');
eq(WEEKLY_GOAL, 150, 'goal is 150');
ok(WEEKLY_GOAL > 0, 'goal positive');

// ══════════════════════════════════════════════════════════════════
// Suite 2: _extractExercise — basic slicing
// ══════════════════════════════════════════════════════════════════
console.log('Suite 2: _extractExercise');
var h7 = makeHist(7, 10, 10); // 10,20,30,40,50,60,70
eq(_extractExercise(h7, 0, 7).length, 7, 'extract all 7');
eq(_extractExercise(h7, 0, 7)[0], 10, 'first val=10');
eq(_extractExercise(h7, 0, 7)[6], 70, 'last val=70');
eq(_extractExercise(h7, 0, 3).length, 3, 'extract latest 3');
eq(_extractExercise(h7, 0, 3)[2], 70, 'latest3 last=70');
eq(_extractExercise(h7, 7, 7).length, 0, 'offset=7 on 7-entry → empty');
eq(_extractExercise([], 0, 7).length, 0, 'empty hist → []');
eq(_extractExercise(null, 0, 7).length, 0, 'null hist → []');
eq(_extractExercise(h7, 0, 7).every(function(v){ return typeof v==='number'; }), true, 'all numeric');

// ══════════════════════════════════════════════════════════════════
// Suite 3: _extractExercise — 14 entries (two weeks)
// ══════════════════════════════════════════════════════════════════
console.log('Suite 3: _extractExercise two-week');
var h14 = makeHist(14, 5, 5); // 5,10,15,...,70
var tw = _extractExercise(h14, 0, 7);
var lw = _extractExercise(h14, 7, 7);
eq(tw.length, 7, '14-entry thisWeek len=7');
eq(lw.length, 7, '14-entry lastWeek len=7');
eq(tw[6], 70, 'thisWeek last=70 (latest)');
eq(lw[0], 5, 'lastWeek first=5 (oldest)');
eq(lw[6], 35, 'lastWeek last=35');
eq(tw[0], 40, 'thisWeek first=40');
eq(_extractExercise(h14, 14, 7).length, 0, 'offset=14 on 14-entry → empty');

// ══════════════════════════════════════════════════════════════════
// Suite 4: _extractExercise — invalid exercise values
// ══════════════════════════════════════════════════════════════════
console.log('Suite 4: _extractExercise invalid values');
var hInv = [
  { date: '2026-06-01', exercise: -5 },
  { date: '2026-06-02', exercise: NaN },
  { date: '2026-06-03', exercise: null },
  { date: '2026-06-04', exercise: 'abc' },
  { date: '2026-06-05', exercise: 30 },
  { date: '2026-06-06', exercise: undefined },
  { date: '2026-06-07', exercise: Infinity },
];
var exVals = _extractExercise(hInv, 0, 7);
eq(exVals.length, 7, 'still returns 7 values');
eq(exVals[0], 0, 'negative → 0');
eq(exVals[1], 0, 'NaN → 0');
eq(exVals[2], 0, 'null → 0');
eq(exVals[3], 0, 'string → 0');
eq(exVals[4], 30, 'valid=30 preserved');
eq(exVals[5], 0, 'undefined → 0');
eq(exVals[6], 0, 'Infinity → 0');
eq(exVals.filter(function(v){return v===0;}).length, 6, '6 zeros for invalid');

// ══════════════════════════════════════════════════════════════════
// Suite 5: computeWeekSummary — empty / null guards
// ══════════════════════════════════════════════════════════════════
console.log('Suite 5: computeWeekSummary empty guards');
var emptyS = computeWeekSummary([]);
eq(emptyS.hasData, false, 'empty → hasData false');
eq(emptyS.total, 0, 'empty → total 0');
eq(emptyS.activeDays, 0, 'empty → activeDays 0');
eq(emptyS.deltAvg, null, 'empty → deltAvg null');
var nullS = computeWeekSummary(null);
eq(nullS.hasData, false, 'null → hasData false');
eq(computeWeekSummary(undefined).total, 0, 'undefined → total 0');

// ══════════════════════════════════════════════════════════════════
// Suite 6: computeWeekSummary — all-zero days
// ══════════════════════════════════════════════════════════════════
console.log('Suite 6: computeWeekSummary all-zero');
var hZero = makeHist(7, 0, 0);
var zeroS = computeWeekSummary(hZero);
eq(zeroS.hasData, false, 'all-zero → hasData false');
eq(zeroS.activeDays, 0, 'all-zero → activeDays 0');
eq(zeroS.total, 0, 'all-zero → total 0');
eq(zeroS.goalPct, 0, 'all-zero → goalPct 0');
eq(zeroS.goalMet, false, 'all-zero → goalMet false');

// ══════════════════════════════════════════════════════════════════
// Suite 7: computeWeekSummary — totals / active days / dots
// ══════════════════════════════════════════════════════════════════
console.log('Suite 7: computeWeekSummary totals');
// [0,20,0,30,0,40,50] → active=4, total=140
var hMix = makeHistVals([0, 20, 0, 30, 0, 40, 50]);
var mxS = computeWeekSummary(hMix);
eq(mxS.total, 140, 'mix total=140');
eq(mxS.activeDays, 4, 'mix activeDays=4');
eq(mxS.totalDays, 7, 'mix totalDays=7');
eq(mxS.dots.length, 7, 'dots length=7');
eq(mxS.dots.charAt(0), '○', 'dot[0] ○ (0 min)');
eq(mxS.dots.charAt(1), '●', 'dot[1] ● (20 min)');
eq(mxS.hasData, true, 'mix hasData true');

// ══════════════════════════════════════════════════════════════════
// Suite 8: computeWeekSummary — goalTier / goalPct
// ══════════════════════════════════════════════════════════════════
console.log('Suite 8: computeWeekSummary goalTier');
// low: total < 100 (< 150*0.67 ≈ 100)
var hLow = makeHistVals([10, 10, 10, 10, 0, 0, 0]); // total=40
var lowS = computeWeekSummary(hLow);
eq(lowS.goalTier, 'low', 'low tier (40 min)');
eq(lowS.goalMet, false, 'low → goalMet false');
ok(lowS.goalPct < 30, 'low goalPct < 30%');

// close: 100 ≤ total < 150
var hClose = makeHistVals([20, 20, 20, 20, 20, 5, 0]); // total=105
var closeS = computeWeekSummary(hClose);
eq(closeS.goalTier, 'close', 'close tier (105 min)');
eq(closeS.goalMet, false, 'close → goalMet false');

// met: total >= 150
var hMet = makeHistVals([25, 25, 25, 25, 25, 25, 0]); // total=150
var metS = computeWeekSummary(hMet);
eq(metS.goalTier, 'met', 'met tier (150 min)');
eq(metS.goalMet, true, 'met → goalMet true');
eq(metS.goalPct, 100, 'met → goalPct 100');

// over: total > 150, clamp to 100%
var hOver = makeHistVals([30, 30, 30, 30, 30, 30, 30]); // total=210
var overS = computeWeekSummary(hOver);
eq(overS.goalPct, 100, 'over → goalPct capped 100');
eq(overS.goalTier, 'met', 'over → goalTier met');

// ══════════════════════════════════════════════════════════════════
// Suite 9: computeWeekSummary — deltAvg (14-entry)
// ══════════════════════════════════════════════════════════════════
console.log('Suite 9: computeWeekSummary deltAvg');
// lastWeek=[10,10,10,10,10,10,10]=70, avg=10
// thisWeek=[20,20,20,20,20,20,20]=140, avg=20
// deltAvg = 20-10 = +10
var hDelta = makeHistVals([10, 10, 10, 10, 10, 10, 10, 20, 20, 20, 20, 20, 20, 20]);
var dS = computeWeekSummary(hDelta);
eq(dS.deltAvg, 10, 'deltAvg +10 when thisWeek avg > lastWeek avg');

// negative delta
var hNegDelta = makeHistVals([30, 30, 30, 30, 30, 30, 30, 10, 10, 10, 10, 10, 10, 10]);
var ndS = computeWeekSummary(hNegDelta);
eq(ndS.deltAvg, -20, 'deltAvg -20 when this < last');

// zero delta
var hFlatDelta = makeHistVals([15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15]);
var fdS = computeWeekSummary(hFlatDelta);
eq(fdS.deltAvg, 0, 'deltAvg 0 when same');

// only 7 entries → deltAvg null
var h7only = makeHist(7, 20, 5);
var onlyS = computeWeekSummary(h7only);
eq(onlyS.deltAvg, null, 'deltAvg null when no previous week');

// ══════════════════════════════════════════════════════════════════
// Suite 10: buildExercisePanelHTML — empty guards
// ══════════════════════════════════════════════════════════════════
console.log('Suite 10: buildExercisePanelHTML empty guards');
eq(buildExercisePanelHTML([]), '', 'empty hist → empty string');
eq(buildExercisePanelHTML(null), '', 'null hist → empty string');
eq(buildExercisePanelHTML(undefined), '', 'undefined → empty string');
eq(buildExercisePanelHTML(makeHist(7, 0, 0)), '', 'all-zero hist → empty string');

// ══════════════════════════════════════════════════════════════════
// Suite 11: buildExercisePanelHTML — structure
// ══════════════════════════════════════════════════════════════════
console.log('Suite 11: buildExercisePanelHTML structure');
var hGood = makeHistVals([30, 25, 20, 30, 20, 15, 20]); // total=160
var html = buildExercisePanelHTML(hGood);
ok(html.length > 0, 'returns non-empty HTML');
ok(html.includes('<div class="ex-panel">'), 'has ex-panel wrapper');
ok(html.includes('ex-panel-title'), 'has panel title');
ok(html.includes('ex-goal-label'), 'has goal label');
ok(html.includes('ex-goal-bar'), 'has goal bar');
ok(html.includes('ex-goal-fill'), 'has goal fill');
ok(html.includes('role="progressbar"'), 'progress bar aria role');
ok(html.includes('aria-valuenow'), 'aria-valuenow present');
ok(html.includes('ex-goal-status'), 'has goal status div');
ok(html.includes('ex-active-row'), 'has active days row');
ok(html.includes('ex-dots'), 'has dots span');
ok(html.includes('ex-note'), 'has disclaimer note');

// ══════════════════════════════════════════════════════════════════
// Suite 12: buildExercisePanelHTML — content values
// ══════════════════════════════════════════════════════════════════
console.log('Suite 12: buildExercisePanelHTML content');
var hContent = makeHistVals([30, 25, 20, 30, 20, 15, 20]); // total=160, goal met
var hc = buildExercisePanelHTML(hContent);
ok(hc.includes('160'), 'total minutes in output');
ok(hc.includes('150'), 'goal 150 shown');
ok(hc.includes('7-DAY EXERCISE SUMMARY'), 'section heading present');
ok(hc.includes('ex-goal-met'), 'goal-met class when total>=150');
ok(hc.includes('Goal met'), 'goal met text');
ok(hc.includes('of 7'), 'active days of 7 shown');
ok(hc.includes('healthcare provider'), 'disclaimer mentions healthcare provider');
ok(!hc.includes('ex-vs-last'), 'no delta row when only 7 entries');

// close tier
var hcClose = makeHistVals([15, 15, 15, 15, 15, 15, 10]); // total=100
var closeHtml = buildExercisePanelHTML(hcClose);
ok(closeHtml.includes('ex-goal-close'), 'close class for 100 min');
nok(closeHtml.includes('Goal met'), 'no Goal met text at 100');

// low tier
var hcLow = makeHistVals([5, 5, 5, 5, 0, 0, 0]); // total=20
var lowHtml = buildExercisePanelHTML(hcLow);
ok(lowHtml.includes('ex-goal-low'), 'low class for 20 min');

// ══════════════════════════════════════════════════════════════════
// Suite 13: buildExercisePanelHTML — delta row
// ══════════════════════════════════════════════════════════════════
console.log('Suite 13: buildExercisePanelHTML delta row');
// 14 entries: last7 avg=10, this7 avg=20 → delta=+10
var hDelt14 = makeHistVals([10, 10, 10, 10, 10, 10, 10, 20, 20, 20, 20, 20, 20, 20]);
var dHtml = buildExercisePanelHTML(hDelt14);
ok(dHtml.includes('ex-vs-last'), 'delta row shown for 14 entries');
ok(dHtml.includes('+10'), '+10 shown in delta');
ok(dHtml.includes('ex-delta-up'), 'ex-delta-up class for positive delta');
ok(dHtml.includes('↑'), 'up arrow for positive delta');

var hNegDelt14 = makeHistVals([30, 30, 30, 30, 30, 30, 30, 10, 10, 10, 10, 10, 10, 10]);
var ndHtml = buildExercisePanelHTML(hNegDelt14);
ok(ndHtml.includes('ex-delta-down'), 'ex-delta-down for negative delta');
ok(ndHtml.includes('↓'), 'down arrow for negative');
ok(ndHtml.includes('-20'), '-20 shown');

// flat delta
var hFlatDelt = makeHistVals([15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15]);
var fHtml = buildExercisePanelHTML(hFlatDelt);
ok(fHtml.includes('ex-delta-flat'), 'flat class for zero delta');
ok(fHtml.includes('→'), 'right arrow for flat delta');

// ══════════════════════════════════════════════════════════════════
// Suite 14: buildExercisePanelHTML — XSS safety
// ══════════════════════════════════════════════════════════════════
console.log('Suite 14: buildExercisePanelHTML XSS safety');
// Inject XSS into a date field
var hXss = [
  { date: '<script>alert(1)</script>', exercise: 40 },
  { date: '2026-06-02', exercise: 30 },
  { date: '2026-06-03', exercise: 20 },
  { date: '2026-06-04', exercise: 30 },
  { date: '2026-06-05', exercise: 10 },
  { date: '2026-06-06', exercise: 20 },
  { date: '2026-06-07', exercise: 10 },
];
var xssHtml = buildExercisePanelHTML(hXss);
nok(xssHtml.includes('<script>'), 'no raw script tag in output');
ok(xssHtml.length > 0, 'XSS hist still produces output');

// Large number in exercise should not cause issues
var hBig = makeHistVals([9999, 0, 0, 0, 0, 0, 0]);
var bigHtml = buildExercisePanelHTML(hBig);
ok(bigHtml.includes('9999'), '9999 shown as-is');

// ══════════════════════════════════════════════════════════════════
// Suite 15: exports
// ══════════════════════════════════════════════════════════════════
console.log('Suite 15: exports');
var mod = require('./bala-b57-exercise-panel.js');
ok(typeof mod.WEEKLY_GOAL === 'number', 'WEEKLY_GOAL exported');
ok(typeof mod._extractExercise === 'function', '_extractExercise exported');
ok(typeof mod.computeWeekSummary === 'function', 'computeWeekSummary exported');
ok(typeof mod.buildExercisePanelHTML === 'function', 'buildExercisePanelHTML exported');
eq(Object.keys(mod).length, 4, 'exactly 4 exports');
ok(mod.WEEKLY_GOAL === 150, 'exported WEEKLY_GOAL === 150');

console.log('\n=== B57 Exercise Panel: ' + passed + '/' + (passed+failed) + ' passed ===');
if (failed > 0) process.exit(1);
