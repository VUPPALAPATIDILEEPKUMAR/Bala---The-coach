// scripts/bala-b75-hydration.test.js — B75 Hydration Tracker tests
'use strict';

const path = require('path');
const {
  logWater, resetDay, setGoal, getTodayProgress,
  getWeeklyAvg, getNudgeText, getStreak, loadLog,
  HYDRATION_KEY, DEFAULT_GOAL, ML_PER_GLASS, MAX_GLASSES_DAY
} = require(path.join(__dirname, 'bala-b75-hydration-engine.js'));

// Fake localStorage factory
function fakeStorage(initial) {
  var store = {};
  if (initial) store[HYDRATION_KEY] = JSON.stringify(initial);
  return {
    getItem: function (k) { return store[k] !== undefined ? store[k] : null; },
    setItem: function (k, v) { store[k] = v; },
    removeItem: function (k) { delete store[k]; }
  };
}

function todayISO() {
  var d = new Date(), p = function(x){ return String(x).padStart(2,'0'); };
  return d.getFullYear() + '-' + p(d.getMonth()+1) + '-' + p(d.getDate());
}

function dayOffset(n) {
  var d = new Date(); d.setDate(d.getDate() + n);
  var p = function(x){ return String(x).padStart(2,'0'); };
  return d.getFullYear() + '-' + p(d.getMonth()+1) + '-' + p(d.getDate());
}

// ── Constants ─────────────────────────────────────────────────────────
describe('Constants', function () {
  test('HYDRATION_KEY is a non-empty string', function () {
    expect(typeof HYDRATION_KEY).toBe('string');
    expect(HYDRATION_KEY.length).toBeGreaterThan(0);
  });
  test('DEFAULT_GOAL is 8', function () {
    expect(DEFAULT_GOAL).toBe(8);
  });
  test('ML_PER_GLASS is 250', function () {
    expect(ML_PER_GLASS).toBe(250);
  });
  test('MAX_GLASSES_DAY is 30', function () {
    expect(MAX_GLASSES_DAY).toBe(30);
  });
});

// ── loadLog ───────────────────────────────────────────────────────────
describe('loadLog', function () {
  test('returns defaults when storage is empty', function () {
    var s = fakeStorage();
    var data = loadLog(s);
    expect(data.goal).toBe(DEFAULT_GOAL);
    expect(data.log).toEqual([]);
  });
  test('returns stored data when valid', function () {
    var s = fakeStorage({ goal: 10, log: [{ date: '2026-01-01', glasses: 5 }] });
    var data = loadLog(s);
    expect(data.goal).toBe(10);
    expect(data.log).toHaveLength(1);
  });
  test('handles corrupt JSON gracefully', function () {
    var store = { getItem: function() { return '{bad json'; }, setItem: function(){} };
    var data = loadLog(store);
    expect(data.goal).toBe(DEFAULT_GOAL);
    expect(data.log).toEqual([]);
  });
  test('handles null storage gracefully', function () {
    var data = loadLog(null);
    expect(data.goal).toBe(DEFAULT_GOAL);
    expect(data.log).toEqual([]);
  });
  test('replaces missing goal with DEFAULT_GOAL', function () {
    var s = fakeStorage({ log: [] });
    var data = loadLog(s);
    expect(data.goal).toBe(DEFAULT_GOAL);
  });
  test('replaces non-array log with empty array', function () {
    var s = fakeStorage({ goal: 8, log: null });
    var data = loadLog(s);
    expect(data.log).toEqual([]);
  });
});

// ── setGoal ───────────────────────────────────────────────────────────
describe('setGoal', function () {
  test('sets a valid goal', function () {
    var s = fakeStorage();
    var r = setGoal(10, s);
    expect(r.ok).toBe(true);
    expect(r.goal).toBe(10);
    expect(loadLog(s).goal).toBe(10);
  });
  test('accepts goal of 1', function () {
    var s = fakeStorage();
    expect(setGoal(1, s).ok).toBe(true);
  });
  test('accepts goal of MAX_GLASSES_DAY', function () {
    var s = fakeStorage();
    expect(setGoal(MAX_GLASSES_DAY, s).ok).toBe(true);
  });
  test('rejects goal of 0', function () {
    var s = fakeStorage();
    expect(setGoal(0, s).ok).toBe(false);
  });
  test('rejects goal greater than MAX_GLASSES_DAY', function () {
    var s = fakeStorage();
    expect(setGoal(MAX_GLASSES_DAY + 1, s).ok).toBe(false);
  });
  test('rejects non-numeric goal', function () {
    var s = fakeStorage();
    expect(setGoal('abc', s).ok).toBe(false);
  });
  test('preserves existing log when changing goal', function () {
    var s = fakeStorage({ goal: 8, log: [{ date: '2026-01-01', glasses: 3 }] });
    setGoal(12, s);
    expect(loadLog(s).log).toHaveLength(1);
    expect(loadLog(s).goal).toBe(12);
  });
});

// ── logWater ──────────────────────────────────────────────────────────
describe('logWater', function () {
  test('logs first glass of day', function () {
    var s = fakeStorage();
    var r = logWater(1, '2026-06-01', s);
    expect(r.ok).toBe(true);
    expect(r.glasses).toBe(1);
  });
  test('accumulates multiple logs for same day', function () {
    var s = fakeStorage();
    logWater(2, '2026-06-01', s);
    var r = logWater(3, '2026-06-01', s);
    expect(r.glasses).toBe(5);
  });
  test('fractional glasses are accepted', function () {
    var s = fakeStorage();
    var r = logWater(0.5, '2026-06-01', s);
    expect(r.ok).toBe(true);
    expect(r.glasses).toBe(0.5);
  });
  test('rejects 0 glasses', function () {
    var s = fakeStorage();
    expect(logWater(0, '2026-06-01', s).ok).toBe(false);
  });
  test('rejects negative glasses', function () {
    var s = fakeStorage();
    expect(logWater(-1, '2026-06-01', s).ok).toBe(false);
  });
  test('rejects NaN', function () {
    var s = fakeStorage();
    expect(logWater('abc', '2026-06-01', s).ok).toBe(false);
  });
  test('caps at MAX_GLASSES_DAY', function () {
    var s = fakeStorage();
    logWater(MAX_GLASSES_DAY, '2026-06-01', s);
    var r = logWater(5, '2026-06-01', s);
    expect(r.glasses).toBe(MAX_GLASSES_DAY);
  });
  test('logs to different dates independently', function () {
    var s = fakeStorage();
    logWater(3, '2026-06-01', s);
    logWater(5, '2026-06-02', s);
    var data = loadLog(s);
    expect(data.log).toHaveLength(2);
    expect(data.log.find(function(e){return e.date==='2026-06-01';}).glasses).toBe(3);
    expect(data.log.find(function(e){return e.date==='2026-06-02';}).glasses).toBe(5);
  });
  test('log is sorted ascending by date', function () {
    var s = fakeStorage();
    logWater(2, '2026-06-03', s);
    logWater(3, '2026-06-01', s);
    logWater(1, '2026-06-02', s);
    var data = loadLog(s);
    expect(data.log[0].date).toBe('2026-06-01');
    expect(data.log[1].date).toBe('2026-06-02');
    expect(data.log[2].date).toBe('2026-06-03');
  });
  test('returns goal in response', function () {
    var s = fakeStorage({ goal: 10, log: [] });
    var r = logWater(2, '2026-06-01', s);
    expect(r.goal).toBe(10);
  });
  test('defaults date to today when not provided', function () {
    var s = fakeStorage();
    logWater(3, undefined, s);
    var data = loadLog(s);
    expect(data.log.some(function(e){return e.date===todayISO();})).toBe(true);
  });
});

// ── resetDay ──────────────────────────────────────────────────────────
describe('resetDay', function () {
  test('removes entry for specified date', function () {
    var s = fakeStorage();
    logWater(5, '2026-06-01', s);
    resetDay('2026-06-01', s);
    expect(loadLog(s).log).toHaveLength(0);
  });
  test('does not remove other dates', function () {
    var s = fakeStorage();
    logWater(3, '2026-06-01', s);
    logWater(4, '2026-06-02', s);
    resetDay('2026-06-01', s);
    var data = loadLog(s);
    expect(data.log).toHaveLength(1);
    expect(data.log[0].date).toBe('2026-06-02');
  });
  test('returns ok:true even if date does not exist', function () {
    var s = fakeStorage();
    expect(resetDay('2026-01-01', s).ok).toBe(true);
  });
});

// ── getTodayProgress ──────────────────────────────────────────────────
describe('getTodayProgress', function () {
  test('returns 0 glasses when no entry today', function () {
    var s = fakeStorage({ goal: 8, log: [] });
    var p = getTodayProgress(s);
    expect(p.glasses).toBe(0);
    expect(p.met).toBe(false);
    expect(p.percent).toBe(0);
  });
  test('returns correct glasses when entry exists', function () {
    var s = fakeStorage();
    logWater(6, todayISO(), s);
    var p = getTodayProgress(s);
    expect(p.glasses).toBe(6);
  });
  test('met is true when goal reached', function () {
    var s = fakeStorage({ goal: 4, log: [] });
    logWater(4, todayISO(), s);
    expect(getTodayProgress(s).met).toBe(true);
  });
  test('met is true when goal exceeded', function () {
    var s = fakeStorage({ goal: 4, log: [] });
    logWater(7, todayISO(), s);
    expect(getTodayProgress(s).met).toBe(true);
  });
  test('percent is 50 when at half goal', function () {
    var s = fakeStorage({ goal: 8, log: [] });
    logWater(4, todayISO(), s);
    expect(getTodayProgress(s).percent).toBe(50);
  });
  test('percent is capped at 100', function () {
    var s = fakeStorage({ goal: 4, log: [] });
    logWater(10, todayISO(), s);
    expect(getTodayProgress(s).percent).toBe(100);
  });
  test('ml is glasses * ML_PER_GLASS', function () {
    var s = fakeStorage({ goal: 8, log: [] });
    logWater(4, todayISO(), s);
    expect(getTodayProgress(s).ml).toBe(4 * ML_PER_GLASS);
  });
  test('date field matches today', function () {
    var s = fakeStorage();
    expect(getTodayProgress(s).date).toBe(todayISO());
  });
  test('goal field reflects stored goal', function () {
    var s = fakeStorage({ goal: 12, log: [] });
    expect(getTodayProgress(s).goal).toBe(12);
  });
});

// ── getWeeklyAvg ──────────────────────────────────────────────────────
describe('getWeeklyAvg', function () {
  test('returns null for empty log', function () {
    var s = fakeStorage({ goal: 8, log: [] });
    expect(getWeeklyAvg(s)).toBeNull();
  });
  test('averages last 7 days', function () {
    var s = fakeStorage();
    // Log 7 days with known values: avg should be 5
    for (var i = 6; i >= 0; i--) {
      logWater(5, dayOffset(-i), s);
    }
    expect(getWeeklyAvg(s)).toBe(5);
  });
  test('uses only last 7 entries if more exist', function () {
    var s = fakeStorage();
    // 10 days: first 3 at 2, last 7 at 8 → avg 8
    for (var i = 9; i >= 0; i--) {
      var g = i >= 7 ? 2 : 8;
      logWater(g, dayOffset(-i), s);
    }
    expect(getWeeklyAvg(s)).toBe(8);
  });
  test('rounds to 1 decimal place', function () {
    var s = fakeStorage();
    logWater(7, dayOffset(-2), s);
    logWater(8, dayOffset(-1), s);
    logWater(9, dayOffset(0), s);
    // avg = (7+8+9)/3 = 8
    expect(getWeeklyAvg(s)).toBe(8);
  });
});

// ── getNudgeText ──────────────────────────────────────────────────────
describe('getNudgeText', function () {
  test('returns success message when goal met', function () {
    var p = { glasses: 8, goal: 8, percent: 100, met: true };
    expect(getNudgeText(p)).toContain('goal met');
  });
  test('returns almost-there message at >= 75%', function () {
    var p = { glasses: 6, goal: 8, percent: 75, met: false };
    expect(getNudgeText(p)).toContain('Almost there');
  });
  test('returns halfway message at >= 50%', function () {
    var p = { glasses: 4, goal: 8, percent: 50, met: false };
    expect(getNudgeText(p)).toContain('Halfway');
  });
  test('returns reminder message below 50%', function () {
    var p = { glasses: 2, goal: 8, percent: 25, met: false };
    expect(getNudgeText(p)).toContain('hydrate');
  });
  test('includes remaining count in message', function () {
    var p = { glasses: 6, goal: 8, percent: 75, met: false };
    var text = getNudgeText(p);
    expect(text).toContain('2');
  });
  test('handles singular glass correctly', function () {
    var p = { glasses: 7, goal: 8, percent: 87, met: false };
    var text = getNudgeText(p);
    expect(text.includes('glass') && !text.includes('glasses')).toBe(true);
  });
  test('does not contain unsafe medical language', function () {
    var p = { glasses: 0, goal: 8, percent: 0, met: false };
    var text = getNudgeText(p);
    var forbidden = ['diagnos', 'treat', 'prescri', 'disease', 'prevent', 'risk of'];
    forbidden.forEach(function(w) {
      expect(text.toLowerCase().includes(w)).toBe(false);
    });
  });
});

// ── getStreak ─────────────────────────────────────────────────────────
describe('getStreak', function () {
  test('returns 0 for empty log', function () {
    var s = fakeStorage({ goal: 8, log: [] });
    expect(getStreak(s)).toBe(0);
  });
  test('returns 1 when goal met today only', function () {
    var s = fakeStorage({ goal: 4, log: [] });
    logWater(4, todayISO(), s);
    expect(getStreak(s)).toBe(1);
  });
  test('returns 0 when today entry is below goal', function () {
    var s = fakeStorage({ goal: 8, log: [] });
    logWater(2, todayISO(), s);
    expect(getStreak(s)).toBe(0);
  });
  test('returns 2 for two consecutive days meeting goal', function () {
    var s = fakeStorage({ goal: 4, log: [] });
    logWater(4, dayOffset(-1), s);
    logWater(4, todayISO(), s);
    expect(getStreak(s)).toBe(2);
  });
  test('streak breaks if a day is missed', function () {
    var s = fakeStorage({ goal: 4, log: [] });
    logWater(4, dayOffset(-3), s);
    logWater(4, dayOffset(-1), s);
    logWater(4, todayISO(), s);
    // Gap on day -2 breaks the streak
    expect(getStreak(s)).toBe(2);
  });
});

// ── Safety checks ─────────────────────────────────────────────────────
describe('Safety — no medical claims', function () {
  var FORBIDDEN = ['diagnos', 'treat', 'prescri', 'cardiac arrest', 'heart attack',
    'prevent disease', 'predict', 'risk of', 'passed away', 'balaji died'];

  function checkText(text) {
    FORBIDDEN.forEach(function (w) {
      expect(text.toLowerCase().includes(w)).toBe(false);
    });
  }

  test('getNudgeText at 0% is safe', function () {
    checkText(getNudgeText({ glasses: 0, goal: 8, percent: 0, met: false }));
  });
  test('getNudgeText at 100% is safe', function () {
    checkText(getNudgeText({ glasses: 8, goal: 8, percent: 100, met: true }));
  });
  test('engine module description is safe', function () {
    var src = require('fs').readFileSync(
      path.join(__dirname, 'bala-b75-hydration-engine.js'), 'utf8');
    FORBIDDEN.forEach(function (w) {
      expect(src.toLowerCase().includes(w)).toBe(false);
    });
  });
});
