'use strict';
// =============================================================================
// BALA-B47 First Three Check-ins Journey Engine
// Pure logic. No DOM. No network. No AI inference.
// Helps new users understand that early check-ins build their personal baseline.
//
// Safety rules:
//   - Never claim BALA will detect anything or provide health outcomes
//   - Use "notice", "pattern", "signal" — never "diagnose" or "measure risk"
//   - No fake progress for demo mode
//   - No streaks, no pressure, no guilt
// =============================================================================

var JOURNEY_DISMISSED_KEY = 'bala_journey_dismissed';

// ---------------------------------------------------------------------------
// Count real (non-demo) check-ins from history array
// history: array of check-in objects with optional .source field
// A demo check-in has source containing "demo" (case-insensitive).
// ---------------------------------------------------------------------------
function countRealCheckins(history) {
  if (!Array.isArray(history) || history.length === 0) return 0;
  var real = history.filter(function(h) {
    var src = String(h && h.source ? h.source : '').toLowerCase();
    return !src.includes('demo');
  });
  return real.length;
}

// ---------------------------------------------------------------------------
// Determine journey state from check-in count
// Returns one of: 'none' | 'one' | 'two' | 'complete'
// ---------------------------------------------------------------------------
function getJourneyState(count) {
  if (typeof count !== 'number' || isNaN(count) || count < 0) count = 0;
  if (count === 0) return 'none';
  if (count === 1) return 'one';
  if (count === 2) return 'two';
  return 'complete';
}

// ---------------------------------------------------------------------------
// Copy for each state
// Returns { heading, copy, progress, total, showProgress } or null if done.
// Returns null also when state is 'complete' — caller should hide the card.
// ---------------------------------------------------------------------------
var JOURNEY_MESSAGES = {
  none: {
    heading: 'Your BALA journey starts here',
    copy: 'Log your first check-in to start seeing your body\'s patterns. Each check-in is private and stays on this device.',
    progress: 0,
    total: 3,
    showProgress: true,
  },
  one: {
    heading: 'First check-in logged',
    copy: 'You have 1 of 3 check-ins. One more and BALA can start noticing a pattern from your data.',
    progress: 1,
    total: 3,
    showProgress: true,
  },
  two: {
    heading: 'Almost there',
    copy: 'You have 2 of 3 check-ins. One more unlocks your first weekly reflection and factor summary.',
    progress: 2,
    total: 3,
    showProgress: true,
  },
};

function getJourneyMessage(state) {
  return JOURNEY_MESSAGES[state] || null;
}

// ---------------------------------------------------------------------------
// Check whether the user has dismissed the journey card
// ---------------------------------------------------------------------------
function isJourneyDismissed(_storage) {
  var store = _storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store) return false;
  return store.getItem(JOURNEY_DISMISSED_KEY) === '1';
}

// ---------------------------------------------------------------------------
// Dismiss the journey card permanently
// ---------------------------------------------------------------------------
function dismissJourney(_storage) {
  var store = _storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store) return;
  store.setItem(JOURNEY_DISMISSED_KEY, '1');
}

// ---------------------------------------------------------------------------
// Main entry point — returns null to hide, or message object to show.
// history: array of check-in objects
// isDemoMode: true when showing demo data (hide journey card)
// _storage: injectable localStorage for tests
// ---------------------------------------------------------------------------
function computeJourneyCard(history, isDemoMode, _storage) {
  // Never show journey card in demo mode
  if (isDemoMode) return null;

  // Never show if dismissed
  if (isJourneyDismissed(_storage)) return null;

  var count = countRealCheckins(history);
  var state = getJourneyState(count);

  // Journey complete — hide the card
  if (state === 'complete') return null;

  return getJourneyMessage(state);
}

// ---------------------------------------------------------------------------
module.exports = {
  countRealCheckins,
  getJourneyState,
  getJourneyMessage,
  isJourneyDismissed,
  dismissJourney,
  computeJourneyCard,
  JOURNEY_DISMISSED_KEY,
  JOURNEY_MESSAGES,
};
