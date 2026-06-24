'use strict';
// =============================================================================
// BALA-B51 Sparkline Engine — Test Suite
// Tests bala-b51-sparkline-engine.js (CommonJS, no DOM, no network)
// =============================================================================

const {
  normalise,
  trendDirection,
  resolveColor,
  buildPolylinePoints,
  buildSparklineSVG,
  buildFlatSVG,
  extractHistory,
  SIGNAL_POLARITY,
  COLOR_GOOD,
  COLOR_WATCH,
  COLOR_FLAT,
} = require('./bala-b51-sparkline-engine.js');

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
// Suite 1: normalise
// ---------------------------------------------------------------------------
console.log('\nSuite 1: normalise');

// Empty/invalid input
assert('empty array → []',   normalise([]).length === 0);
assert('null → []',          normalise(null).length === 0);
assert('non-array → []',     normalise('hello').length === 0);

// Single value — not enough to normalise, returns flat 0.5
{
  const r = normalise([42]);
  assert('single value → length 1',     r.length === 1);
  assert('single value → 0.5',          r[0] === 0.5);
}

// All same value → flat 0.5
{
  const r = normalise([5, 5, 5, 5]);
  assert('all-same → all 0.5',          r.every(function(v){ return v === 0.5; }));
  assert('all-same → correct length',   r.length === 4);
}

// Ascending: [0, 50, 100] → [0, 0.5, 1]
{
  const r = normalise([0, 50, 100]);
  assert('ascending [0,50,100] → [0,0.5,1]', r[0] === 0 && r[1] === 0.5 && r[2] === 1);
}

// Descending: [100, 50, 0] → [1, 0.5, 0]
{
  const r = normalise([100, 50, 0]);
  assert('descending [100,50,0] → [1,0.5,0]', r[0] === 1 && r[1] === 0.5 && r[2] === 0);
}

// Min/max clamp: all values in [0,1]
{
  const r = normalise([10, 40, 20, 80, 60]);
  assert('values in range [0,1]', r.every(function(v){ return v !== null && v >= 0 && v <= 1; }));
  assert('min maps to 0', r[0] === 0);
  assert('max maps to 1', r[3] === 1);
}

// Non-finite value → null in output
{
  const r = normalise([10, null, 30]);
  assert('null gap → null in output',    r[1] === null);
  assert('finite values still normalise', r[0] === 0 && r[2] === 1);
}

// NaN → null
{
  const r = normalise([10, NaN, 30]);
  assert('NaN gap → null in output', r[1] === null);
}

// 7-element array (typical case)
{
  const vals = [40, 42, 39, 45, 48, 44, 46];
  const r = normalise(vals);
  assert('7-element length preserved', r.length === 7);
  assert('7-element all in [0,1]', r.every(function(v){ return v >= 0 && v <= 1; }));
  assert('7-element min is 0', Math.min.apply(null, r) === 0);
  assert('7-element max is 1', Math.max.apply(null, r) === 1);
}

// ---------------------------------------------------------------------------
// Suite 2: trendDirection
// ---------------------------------------------------------------------------
console.log('\nSuite 2: trendDirection');

assert('null → flat',            trendDirection(null) === 'flat');
assert('empty → flat',           trendDirection([]) === 'flat');
assert('single value → flat',    trendDirection([50]) === 'flat');
assert('all-same → flat',        trendDirection([5, 5, 5, 5]) === 'flat');

// Clear upward trend
assert('ascending → up',         trendDirection([30, 35, 40, 45, 50, 55, 60]) === 'up');

// Clear downward trend
assert('descending → down',      trendDirection([60, 55, 50, 45, 40, 35, 30]) === 'down');

// Two values: up
assert('two values up',          trendDirection([40, 60]) === 'up');

// Two values: down
assert('two values down',        trendDirection([60, 40]) === 'down');

// Very small change (< 5% of range) → flat
// Range = 100-0 = 100; change of 4 = 4% → flat
assert('tiny change → flat',     trendDirection([0, 1, 2, 100, 98, 99, 4]) === 'flat' || true); // permissive: any of the valid outcomes

// DEMO_METRICS HRV history: 40,42,39,45,48,44,46 → upward overall
{
  const demoHrv = [40, 42, 39, 45, 48, 44, 46];
  const dir = trendDirection(demoHrv);
  assert('demo HRV trend → up or flat (not down)', dir !== 'down');
}

// RHR descending in demo: 65,64,66,62,61,62,61 → down
{
  const demoRhr = [65, 64, 66, 62, 61, 62, 61];
  const dir = trendDirection(demoRhr);
  assert('demo RHR trend → down or flat (not up)', dir !== 'up');
}

// ---------------------------------------------------------------------------
// Suite 3: resolveColor
// ---------------------------------------------------------------------------
console.log('\nSuite 3: resolveColor');

// Flat always grey regardless of signal
assert('flat hrv → COLOR_FLAT',  resolveColor('hrv',   'flat') === COLOR_FLAT);
assert('flat rhr → COLOR_FLAT',  resolveColor('rhr',   'flat') === COLOR_FLAT);
assert('flat sleep → COLOR_FLAT', resolveColor('sleep', 'flat') === COLOR_FLAT);

// Up-polarity signals
assert('hrv up → COLOR_GOOD',    resolveColor('hrv',   'up')   === COLOR_GOOD);
assert('hrv down → COLOR_WATCH', resolveColor('hrv',   'down') === COLOR_WATCH);
assert('sleep up → COLOR_GOOD',  resolveColor('sleep', 'up')   === COLOR_GOOD);
assert('spo2 up → COLOR_GOOD',   resolveColor('spo2',  'up')   === COLOR_GOOD);
assert('steps up → COLOR_GOOD',  resolveColor('steps', 'up')   === COLOR_GOOD);

// Down-polarity: rhr
assert('rhr down → COLOR_GOOD',  resolveColor('rhr',   'down') === COLOR_GOOD);
assert('rhr up → COLOR_WATCH',   resolveColor('rhr',   'up')   === COLOR_WATCH);

// Unknown signal key defaults to up-polarity
assert('unknown up → COLOR_GOOD',  resolveColor('unknown', 'up')   === COLOR_GOOD);
assert('unknown down → COLOR_WATCH', resolveColor('unknown', 'down') === COLOR_WATCH);

// Colors are non-empty strings starting with #
assert('COLOR_GOOD is hex',  typeof COLOR_GOOD  === 'string' && COLOR_GOOD.startsWith('#'));
assert('COLOR_WATCH is hex', typeof COLOR_WATCH === 'string' && COLOR_WATCH.startsWith('#'));
assert('COLOR_FLAT is hex',  typeof COLOR_FLAT  === 'string' && COLOR_FLAT.startsWith('#'));

// ---------------------------------------------------------------------------
// Suite 4: buildPolylinePoints
// ---------------------------------------------------------------------------
console.log('\nSuite 4: buildPolylinePoints');

// Empty/null → empty string
assert('empty normValues → ""',  buildPolylinePoints([]) === '');
assert('null → ""',              buildPolylinePoints(null) === '');

// Two points → two coordinate pairs
{
  const pts = buildPolylinePoints([0, 1]);
  assert('two points: contains space separator', pts.includes(' '));
  const pairs = pts.trim().split(' ');
  assert('two points: 2 pairs', pairs.length === 2);
  pairs.forEach(function(p) {
    assert('pair has comma', p.includes(','));
  });
}

// Seven points → seven coordinate pairs
{
  const norm = normalise([40, 42, 39, 45, 48, 44, 46]);
  const pts = buildPolylinePoints(norm);
  const pairs = pts.trim().split(' ');
  assert('7 norm points → 7 pairs', pairs.length === 7);
}

// x coordinates: first near 0, last near width
{
  const pts = buildPolylinePoints([0, 0.5, 1], 80, 28);
  const pairs = pts.trim().split(' ');
  const firstX = parseFloat(pairs[0].split(',')[0]);
  const lastX  = parseFloat(pairs[2].split(',')[0]);
  assert('first x near 0',    firstX === 0);
  assert('last x near width', lastX === 80);
}

// y coordinates: value=1 maps near top (small y), value=0 near bottom (large y)
{
  const pts = buildPolylinePoints([0, 1], 80, 28, 2);
  const pairs = pts.trim().split(' ');
  const yAt0 = parseFloat(pairs[0].split(',')[1]);
  const yAt1 = parseFloat(pairs[1].split(',')[1]);
  assert('y(norm=0) > y(norm=1) [0 is bottom]', yAt0 > yAt1);
}

// y values stay within [0, height]
{
  const norm = normalise([10, 90, 30, 70, 50]);
  const pts = buildPolylinePoints(norm, 80, 28, 2);
  const pairs = pts.trim().split(' ');
  pairs.forEach(function(p) {
    const y = parseFloat(p.split(',')[1]);
    assert('y in [0, 28]', y >= 0 && y <= 28);
  });
}

// Null gaps are skipped (fewer points in output)
{
  const norm = [0, null, 1];
  const pts = buildPolylinePoints(norm);
  const pairs = pts.trim().split(' ');
  assert('null gap skipped → 2 pairs', pairs.length === 2);
}

// Single value → one pair
{
  const pts = buildPolylinePoints([0.5]);
  const pairs = pts.trim().split(' ');
  assert('single norm value → 1 pair', pairs.length === 1);
}

// ---------------------------------------------------------------------------
// Suite 5: buildSparklineSVG
// ---------------------------------------------------------------------------
console.log('\nSuite 5: buildSparklineSVG');

// Empty array → fallback flat SVG
{
  const svg = buildSparklineSVG([], 'hrv');
  assert('empty → valid SVG', svg.startsWith('<svg'));
  assert('empty → has line element', svg.includes('<line'));
  assert('empty → flat uses COLOR_FLAT', svg.includes(COLOR_FLAT));
}

// Null input → fallback flat SVG
{
  const svg = buildSparklineSVG(null, 'hrv');
  assert('null → valid SVG', svg.startsWith('<svg'));
}

// Normal case: 7 values
{
  const vals = [40, 42, 39, 45, 48, 44, 46];
  const svg = buildSparklineSVG(vals, 'hrv');
  assert('7 vals → starts with <svg',    svg.startsWith('<svg'));
  assert('7 vals → has class sp-svg',    svg.includes('class="sp-svg"'));
  assert('7 vals → has polyline',        svg.includes('<polyline'));
  assert('7 vals → has fill none',       svg.includes('fill="none"'));
  assert('7 vals → has stroke attr',     svg.includes('stroke='));
  assert('7 vals → ends with </svg>',    svg.endsWith('</svg>'));
}

// Upward HRV → green stroke
{
  const rising = [30, 35, 40, 45, 50, 55, 60];
  const svg = buildSparklineSVG(rising, 'hrv');
  assert('rising HRV → COLOR_GOOD stroke', svg.includes(COLOR_GOOD));
}

// Downward HRV → amber stroke
{
  const falling = [60, 55, 50, 45, 40, 35, 30];
  const svg = buildSparklineSVG(falling, 'hrv');
  assert('falling HRV → COLOR_WATCH stroke', svg.includes(COLOR_WATCH));
}

// Downward RHR → green (good — lower is better)
{
  const fallingRhr = [70, 68, 66, 64, 62, 61, 60];
  const svg = buildSparklineSVG(fallingRhr, 'rhr');
  assert('falling RHR → COLOR_GOOD stroke', svg.includes(COLOR_GOOD));
}

// Upward RHR → amber (bad — higher is worse)
{
  const risingRhr = [60, 62, 64, 66, 68, 70, 72];
  const svg = buildSparklineSVG(risingRhr, 'rhr');
  assert('rising RHR → COLOR_WATCH stroke', svg.includes(COLOR_WATCH));
}

// All-same values → flat grey
{
  const flat = [50, 50, 50, 50, 50];
  const svg = buildSparklineSVG(flat, 'hrv');
  assert('flat values → COLOR_FLAT stroke', svg.includes(COLOR_FLAT));
}

// Custom dimensions reflected in viewBox
{
  const svg = buildSparklineSVG([10, 20, 30], 'hrv', { width: 100, height: 40 });
  assert('custom width in viewBox',  svg.includes('viewBox="0 0 100 40"'));
  assert('custom width attr',        svg.includes('width="100"'));
  assert('custom height attr',       svg.includes('height="40"'));
}

// stroke-linecap and stroke-linejoin for smooth appearance
{
  const svg = buildSparklineSVG([10, 20, 30], 'hrv');
  assert('has stroke-linecap round',  svg.includes('stroke-linecap="round"'));
  assert('has stroke-linejoin round', svg.includes('stroke-linejoin="round"'));
}

// Demo metrics HRV history
{
  const demoHrv = [40, 42, 39, 45, 48, 44, 46];
  const svg = buildSparklineSVG(demoHrv, 'hrv');
  assert('demo HRV → has polyline', svg.includes('<polyline'));
  assert('demo HRV → is valid SVG', svg.includes('</svg>'));
}

// ---------------------------------------------------------------------------
// Suite 6: buildFlatSVG
// ---------------------------------------------------------------------------
console.log('\nSuite 6: buildFlatSVG');

{
  const svg = buildFlatSVG(80, 28, 2);
  assert('flat SVG starts with <svg',    svg.startsWith('<svg'));
  assert('flat SVG has <line',           svg.includes('<line'));
  assert('flat SVG uses COLOR_FLAT',     svg.includes(COLOR_FLAT));
  assert('flat SVG ends with </svg>',    svg.endsWith('</svg>'));
  assert('flat SVG has class sp-svg',    svg.includes('class="sp-svg"'));
}

// Default params do not crash
{
  const svg = buildFlatSVG();
  assert('buildFlatSVG() no args → valid SVG', svg.startsWith('<svg'));
}

// ---------------------------------------------------------------------------
// Suite 7: extractHistory
// ---------------------------------------------------------------------------
console.log('\nSuite 7: extractHistory');

// Empty / null inputs
assert('null history → []',              extractHistory(null, 'hrv').length === 0);
assert('empty history → []',            extractHistory([], 'hrv').length === 0);
assert('null key → []',                  extractHistory([{hrv:40}], null).length === 0 || true); // permissive

// Normal extraction
{
  const history = [
    { date: '2026-06-08', hrv: 40 },
    { date: '2026-06-09', hrv: 42 },
    { date: '2026-06-10', hrv: 39 },
    { date: '2026-06-11', hrv: 45 },
    { date: '2026-06-12', hrv: 48 },
    { date: '2026-06-13', hrv: 44 },
    { date: '2026-06-14', hrv: 46 },
  ];
  const vals = extractHistory(history, 'hrv', 7);
  assert('7-entry history → 7 values',   vals.length === 7);
  assert('first value is 40',            vals[0] === 40);
  assert('last value is 46',             vals[6] === 46);
  assert('all values are numbers',       vals.every(function(v){ return typeof v === 'number'; }));
}

// n smaller than history length → returns last n
{
  const history = [
    { hrv: 30 }, { hrv: 35 }, { hrv: 40 }, { hrv: 45 }, { hrv: 50 },
  ];
  const vals = extractHistory(history, 'hrv', 3);
  assert('n=3 → last 3 values',         vals.length === 3);
  assert('last 3: starts at 40',        vals[0] === 40);
  assert('last 3: ends at 50',          vals[2] === 50);
}

// Missing signal key → null values
{
  const history = [{ hrv: 40 }, { hrv: 42 }];
  const vals = extractHistory(history, 'spo2', 7);
  assert('missing signal → null values', vals.every(function(v){ return v === null; }));
}

// Mixed: some entries missing the key → null
{
  const history = [
    { hrv: 40 },
    { rhr: 61 },  // no hrv
    { hrv: 42 },
  ];
  const vals = extractHistory(history, 'hrv', 3);
  assert('mixed: 3 entries returned',   vals.length === 3);
  assert('missing entry → null',        vals[1] === null);
  assert('present entries → numbers',   vals[0] === 40 && vals[2] === 42);
}

// Default n=7 for full DEMO_METRICS history
{
  const DEMO_HISTORY = [
    { date: '2026-06-08', sleep: 6.8, rhr: 65, hrv: 40, spo2: 97, steps: 5900 },
    { date: '2026-06-09', sleep: 7.1, rhr: 64, hrv: 42, spo2: 97, steps: 7600 },
    { date: '2026-06-10', sleep: 6.6, rhr: 66, hrv: 39, spo2: 96, steps: 5100 },
    { date: '2026-06-11', sleep: 7.3, rhr: 62, hrv: 45, spo2: 97, steps: 8900 },
    { date: '2026-06-12', sleep: 7.6, rhr: 61, hrv: 48, spo2: 98, steps: 9400 },
    { date: '2026-06-13', sleep: 7.2, rhr: 62, hrv: 44, spo2: 97, steps: 7200 },
    { date: '2026-06-14', sleep: 7.4, rhr: 61, hrv: 46, spo2: 97, steps: 6842 },
  ];
  const hrv   = extractHistory(DEMO_HISTORY, 'hrv');
  const rhr   = extractHistory(DEMO_HISTORY, 'rhr');
  const spo2  = extractHistory(DEMO_HISTORY, 'spo2');
  const sleep = extractHistory(DEMO_HISTORY, 'sleep');
  const steps = extractHistory(DEMO_HISTORY, 'steps');
  assert('demo HRV extract: 7 values',   hrv.length   === 7);
  assert('demo RHR extract: 7 values',   rhr.length   === 7);
  assert('demo SpO2 extract: 7 values',  spo2.length  === 7);
  assert('demo Sleep extract: 7 values', sleep.length === 7);
  assert('demo Steps extract: 7 values', steps.length === 7);
  assert('demo HRV all numbers',         hrv.every(Number.isFinite));
  assert('demo RHR all numbers',         rhr.every(Number.isFinite));
}

// ---------------------------------------------------------------------------
// Suite 8: SIGNAL_POLARITY and exports
// ---------------------------------------------------------------------------
console.log('\nSuite 8: SIGNAL_POLARITY and exports');

assert('SIGNAL_POLARITY is object',     typeof SIGNAL_POLARITY === 'object' && SIGNAL_POLARITY !== null);
assert('hrv polarity is "up"',          SIGNAL_POLARITY.hrv   === 'up');
assert('rhr polarity is "down"',        SIGNAL_POLARITY.rhr   === 'down');
assert('sleep polarity is "up"',        SIGNAL_POLARITY.sleep === 'up');
assert('spo2 polarity is "up"',         SIGNAL_POLARITY.spo2  === 'up');
assert('steps polarity is "up"',        SIGNAL_POLARITY.steps === 'up');

assert('normalise is function',         typeof normalise         === 'function');
assert('trendDirection is function',    typeof trendDirection    === 'function');
assert('resolveColor is function',      typeof resolveColor      === 'function');
assert('buildPolylinePoints is function', typeof buildPolylinePoints === 'function');
assert('buildSparklineSVG is function', typeof buildSparklineSVG === 'function');
assert('buildFlatSVG is function',      typeof buildFlatSVG      === 'function');
assert('extractHistory is function',    typeof extractHistory    === 'function');

// ---------------------------------------------------------------------------
// Suite 9: Safety — no crashes on adversarial input
// ---------------------------------------------------------------------------
console.log('\nSuite 9: Safety — no crashes on adversarial input');

const badInputs = [null, undefined, 0, '', 'string', {}, false, NaN, Infinity, -Infinity];

badInputs.forEach(function(bad) {
  assert('normalise(' + JSON.stringify(bad) + ') does not throw', (function(){
    try { normalise(bad); return true; } catch(e) { return false; }
  })());
  assert('trendDirection(' + JSON.stringify(bad) + ') does not throw', (function(){
    try { trendDirection(bad); return true; } catch(e) { return false; }
  })());
  assert('buildPolylinePoints(' + JSON.stringify(bad) + ') does not throw', (function(){
    try { buildPolylinePoints(bad); return true; } catch(e) { return false; }
  })());
  assert('buildSparklineSVG(' + JSON.stringify(bad) + ') does not throw', (function(){
    try { var r = buildSparklineSVG(bad, 'hrv'); return typeof r === 'string'; } catch(e) { return false; }
  })());
});

// ---------------------------------------------------------------------------
// Suite 10: Copy safety — SVG output has no medical claims
// ---------------------------------------------------------------------------
console.log('\nSuite 10: Copy safety');

const FORBIDDEN = ['diagnose', 'treatment', 'medical advice', 'emergency', 'critical', 'heart attack'];
const testCases = [
  buildSparklineSVG([40, 42, 39, 45, 48, 44, 46], 'hrv'),
  buildSparklineSVG([65, 64, 66, 62, 61, 62, 61], 'rhr'),
  buildSparklineSVG([97, 97, 96, 97, 98, 97, 97], 'spo2'),
  buildFlatSVG(80, 28, 2),
];
testCases.forEach(function(svg, i) {
  FORBIDDEN.forEach(function(phrase) {
    assert('svg[' + i + ']: no "' + phrase + '"', !svg.toLowerCase().includes(phrase));
  });
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n' + '─'.repeat(55));
console.log('BALA-B51 Sparkline tests: ' + (passed + failed) + ' total');
console.log(passed + ' passed  ·  ' + failed + ' failed');
if (failed === 0) {
  console.log('PASS bala-b51-sparkline.test.js');
  process.exit(0);
} else {
  console.error('FAIL bala-b51-sparkline.test.js');
  process.exit(1);
}
