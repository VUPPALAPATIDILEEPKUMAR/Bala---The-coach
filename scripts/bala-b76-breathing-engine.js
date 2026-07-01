// scripts/bala-b76-breathing-engine.js
// B76 — BALA Breathing & Stress Check-in Engine
// Tracks daily breathing session + subjective stress level (1-5).
// Provides guided breathing reminder text and trend signal.
// LOCAL-ONLY — zero network, zero paid APIs, zero medical claims.
'use strict';

var BREATHING_KEY   = 'bala-breathing-v1';
var STRESS_MIN      = 1;
var STRESS_MAX      = 5;
var HISTORY_MAX     = 90;
var DEFAULT_SESSIONS_GOAL = 1; // at least 1 breathing check-in per day

// Breathing exercise presets (text-only, no timers — user controls pace)
var EXERCISES = {
  '478': {
    name: '4-7-8 Calm',
    steps: ['Breathe in for 4 counts', 'Hold for 7 counts', 'Breathe out for 8 counts'],
    rounds: 4,
    note: 'A calming rhythm to help your body settle.'
  },
  'box': {
    name: 'Box Breathing',
    steps: ['Breathe in for 4 counts', 'Hold for 4 counts', 'Breathe out for 4 counts', 'Hold for 4 counts'],
    rounds: 4,
    note: 'Equal rhythm — steady and grounding.'
  },
  'deep': {
    name: 'Deep Breath',
    steps: ['Breathe in slowly through your nose', 'Breathe out slowly through your mouth'],
    rounds: 6,
    note: 'Simple and effective — any time, anywhere.'
  }
};

var STRESS_LABELS  = ['', 'Very calm', 'Calm', 'Neutral', 'A bit tense', 'Very tense'];
var STRESS_EMOJIS  = ['', '😌', '🙂', '😐', '😤', '😰'];

function todayISO() {
  var d = new Date(), p = function (x) { return String(x).padStart(2, '0'); };
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function clampStress(v) {
  var n = parseInt(v, 10);
  if (isNaN(n)) return null;
  return Math.max(STRESS_MIN, Math.min(STRESS_MAX, n));
}

function loadBreathing(storage) {
  try {
    var src = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!src) return { log: [] };
    var data = JSON.parse(src.getItem(BREATHING_KEY));
    if (!data || typeof data !== 'object') return { log: [] };
    return { log: Array.isArray(data.log) ? data.log : [] };
  } catch (_) { return { log: [] }; }
}

function saveBreathing(data, storage) {
  try {
    var src = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!src) return false;
    src.setItem(BREATHING_KEY, JSON.stringify(data));
    return true;
  } catch (_) { return false; }
}

function logBreathingSession(stressLevel, exerciseKey, date, storage) {
  var stress = clampStress(stressLevel);
  if (stress === null) return { ok: false, reason: 'invalid_stress' };
  var exercise = exerciseKey || 'deep';
  if (!EXERCISES[exercise]) exercise = 'deep';
  var day  = date || todayISO();
  var data = loadBreathing(storage);
  var existing = data.log.find(function (e) { return e.date === day; });
  if (existing) {
    existing.stress = stress;
    existing.exercise = exercise;
    existing.sessions = (existing.sessions || 1) + 1;
    existing.ts = Date.now();
  } else {
    data.log.push({ date: day, stress: stress, exercise: exercise, sessions: 1, ts: Date.now() });
  }
  data.log.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  data.log = data.log.slice(-HISTORY_MAX);
  saveBreathing(data, storage);
  return { ok: true, date: day, stress: stress, exercise: exercise };
}

function getTodaySession(storage) {
  var data  = loadBreathing(storage);
  var entry = data.log.find(function (e) { return e.date === todayISO(); });
  return entry || null;
}

function getRecentDays(n, storage) {
  if (n <= 0) return [];
  var data = loadBreathing(storage);
  return data.log.slice(-n);
}

function computeAvgStress(entries) {
  var vals = entries
    .map(function (e) { return parseInt(e.stress, 10); })
    .filter(function (v) { return !isNaN(v) && v >= STRESS_MIN && v <= STRESS_MAX; });
  if (!vals.length) return null;
  var sum = vals.reduce(function (s, v) { return s + v; }, 0);
  return Math.round((sum / vals.length) * 10) / 10;
}

function getStressLabel(rating) {
  var r = parseInt(rating, 10);
  return STRESS_LABELS[r] || 'Unknown';
}

function getStressEmoji(rating) {
  var r = parseInt(rating, 10);
  return STRESS_EMOJIS[r] || '';
}

function getExerciseGuide(key) {
  return EXERCISES[key] || EXERCISES['deep'];
}

function getBreathingNudge(todayEntry, avgStress) {
  if (!todayEntry) {
    return 'Take a moment to breathe — even one minute of steady breathing can help your body settle.';
  }
  var s = parseInt(todayEntry.stress, 10);
  if (s >= 4) {
    return 'Your check-in shows some tension today. A few slow breaths can help your body find balance.';
  }
  if (avgStress !== null && avgStress >= 4) {
    return 'Your stress signal has been elevated this week. Small daily breathing moments can add up.';
  }
  return 'Good check-in today. Keep listening to your body — consistency is what matters.';
}

function buildBreathingSummary(entries) {
  if (!entries.length) {
    return { ok: false, reason: 'no_data', sessionsLogged: 0 };
  }
  var avgStress  = computeAvgStress(entries);
  var today      = getTodaySession(null); // null storage — caller should pass storage separately
  var lastEntry  = entries[entries.length - 1];
  return {
    ok: true,
    sessionsLogged: entries.length,
    avgStress: avgStress,
    lastStress: lastEntry ? parseInt(lastEntry.stress, 10) : null,
    lastExercise: lastEntry ? lastEntry.exercise : null,
    nudge: getBreathingNudge(lastEntry, avgStress)
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    logBreathingSession: logBreathingSession,
    getTodaySession: getTodaySession,
    getRecentDays: getRecentDays,
    computeAvgStress: computeAvgStress,
    getStressLabel: getStressLabel,
    getStressEmoji: getStressEmoji,
    getExerciseGuide: getExerciseGuide,
    getBreathingNudge: getBreathingNudge,
    buildBreathingSummary: buildBreathingSummary,
    clampStress: clampStress,
    loadBreathing: loadBreathing,
    BREATHING_KEY: BREATHING_KEY,
    STRESS_MIN: STRESS_MIN,
    STRESS_MAX: STRESS_MAX,
    EXERCISES: EXERCISES,
    STRESS_LABELS: STRESS_LABELS,
    STRESS_EMOJIS: STRESS_EMOJIS,
    DEFAULT_SESSIONS_GOAL: DEFAULT_SESSIONS_GOAL
  };
}
