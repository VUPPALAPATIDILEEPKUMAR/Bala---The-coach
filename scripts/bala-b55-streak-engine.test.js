'use strict';
var e = require('./bala-b55-streak-engine');
var MILESTONES = e.MILESTONES;
var computeStreak = e.computeStreak;
var buildStreakCardHTML = e.buildStreakCardHTML;
var _setTestToday = e._setTestToday;
var _daysBetween = e._daysBetween;
var _offsetDay = e._offsetDay;
var _uniqueSortedDesc = e._uniqueSortedDesc;
var _computeCurrentStreak = e._computeCurrentStreak;
var _computeBestStreak = e._computeBestStreak;

var passed = 0; var failed = 0;
function assert(cond, msg) { if (cond) { passed++; } else { failed++; console.error('FAIL: ' + msg); } }
function eq(a, b, msg) { assert(a === b, msg + ' — got ' + JSON.stringify(a) + ' expected ' + JSON.stringify(b)); }

// Helper: build history array with consecutive dates ending at a given date
function makeHist(endDate, count, spacing) {
  spacing = spacing || 1;
  var out = [];
  var dt = new Date(endDate + 'T00:00:00Z');
  for (var i = 0; i < count; i++) {
    out.unshift({ date: dt.toISOString().slice(0, 10), sleep: 7, rhr: 58, hrv: 50, steps: 8000, exercise: 30, spo2: 97 });
    dt.setUTCDate(dt.getUTCDate() - spacing);
  }
  return out;
}

// ── Suite 1: _daysBetween ────────────────────────────────────────────────────
console.log('\n_daysBetween');
eq(_daysBetween('2026-06-21', '2026-06-22'), 1, 'consecutive days = 1');
eq(_daysBetween('2026-06-22', '2026-06-22'), 0, 'same day = 0');
eq(_daysBetween('2026-06-15', '2026-06-22'), 7, '7-day span');
eq(_daysBetween('2026-06-22', '2026-06-21'), -1, 'reversed = negative');
eq(_daysBetween('2026-01-31', '2026-02-01'), 1, 'month boundary');
eq(_daysBetween('2025-12-31', '2026-01-01'), 1, 'year boundary');
assert(isNaN(_daysBetween('not-a-date', '2026-06-22')), 'invalid d1 → NaN');
assert(isNaN(_daysBetween('2026-06-22', 'bad')), 'invalid d2 → NaN');
assert(isNaN(_daysBetween(null, '2026-06-22')), 'null d1 → NaN');
// 9 tests

// ── Suite 2: _offsetDay ──────────────────────────────────────────────────────
console.log('\n_offsetDay');
eq(_offsetDay('2026-06-22', 0), '2026-06-22', '+0 same day');
eq(_offsetDay('2026-06-22', 1), '2026-06-23', '+1 next day');
eq(_offsetDay('2026-06-22', -1), '2026-06-21', '-1 yesterday');
eq(_offsetDay('2026-06-30', 1), '2026-07-01', 'month boundary +1');
eq(_offsetDay('2026-01-01', -1), '2025-12-31', 'year boundary -1');
eq(_offsetDay('bad-date', 1), '', 'invalid date returns empty');
// 6 tests

// ── Suite 3: _uniqueSortedDesc ───────────────────────────────────────────────
console.log('\n_uniqueSortedDesc');
var ud1 = _uniqueSortedDesc([{date:'2026-06-21'},{date:'2026-06-20'},{date:'2026-06-22'}]);
eq(ud1[0], '2026-06-22', 'sorted desc: newest first');
eq(ud1[2], '2026-06-20', 'sorted desc: oldest last');
eq(ud1.length, 3, 'correct count');
var ud2 = _uniqueSortedDesc([{date:'2026-06-21'},{date:'2026-06-21'},{date:'2026-06-20'}]);
eq(ud2.length, 2, 'deduplicates repeated dates');
eq(_uniqueSortedDesc([]).length, 0, 'empty array → empty');
eq(_uniqueSortedDesc(null).length, 0, 'null → empty');
var ud3 = _uniqueSortedDesc([{date:'bad'},{date:'2026-06-22'},{sleep:7}]);
eq(ud3.length, 1, 'filters invalid/missing dates');
eq(ud3[0], '2026-06-22', 'valid date kept');
// 8 tests

// ── Suite 4: _computeCurrentStreak ──────────────────────────────────────────
console.log('\n_computeCurrentStreak');
eq(_computeCurrentStreak([], '2026-06-22'), 0, 'empty → 0');
eq(_computeCurrentStreak(['2026-06-22'], '2026-06-22'), 1, 'just today → 1');
eq(_computeCurrentStreak(['2026-06-21'], '2026-06-22'), 1, 'yesterday only → 1');
eq(_computeCurrentStreak(['2026-06-20'], '2026-06-22'), 0, '2 days ago → 0 (broken)');
// 7-day streak ending today
var s7t = ['2026-06-22','2026-06-21','2026-06-20','2026-06-19','2026-06-18','2026-06-17','2026-06-16'];
eq(_computeCurrentStreak(s7t, '2026-06-22'), 7, '7-day streak ending today');
// 7-day streak ending yesterday
var s7y = ['2026-06-21','2026-06-20','2026-06-19','2026-06-18','2026-06-17','2026-06-16','2026-06-15'];
eq(_computeCurrentStreak(s7y, '2026-06-22'), 7, '7-day streak ending yesterday (still active)');
// gap breaks streak
var sgap = ['2026-06-22','2026-06-21','2026-06-19','2026-06-18'];
eq(_computeCurrentStreak(sgap, '2026-06-22'), 2, 'gap after 2 days breaks streak');
// single entry far in past
eq(_computeCurrentStreak(['2026-01-01'], '2026-06-22'), 0, 'old entry → 0');
// longer streak with gap inside
var smix = ['2026-06-22','2026-06-21','2026-06-20','2026-06-18','2026-06-17'];
eq(_computeCurrentStreak(smix, '2026-06-22'), 3, 'streak ends at gap: 3');
// invalid today
eq(_computeCurrentStreak(['2026-06-22'], null), 0, 'null today → 0');
// 10 tests

// ── Suite 5: _computeBestStreak ──────────────────────────────────────────────
console.log('\n_computeBestStreak');
eq(_computeBestStreak([]), 0, 'empty → 0');
eq(_computeBestStreak(['2026-06-22']), 1, 'single day → 1');
var bcs7 = ['2026-06-22','2026-06-21','2026-06-20','2026-06-19','2026-06-18','2026-06-17','2026-06-16'];
eq(_computeBestStreak(bcs7), 7, '7 consecutive → 7');
// Two runs: 3 + 4
var bctwo = ['2026-06-22','2026-06-21','2026-06-20','2026-06-19','2026-06-16','2026-06-15','2026-06-12','2026-06-11'];
eq(_computeBestStreak(bctwo), 4, 'two runs — best is 4');
// Non-consecutive all
var bcnon = ['2026-06-22','2026-06-20','2026-06-18','2026-06-16'];
eq(_computeBestStreak(bcnon), 1, 'no consecutive days → best=1');
// 5 consecutive in longer list
var bclong = ['2026-06-22','2026-06-18','2026-06-17','2026-06-16','2026-06-15','2026-06-14','2026-06-10'];
eq(_computeBestStreak(bclong), 5, 'best 5-day run inside longer list');
// 8 tests (padding to 8)
eq(_computeBestStreak(['2026-06-22','2026-06-21']), 2, '2-day run → 2');
eq(_computeBestStreak(['2026-06-22','2026-06-20']), 1, 'gap of 2 → best 1');
// 8 tests

// ── Suite 6: computeStreak ───────────────────────────────────────────────────
console.log('\ncomputeStreak');
_setTestToday('2026-06-22');
// Empty
var cs0 = computeStreak([]);
eq(cs0.current, 0, 'empty: current=0'); eq(cs0.best, 0, 'empty: best=0'); eq(cs0.todayLogged, false, 'empty: todayLogged=false');
// Null
var csn = computeStreak(null);
eq(csn.current, 0, 'null: current=0');
// 7-day streak ending yesterday (demo scenario)
var hist7 = makeHist('2026-06-21', 7);
var cs7 = computeStreak(hist7);
eq(cs7.current, 7, '7-day: current=7');
eq(cs7.best, 7, '7-day: best=7');
eq(cs7.todayLogged, false, '7-day ending yesterday: todayLogged=false');
// Today logged
var histT = makeHist('2026-06-22', 5);
var csT = computeStreak(histT);
eq(csT.current, 5, 'today logged: current=5');
eq(csT.todayLogged, true, 'today logged: todayLogged=true');
// Broken streak
var histB = [
  {date:'2026-06-22', sleep:7},{date:'2026-06-21', sleep:7},
  {date:'2026-06-18', sleep:7},{date:'2026-06-17', sleep:7}
];
var csB = computeStreak(histB);
eq(csB.current, 2, 'broken: current=2 (today+yesterday)');
eq(csB.best, 2, 'broken: best=2 (two runs of 2 each)');
// 12 tests

// ── Suite 7: earnedMilestones and nextMilestone ──────────────────────────────
console.log('\nearnedMilestones');
_setTestToday('2026-06-22');
// 2-day streak: no milestones
var hist2 = makeHist('2026-06-22', 2);
var cs2 = computeStreak(hist2);
eq(cs2.earnedMilestones.length, 0, '2-day: no milestones');
eq(cs2.nextMilestone && cs2.nextMilestone.days, 3, '2-day: next=3-Day');
// 3-day streak: 3d earned
var hist3 = makeHist('2026-06-22', 3);
var cs3 = computeStreak(hist3);
eq(cs3.earnedMilestones.length, 1, '3-day: 1 milestone');
eq(cs3.earnedMilestones[0].days, 3, '3-day: first earned is 3d');
eq(cs3.nextMilestone && cs3.nextMilestone.days, 7, '3-day: next=7-Day');
// 7-day streak: 3d and 7d earned
var hist77 = makeHist('2026-06-22', 7);
var cs77 = computeStreak(hist77);
eq(cs77.earnedMilestones.length, 2, '7-day: 2 milestones');
eq(cs77.nextMilestone && cs77.nextMilestone.days, 14, '7-day: next=14-Day');
// 30-day: all milestones
var hist30 = makeHist('2026-06-22', 30);
var cs30 = computeStreak(hist30);
eq(cs30.earnedMilestones.length, 4, '30-day: all 4 milestones');
eq(cs30.nextMilestone, null, '30-day: no next milestone');
// 10 tests

// ── Suite 8: buildStreakCardHTML structure ───────────────────────────────────
console.log('\nbuildStreakCardHTML structure');
_setTestToday('2026-06-22');
var html7 = buildStreakCardHTML(makeHist('2026-06-21', 7)); // 7-day, ending yesterday
assert(html7.includes('streak-card'), 'has streak-card class');
assert(html7.includes('CHECK-IN STREAK'), 'has title');
assert(html7.includes('role="region"'), 'has ARIA role');
assert(html7.includes('aria-label="Check-in streak"'), 'has ARIA label');
assert(html7.includes('🔥'), 'has flame emoji');
assert(html7.includes('streak-count'), 'has streak-count');
assert(html7.includes('streak-badges'), 'has streak-badges');
assert(html7.includes('streak-note'), 'has streak-note');
assert(html7.includes('streak-best'), 'has streak-best');
assert(html7.includes('streak-today'), 'has streak-today status');
assert(html7.includes('streak-next'), 'has streak-next');
// zero streak → empty string
var html0 = buildStreakCardHTML([]);
eq(html0, '', 'empty history → empty string');
// 12 tests

// ── Suite 9: buildStreakCardHTML content ─────────────────────────────────────
console.log('\nbuildStreakCardHTML content');
_setTestToday('2026-06-22');
// 7-day streak: shows "7", today not logged
assert(html7.includes('>7<'), 'shows count 7');
assert(html7.includes('days'), 'plural "days"');
assert(html7.includes('Best:'), 'shows best');
assert(html7.includes('Log today to continue'), 'today not logged msg');
assert(!html7.includes('Logged today ✓'), 'does NOT show logged-today when not logged');
// 7d badge earned
assert(html7.includes('streak-badge-earned'), 'has earned badge');
assert(html7.includes('7d ✓'), '7d badge shown as earned');
// 3d badge earned too
assert(html7.includes('3d ✓'), '3d badge earned');
// 14d NOT earned
assert(html7.includes('>14d<'), '14d badge shown but not earned');
// Today logged scenario
var htmlTL = buildStreakCardHTML(makeHist('2026-06-22', 5));
assert(htmlTL.includes('Logged today ✓'), 'shows logged-today when today logged');
// 10 tests

// ── Suite 10: single-day and edge counts ─────────────────────────────────────
console.log('\nsingle-day / edge');
_setTestToday('2026-06-22');
var html1 = buildStreakCardHTML([{date:'2026-06-22',sleep:7,rhr:58,hrv:50,steps:8000,exercise:30,spo2:97}]);
assert(html1.includes('>1<'), '1-day: count 1');
assert(html1.includes('>day<'), '1-day: singular "day"');
// broken streak (date 3 days ago)
var hOld = [{date:'2026-06-19',sleep:7,rhr:58,hrv:50,steps:8000,exercise:30,spo2:97}];
eq(buildStreakCardHTML(hOld), '', 'old entry returns empty');
// null entries in array
var hNull = [{date:'2026-06-22',sleep:7,rhr:58,hrv:50,steps:8000,exercise:30,spo2:97}, null, undefined, {}];
assert(buildStreakCardHTML(hNull).includes('>1<'), 'null entries filtered, streak=1');
// 5 tests

// ── Suite 11: adversarial / XSS safety ──────────────────────────────────────
console.log('\nadversarial');
_setTestToday('2026-06-22');
// XSS attempt in date field
var hXss = [{date:'<script>alert(1)</script>',sleep:7,rhr:58,hrv:50}];
eq(buildStreakCardHTML(hXss), '', 'XSS date string filtered out (invalid format)');
// NaN/Infinity numeric fields don't crash
var hNum = [{date:'2026-06-22',sleep:NaN,rhr:Infinity,hrv:-Infinity}];
assert(typeof buildStreakCardHTML(hNum) === 'string', 'NaN/Infinity fields: no crash');
// All-null history items
eq(buildStreakCardHTML([null,null,null]), '', 'all-null items → empty');
// computeStreak with undefined
var csu = computeStreak(undefined);
eq(csu.current, 0, 'undefined → current=0');
// computeStreak with non-array
var cso = computeStreak({date:'2026-06-22'});
eq(cso.current, 0, 'object (non-array) → current=0');
// Duplicate dates don't inflate streak
var hDup = [{date:'2026-06-22',sleep:7},{date:'2026-06-22',sleep:7},{date:'2026-06-21',sleep:7}];
var csDup = computeStreak(hDup);
eq(csDup.current, 2, 'duplicate dates deduplicated, streak=2');
// Very large history doesn't crash
var hLarge = makeHist('2026-06-22', 100);
assert(typeof buildStreakCardHTML(hLarge) === 'string', '100-entry history: no crash');
// 7 tests

// ── Suite 12: MILESTONES config ──────────────────────────────────────────────
console.log('\nMILESTONES config');
assert(Array.isArray(MILESTONES), 'MILESTONES is array');
eq(MILESTONES.length, 4, 'exactly 4 milestones');
eq(MILESTONES[0].days, 3, 'first milestone: 3 days');
eq(MILESTONES[1].days, 7, 'second milestone: 7 days');
eq(MILESTONES[2].days, 14, 'third milestone: 14 days');
eq(MILESTONES[3].days, 30, 'fourth milestone: 30 days');
assert(MILESTONES.every(function(m){ return typeof m.label === 'string' && m.label.length > 0; }), 'all have label strings');
assert(MILESTONES.every(function(m){ return typeof m.badge === 'string'; }), 'all have badge strings');
// days ascending
var days = MILESTONES.map(function(m){ return m.days; });
assert(days[0] < days[1] && days[1] < days[2] && days[2] < days[3], 'days strictly ascending');
// 9 tests

// ── Suite 13: exports ────────────────────────────────────────────────────────
console.log('\nexports');
eq(typeof computeStreak, 'function', 'computeStreak exported');
eq(typeof buildStreakCardHTML, 'function', 'buildStreakCardHTML exported');
eq(typeof _setTestToday, 'function', '_setTestToday exported');
eq(typeof _daysBetween, 'function', '_daysBetween exported');
eq(typeof _computeCurrentStreak, 'function', '_computeCurrentStreak exported');
eq(typeof _computeBestStreak, 'function', '_computeBestStreak exported');
// 6 tests

// ── Reset test today ────────────────────────────────────────────────────────
_setTestToday(null);

// ── Results ──────────────────────────────────────────────────────────────────
console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
if (failed > 0) process.exit(1);
