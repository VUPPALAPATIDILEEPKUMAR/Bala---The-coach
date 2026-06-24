#!/usr/bin/env node
'use strict';

// =============================================================================
// BALA Coach Engine — Test Suite
// =============================================================================

const {
  buildCoachGuide,
  buildSignalExplanation,
  buildAskReply,
  SIGNAL_EXPLAINERS,
  DISCLAIMER,
  _hasEmergency,
  _getToneForScore,
  _getLowestCategory,
  _buildMissingSignalsNote,
  EMERGENCY_REPLY,
} = require('./bala-coach-engine.js');

const { computeBALAScore } = require('./bala-score-engine.js');

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) { passed++; }
  else { failed++; console.error('  FAIL:', label); }
}
function assertEq(actual, expected, label) {
  if (actual === expected) { passed++; }
  else { failed++; console.error(`  FAIL: ${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); }
}
function assertIncludes(str, substring, label) {
  if (typeof str === 'string' && str.includes(substring)) { passed++; }
  else { failed++; console.error(`  FAIL: ${label} — "${substring}" not found in "${str}"`); }
}
function assertNotIncludes(str, substring, label) {
  if (typeof str !== 'string' || !str.includes(substring)) { passed++; }
  else { failed++; console.error(`  FAIL: ${label} — forbidden "${substring}" found in "${str}"`); }
}

// ---------------------------------------------------------------------------
// Suite 1: Emergency detection
// ---------------------------------------------------------------------------
console.log('Suite 1: Emergency detection');

assert(_hasEmergency('I have chest pain'), 'chest pain triggers emergency');
assert(_hasEmergency('trouble breathing since this morning'), 'trouble breathing triggers emergency');
assert(_hasEmergency('I think I\'m having a heart attack'), 'heart attack triggers emergency');
assert(_hasEmergency('CHEST PAIN'), 'case-insensitive emergency detection');
assert(!_hasEmergency('mild headache today'), 'mild headache not emergency');
assert(!_hasEmergency('my hrv dropped a bit'), 'HRV drop not emergency');
assert(!_hasEmergency(''), 'empty string not emergency');
assert(!_hasEmergency(null), 'null not emergency');

// ---------------------------------------------------------------------------
// Suite 2: _getToneForScore label routing
// ---------------------------------------------------------------------------
console.log('Suite 2: Tone mapping');

{
  const t = _getToneForScore(85, 'Thriving');
  assert(Array.isArray(t.openingOptions), 'Thriving has openingOptions array');
  assert(t.openingOptions.length > 0, 'Thriving has at least one opening');
  assert(typeof t.nudge === 'string', 'Thriving has nudge');
}
{
  const t = _getToneForScore(60, 'Balanced');
  assert(t.openingOptions.length > 0, 'Balanced has openings');
}
{
  const t = _getToneForScore(40, 'Recovering');
  assert(t.openingOptions.length > 0, 'Recovering has openings');
}
{
  const t = _getToneForScore(20, 'Rest Day');
  assert(t.openingOptions.length > 0, 'Rest Day has openings');
}
// Score-based fallback
{
  const t = _getToneForScore(80, null); // no label
  assert(t.openingOptions.length > 0, 'High score without label falls back to Thriving openings');
}
{
  const t = _getToneForScore(25, null);
  assert(t.openingOptions.length > 0, 'Low score without label falls back to Rest Day openings');
}

// ---------------------------------------------------------------------------
// Suite 3: buildCoachGuide — structure and safety
// ---------------------------------------------------------------------------
console.log('Suite 3: buildCoachGuide structure');

{
  const score = computeBALAScore({
    hrv_today: 65, hrv_baseline7d: 50,
    rhr_today: 58, rhr_baseline7d: 62,
    sleep_hours_today: 7.5, sleep_hours_goal: 7.5,
    spo2_pct: 97,
    steps_today: 8000, steps_goal: 10000,
  });
  const guide = buildCoachGuide(score, { userName: 'Dileep' });
  assert(!guide.emergency, 'healthy score: no emergency');
  assert(Array.isArray(guide.sections), 'guide has sections array');
  assert(guide.sections.length >= 3, 'guide has at least 3 sections');
  assert(typeof guide.disclaimer === 'string', 'guide has disclaimer');
  assertIncludes(guide.disclaimer, 'not medical advice', 'disclaimer says not medical advice');
  // Personalization
  const greetingSection = guide.sections.find((s) => s.id === 'greeting');
  assert(greetingSection !== undefined, 'greeting section present');
  assertIncludes(greetingSection.text, 'Dileep', 'greeting includes user name');
}

{
  // Emergency input
  const score = computeBALAScore({ symptom_text: 'chest pain' });
  const guide = buildCoachGuide(score);
  assert(guide.emergency === true, 'emergency score produces emergency guide');
  assert(typeof guide.message === 'string', 'emergency guide has message');
  assert(guide.disclaimer === null, 'emergency guide has no disclaimer (safety message replaces)');
  assertNotIncludes(guide.message || '', 'BALA Score', 'emergency reply does not mention BALA Score');
}

{
  // Null input — graceful
  const guide = buildCoachGuide(null);
  assert(!guide.emergency, 'null input: no crash');
  assert(typeof guide.disclaimer === 'string', 'null input: disclaimer still present');
  assert(guide.error !== undefined, 'null input: error field set');
}

{
  // No userName — no crash, no "undefined" in output
  const score = computeBALAScore({ hrv_today: 55, hrv_baseline7d: 50 });
  const guide = buildCoachGuide(score);
  const greetingSection = guide.sections.find((s) => s.id === 'greeting');
  assert(greetingSection !== undefined, 'greeting section present without userName');
  assertNotIncludes(greetingSection.text, 'undefined', 'no "undefined" in greeting');
  assertNotIncludes(greetingSection.text, 'null', 'no "null" in greeting');
}

// ---------------------------------------------------------------------------
// Suite 4: buildCoachGuide — medical safety
// ---------------------------------------------------------------------------
console.log('Suite 4: Medical safety in guide output');

const FORBIDDEN = ['diagnos', 'treat', 'prevent', 'predict', 'guaranteed', 'cure', 'disease', 'at risk of'];

function checkGuideForForbidden(guide, context) {
  const allText = guide.sections.map((s) => s.text || '').join(' ');
  FORBIDDEN.forEach((term) => {
    assertNotIncludes(allText.toLowerCase(), term, `${context}: guide must not contain "${term}"`);
  });
}

{
  const score = computeBALAScore({ hrv_today: 25, hrv_baseline7d: 60, spo2_pct: 91 });
  if (!score.emergency) {
    const guide = buildCoachGuide(score);
    checkGuideForForbidden(guide, 'low signals scenario');
  }
}
{
  const score = computeBALAScore({ alcohol_drinks: 5, stress_level: 5, hydration: 'low' });
  const guide = buildCoachGuide(score);
  checkGuideForForbidden(guide, 'bad lifestyle scenario');
}
{
  // Best day
  const score = computeBALAScore({
    hrv_today: 75, hrv_baseline7d: 50,
    sleep_hours_today: 8, sleep_hours_goal: 7.5,
    steps_today: 12000, steps_goal: 10000,
  });
  const guide = buildCoachGuide(score);
  checkGuideForForbidden(guide, 'best day scenario');
}

// ---------------------------------------------------------------------------
// Suite 5: buildSignalExplanation
// ---------------------------------------------------------------------------
console.log('Suite 5: Signal explainer');

{
  const ex = buildSignalExplanation('hrv');
  assert(ex.found === true, 'hrv explainer found');
  assert(typeof ex.name === 'string', 'hrv has name');
  assert(typeof ex.what === 'string', 'hrv has what');
  assert(Array.isArray(ex.affects), 'hrv has affects array');
  assert(typeof ex.improving === 'string', 'hrv has improving tip');
  assert(typeof ex.disclaimer === 'string', 'hrv explainer has disclaimer');
  // Safety
  FORBIDDEN.forEach((term) => {
    assertNotIncludes((ex.what + ex.improving).toLowerCase(), term, `hrv explainer: no "${term}"`);
  });
}

{
  // With user value + baseline
  const ex = buildSignalExplanation('rhr', { userValue: 72, userBaseline: 60 });
  assert(ex.found === true, 'rhr with values found');
  assert(typeof ex.yourContext === 'string', 'rhr context string present');
  assertIncludes(ex.yourContext, 'above', 'high RHR vs baseline noted as above');
}

{
  // Below baseline
  const ex = buildSignalExplanation('hrv', { userValue: 35, userBaseline: 55 });
  assert(typeof ex.yourContext === 'string', 'hrv below baseline context present');
  assertIncludes(ex.yourContext, 'below', 'low HRV vs baseline noted as below');
}

{
  // At baseline (within 3%)
  const ex = buildSignalExplanation('steps', { userValue: 8000, userBaseline: 8100 });
  assert(typeof ex.yourContext === 'string', 'steps at baseline context present');
  assertIncludes(ex.yourContext, 'in line', 'steps at baseline noted as in line');
}

{
  // Unknown signal
  const ex = buildSignalExplanation('unknown_signal_xyz');
  assert(ex.found === false, 'unknown signal returns found=false');
  assert(typeof ex.message === 'string', 'unknown signal has message');
}

// All known signals exist
{
  const knownSignals = ['hrv', 'rhr', 'spo2', 'sleep_hours', 'sleep_consistency',
    'steps', 'sleep_score', 'weekly_cardio', 'stress_level', 'hydration'];
  knownSignals.forEach((key) => {
    const ex = buildSignalExplanation(key);
    assert(ex.found === true, `signal explainer exists for: ${key}`);
  });
}

// ---------------------------------------------------------------------------
// Suite 6: buildAskReply — pattern matching
// ---------------------------------------------------------------------------
console.log('Suite 6: buildAskReply pattern matching');

{
  // Emergency
  const r = buildAskReply('I have chest pain right now');
  assert(r.emergency === true, 'ask: chest pain triggers emergency');
  assert(typeof r.message === 'string', 'ask: emergency message present');
  assert(r.disclaimer === null, 'ask: emergency reply has no disclaimer');
}

{
  // HRV question
  const r = buildAskReply('my hrv dropped this week');
  assert(r.matched === true, 'ask: HRV question matched');
  assertEq(r.signal, 'hrv', 'ask: HRV signal identified');
  assert(typeof r.message === 'string', 'ask: HRV reply present');
  assert(typeof r.disclaimer === 'string', 'ask: HRV reply has disclaimer');
  FORBIDDEN.forEach((t) => assertNotIncludes(r.message.toLowerCase(), t, `ask hrv: no "${t}"`));
}

{
  // Sleep question
  const r = buildAskReply('I feel exhausted today');
  assert(r.matched === true, 'ask: exhausted matches sleep pattern');
  assertEq(r.signal, 'sleep_hours', 'ask: sleep signal identified');
}

{
  // Stress question
  const r = buildAskReply('I\'m feeling really anxious and overwhelmed');
  assert(r.matched === true, 'ask: anxious + overwhelmed matches stress pattern');
  assertEq(r.signal, 'stress_level', 'ask: stress signal identified');
}

{
  // Steps question
  const r = buildAskReply('should I go for a walk today?');
  assert(r.matched === true, 'ask: walk question matched');
  assertEq(r.signal, 'steps', 'ask: steps signal identified');
}

{
  // BALA score question — with score result
  const score = computeBALAScore({ hrv_today: 60, hrv_baseline7d: 50, sleep_hours_today: 7.5, sleep_hours_goal: 7.5 });
  const r = buildAskReply('what is my bala score today?', score);
  assert(r.matched === true, 'ask: bala score question matched');
  assertEq(r.signal, 'bala_score', 'ask: bala_score signal identified');
  assertIncludes(r.message, score.score.toString(), 'ask: score value included in reply');
}

{
  // General check — with score
  const score = computeBALAScore({ hrv_today: 65, hrv_baseline7d: 55, steps_today: 9000, steps_goal: 10000 });
  const r = buildAskReply('how am I doing today?', score);
  assert(r.matched === true, 'ask: how am I doing matched');
  assertEq(r.signal, 'general_check', 'ask: general_check signal identified');
}

{
  // Unmatched — guide reply
  const r = buildAskReply('what should I have for dinner?');
  assert(r.matched === false, 'ask: unrelated question not matched');
  assert(typeof r.message === 'string', 'ask: unmatched still has helpful message');
  assertIncludes(r.message, 'HRV', 'ask: unmatched reply suggests HRV as example');
}

{
  // Null / empty input
  const r1 = buildAskReply(null);
  assert(typeof r1.message === 'string', 'ask: null input returns message');
  const r2 = buildAskReply('');
  assert(typeof r2.message === 'string', 'ask: empty string returns message');
}

// ---------------------------------------------------------------------------
// Suite 7: SIGNAL_EXPLAINERS — coverage and safety
// ---------------------------------------------------------------------------
console.log('Suite 7: SIGNAL_EXPLAINERS coverage');

{
  const keys = Object.keys(SIGNAL_EXPLAINERS);
  assert(keys.length >= 10, 'at least 10 signal explainers');
  keys.forEach((key) => {
    const ex = SIGNAL_EXPLAINERS[key];
    assert(typeof ex.name === 'string', `${key}: has name`);
    assert(typeof ex.what === 'string', `${key}: has what`);
    assert(Array.isArray(ex.affects), `${key}: has affects array`);
    FORBIDDEN.forEach((term) => {
      assertNotIncludes((ex.what + ex.improving + ex.lowSignal + ex.highSignal).toLowerCase(),
        term, `${key}: no forbidden term "${term}"`);
    });
  });
}

// ---------------------------------------------------------------------------
// Suite 8: _getLowestCategory
// ---------------------------------------------------------------------------
console.log('Suite 8: Lowest category detection');

{
  // Score with clear low category (lifestyle)
  const score = computeBALAScore({
    hrv_today: 60, hrv_baseline7d: 50,
    sleep_hours_today: 8, sleep_hours_goal: 7.5,
    steps_today: 9000, steps_goal: 10000,
    alcohol_drinks: 5, hydration: 'low', stress_level: 5, travel_today: true,
  });
  const lowest = _getLowestCategory(score);
  assert(lowest !== null, 'lowest category found for full score');
  assert(typeof lowest === 'string', 'lowest category is a string');
}

{
  // Null scoreResult
  const lowest = _getLowestCategory(null);
  assert(lowest === null, 'null scoreResult: lowest category is null');
}

// ---------------------------------------------------------------------------
// Suite 9: buildCoachGuide sections completeness
// ---------------------------------------------------------------------------
console.log('Suite 9: Guide sections completeness');

{
  const score = computeBALAScore({
    hrv_today: 70, hrv_baseline7d: 50,
    sleep_hours_today: 8, sleep_hours_goal: 7.5,
    steps_today: 10000, steps_goal: 10000,
    workout_logged: true,
    alcohol_drinks: 0, hydration: 'well', stress_level: 1,
  }, { previous_score: 55 }); // large delta to trigger changeCopy

  const guide = buildCoachGuide(score, { userName: 'Dileep' });

  const ids = guide.sections.map((s) => s.id);
  assert(ids.includes('greeting'), 'guide has greeting section');
  assert(ids.includes('score'), 'guide has score section');
  assert(ids.includes('action'), 'guide has action section');

  // All sections have text
  guide.sections.forEach((s) => {
    assert(typeof s.text === 'string' && s.text.length > 0, `section ${s.id} has non-empty text`);
    assert(typeof s.label === 'string' && s.label.length > 0, `section ${s.id} has non-empty label`);
  });
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
const total = passed + failed;
console.log(`\nBALA Coach Engine tests: ${passed}/${total} passed`);
if (failed > 0) {
  console.error(`${failed} test(s) FAILED`);
  process.exit(1);
}
console.log('PASS bala-coach-engine.test.js');
