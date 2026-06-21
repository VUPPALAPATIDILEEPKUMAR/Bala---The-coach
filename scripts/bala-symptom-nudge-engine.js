'use strict';
// =============================================================================
// BALA-B48 Symptom Nudge Engine
// Pure logic. No DOM. No network. No AI inference.
// Provides a gentle daily "how is your body feeling?" chip prompt.
//
// Safety rules:
//   - Chips are awareness signals only — never diagnostic categories
//   - No outcomes promised ("this will detect X", "helps prevent Y")
//   - No urgency or pressure language
//   - No streaks, no scoring of symptoms, no health risk framing
//   - Urgent symptoms handled separately by the emergency safety gate
// =============================================================================

var NUDGE_DATE_KEY  = 'bala_nudge_date';
var NUDGE_LOG_KEY   = 'bala_nudge_log';
var NUDGE_MAX_LOG   = 90; // days to keep

// ---------------------------------------------------------------------------
// Chip definitions — awareness labels only, no clinical framing
// ---------------------------------------------------------------------------
var NUDGE_CHIPS = [
  { id: 'tired',      label: 'Tired',              emoji: '😴' },
  { id: 'stressed',   label: 'Stressed',            emoji: '😤' },
  { id: 'calm',       label: 'Calm',                emoji: '😌' },
  { id: 'energised',  label: 'Energised',           emoji: '💪' },
  { id: 'unwell',     label: 'Under the weather',   emoji: '🤒' },
  { id: 'sore',       label: 'Sore or achy',        emoji: '🤕' },
];

// ---------------------------------------------------------------------------
// Acknowledgement copy shown after a chip is tapped.
// Warm, non-medical, privacy-respecting.
// ---------------------------------------------------------------------------
var NUDGE_ACK = 'Noted — BALA keeps this on your device only.';

// ---------------------------------------------------------------------------
// todayString — returns "YYYY-MM-DD" in local time
// Accepts optional _now (ms timestamp) for deterministic testing.
// ---------------------------------------------------------------------------
function todayString(_now) {
  var d = _now ? new Date(_now) : new Date();
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// hasNudgedToday — true if the user already responded to the nudge today
// ---------------------------------------------------------------------------
function hasNudgedToday(_storage, _now) {
  var store = _storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store) return false;
  var saved = store.getItem(NUDGE_DATE_KEY);
  return saved === todayString(_now);
}

// ---------------------------------------------------------------------------
// recordNudge — save chipId for today; append to log
// chipId must be one of the NUDGE_CHIPS ids or 'skip'.
// ---------------------------------------------------------------------------
function recordNudge(chipId, _storage, _now) {
  if (typeof chipId !== 'string' || !chipId.trim()) {
    throw new Error('chipId must be a non-empty string');
  }
  var store = _storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store) return;

  var today = todayString(_now);
  store.setItem(NUDGE_DATE_KEY, today);

  // Append to log (deduplicated by date — only one entry per day)
  var raw = null;
  try { raw = JSON.parse(store.getItem(NUDGE_LOG_KEY)); } catch (e) {}
  var log = Array.isArray(raw) ? raw : [];

  // Remove any existing entry for today
  log = log.filter(function(e) { return e.date !== today; });

  // Append new entry
  log.push({ date: today, chipId: chipId });

  // Trim to max
  if (log.length > NUDGE_MAX_LOG) {
    log = log.slice(log.length - NUDGE_MAX_LOG);
  }

  try { store.setItem(NUDGE_LOG_KEY, JSON.stringify(log)); } catch (e) {}
}

// ---------------------------------------------------------------------------
// getNudgeLog — returns array of { date, chipId } entries, never throws
// ---------------------------------------------------------------------------
function getNudgeLog(_storage) {
  var store = _storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store) return [];
  var raw = null;
  try { raw = JSON.parse(store.getItem(NUDGE_LOG_KEY)); } catch (e) {}
  return Array.isArray(raw) ? raw : [];
}

// ---------------------------------------------------------------------------
// shouldShowNudge — master gate: returns true when the nudge prompt should render
// Conditions: not demo mode, not already nudged today.
// isDemoMode: boolean — pass true when showing demo data
// ---------------------------------------------------------------------------
function shouldShowNudge(isDemoMode, _storage, _now) {
  if (isDemoMode) return false;
  if (hasNudgedToday(_storage, _now)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// validateChipId — returns { valid, known }
// valid: chipId is a non-empty string
// known: chipId matches one of NUDGE_CHIPS or is 'skip'
// ---------------------------------------------------------------------------
function validateChipId(chipId) {
  if (typeof chipId !== 'string' || !chipId.trim()) {
    return { valid: false, known: false };
  }
  var knownIds = NUDGE_CHIPS.map(function(c) { return c.id; }).concat(['skip']);
  return { valid: true, known: knownIds.includes(chipId) };
}

// ---------------------------------------------------------------------------
module.exports = {
  todayString,
  hasNudgedToday,
  recordNudge,
  getNudgeLog,
  shouldShowNudge,
  validateChipId,
  NUDGE_CHIPS,
  NUDGE_ACK,
  NUDGE_DATE_KEY,
  NUDGE_LOG_KEY,
  NUDGE_MAX_LOG,
};
