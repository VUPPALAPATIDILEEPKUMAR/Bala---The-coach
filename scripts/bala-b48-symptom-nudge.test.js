'use strict';
// =============================================================================
// BALA-B48 Symptom Nudge — Test Suite
// Tests bala-symptom-nudge-engine.js (CommonJS, no DOM, no network)
// =============================================================================

const {
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
} = require('./bala-symptom-nudge-engine.js');

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

const NOW_A = new Date('2024-06-20T10:00:00Z').getTime(); // 2024-06-20
const NOW_B = new Date('2024-06-21T10:00:00Z').getTime(); // 2024-06-21 (next day)

// ---------------------------------------------------------------------------
// Suite 1: todayString
// ---------------------------------------------------------------------------
console.log('\nSuite 1: todayString');
assert('returns YYYY-MM-DD format', /^\d{4}-\d{2}-\d{2}$/.test(todayString(NOW_A)));
assert('specific date 2024-06-20', todayString(NOW_A) === '2024-06-20');
assert('specific date 2024-06-21', todayString(NOW_B) === '2024-06-21');
assert('no _now → returns string', typeof todayString() === 'string' && todayString().length === 10);

// ---------------------------------------------------------------------------
// Suite 2: hasNudgedToday
// ---------------------------------------------------------------------------
console.log('\nSuite 2: hasNudgedToday');
{
  const s = makeMock();
  assert('fresh storage → false', hasNudgedToday(s, NOW_A) === false);
  s.setItem(NUDGE_DATE_KEY, '2024-06-20');
  assert('date matches → true', hasNudgedToday(s, NOW_A) === true);
  assert('different day → false', hasNudgedToday(s, NOW_B) === false);
}
{
  assert('null storage → false (no throw)', hasNudgedToday(null, NOW_A) === false);
}

// ---------------------------------------------------------------------------
// Suite 3: recordNudge
// ---------------------------------------------------------------------------
console.log('\nSuite 3: recordNudge');
{
  const s = makeMock();
  recordNudge('tired', s, NOW_A);
  assert('sets NUDGE_DATE_KEY to today', s.getItem(NUDGE_DATE_KEY) === '2024-06-20');
  const log = JSON.parse(s.getItem(NUDGE_LOG_KEY));
  assert('appends entry to log', Array.isArray(log) && log.length === 1);
  assert('log entry has date', log[0].date === '2024-06-20');
  assert('log entry has chipId', log[0].chipId === 'tired');
}
{
  // Same day: dedup — only one entry per day
  const s = makeMock();
  recordNudge('tired', s, NOW_A);
  recordNudge('calm', s, NOW_A);
  const log = JSON.parse(s.getItem(NUDGE_LOG_KEY));
  assert('same-day dedup → 1 entry', log.length === 1);
  assert('second record wins', log[0].chipId === 'calm');
}
{
  // Different days: both kept
  const s = makeMock();
  recordNudge('tired', s, NOW_A);
  recordNudge('energised', s, NOW_B);
  const log = JSON.parse(s.getItem(NUDGE_LOG_KEY));
  assert('two days → 2 entries', log.length === 2);
}
{
  // 'skip' is a valid chipId
  const s = makeMock();
  recordNudge('skip', s, NOW_A);
  const log = JSON.parse(s.getItem(NUDGE_LOG_KEY));
  assert('skip is recordable', log[0].chipId === 'skip');
}
{
  // Empty chipId should throw
  let threw = false;
  try { recordNudge('', makeMock(), NOW_A); } catch(e) { threw = true; }
  assert('empty chipId throws', threw);
}
{
  // null chipId should throw
  let threw = false;
  try { recordNudge(null, makeMock(), NOW_A); } catch(e) { threw = true; }
  assert('null chipId throws', threw);
}

// ---------------------------------------------------------------------------
// Suite 4: NUDGE_MAX_LOG trim
// ---------------------------------------------------------------------------
console.log('\nSuite 4: NUDGE_MAX_LOG trim');
{
  const s = makeMock();
  // Pre-fill log with NUDGE_MAX_LOG entries
  const existing = [];
  for (let i = 0; i < NUDGE_MAX_LOG; i++) {
    existing.push({ date: `2023-01-${String(i + 1).padStart(2,'0')}`, chipId: 'calm' });
  }
  s.setItem(NUDGE_LOG_KEY, JSON.stringify(existing));
  // Add one more
  recordNudge('tired', s, NOW_A);
  const log = JSON.parse(s.getItem(NUDGE_LOG_KEY));
  assert('log trimmed to NUDGE_MAX_LOG', log.length === NUDGE_MAX_LOG);
  assert('newest entry kept', log[log.length - 1].chipId === 'tired');
}

// ---------------------------------------------------------------------------
// Suite 5: getNudgeLog
// ---------------------------------------------------------------------------
console.log('\nSuite 5: getNudgeLog');
{
  const s = makeMock();
  assert('empty storage → []', Array.isArray(getNudgeLog(s)) && getNudgeLog(s).length === 0);
  recordNudge('sore', s, NOW_A);
  assert('returns 1 entry after record', getNudgeLog(s).length === 1);
  assert('null storage → [] (no throw)', Array.isArray(getNudgeLog(null)) && getNudgeLog(null).length === 0);
}
{
  // Corrupt JSON → returns []
  const s = makeMock();
  s.setItem(NUDGE_LOG_KEY, 'not json');
  assert('corrupt JSON → []', getNudgeLog(s).length === 0);
}

// ---------------------------------------------------------------------------
// Suite 6: shouldShowNudge
// ---------------------------------------------------------------------------
console.log('\nSuite 6: shouldShowNudge');
{
  const s = makeMock();
  assert('fresh + not demo → true', shouldShowNudge(false, s, NOW_A) === true);
  assert('demo mode → false', shouldShowNudge(true, s, NOW_A) === false);
}
{
  const s = makeMock();
  recordNudge('tired', s, NOW_A);
  assert('already nudged today → false', shouldShowNudge(false, s, NOW_A) === false);
  assert('next day → true again', shouldShowNudge(false, s, NOW_B) === true);
}
{
  assert('null storage + not demo → true', shouldShowNudge(false, null, NOW_A) === true);
}

// ---------------------------------------------------------------------------
// Suite 7: validateChipId
// ---------------------------------------------------------------------------
console.log('\nSuite 7: validateChipId');
NUDGE_CHIPS.forEach(function(chip) {
  const r = validateChipId(chip.id);
  assert(chip.id + ': valid=true, known=true', r.valid === true && r.known === true);
});
{
  const r = validateChipId('skip');
  assert('skip: valid=true, known=true', r.valid === true && r.known === true);
}
{
  const r = validateChipId('unknown-chip');
  assert('unknown string: valid=true, known=false', r.valid === true && r.known === false);
}
{
  const r = validateChipId('');
  assert('empty string: valid=false', r.valid === false);
}
{
  const r = validateChipId(null);
  assert('null: valid=false', r.valid === false);
}
{
  const r = validateChipId(42);
  assert('number: valid=false', r.valid === false);
}

// ---------------------------------------------------------------------------
// Suite 8: NUDGE_CHIPS structure
// ---------------------------------------------------------------------------
console.log('\nSuite 8: NUDGE_CHIPS structure');
assert('NUDGE_CHIPS is array', Array.isArray(NUDGE_CHIPS));
assert('has 6 chips', NUDGE_CHIPS.length === 6);
NUDGE_CHIPS.forEach(function(chip) {
  assert(chip.id + ': has id', typeof chip.id === 'string' && chip.id.length > 0);
  assert(chip.id + ': has label', typeof chip.label === 'string' && chip.label.length > 0);
  assert(chip.id + ': has emoji', typeof chip.emoji === 'string' && chip.emoji.length > 0);
});

// ---------------------------------------------------------------------------
// Suite 9: Copy safety (no medical claims in labels or ack)
// ---------------------------------------------------------------------------
console.log('\nSuite 9: Copy safety');
const FORBIDDEN = ['diagnose', 'diagnoses', 'treat', 'cure', 'prevent', 'cardiac arrest',
  'heart attack', 'emergency', 'call 999', 'call 911', 'will improve', 'will reduce', 'will fix'];

const allCopy = NUDGE_CHIPS.map(function(c) { return c.label + ' ' + c.emoji; }).join(' ') + ' ' + NUDGE_ACK;
FORBIDDEN.forEach(function(word) {
  assert('no "' + word + '" in any chip or ack copy', !allCopy.toLowerCase().includes(word));
});

// ---------------------------------------------------------------------------
// Suite 10: Exports
// ---------------------------------------------------------------------------
console.log('\nSuite 10: Exports');
assert('NUDGE_ACK is string', typeof NUDGE_ACK === 'string' && NUDGE_ACK.length > 0);
assert('NUDGE_DATE_KEY is string', typeof NUDGE_DATE_KEY === 'string');
assert('NUDGE_LOG_KEY is string', typeof NUDGE_LOG_KEY === 'string');
assert('NUDGE_MAX_LOG is number > 0', typeof NUDGE_MAX_LOG === 'number' && NUDGE_MAX_LOG > 0);
assert('NUDGE_DATE_KEY !== NUDGE_LOG_KEY', NUDGE_DATE_KEY !== NUDGE_LOG_KEY);

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n' + '─'.repeat(55));
console.log('BALA-B48 Symptom Nudge tests: ' + (passed + failed) + ' total');
console.log(passed + ' passed  ·  ' + failed + ' failed');
if (failed === 0) {
  console.log('PASS bala-b48-symptom-nudge.test.js');
  process.exit(0);
} else {
  console.error('FAIL bala-b48-symptom-nudge.test.js');
  process.exit(1);
}
