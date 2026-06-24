'use strict';
// =============================================================================
// BALA-B46 Weekly Focus Engine
// Pure local logic. No DOM. No network. No AI inference.
// Deterministic from localStorage state only.
//
// Safety rules (enforced throughout):
//   - Never diagnose
//   - Never predict risk
//   - Never say a behavior caused a health outcome
//   - Never give treatment advice
//   - Never use imperative "fix / cure / prevent / treat / reduce risk"
//   - Phrase suggestions as things to "notice" or "try", never prescriptive
// =============================================================================

const FOCUS_KEY     = 'bala_active_focus';
const FOCUS_LOG_KEY = 'bala_focus_log';
const MAX_LOG       = 90;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _todayISO(_now) {
  return new Date(_now != null ? _now : Date.now()).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Set active focus (replaces any existing; only one at a time)
// Returns the saved object.
// ---------------------------------------------------------------------------
function setActiveFocus(text, _storage, _now) {
  const store = _storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store) throw new Error('No storage available');
  const clean = String(text || '').trim();
  if (!clean) throw new Error('Focus text must not be empty');
  const focus = { text: clean, acceptedDate: _todayISO(_now) };
  store.setItem(FOCUS_KEY, JSON.stringify(focus));
  return focus;
}

// ---------------------------------------------------------------------------
// Get active focus → { text, acceptedDate } or null
// Never throws.
// ---------------------------------------------------------------------------
function getActiveFocus(_storage) {
  const store = _storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store) return null;
  try {
    const raw = store.getItem(FOCUS_KEY);
    if (!raw) return null;
    const f = JSON.parse(raw);
    if (!f || typeof f.text !== 'string' || !f.text.trim()) return null;
    return { text: f.text.trim(), acceptedDate: f.acceptedDate || null };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Dismiss (clear) active focus
// ---------------------------------------------------------------------------
function dismissFocus(_storage) {
  const store = _storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store) return;
  store.removeItem(FOCUS_KEY);
}

// ---------------------------------------------------------------------------
// Log today's attempt
//   text  — the focus text that was attempted
//   tried — true = "Tried today", false = "Not today"
// Returns the updated log array.
// ---------------------------------------------------------------------------
function logFocusAttempt(text, tried, _storage, _now) {
  const store = _storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store) return [];
  const date = _todayISO(_now);
  let log = [];
  try { log = JSON.parse(store.getItem(FOCUS_LOG_KEY) || '[]'); } catch {}
  if (!Array.isArray(log)) log = [];
  // Replace any existing entry for today (idempotent per day)
  log = log.filter(function(e) { return e.date !== date; });
  log.push({ date: date, text: String(text || '').trim(), tried: Boolean(tried) });
  // Trim to max
  if (log.length > MAX_LOG) log = log.slice(-MAX_LOG);
  store.setItem(FOCUS_LOG_KEY, JSON.stringify(log));
  return log;
}

// ---------------------------------------------------------------------------
// Get full focus log → array of { date, text, tried }
// Never throws.
// ---------------------------------------------------------------------------
function getFocusLog(_storage) {
  const store = _storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store) return [];
  try {
    const raw = store.getItem(FOCUS_LOG_KEY);
    if (!raw) return [];
    const log = JSON.parse(raw);
    return Array.isArray(log) ? log : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Check whether today has already been logged (avoid double-logging)
// ---------------------------------------------------------------------------
function hasTodayLog(_storage, _now) {
  const store = _storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  const date = _todayISO(_now);
  const log = getFocusLog(store);
  return log.some(function(e) { return e.date === date; });
}

// ---------------------------------------------------------------------------
// Summary of how many times a focus text was tried vs skipped
// ---------------------------------------------------------------------------
function getFocusSummary(text, _storage) {
  const store = _storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  const log = getFocusLog(store);
  const target = String(text || '').trim();
  const relevant = log.filter(function(e) { return e.text === target; });
  const tried   = relevant.filter(function(e) { return e.tried; }).length;
  const skipped = relevant.filter(function(e) { return !e.tried; }).length;
  return { tried: tried, skipped: skipped, total: relevant.length };
}

// ---------------------------------------------------------------------------
// Safety gate — validate focus text against forbidden medical/imperative words
// ---------------------------------------------------------------------------
const FORBIDDEN_FOCUS_WORDS = [
  'diagnose', 'diagnoses', 'diagnosed', 'diagnosis',
  'treat', 'treatment', 'treating', 'treated',
  'cure', 'cures', 'cured',
  'prevent', 'prevents', 'prevention', 'preventing',
  'fix ', 'fixes ', 'fixing ', 'fixed ',   // trailing space avoids "prefix"
  'improve your condition',
  'reduce risk', 'reduces risk',
  'heart attack', 'cardiac arrest',
  'emergency', 'call 999', 'call 911',
];

function validateFocusText(text) {
  const lower = String(text || '').toLowerCase();
  const violations = FORBIDDEN_FOCUS_WORDS.filter(function(w) {
    return lower.includes(w);
  });
  return { valid: violations.length === 0, violations: violations };
}

// ---------------------------------------------------------------------------
// Safe default focus suggestions (validated internally)
// Used as fallback when B45 reflection hasn't run yet.
// ---------------------------------------------------------------------------
const SAFE_DEFAULT_FOCUSES = [
  'Notice how you feel after a more consistent wind-down time this week.',
  'Choose one lighter day if you feel less recharged than usual.',
  'Keep your next check-in simple — even partial data helps build your reflection.',
  'Notice how your energy feels across different sleep windows this week.',
  'Log one extra check-in to help BALA learn your usual pattern.',
];

// ---------------------------------------------------------------------------
module.exports = {
  setActiveFocus,
  getActiveFocus,
  dismissFocus,
  logFocusAttempt,
  getFocusLog,
  hasTodayLog,
  getFocusSummary,
  validateFocusText,
  FOCUS_KEY,
  FOCUS_LOG_KEY,
  MAX_LOG,
  FORBIDDEN_FOCUS_WORDS,
  SAFE_DEFAULT_FOCUSES,
};
