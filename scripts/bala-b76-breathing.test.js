// scripts/bala-b76-breathing.test.js — B76 Breathing & Stress tests
'use strict';

const path = require('path');
const {
  logBreathingSession, getTodaySession, getRecentDays,
  computeAvgStress, getStressLabel, getStressEmoji,
  getExerciseGuide, getBreathingNudge, buildBreathingSummary,
  clampStress, loadBreathing,
  BREATHING_KEY, STRESS_MIN, STRESS_MAX, EXERCISES,
  STRESS_LABELS, STRESS_EMOJIS, DEFAULT_SESSIONS_GOAL
} = require(path.join(__dirname, 'bala-b76-breathing-engine.js'));

function fakeStorage(initial) {
  var store = {};
  if (initial) store[BREATHING_KEY] = JSON.stringify(initial);
  return {
    getItem: function (k) { return store[k] !== undefined ? store[k] : null; },
    setItem: function (k, v) { store[k] = v; },
    removeItem: function (k) { delete store[k]; }
  };
}

function todayISO() {
  var d = new Date(), p = function(x){return String(x).padStart(2,'0');};
  return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());
}

function dayOffset(n) {
  var d = new Date(); d.setDate(d.getDate()+n);
  var p = function(x){return String(x).padStart(2,'0');};
  return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());
}

// ── Constants ─────────────────────────────────────────────────────────
describe('Constants', function () {
  test('BREATHING_KEY is a non-empty string', function () {
    expect(typeof BREATHING_KEY).toBe('string');
    expect(BREATHING_KEY.length).toBeGreaterThan(0);
  });
  test('STRESS_MIN is 1', function () { expect(STRESS_MIN).toBe(1); });
  test('STRESS_MAX is 5', function () { expect(STRESS_MAX).toBe(5); });
  test('DEFAULT_SESSIONS_GOAL is at least 1', function () {
    expect(DEFAULT_SESSIONS_GOAL).toBeGreaterThanOrEqual(1);
  });
  test('EXERCISES has 478, box, deep keys', function () {
    expect('478' in EXERCISES).toBe(true);
    expect('box' in EXERCISES).toBe(true);
    expect('deep' in EXERCISES).toBe(true);
  });
  test('Each exercise has name, steps, rounds, note', function () {
    Object.values(EXERCISES).forEach(function (ex) {
      expect(typeof ex.name).toBe('string');
      expect(Array.isArray(ex.steps)).toBe(true);
      expect(typeof ex.rounds).toBe('number');
      expect(typeof ex.note).toBe('string');
    });
  });
  test('STRESS_LABELS has 6 entries (index 0-5)', function () {
    expect(STRESS_LABELS).toHaveLength(6);
    expect(STRESS_LABELS[0]).toBe('');
  });
  test('STRESS_EMOJIS has 6 entries (index 0-5)', function () {
    expect(STRESS_EMOJIS).toHaveLength(6);
    expect(STRESS_EMOJIS[0]).toBe('');
  });
});

// ── clampStress ───────────────────────────────────────────────────────
describe('clampStress', function () {
  test('returns 1 for input 1', function () { expect(clampStress(1)).toBe(1); });
  test('returns 5 for input 5', function () { expect(clampStress(5)).toBe(5); });
  test('clamps below min to 1', function () { expect(clampStress(0)).toBe(1); });
  test('clamps above max to 5', function () { expect(clampStress(10)).toBe(5); });
  test('returns null for NaN string', function () { expect(clampStress('abc')).toBeNull(); });
  test('returns null for undefined', function () { expect(clampStress(undefined)).toBeNull(); });
  test('parses string numbers', function () { expect(clampStress('3')).toBe(3); });
  test('clamps negative to 1', function () { expect(clampStress(-5)).toBe(1); });
});

// ── loadBreathing ─────────────────────────────────────────────────────
describe('loadBreathing', function () {
  test('returns empty log for empty storage', function () {
    var s = fakeStorage();
    var data = loadBreathing(s);
    expect(data.log).toEqual([]);
  });
  test('returns stored data when valid', function () {
    var s = fakeStorage({ log: [{ date: '2026-01-01', stress: 2 }] });
    expect(loadBreathing(s).log).toHaveLength(1);
  });
  test('handles corrupt JSON', function () {
    var store = { getItem: function(){return '{bad';}, setItem:function(){} };
    expect(loadBreathing(store).log).toEqual([]);
  });
  test('handles null storage', function () {
    expect(loadBreathing(null).log).toEqual([]);
  });
});

// ── logBreathingSession ───────────────────────────────────────────────
describe('logBreathingSession', function () {
  test('logs a valid session', function () {
    var s = fakeStorage();
    var r = logBreathingSession(3, 'deep', '2026-06-01', s);
    expect(r.ok).toBe(true);
    expect(r.stress).toBe(3);
    expect(r.exercise).toBe('deep');
  });
  test('rejects invalid stress', function () {
    var s = fakeStorage();
    expect(logBreathingSession('abc', 'deep', '2026-06-01', s).ok).toBe(false);
  });
  test('clamps stress to max', function () {
    var s = fakeStorage();
    var r = logBreathingSession(99, 'deep', '2026-06-01', s);
    expect(r.stress).toBe(STRESS_MAX);
  });
  test('clamps stress to min', function () {
    var s = fakeStorage();
    var r = logBreathingSession(-1, 'deep', '2026-06-01', s);
    expect(r.stress).toBe(STRESS_MIN);
  });
  test('unknown exercise key falls back to deep', function () {
    var s = fakeStorage();
    var r = logBreathingSession(2, 'unknown_key', '2026-06-01', s);
    expect(r.exercise).toBe('deep');
  });
  test('null exercise key falls back to deep', function () {
    var s = fakeStorage();
    var r = logBreathingSession(2, null, '2026-06-01', s);
    expect(r.exercise).toBe('deep');
  });
  test('updates sessions count on same day', function () {
    var s = fakeStorage();
    logBreathingSession(3, 'deep', '2026-06-01', s);
    logBreathingSession(2, 'box', '2026-06-01', s);
    var data = loadBreathing(s);
    expect(data.log[0].sessions).toBe(2);
  });
  test('different dates produce separate entries', function () {
    var s = fakeStorage();
    logBreathingSession(3, 'deep', '2026-06-01', s);
    logBreathingSession(4, '478', '2026-06-02', s);
    expect(loadBreathing(s).log).toHaveLength(2);
  });
  test('log is sorted ascending', function () {
    var s = fakeStorage();
    logBreathingSession(3, 'deep', '2026-06-03', s);
    logBreathingSession(2, 'deep', '2026-06-01', s);
    var data = loadBreathing(s);
    expect(data.log[0].date).toBe('2026-06-01');
    expect(data.log[1].date).toBe('2026-06-03');
  });
  test('defaults date to today', function () {
    var s = fakeStorage();
    logBreathingSession(2, 'deep', undefined, s);
    expect(loadBreathing(s).log.some(function(e){return e.date===todayISO();})).toBe(true);
  });
  test('accepts all valid exercise keys', function () {
    ['478', 'box', 'deep'].forEach(function (key) {
      var s = fakeStorage();
      var r = logBreathingSession(3, key, '2026-06-01', s);
      expect(r.exercise).toBe(key);
    });
  });
});

// ── getRecentDays ─────────────────────────────────────────────────────
describe('getRecentDays', function () {
  test('returns empty for n=0', function () {
    var s = fakeStorage({ log: [{ date: '2026-06-01', stress: 3 }] });
    expect(getRecentDays(0, s)).toHaveLength(0);
  });
  test('returns last n entries', function () {
    var s = fakeStorage();
    for (var i = 9; i >= 0; i--) {
      logBreathingSession(3, 'deep', dayOffset(-i), s);
    }
    expect(getRecentDays(7, s)).toHaveLength(7);
  });
  test('returns all when fewer than n', function () {
    var s = fakeStorage();
    logBreathingSession(3, 'deep', '2026-06-01', s);
    expect(getRecentDays(10, s)).toHaveLength(1);
  });
});

// ── computeAvgStress ──────────────────────────────────────────────────
describe('computeAvgStress', function () {
  test('returns null for empty entries', function () {
    expect(computeAvgStress([])).toBeNull();
  });
  test('averages stress values', function () {
    var entries = [
      { stress: 2 }, { stress: 4 }, { stress: 3 }
    ];
    expect(computeAvgStress(entries)).toBe(3);
  });
  test('rounds to 1 decimal', function () {
    var entries = [{ stress: 1 }, { stress: 2 }];
    expect(computeAvgStress(entries)).toBe(1.5);
  });
  test('ignores out-of-range stress values', function () {
    var entries = [{ stress: 0 }, { stress: 3 }, { stress: 99 }];
    expect(computeAvgStress(entries)).toBe(3);
  });
});

// ── getStressLabel / getStressEmoji ───────────────────────────────────
describe('getStressLabel and getStressEmoji', function () {
  test('label for 1 is "Very calm"', function () { expect(getStressLabel(1)).toBe('Very calm'); });
  test('label for 5 is "Very tense"', function () { expect(getStressLabel(5)).toBe('Very tense'); });
  test('emoji for 1 is 😌', function () { expect(getStressEmoji(1)).toBe('😌'); });
  test('emoji for 5 is 😰', function () { expect(getStressEmoji(5)).toBe('😰'); });
  test('label for string "3" works', function () { expect(getStressLabel('3')).toBe('Neutral'); });
  test('out-of-range returns empty/Unknown', function () {
    expect(['', 'Unknown'].includes(getStressLabel(99))).toBe(true);
  });
});

// ── getExerciseGuide ──────────────────────────────────────────────────
describe('getExerciseGuide', function () {
  test('returns 478 guide', function () {
    var g = getExerciseGuide('478');
    expect(g.name).toContain('4-7-8');
    expect(g.steps).toHaveLength(3);
  });
  test('returns box guide', function () {
    var g = getExerciseGuide('box');
    expect(g.name).toContain('Box');
    expect(g.steps).toHaveLength(4);
  });
  test('returns deep guide for unknown key', function () {
    var g = getExerciseGuide('unknown');
    expect(g.name).toContain('Deep');
  });
  test('all guides have note field', function () {
    ['478','box','deep'].forEach(function(k){
      expect(getExerciseGuide(k).note.length).toBeGreaterThan(0);
    });
  });
});

// ── getBreathingNudge ─────────────────────────────────────────────────
describe('getBreathingNudge', function () {
  test('returns session reminder when no today entry', function () {
    var text = getBreathingNudge(null, null);
    expect(text.length).toBeGreaterThan(0);
    expect(text.toLowerCase()).toContain('breath');
  });
  test('returns tension message for stress >= 4', function () {
    var entry = { date: todayISO(), stress: 4 };
    var text = getBreathingNudge(entry, null);
    expect(text.toLowerCase()).toContain('tension');
  });
  test('returns elevated message when avgStress >= 4', function () {
    var entry = { date: todayISO(), stress: 2 };
    var text = getBreathingNudge(entry, 4.2);
    expect(text.toLowerCase()).toContain('week');
  });
  test('returns positive message for calm today', function () {
    var entry = { date: todayISO(), stress: 2 };
    var text = getBreathingNudge(entry, 2);
    expect(text.toLowerCase()).toContain('good');
  });
  test('nudge text does not contain medical claims', function () {
    var FORBIDDEN = ['diagnos', 'treat', 'prescri', 'cardiac arrest', 'heart attack'];
    [null, { stress: 1 }, { stress: 5 }].forEach(function (entry) {
      var text = getBreathingNudge(entry, 3);
      FORBIDDEN.forEach(function (w) {
        expect(text.toLowerCase().includes(w)).toBe(false);
      });
    });
  });
});

// ── buildBreathingSummary ─────────────────────────────────────────────
describe('buildBreathingSummary', function () {
  test('returns ok:false for empty entries', function () {
    expect(buildBreathingSummary([]).ok).toBe(false);
  });
  test('returns ok:true for valid entries', function () {
    var entries = [{ date: '2026-06-01', stress: 3, exercise: 'deep', sessions: 1 }];
    expect(buildBreathingSummary(entries).ok).toBe(true);
  });
  test('includes sessionsLogged', function () {
    var entries = [
      { date: '2026-06-01', stress: 2, exercise: 'deep' },
      { date: '2026-06-02', stress: 3, exercise: 'box' }
    ];
    expect(buildBreathingSummary(entries).sessionsLogged).toBe(2);
  });
  test('includes avgStress', function () {
    var entries = [{ date: '2026-06-01', stress: 4 }, { date: '2026-06-02', stress: 2 }];
    expect(buildBreathingSummary(entries).avgStress).toBe(3);
  });
  test('includes nudge string', function () {
    var entries = [{ date: '2026-06-01', stress: 3, exercise: 'deep' }];
    expect(typeof buildBreathingSummary(entries).nudge).toBe('string');
  });
});

// ── Safety ────────────────────────────────────────────────────────────
describe('Safety — no medical claims in engine', function () {
  var FORBIDDEN = ['diagnos', 'treat', 'prescri', 'cardiac arrest', 'heart attack',
    'prevent disease', 'predict', 'risk of', 'passed away', 'balaji died'];
  test('engine source is free of forbidden phrases', function () {
    var src = require('fs').readFileSync(
      path.join(__dirname, 'bala-b76-breathing-engine.js'), 'utf8');
    FORBIDDEN.forEach(function (w) {
      expect(src.toLowerCase().includes(w)).toBe(false);
    });
  });
});
