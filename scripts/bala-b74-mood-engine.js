// scripts/bala-b74-mood-engine.js
// B74 -- BALA Mood & Energy Quick Log Engine
// Tracks daily mood (1-5) and energy (1-5) alongside check-ins.
// LocalStorage only. No network. No medical claims.
'use strict';

var MOOD_KEY      = 'bala-mood-log-v1';
var MOOD_MIN      = 1;
var MOOD_MAX      = 5;
var MOOD_LABELS   = ['', 'Low', 'Fair', 'OK', 'Good', 'Great'];
var ENERGY_LABELS = ['', 'Drained', 'Tired', 'OK', 'Energised', 'Vibrant'];
var MOOD_EMOJIS   = ['', '😔', '😐', '🙂', '😊', '😄'];
var ENERGY_EMOJIS = ['', '🪫', '😴', '⚡', '🔋', '✨'];

function clampRating(v) {
  var n = parseInt(v, 10);
  if (isNaN(n)) return null;
  return Math.min(MOOD_MAX, Math.max(MOOD_MIN, n));
}

function todayISO() {
  var d = new Date();
  var pad = function (x) { return String(x).padStart(2, '0'); };
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function loadLog(storage) {
  try {
    var raw = (storage || (typeof localStorage !== 'undefined' ? localStorage : null));
    if (!raw) return [];
    var data = JSON.parse(raw.getItem(MOOD_KEY));
    return Array.isArray(data) ? data : [];
  } catch (_) { return []; }
}

function saveLog(entries, storage) {
  try {
    var raw = (storage || (typeof localStorage !== 'undefined' ? localStorage : null));
    if (!raw) return false;
    raw.setItem(MOOD_KEY, JSON.stringify(entries));
    return true;
  } catch (_) { return false; }
}

function logMoodEntry(mood, energy, date, storage) {
  var m = clampRating(mood);
  var e = clampRating(energy);
  if (m === null || e === null) return { ok: false, reason: 'invalid_rating' };
  var day = date || todayISO();
  var entries = loadLog(storage);
  // Upsert: replace existing entry for same date
  var idx = entries.findIndex(function (x) { return x.date === day; });
  var entry = { date: day, mood: m, energy: e, ts: Date.now() };
  if (idx >= 0) { entries[idx] = entry; }
  else { entries.push(entry); }
  // Keep last 90 days
  entries.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  entries = entries.slice(-90);
  var saved = saveLog(entries, storage);
  return { ok: saved, entry: entry };
}

function getRecentEntries(n, storage) {
  var entries = loadLog(storage);
  if (n <= 0) return [];
  return entries.slice(-n);
}

function getEntryForDate(date, storage) {
  return loadLog(storage).find(function (e) { return e.date === date; }) || null;
}

function computeMoodAvg(entries) {
  var vals = entries.map(function (e) { return e.mood; }).filter(function (v) { return typeof v === 'number' && v >= MOOD_MIN; });
  if (!vals.length) return null;
  return Math.round((vals.reduce(function (s, v) { return s + v; }, 0) / vals.length) * 10) / 10;
}

function computeEnergyAvg(entries) {
  var vals = entries.map(function (e) { return e.energy; }).filter(function (v) { return typeof v === 'number' && v >= MOOD_MIN; });
  if (!vals.length) return null;
  return Math.round((vals.reduce(function (s, v) { return s + v; }, 0) / vals.length) * 10) / 10;
}

function buildMoodSummary(entries) {
  if (!entries.length) return { ok: false, reason: 'no_data' };
  var moodAvg   = computeMoodAvg(entries);
  var energyAvg = computeEnergyAvg(entries);
  var best = entries.reduce(function (b, e) { return e.mood > (b ? b.mood : -1) ? e : b; }, null);
  return {
    ok: true,
    count: entries.length,
    moodAvg: moodAvg,
    energyAvg: energyAvg,
    bestDay: best ? { date: best.date, mood: best.mood, energy: best.energy } : null,
    moodLabel: moodAvg !== null ? MOOD_LABELS[Math.round(moodAvg)] : null,
    energyLabel: energyAvg !== null ? ENERGY_LABELS[Math.round(energyAvg)] : null
  };
}

function getMoodLabel(rating)   { return MOOD_LABELS[clampRating(rating)] || ''; }
function getEnergyLabel(rating) { return ENERGY_LABELS[clampRating(rating)] || ''; }
function getMoodEmoji(rating)   { return MOOD_EMOJIS[clampRating(rating)] || ''; }
function getEnergyEmoji(rating) { return ENERGY_EMOJIS[clampRating(rating)] || ''; }

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    logMoodEntry: logMoodEntry,
    getRecentEntries: getRecentEntries,
    getEntryForDate: getEntryForDate,
    computeMoodAvg: computeMoodAvg,
    computeEnergyAvg: computeEnergyAvg,
    buildMoodSummary: buildMoodSummary,
    clampRating: clampRating,
    getMoodLabel: getMoodLabel,
    getEnergyLabel: getEnergyLabel,
    getMoodEmoji: getMoodEmoji,
    getEnergyEmoji: getEnergyEmoji,
    MOOD_KEY: MOOD_KEY,
    MOOD_MIN: MOOD_MIN,
    MOOD_MAX: MOOD_MAX,
    MOOD_LABELS: MOOD_LABELS,
    ENERGY_LABELS: ENERGY_LABELS,
    MOOD_EMOJIS: MOOD_EMOJIS,
    ENERGY_EMOJIS: ENERGY_EMOJIS
  };
}
