'use strict';
// =============================================================================
// BALA-B49 Doctor-Ready Export Summary — Test Suite
// Tests bala-doctor-summary-engine.js (CommonJS, no DOM, no network)
// =============================================================================

const {
  average,
  formatDate,
  buildMetricsSummary,
  buildSymptomSection,
  buildFocusSection,
  generateSummary,
  DISCLAIMER,
} = require('./bala-doctor-summary-engine.js');

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
// Fixtures
// ---------------------------------------------------------------------------
const HISTORY_3 = [
  { date: '2026-06-10', sleep: 7.5, hrv: 42, rhr: 60, spo2: 98, steps: 8500 },
  { date: '2026-06-11', sleep: 6.0, hrv: 38, rhr: 62, spo2: 97, steps: 7200 },
  { date: '2026-06-12', sleep: 8.0, hrv: 45, rhr: 59, spo2: 99, steps: 9100 },
];
const NUDGE_LOG_3 = [
  { date: '2026-06-10', chipId: 'tired' },
  { date: '2026-06-11', chipId: 'calm' },
  { date: '2026-06-12', chipId: 'skip' },
];
const FOCUS_LOG_2 = [
  { date: '2026-06-03', text: 'Drink more water', tried: true },
  { date: '2026-06-10', text: 'Walk 10 mins after dinner', tried: false },
];

// ---------------------------------------------------------------------------
// Suite 1: average
// ---------------------------------------------------------------------------
console.log('\nSuite 1: average');
assert('empty array → null',         average([]) === null);
assert('undefined → null',           average() === null);
assert('null → null',                average(null) === null);
assert('non-array → null',           average('hello') === null);
assert('single value',               average([5]) === 5);
assert('[7,8] → 7.5',               average([7, 8]) === 7.5);
assert('rounds to 1 dp: [1,2,3]→2', average([1, 2, 3]) === 2);
assert('filters NaN/Infinity',       average([5, NaN, Infinity, 5]) === 5);
assert('mixed valid/invalid',        average([10, null, undefined, 20]) === 15);
assert('decimal precision: [7.5,6.0,8.0]', average([7.5, 6.0, 8.0]) === 7.2);

// ---------------------------------------------------------------------------
// Suite 2: formatDate
// ---------------------------------------------------------------------------
console.log('\nSuite 2: formatDate');
assert('non-string → ""',          formatDate(123) === '');
assert('null → ""',                formatDate(null) === '');
assert('2026-06-10 → "10 Jun 2026"', formatDate('2026-06-10') === '10 Jun 2026');
assert('2026-01-01 → "1 Jan 2026"',  formatDate('2026-01-01') === '1 Jan 2026');
assert('2024-12-31 → "31 Dec 2024"', formatDate('2024-12-31') === '31 Dec 2024');
assert('bad format → returns input',  formatDate('not-a-date') === 'not-a-date');
assert('too many parts → returns input', formatDate('2026-06-10-extra') === '2026-06-10-extra');

// ---------------------------------------------------------------------------
// Suite 3: buildMetricsSummary
// ---------------------------------------------------------------------------
console.log('\nSuite 3: buildMetricsSummary');
{
  const r = buildMetricsSummary([]);
  assert('empty → fallback message', r.includes('No check-in data') || r.includes('No check-in'));
}
{
  const r = buildMetricsSummary(null);
  assert('null → fallback message', r.includes('No check-in data') || r.includes('No check-in'));
}
{
  const r = buildMetricsSummary(HISTORY_3);
  assert('contains date range',   r.includes('10 Jun 2026') && r.includes('12 Jun 2026'));
  assert('contains total count',  r.includes('3'));
  assert('contains avg sleep',    r.includes('7.2'));       // (7.5+6+8)/3=7.2
  assert('contains avg HRV',      r.includes('41.7'));      // (42+38+45)/3=41.7
  assert('contains avg RHR',      r.includes('bpm'));
  assert('contains avg SpO₂',     r.includes('%'));
  assert('contains daily steps',  r.includes('steps'));
}
{
  // History with only sleep values — other signals are undefined
  const sparse = [{ date: '2026-06-01', sleep: 7.0 }];
  const r = buildMetricsSummary(sparse);
  assert('partial metrics: still shows sleep', r.includes('7') && r.includes('Sleep'));
}
{
  // No numeric signals at all
  const noNums = [{ date: '2026-06-01' }];
  const r = buildMetricsSummary(noNums);
  assert('no numeric signals → says so', r.includes('No numeric signals') || r.includes('(No numeric'));
}

// ---------------------------------------------------------------------------
// Suite 4: buildSymptomSection
// ---------------------------------------------------------------------------
console.log('\nSuite 4: buildSymptomSection');
{
  const r = buildSymptomSection(null);
  assert('null log → fallback', r.includes('No symptom check-ins'));
}
{
  const r = buildSymptomSection([]);
  assert('empty log → fallback', r.includes('No symptom check-ins'));
}
{
  // All entries are 'skip' — no real signals
  const skipOnly = [{ date: '2026-06-12', chipId: 'skip' }];
  const r = buildSymptomSection(skipOnly);
  assert('skip-only within window → fallback', r.includes('No symptom check-ins'));
}
{
  // Old entries outside the 14-day window
  const old = [{ date: '2020-01-01', chipId: 'tired' }];
  const r = buildSymptomSection(old);
  assert('old entries outside window → fallback', r.includes('No symptom check-ins'));
}
{
  // Real recent entries
  const recent = [
    { date: new Date(Date.now() - 2*24*60*60*1000).toISOString().slice(0,10), chipId: 'calm' },
    { date: new Date(Date.now() - 1*24*60*60*1000).toISOString().slice(0,10), chipId: 'tired' },
    { date: new Date(Date.now() - 1*24*60*60*1000).toISOString().slice(0,10), chipId: 'skip' }, // same day, would be deduped by engine normally
  ];
  const r = buildSymptomSection(recent);
  assert('recent entries → shows chip counts', r.includes('calm') && r.includes('tired'));
  assert('skip entries excluded from counts', !r.includes('skip'));
}
{
  const r = buildSymptomSection(null, 7);
  assert('custom days param reflected in message', r.includes('7 days'));
}

// ---------------------------------------------------------------------------
// Suite 5: buildFocusSection
// ---------------------------------------------------------------------------
console.log('\nSuite 5: buildFocusSection');
{
  const r = buildFocusSection([]);
  assert('empty → fallback', r.includes('No weekly focus entries'));
}
{
  const r = buildFocusSection(null);
  assert('null → fallback', r.includes('No weekly focus entries'));
}
{
  const old = [{ date: '2020-01-01', text: 'ancient focus', tried: true }];
  const r = buildFocusSection(old);
  assert('entries too old → fallback', r.includes('No weekly focus entries'));
}
{
  const recent = [
    { date: new Date(Date.now() - 5*24*60*60*1000).toISOString().slice(0,10), text: 'Walk more', tried: true },
    { date: new Date(Date.now() - 3*24*60*60*1000).toISOString().slice(0,10), text: 'Sleep by 10pm', tried: false },
  ];
  const r = buildFocusSection(recent);
  assert('recent entries → shows text', r.includes('Walk more') || r.includes('Sleep by 10pm'));
  assert('tried=true → ✓ tried marker', r.includes('✓'));
  assert('tried=false → skipped marker', r.includes('skipped'));
}
{
  // Pass an old entry that falls outside a 2-week window
  const ancient = [{ date: '2020-01-01', text: 'old entry', tried: true }];
  const r = buildFocusSection(ancient, 2);
  assert('custom weeks param reflected in no-entries message', r.includes('2 weeks'));
}

// ---------------------------------------------------------------------------
// Suite 6: generateSummary
// ---------------------------------------------------------------------------
console.log('\nSuite 6: generateSummary');
{
  const r = generateSummary({});
  assert('no-data call → returns string', typeof r === 'string');
  assert('no-data call → has BALA header', r.includes('BALA Personal Wellness Log'));
  assert('disclaimer always present', r.includes(DISCLAIMER));
}
{
  const r = generateSummary({ history: HISTORY_3, nudgeLog: NUDGE_LOG_3, focusLog: FOCUS_LOG_2, generatedAt: '2026-06-21T09:00:00Z' });
  assert('generatedAt date in output', r.includes('2026-06-21'));
  assert('history metrics present',   r.includes('Jun 2026'));
  assert('separator lines present',   r.includes('─'));
  assert('disclaimer present in full output', r.includes(DISCLAIMER));
}
{
  const r = generateSummary(null);
  assert('null opts → returns string with disclaimer', typeof r === 'string' && r.includes(DISCLAIMER));
}
{
  const r = generateSummary({ history: HISTORY_3 });
  assert('nudgeLog/focusLog optional — fallback shown for each', r.includes('No symptom check-ins') && r.includes('No weekly focus entries'));
}

// ---------------------------------------------------------------------------
// Suite 7: DISCLAIMER content and copy safety
// ---------------------------------------------------------------------------
console.log('\nSuite 7: Copy safety');
assert('DISCLAIMER is non-empty string', typeof DISCLAIMER === 'string' && DISCLAIMER.length > 10);

// Required disclaimer phrases
assert('DISCLAIMER: says personal wellness log', DISCLAIMER.toLowerCase().includes('personal wellness log'));
assert('DISCLAIMER: says not a medical record',   DISCLAIMER.toLowerCase().includes('not a medical record'));
assert('DISCLAIMER: says not a diagnosis',        DISCLAIMER.toLowerCase().includes('diagnosis'));
assert('DISCLAIMER: mentions emergency services', DISCLAIMER.toLowerCase().includes('emergency services'));

// Forbidden outcome claims in DISCLAIMER and in generateSummary output
const FORBIDDEN_CLAIMS = [
  'will detect', 'will prevent', 'will cure', 'will treat', 'will diagnose',
  'predicts heart', 'cardiac arrest', 'heart attack monitoring',
  'guarantees', 'replaces your doctor', 'replace a doctor',
];
const sampleOutput = generateSummary({ history: HISTORY_3, nudgeLog: NUDGE_LOG_3, focusLog: FOCUS_LOG_2 });
FORBIDDEN_CLAIMS.forEach(function(phrase) {
  assert('no "' + phrase + '" in output', !sampleOutput.toLowerCase().includes(phrase));
});

// buildMetricsSummary must not contain outcome claims
const metText = buildMetricsSummary(HISTORY_3).toLowerCase();
assert('metrics text: no "diagnose"',  !metText.includes('diagnose'));
assert('metrics text: no "prevents"',  !metText.includes('prevents'));
assert('metrics text: no "monitors"',  !metText.includes('monitors cardiac'));

// ---------------------------------------------------------------------------
// Suite 8: Exports
// ---------------------------------------------------------------------------
console.log('\nSuite 8: Exports');
assert('average is function',            typeof average === 'function');
assert('formatDate is function',         typeof formatDate === 'function');
assert('buildMetricsSummary is function',typeof buildMetricsSummary === 'function');
assert('buildSymptomSection is function',typeof buildSymptomSection === 'function');
assert('buildFocusSection is function',  typeof buildFocusSection === 'function');
assert('generateSummary is function',    typeof generateSummary === 'function');
assert('DISCLAIMER is exported string',  typeof DISCLAIMER === 'string');

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n' + '─'.repeat(55));
console.log('BALA-B49 Doctor-Ready Export tests: ' + (passed + failed) + ' total');
console.log(passed + ' passed  ·  ' + failed + ' failed');
if (failed === 0) {
    console.log('PASS bala-b49-doctor-summary.test.js');
  process.exit(0);
} else {
  console.error('FAIL bala-b49-doctor-summary.test.js');
  process.exit(1);
}
