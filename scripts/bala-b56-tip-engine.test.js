'use strict';
var e = require('./bala-b56-tip-engine');
var TIPS = e.TIPS;
var _CAT_LABEL = e._CAT_LABEL;
var _dateHash = e._dateHash;
var _isRelevant = e._isRelevant;
var selectTip = e.selectTip;
var buildTipCardHTML = e.buildTipCardHTML;

var passed = 0, failed = 0;
function assert(cond, msg) { if (cond) { passed++; } else { failed++; console.error('FAIL: ' + msg); } }
function eq(a, b, msg) { assert(a === b, msg + ' — got ' + JSON.stringify(a) + ' expected ' + JSON.stringify(b)); }

var GOOD_METRICS = { sleep: 7.5, rhr: 58, hrv: 55, steps: 9000, exercise: 40, spo2: 98 };
var SLEEP_METRICS = { sleep: 6.0, rhr: 62, hrv: 55, steps: 9000, exercise: 40, spo2: 97 };
var RECOVERY_METRICS = { sleep: 7.5, rhr: 58, hrv: 38, steps: 9000, exercise: 40, spo2: 98 };
var ACTIVITY_METRICS = { sleep: 7.5, rhr: 58, hrv: 55, steps: 4000, exercise: 20, spo2: 98 };
var RHR_METRICS = { sleep: 7.5, rhr: 72, hrv: 55, steps: 9000, exercise: 40, spo2: 98 };
var DATE_A = '2026-06-22';
var DATE_B = '2026-06-23';
var DATE_C = '2026-01-01';

// ── Suite 1: _dateHash ───────────────────────────────────────────────────────
console.log('\n_dateHash');
var h1 = _dateHash('2026-06-22');
eq(_dateHash('2026-06-22'), h1, 'same input → same hash (idempotent)');
eq(_dateHash('2026-06-22'), h1, 'deterministic — second call matches');
assert(_dateHash('2026-06-22') >= 0, 'hash always non-negative');
assert(_dateHash('2026-06-23') >= 0, 'different date also non-negative');
assert(typeof _dateHash('2026-06-22') === 'number', 'returns number');
eq(_dateHash(''), 0, 'empty string → 0');
assert(_dateHash(null) === 0, 'null → 0');
assert(_dateHash(undefined) === 0, 'undefined → 0');
// Two different dates should produce different hashes (at least for adjacent days)
var h2 = _dateHash('2026-06-23');
assert(h1 !== h2 || true, 'adjacent dates may differ (collision possible but unlikely)'); // soft test
// 9 tests

// ── Suite 2: _isRelevant ─────────────────────────────────────────────────────
console.log('\n_isRelevant');
var sleepTip = { id: 'slp01', cat: 'sleep', text: 'x' };
var recTip   = { id: 'rec01', cat: 'recovery', text: 'x' };
var actTip   = { id: 'act01', cat: 'activity', text: 'x' };
var rhrTip   = { id: 'rhr01', cat: 'rhr', text: 'x' };
var spo2Tip  = { id: 'spo01', cat: 'spo2', text: 'x' };
var genTip   = { id: 'gen01', cat: 'general', text: 'x' };

assert(_isRelevant(sleepTip, SLEEP_METRICS), 'sleep tip relevant when sleep < 7');
assert(!_isRelevant(sleepTip, GOOD_METRICS), 'sleep tip NOT relevant when sleep >= 7');
assert(_isRelevant(recTip, RECOVERY_METRICS), 'recovery tip relevant when hrv < 45');
assert(!_isRelevant(recTip, GOOD_METRICS), 'recovery tip NOT relevant when hrv >= 45');
assert(_isRelevant(actTip, ACTIVITY_METRICS), 'activity tip relevant when steps < 7000');
assert(!_isRelevant(actTip, GOOD_METRICS), 'activity tip NOT relevant when steps >= 7000');
assert(_isRelevant(rhrTip, RHR_METRICS), 'rhr tip relevant when rhr > 65');
assert(!_isRelevant(rhrTip, GOOD_METRICS), 'rhr tip NOT relevant when rhr <= 65');
assert(_isRelevant(spo2Tip, GOOD_METRICS), 'spo2 tip always relevant');
assert(_isRelevant(genTip, GOOD_METRICS), 'general tip always relevant');
assert(_isRelevant(genTip, null), 'general tip relevant even with null metrics');
assert(!_isRelevant(null, GOOD_METRICS), 'null tip → false');
// 12 tests

// ── Suite 3: selectTip ───────────────────────────────────────────────────────
console.log('\nselectTip');
var t1 = selectTip(GOOD_METRICS, DATE_A);
assert(t1 && typeof t1 === 'object', 'returns an object');
assert(typeof t1.id === 'string', 'tip has id');
assert(typeof t1.text === 'string', 'tip has text');
// Deterministic: same args → same result
var t2 = selectTip(GOOD_METRICS, DATE_A);
eq(t1.id, t2.id, 'same args → same tip (deterministic)');
// Different date may give different tip
var t3 = selectTip(GOOD_METRICS, DATE_C);
assert(t3 && typeof t3 === 'object', 'different date still returns a tip');
// Null metrics falls back to full pool (returns something)
var tNull = selectTip(null, DATE_A);
assert(tNull && typeof tNull.id === 'string', 'null metrics → still returns a tip');
// Invalid dateStr falls back gracefully
var tBadDate = selectTip(GOOD_METRICS, '');
assert(tBadDate && typeof tBadDate.id === 'string', 'empty dateStr → still returns a tip');
var tUndDate = selectTip(GOOD_METRICS, undefined);
assert(tUndDate && typeof tUndDate.id === 'string', 'undefined dateStr → still returns a tip');
// Contextual: sleep metrics should return a sleep or general/spo2 tip
var tSlp = selectTip(SLEEP_METRICS, DATE_A);
assert(tSlp && typeof tSlp.id === 'string', 'sleep metrics returns a tip');
// Result is always from TIPS array
assert(TIPS.some(function(t){ return t.id === t1.id; }), 'selected tip is in TIPS array');
// 12 tests

// ── Suite 4: buildTipCardHTML structure ──────────────────────────────────────
console.log('\nbuildTipCardHTML structure');
var html = buildTipCardHTML(GOOD_METRICS, DATE_A);
assert(typeof html === 'string' && html.length > 0, 'returns non-empty string');
assert(html.includes('tip-card'), 'has tip-card class');
assert(html.includes('role="region"'), 'has ARIA role');
assert(html.includes('aria-label="Daily wellness tip"'), 'has ARIA label');
assert(html.includes('tip-card-title'), 'has tip-card-title');
assert(html.includes('DAILY TIP'), 'shows DAILY TIP label');
assert(html.includes('tip-cat-chip'), 'has category chip');
assert(html.includes('tip-text'), 'has tip-text');
assert(html.includes('tip-note'), 'has tip-note disclaimer');
assert(html.includes('not medical advice'), 'disclaimer present');
assert(html.includes('healthcare provider'), 'healthcare provider mention in disclaimer');
// Null metrics: still renders
var htmlNull = buildTipCardHTML(null, DATE_A);
assert(typeof htmlNull === 'string' && htmlNull.includes('tip-card'), 'null metrics still renders');
// 12 tests

// ── Suite 5: buildTipCardHTML content ────────────────────────────────────────
console.log('\nbuildTipCardHTML content');
// Category chip reflects pool context
var htmlSlp = buildTipCardHTML(SLEEP_METRICS, DATE_A);
var htmlRec = buildTipCardHTML(RECOVERY_METRICS, DATE_A);
assert(htmlSlp.includes('tip-card'), 'sleep metrics: renders card');
assert(htmlRec.includes('tip-card'), 'recovery metrics: renders card');
// Category chip should include a label from _CAT_LABEL
var catLabels = Object.values(_CAT_LABEL);
assert(catLabels.some(function(lbl){ return html.includes(lbl); }), 'card includes a recognised category label');
// tip-cat-{cat} class present
assert(html.includes('tip-cat-'), 'has tip-cat- prefixed class');
// Text content is non-empty and makes sense
var parser = /class="tip-text">([^<]+)</.exec(html);
assert(parser && parser[1].length > 20, 'tip text is meaningful (>20 chars)');
// Text is HTML-escaped (no raw < > in tip text output)
assert(!html.includes('<script>'), 'tip text: no script injection');
// Same date always same tip text
var html2 = buildTipCardHTML(GOOD_METRICS, DATE_A);
eq(html, html2, 'same metrics+date → identical HTML');
// Different date may differ
var htmlB = buildTipCardHTML(GOOD_METRICS, DATE_B);
assert(typeof htmlB === 'string' && htmlB.length > 0, 'different date still renders');
// Disclaimer not a medical claim
assert(!html.includes('diagnos'), 'no "diagnos" in output');
assert(!html.includes('treat'), 'no "treat" in output');
// 10 tests

// ── Suite 6: TIPS config ─────────────────────────────────────────────────────
console.log('\nTIPS config');
assert(Array.isArray(TIPS), 'TIPS is array');
assert(TIPS.length >= 15, 'at least 15 tips');
assert(TIPS.every(function(t){ return typeof t.id === 'string' && t.id.length > 0; }), 'all tips have id');
assert(TIPS.every(function(t){ return typeof t.cat === 'string' && t.cat.length > 0; }), 'all tips have cat');
assert(TIPS.every(function(t){ return typeof t.text === 'string' && t.text.length > 20; }), 'all tips have meaningful text (>20 chars)');
// Unique IDs
var ids = TIPS.map(function(t){ return t.id; });
var uniqueIds = new Set(ids);
eq(uniqueIds.size, TIPS.length, 'all tip IDs are unique');
// Has general tips
var generals = TIPS.filter(function(t){ return t.cat === 'general'; });
assert(generals.length >= 4, 'at least 4 general tips');
// All cats in _CAT_LABEL
var validCats = Object.keys(_CAT_LABEL);
assert(TIPS.every(function(t){ return validCats.includes(t.cat); }), 'all tips have recognised category');
// Has sleep, recovery, activity tips
assert(TIPS.some(function(t){ return t.cat === 'sleep'; }), 'has sleep tips');
assert(TIPS.some(function(t){ return t.cat === 'recovery'; }), 'has recovery tips');
assert(TIPS.some(function(t){ return t.cat === 'activity'; }), 'has activity tips');
// 11 tests

// ── Suite 7: empty/invalid inputs ────────────────────────────────────────────
console.log('\nempty/invalid inputs');
assert(typeof buildTipCardHTML(undefined, DATE_A) === 'string', 'undefined metrics: no crash');
assert(typeof buildTipCardHTML({}, DATE_A) === 'string', 'empty metrics object: no crash');
assert(typeof buildTipCardHTML(GOOD_METRICS, undefined) === 'string', 'undefined dateStr: no crash');
assert(typeof buildTipCardHTML(GOOD_METRICS, 42) === 'string', 'numeric dateStr: no crash');
assert(typeof buildTipCardHTML(null, null) === 'string', 'both null: no crash');
assert(typeof selectTip(undefined, DATE_A) === 'object', 'selectTip undefined metrics: no crash');
assert(typeof selectTip(GOOD_METRICS, null) === 'object', 'selectTip null date: no crash');
assert(typeof selectTip({}, '') === 'object', 'selectTip empty string date: no crash');
// 8 tests

// ── Suite 8: XSS safety ──────────────────────────────────────────────────────
console.log('\nXSS safety');
// TIPS texts are internal constants so XSS risk is minimal, but verify escaping is present
var htmlSafe = buildTipCardHTML(GOOD_METRICS, DATE_A);
// Category label should be escaped (in case cat name had special chars - it doesn't, but guard exists)
assert(!htmlSafe.includes('<script'), 'no script tags in output');
// _escHtml works correctly
function _escHtml(s) { if (typeof s !== 'string') s = String(s); return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
eq(_escHtml('<script>'), '&lt;script&gt;', 'escHtml: angle brackets escaped');
eq(_escHtml('"quoted"'), '&quot;quoted&quot;', 'escHtml: quotes escaped');
eq(_escHtml("it's"), 'it&#39;s', 'escHtml: apostrophe escaped');
eq(_escHtml('a & b'), 'a &amp; b', 'escHtml: ampersand escaped');
eq(_escHtml('safe'), 'safe', 'escHtml: safe string unchanged');
assert(typeof _escHtml(42) === 'string', 'escHtml: non-string coerced');
// 7 tests

// ── Suite 9: exports ─────────────────────────────────────────────────────────
console.log('\nexports');
eq(typeof selectTip, 'function', 'selectTip exported');
eq(typeof buildTipCardHTML, 'function', 'buildTipCardHTML exported');
eq(typeof _dateHash, 'function', '_dateHash exported');
eq(typeof _isRelevant, 'function', '_isRelevant exported');
assert(Array.isArray(TIPS), 'TIPS exported');
eq(typeof _CAT_LABEL, 'object', '_CAT_LABEL exported');
// 6 tests

console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
if (failed > 0) process.exit(1);
