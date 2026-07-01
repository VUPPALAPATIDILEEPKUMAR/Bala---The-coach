// scripts/bala-b75-hydration-engine.js
// B75 -- BALA Hydration Tracker Engine
// Tracks daily water intake (glasses or ml). Local-only. No network.
// Provides daily progress, 7-day avg, simple nudge text.
// Safe language only — hydration awareness, not clinical guidance.
'use strict';

var HYDRATION_KEY     = 'bala-hydration-v1';
var DEFAULT_GOAL      = 8;     // glasses per day
var ML_PER_GLASS      = 250;
var MAX_GLASSES_DAY   = 30;    // safety cap per day
var HISTORY_MAX_DAYS  = 90;

function todayISO() {
  var d = new Date(), p = function (x) { return String(x).padStart(2, '0'); };
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function loadLog(storage) {
  try {
    var src = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!src) return { goal: DEFAULT_GOAL, log: [] };
    var data = JSON.parse(src.getItem(HYDRATION_KEY));
    if (!data || typeof data !== 'object') return { goal: DEFAULT_GOAL, log: [] };
    return {
      goal: typeof data.goal === 'number' ? data.goal : DEFAULT_GOAL,
      log: Array.isArray(data.log) ? data.log : []
    };
  } catch (_) { return { goal: DEFAULT_GOAL, log: [] }; }
}

function saveLog(data, storage) {
  try {
    var src = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!src) return false;
    src.setItem(HYDRATION_KEY, JSON.stringify(data));
    return true;
  } catch (_) { return false; }
}

function setGoal(glasses, storage) {
  var g = parseInt(glasses, 10);
  if (isNaN(g) || g < 1 || g > MAX_GLASSES_DAY) {
    return { ok: false, reason: 'invalid_goal' };
  }
  var data = loadLog(storage);
  data.goal = g;
  saveLog(data, storage);
  return { ok: true, goal: g };
}

function logWater(glasses, date, storage) {
  var g = parseFloat(glasses);
  if (isNaN(g) || g <= 0) return { ok: false, reason: 'invalid_amount' };
  var day  = date || todayISO();
  var data = loadLog(storage);
  var idx  = data.log.findIndex(function (e) { return e.date === day; });
  if (idx >= 0) {
    data.log[idx].glasses = Math.min(MAX_GLASSES_DAY, data.log[idx].glasses + g);
    data.log[idx].ts = Date.now();
  } else {
    data.log.push({ date: day, glasses: Math.min(MAX_GLASSES_DAY, g), ts: Date.now() });
  }
  data.log.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  data.log = data.log.slice(-HISTORY_MAX_DAYS);
  saveLog(data, storage);
  return { ok: true, glasses: data.log.find(function (e) { return e.date === day; }).glasses, goal: data.goal };
}

function resetDay(date, storage) {
  var day  = date || todayISO();
  var data = loadLog(storage);
  data.log = data.log.filter(function (e) { return e.date !== day; });
  saveLog(data, storage);
  return { ok: true };
}

function getTodayProgress(storage) {
  var data    = loadLog(storage);
  var day     = todayISO();
  var entry   = data.log.find(function (e) { return e.date === day; }) || null;
  var glasses = entry ? entry.glasses : 0;
  return {
    date: day,
    glasses: glasses,
    goal: data.goal,
    ml: Math.round(glasses * ML_PER_GLASS),
    percent: Math.min(100, Math.round((glasses / data.goal) * 100)),
    met: glasses >= data.goal
  };
}

function getWeeklyAvg(storage) {
  var data    = loadLog(storage);
  var entries = data.log.slice(-7);
  if (!entries.length) return null;
  var sum = entries.reduce(function (s, e) { return s + e.glasses; }, 0);
  return Math.round((sum / entries.length) * 10) / 10;
}

function getNudgeText(progress) {
  if (progress.met) {
    return 'Hydration goal met today! Great job listening to your body.';
  }
  var remaining = Math.max(0, progress.goal - progress.glasses);
  if (progress.percent >= 75) {
    return 'Almost there — ' + remaining + ' more glass' + (remaining !== 1 ? 'es' : '') + ' to reach your goal today.';
  }
  if (progress.percent >= 50) {
    return 'Halfway there! ' + remaining + ' more glass' + (remaining !== 1 ? 'es' : '') + ' to go today.';
  }
  return 'Remember to hydrate — ' + remaining + ' glass' + (remaining !== 1 ? 'es' : '') + ' left to reach your goal today.';
}

function getStreak(storage) {
  var data = loadLog(storage);
  if (!data.log.length) return 0;
  var sorted  = data.log.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  var streak  = 0;
  var checkDate = todayISO();
  for (var i = 0; i < sorted.length; i++) {
    if (sorted[i].date === checkDate && sorted[i].glasses >= data.goal) {
      streak++;
      var d  = new Date(checkDate);
      d.setDate(d.getDate() - 1);
      var p  = function (x) { return String(x).padStart(2, '0'); };
      checkDate = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    } else if (sorted[i].date < checkDate) {
      break;
    }
  }
  return streak;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    logWater: logWater,
    resetDay: resetDay,
    setGoal: setGoal,
    getTodayProgress: getTodayProgress,
    getWeeklyAvg: getWeeklyAvg,
    getNudgeText: getNudgeText,
    getStreak: getStreak,
    loadLog: loadLog,
    HYDRATION_KEY: HYDRATION_KEY,
    DEFAULT_GOAL: DEFAULT_GOAL,
    ML_PER_GLASS: ML_PER_GLASS,
    MAX_GLASSES_DAY: MAX_GLASSES_DAY
  };
}
