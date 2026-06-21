'use strict';
// =============================================================================
// BALA-B46 Weekly Focus Engine — Test Suite
// Tests bala-weekly-focus-engine.js (CommonJS, no DOM, no network)
// =============================================================================

const {
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
} = require('./bala-weekly-focus-engine.js');

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

// ---------------------------------------------------------------------------
// Mock localStorage (Map-backed, same interface as real browser)
// ---------------------------------------------------------------------------
function makeMock() {
  const map = new Map();
  return {
    getItem(k)    { return map.has(k) ? map.get(k) : null; },
    setItem(k, v) { map.set(k, v); },
    removeItem(k) { map.delete(k); },
    clear()       { map.clear(); },
    _map: map,
  };
}

const NOW = new Date('2024-06-20T12:00:00Z').getTime(); // deterministic
const TODAY = '2024-06-20';
const YESTERDAY = '2024-06-19';

// ---------------------------------------------------------------------------
// Suite 1: setActiveFocus
// ---------------------------------------------------------------------------
console.log('\nSuite 1: setActiveFocus');
{
  const s = makeMock();
  const result = setActiveFocus('Notice how you feel after a consistent wind-down.', s, NOW);
  assert('returns object with text', typeof result === 'object' && result.text !== undefined);
  assert('text is trimmed', result.text === 'Notice how you feel after a consistent wind-down.');
  assert('acceptedDate is TODAY', result.acceptedDate === TODAY);
  assert('stored in mock storage', s.getItem(FOCUS_KEY) !== null);
}
{
  const s = makeMock();
  try {
    setActiveFocus('', s, NOW);
    assert('throws on empty text', false);
  } catch (e) {
    assert('throws on empty text', true);
  }
}
{
  const s = makeMock();
  try {
    setActiveFocus('   ', s, NOW);
    assert('throws on whitespace-only text', false);
  } catch (e) {
    assert('throws on whitespace-only text', true);
  }
}
{
  const s = makeMock();
  setActiveFocus('First focus.', s, NOW);
  setActiveFocus('Second focus.', s, NOW);
  const stored = JSON.parse(s.getItem(FOCUS_KEY));
  assert('second set replaces first (one focus only)', stored.text === 'Second focus.');
}

// ---------------------------------------------------------------------------
// Suite 2: getActiveFocus
// ---------------------------------------------------------------------------
console.log('\nSuite 2: getActiveFocus');
{
  const s = makeMock();
  assert('returns null when empty', getActiveFocus(s) === null);
}
{
  const s = makeMock();
  setActiveFocus('Keep an eye on sleep timing.', s, NOW);
  const f = getActiveFocus(s);
  assert('returns focus object', f !== null);
  assert('text matches', f.text === 'Keep an eye on sleep timing.');
  assert('acceptedDate present', typeof f.acceptedDate === 'string');
}
{
  const s = makeMock();
  s.setItem(FOCUS_KEY, 'broken json{{{{');
  assert('corrupt JSON → returns null', getActiveFocus(s) === null);
}
{
  const s = makeMock();
  s.setItem(FOCUS_KEY, JSON.stringify({ text: '', acceptedDate: TODAY }));
  assert('empty text → returns null', getActiveFocus(s) === null);
}
{
  const s = makeMock();
  s.setItem(FOCUS_KEY, JSON.stringify({ text: '   ', acceptedDate: TODAY }));
  assert('whitespace-only text → returns null', getActiveFocus(s) === null);
}

// ---------------------------------------------------------------------------
// Suite 3: dismissFocus
// ---------------------------------------------------------------------------
console.log('\nSuite 3: dismissFocus');
{
  const s = makeMock();
  setActiveFocus('Notice hydration patterns.', s, NOW);
  dismissFocus(s);
  assert('focus cleared after dismiss', getActiveFocus(s) === null);
}
{
  const s = makeMock();
  dismissFocus(s); // dismiss with nothing set — must not throw
  assert('dismiss on empty storage does not throw', true);
}

// ---------------------------------------------------------------------------
// Suite 4: logFocusAttempt
// ---------------------------------------------------------------------------
console.log('\nSuite 4: logFocusAttempt');
{
  const s = makeMock();
  const log = logFocusAttempt('My focus', true, s, NOW);
  assert('log is array', Array.isArray(log));
  assert('one entry', log.length === 1);
  assert('date is today', log[0].date === TODAY);
  assert('tried=true recorded', log[0].tried === true);
  assert('text recorded', log[0].text === 'My focus');
}
{
  const s = makeMock();
  logFocusAttempt('My focus', false, s, NOW);
  assert('tried=false recorded', getFocusLog(s)[0].tried === false);
}
{
  const s = makeMock();
  logFocusAttempt('My focus', true, s, NOW);
  logFocusAttempt('My focus', false, s, NOW); // same day, overrides
  const log = getFocusLog(s);
  assert('second log on same day replaces first', log.length === 1);
  assert('override value is false (latest wins)', log[0].tried === false);
}
{
  const s = makeMock();
  for (let i = 0; i < MAX_LOG + 5; i++) {
    const d = new Date(NOW - (MAX_LOG + 5 - i) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    logFocusAttempt('focus', true, s, new Date(d + 'T12:00:00Z').getTime());
  }
  const log = getFocusLog(s);
  assert('log never exceeds MAX_LOG', log.length <= MAX_LOG, log.length);
}

// ---------------------------------------------------------------------------
// Suite 5: getFocusLog
// ---------------------------------------------------------------------------
console.log('\nSuite 5: getFocusLog');
{
  const s = makeMock();
  assert('empty log returns []', Array.isArray(getFocusLog(s)) && getFocusLog(s).length === 0);
}
{
  const s = makeMock();
  s.setItem(FOCUS_LOG_KEY, 'corrupt{{{');
  assert('corrupt JSON returns []', Array.isArray(getFocusLog(s)) && getFocusLog(s).length === 0);
}
{
  const s = makeMock();
  s.setItem(FOCUS_LOG_KEY, '"not-an-array"');
  assert('non-array JSON returns []', getFocusLog(s).length === 0);
}

// ---------------------------------------------------------------------------
// Suite 6: hasTodayLog
// ---------------------------------------------------------------------------
console.log('\nSuite 6: hasTodayLog');
{
  const s = makeMock();
  assert('no log → false', hasTodayLog(s, NOW) === false);
}
{
  const s = makeMock();
  logFocusAttempt('focus', true, s, NOW);
  assert('after log today → true', hasTodayLog(s, NOW) === true);
}
{
  const s = makeMock();
  logFocusAttempt('focus', true, s, NOW - 24 * 60 * 60 * 1000);
  assert('log from yesterday → false', hasTodayLog(s, NOW) === false);
}

// ---------------------------------------------------------------------------
// Suite 7: getFocusSummary
// ---------------------------------------------------------------------------
console.log('\nSuite 7: getFocusSummary');
{
  const s = makeMock();
  const focus = 'Notice sleep consistency.';
  const d1 = new Date(NOW - 3 * 86400000).getTime();
  const d2 = new Date(NOW - 2 * 86400000).getTime();
  const d3 = new Date(NOW - 1 * 86400000).getTime();
  logFocusAttempt(focus, true,  s, d1);
  logFocusAttempt(focus, false, s, d2);
  logFocusAttempt(focus, true,  s, d3);
  const summary = getFocusSummary(focus, s);
  assert('total=3', summary.total === 3, summary);
  assert('tried=2', summary.tried === 2, summary);
  assert('skipped=1', summary.skipped === 1, summary);
}
{
  const s = makeMock();
  logFocusAttempt('other focus', true, s, NOW);
  const summary = getFocusSummary('My focus', s);
  assert('different text → total=0', summary.total === 0);
}
{
  const s = makeMock();
  const summary = getFocusSummary('', s);
  assert('empty text → total=0 (no crash)', summary.total === 0);
}

// ---------------------------------------------------------------------------
// Suite 8: validateFocusText — safe copy passes
// ---------------------------------------------------------------------------
console.log('\nSuite 8: validateFocusText — safe copy');
const safeCopies = [
  'Notice how you feel after a more consistent wind-down time this week.',
  'Choose one lighter day if you feel less recharged than usual.',
  'Keep your next check-in simple — even partial data helps build your reflection.',
  'Log one extra check-in to help BALA learn your usual pattern.',
  'HRV trended upward. Rest and hydration often support this over time.',
  'Sleep varied this week. Worth noticing your usual wind-down time.',
  'Try a slightly earlier wind-down on two nights.',
];
for (const copy of safeCopies) {
  const result = validateFocusText(copy);
  assert('safe: "' + copy.slice(0, 50) + '…"', result.valid, result.violations);
}

// ---------------------------------------------------------------------------
// Suite 9: validateFocusText — forbidden copy fails
// ---------------------------------------------------------------------------
console.log('\nSuite 9: validateFocusText — forbidden medical copy');
const forbiddenCopies = [
  'This will cure your sleep problems.',
  'BALA will diagnose your condition.',
  'We can prevent heart attacks with this.',
  'Use this to treat your high heart rate.',
  'Fix your HRV with this suggestion.',
  'This reduces risk of cardiac events.',
  'In an emergency, call 999.',
  'This will improve your condition.',
];
for (const copy of forbiddenCopies) {
  const result = validateFocusText(copy);
  assert('forbidden: "' + copy.slice(0, 45) + '…"', !result.valid);
}

// ---------------------------------------------------------------------------
// Suite 10: SAFE_DEFAULT_FOCUSES all pass validation
// ---------------------------------------------------------------------------
console.log('\nSuite 10: SAFE_DEFAULT_FOCUSES all pass validation');
assert('SAFE_DEFAULT_FOCUSES is array', Array.isArray(SAFE_DEFAULT_FOCUSES));
assert('at least 3 defaults', SAFE_DEFAULT_FOCUSES.length >= 3);
for (const f of SAFE_DEFAULT_FOCUSES) {
  const r = validateFocusText(f);
  assert('default focus is safe: "' + f.slice(0, 50) + '…"', r.valid, r.violations);
}

// ---------------------------------------------------------------------------
// Suite 11: FORBIDDEN_FOCUS_WORDS export
// ---------------------------------------------------------------------------
console.log('\nSuite 11: FORBIDDEN_FOCUS_WORDS export');
assert('is array', Array.isArray(FORBIDDEN_FOCUS_WORDS));
assert('at least 10 entries', FORBIDDEN_FOCUS_WORDS.length >= 10);
assert('contains "diagnose"', FORBIDDEN_FOCUS_WORDS.some(w => w.includes('diagnose')));
assert('contains "treat"', FORBIDDEN_FOCUS_WORDS.some(w => w.includes('treat')));
assert('contains "cure"', FORBIDDEN_FOCUS_WORDS.some(w => w.includes('cure')));
assert('contains "prevent"', FORBIDDEN_FOCUS_WORDS.some(w => w.includes('prevent')));
assert('contains "emergency"', FORBIDDEN_FOCUS_WORDS.some(w => w.includes('emergency')));

// ---------------------------------------------------------------------------
// Suite 12: constants
// ---------------------------------------------------------------------------
console.log('\nSuite 12: Constants');
assert('FOCUS_KEY is string', typeof FOCUS_KEY === 'string' && FOCUS_KEY.length > 0);
assert('FOCUS_LOG_KEY is string', typeof FOCUS_LOG_KEY === 'string' && FOCUS_LOG_KEY.length > 0);
assert('MAX_LOG >= 30', typeof MAX_LOG === 'number' && MAX_LOG >= 30);
assert('FOCUS_KEY !== FOCUS_LOG_KEY', FOCUS_KEY !== FOCUS_LOG_KEY);

// ---------------------------------------------------------------------------
// Suite 13: Full flow — accept → log → dismiss
// ---------------------------------------------------------------------------
console.log('\nSuite 13: Full accept → log → dismiss flow');
{
  const s = makeMock();
  const TEXT = 'Notice sleep consistency this week.';

  // Accept focus
  setActiveFocus(TEXT, s, NOW);
  const active = getActiveFocus(s);
  assert('focus active after accept', active !== null && active.text === TEXT);

  // Log "tried today"
  logFocusAttempt(TEXT, true, s, NOW);
  assert('today log created', hasTodayLog(s, NOW));

  // Summary shows 1 tried
  const summ = getFocusSummary(TEXT, s);
  assert('summary: 1 tried', summ.tried === 1 && summ.total === 1);

  // Log "not today" (same day — overrides)
  logFocusAttempt(TEXT, false, s, NOW);
  const log = getFocusLog(s);
  assert('override: still 1 entry for today', log.filter(e => e.date === TODAY).length === 1);
  assert('override value is false', log.find(e => e.date === TODAY).tried === false);

  // Dismiss
  dismissFocus(s);
  assert('null after dismiss', getActiveFocus(s) === null);

  // Log persists after dismiss (history is separate from active focus)
  assert('log still has entries after dismiss', getFocusLog(s).length === 1);
}

// ---------------------------------------------------------------------------
// Suite 14: Multi-day flow
// ---------------------------------------------------------------------------
console.log('\nSuite 14: Multi-day flow');
{
  const s = makeMock();
  const TEXT = 'Notice hydration patterns.';
  const days = [
    { offset: 4, tried: true },
    { offset: 3, tried: false },
    { offset: 2, tried: true },
    { offset: 1, tried: true },
  ];
  for (const d of days) {
    logFocusAttempt(TEXT, d.tried, s, NOW - d.offset * 86400000);
  }
  const summ = getFocusSummary(TEXT, s);
  assert('total=4 across days', summ.total === 4, summ);
  assert('tried=3', summ.tried === 3, summ);
  assert('skipped=1', summ.skipped === 1, summ);
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n' + '─'.repeat(55));
console.log('BALA-B46 Weekly Focus tests: ' + (passed + failed) + ' total');
console.log(passed + ' passed  ·  ' + failed + ' failed');
if (failed === 0) {
  console.log('PASS bala-b46-weekly-focus.test.js');
  process.exit(0);
} else {
  console.error('FAIL bala-b46-weekly-focus.test.js');
  process.exit(1);
}
