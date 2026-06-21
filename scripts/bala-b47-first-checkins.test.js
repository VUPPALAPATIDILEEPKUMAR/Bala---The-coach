'use strict';
// =============================================================================
// BALA-B47 First Three Check-ins Journey — Test Suite
// Tests bala-first-checkins-engine.js (CommonJS, no DOM, no network)
// =============================================================================

const {
  countRealCheckins,
  getJourneyState,
  getJourneyMessage,
  isJourneyDismissed,
  dismissJourney,
  computeJourneyCard,
  JOURNEY_DISMISSED_KEY,
  JOURNEY_MESSAGES,
} = require('./bala-first-checkins-engine.js');

let passed = 0;
let failed = 0;

function assert(label, condition, detail) {
  if (condition) {
    console.log('  ✓', label);
    passed++;
  } else {
    console.error('  ✗', label, detail !== undefined ? '→ ' + JSON.stringify(detail) : '');
    failed++;
  }
}

function makeMock() {
  const map = new Map();
  return {
    getItem(k)    { return map.has(k) ? map.get(k) : null; },
    setItem(k, v) { map.set(k, v); },
    removeItem(k) { map.delete(k); },
    clear()       { map.clear(); },
  };
}

// Sample check-in objects
const REAL_1 = { source: 'manual', hrv: 52, sleep: 7.2 };
const REAL_2 = { source: 'Apple Health', hrv: 55, sleep: 7.5 };
const REAL_3 = { source: 'apple', hrv: 60, sleep: 8 };
const DEMO_1 = { source: 'demo', hrv: 65, sleep: 8 };
const DEMO_2 = { source: 'Demo Mode', hrv: 70, sleep: 7 };
const DEMO_3 = { source: 'DEMO', hrv: 68, sleep: 7.5 };
const NO_SRC = { hrv: 50, sleep: 7 }; // no source field → treated as real

// ---------------------------------------------------------------------------
// Suite 1: countRealCheckins
// ---------------------------------------------------------------------------
console.log('\nSuite 1: countRealCheckins');
assert('empty array → 0', countRealCheckins([]) === 0);
assert('null → 0', countRealCheckins(null) === 0);
assert('undefined → 0', countRealCheckins(undefined) === 0);
assert('non-array → 0', countRealCheckins('not an array') === 0);
assert('1 real → 1', countRealCheckins([REAL_1]) === 1);
assert('2 real → 2', countRealCheckins([REAL_1, REAL_2]) === 2);
assert('3 real → 3', countRealCheckins([REAL_1, REAL_2, REAL_3]) === 3);
assert('demo only → 0', countRealCheckins([DEMO_1]) === 0);
assert('all demos → 0', countRealCheckins([DEMO_1, DEMO_2, DEMO_3]) === 0);
assert('mixed: 2 real + 1 demo → 2', countRealCheckins([REAL_1, DEMO_1, REAL_2]) === 2);
assert('no source field → counts as real', countRealCheckins([NO_SRC]) === 1);
assert('empty source string → counts as real', countRealCheckins([{ source: '' }]) === 1);
assert('Demo (capital D) filtered', countRealCheckins([DEMO_2]) === 0, DEMO_2.source);
assert('DEMO (all caps) filtered', countRealCheckins([DEMO_3]) === 0, DEMO_3.source);
assert('5 real + 3 demo → 5', countRealCheckins([REAL_1, DEMO_1, REAL_2, DEMO_2, REAL_3, DEMO_3, REAL_1, REAL_2]) === 5);

// ---------------------------------------------------------------------------
// Suite 2: getJourneyState
// ---------------------------------------------------------------------------
console.log('\nSuite 2: getJourneyState');
assert('0 → none',     getJourneyState(0) === 'none');
assert('1 → one',      getJourneyState(1) === 'one');
assert('2 → two',      getJourneyState(2) === 'two');
assert('3 → complete', getJourneyState(3) === 'complete');
assert('4 → complete', getJourneyState(4) === 'complete');
assert('10 → complete', getJourneyState(10) === 'complete');
assert('-1 → none (clamped)', getJourneyState(-1) === 'none');
assert('null → none', getJourneyState(null) === 'none');
assert('NaN → none',  getJourneyState(NaN) === 'none');

// ---------------------------------------------------------------------------
// Suite 3: getJourneyMessage
// ---------------------------------------------------------------------------
console.log('\nSuite 3: getJourneyMessage');
{
  const msg = getJourneyMessage('none');
  assert('none: returns object', msg !== null && typeof msg === 'object');
  assert('none: has heading', typeof msg.heading === 'string' && msg.heading.length > 0);
  assert('none: has copy', typeof msg.copy === 'string' && msg.copy.length > 0);
  assert('none: progress=0', msg.progress === 0);
  assert('none: total=3', msg.total === 3);
  assert('none: showProgress=true', msg.showProgress === true);
}
{
  const msg = getJourneyMessage('one');
  assert('one: progress=1', msg.progress === 1);
  assert('one: total=3', msg.total === 3);
  assert('one: copy mentions 1 of 3', msg.copy.includes('1 of 3') || msg.copy.includes('1'));
}
{
  const msg = getJourneyMessage('two');
  assert('two: progress=2', msg.progress === 2);
  assert('two: total=3', msg.total === 3);
  assert('two: copy mentions 2 of 3', msg.copy.includes('2 of 3') || msg.copy.includes('2'));
}
assert('complete → null', getJourneyMessage('complete') === null);
assert('unknown state → null', getJourneyMessage('bogus') === null);

// ---------------------------------------------------------------------------
// Suite 4: Message copy safety check (no medical claims)
// ---------------------------------------------------------------------------
console.log('\nSuite 4: Copy safety');
const FORBIDDEN = ['diagnose', 'diagnoses', 'treat', 'cure', 'prevent', 'cardiac arrest', 'heart attack', 'emergency', 'call 999', 'call 911'];
for (const [state, msg] of Object.entries(JOURNEY_MESSAGES)) {
  const combined = (msg.heading + ' ' + msg.copy).toLowerCase();
  for (const word of FORBIDDEN) {
    assert(state + ': no "' + word + '" in copy', !combined.includes(word));
  }
  assert(state + ': copy does not promise outcomes', !combined.includes('will improve') && !combined.includes('will reduce') && !combined.includes('will fix'));
}

// ---------------------------------------------------------------------------
// Suite 5: isJourneyDismissed / dismissJourney
// ---------------------------------------------------------------------------
console.log('\nSuite 5: isJourneyDismissed / dismissJourney');
{
  const s = makeMock();
  assert('not dismissed initially', isJourneyDismissed(s) === false);
  dismissJourney(s);
  assert('dismissed after call', isJourneyDismissed(s) === true);
}
{
  const s = makeMock();
  s.setItem(JOURNEY_DISMISSED_KEY, '0');
  assert('"0" → not dismissed', isJourneyDismissed(s) === false);
}
{
  const s = makeMock();
  s.setItem(JOURNEY_DISMISSED_KEY, '1');
  assert('"1" pre-set → dismissed', isJourneyDismissed(s) === true);
}
{
  // null storage: should not throw
  assert('null storage → not dismissed', isJourneyDismissed(null) === false);
}

// ---------------------------------------------------------------------------
// Suite 6: computeJourneyCard
// ---------------------------------------------------------------------------
console.log('\nSuite 6: computeJourneyCard');
{
  // Demo mode always returns null
  const s = makeMock();
  assert('demo mode → null', computeJourneyCard([REAL_1, REAL_2], true, s) === null);
  assert('demo mode + 0 checkins → null', computeJourneyCard([], true, s) === null);
}
{
  // Dismissed → null regardless of count
  const s = makeMock();
  dismissJourney(s);
  assert('dismissed + 0 checkins → null', computeJourneyCard([], false, s) === null);
  assert('dismissed + 1 checkin → null', computeJourneyCard([REAL_1], false, s) === null);
}
{
  // Active (not demo, not dismissed)
  const s = makeMock();
  const r0 = computeJourneyCard([], false, s);
  assert('0 checkins → message returned', r0 !== null);
  assert('0 checkins → progress=0', r0 && r0.progress === 0);

  const r1 = computeJourneyCard([REAL_1], false, s);
  assert('1 real checkin → message returned', r1 !== null);
  assert('1 real checkin → progress=1', r1 && r1.progress === 1);

  const r2 = computeJourneyCard([REAL_1, REAL_2], false, s);
  assert('2 real checkins → message returned', r2 !== null);
  assert('2 real checkins → progress=2', r2 && r2.progress === 2);

  const r3 = computeJourneyCard([REAL_1, REAL_2, REAL_3], false, s);
  assert('3 real checkins → null (complete)', r3 === null);

  const r4 = computeJourneyCard([REAL_1, REAL_2, REAL_3, REAL_1], false, s);
  assert('4 real checkins → null (complete)', r4 === null);
}
{
  // Demo check-ins don't count
  const s = makeMock();
  const result = computeJourneyCard([DEMO_1, DEMO_2, DEMO_3, REAL_1], false, s);
  assert('3 demo + 1 real → progress=1', result !== null && result.progress === 1);
}
{
  // Mix of real + demo reaching 3
  const s = makeMock();
  const result = computeJourneyCard([REAL_1, DEMO_1, REAL_2, DEMO_2, REAL_3], false, s);
  assert('3 real + 2 demo → null (complete)', result === null);
}
{
  // No source field: counts as real
  const s = makeMock();
  const result = computeJourneyCard([NO_SRC], false, s);
  assert('no source field counts as real → progress=1', result !== null && result.progress === 1);
}
{
  // null history
  const s = makeMock();
  const result = computeJourneyCard(null, false, s);
  assert('null history → shows none state', result !== null && result.progress === 0);
}

// ---------------------------------------------------------------------------
// Suite 7: JOURNEY_DISMISSED_KEY export
// ---------------------------------------------------------------------------
console.log('\nSuite 7: Exports');
assert('JOURNEY_DISMISSED_KEY is string', typeof JOURNEY_DISMISSED_KEY === 'string' && JOURNEY_DISMISSED_KEY.length > 0);
assert('JOURNEY_MESSAGES is object', JOURNEY_MESSAGES !== null && typeof JOURNEY_MESSAGES === 'object');
assert('JOURNEY_MESSAGES.none exists', !!JOURNEY_MESSAGES.none);
assert('JOURNEY_MESSAGES.one exists',  !!JOURNEY_MESSAGES.one);
assert('JOURNEY_MESSAGES.two exists',  !!JOURNEY_MESSAGES.two);
assert('JOURNEY_MESSAGES has no complete key', !JOURNEY_MESSAGES.complete);

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n' + '─'.repeat(55));
console.log('BALA-B47 First Check-ins tests: ' + (passed + failed) + ' total');
console.log(passed + ' passed  ·  ' + failed + ' failed');
if (failed === 0) {
  console.log('PASS bala-b47-first-checkins.test.js');
  process.exit(0);
} else {
  console.error('FAIL bala-b47-first-checkins.test.js');
  process.exit(1);
}
