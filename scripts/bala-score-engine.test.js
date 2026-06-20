#!/usr/bin/env node
'use strict';

// =============================================================================
// BALA Score Engine — Test Suite
// =============================================================================

const {
  computeBALAScore,
  ALL_SIGNAL_KEYS,
  EMERGENCY_REPLY,
  _recoveryContribution,
  _sleepContribution,
  _activityContribution,
  _lifestyleModifier,
  _symptomModifier,
  _computeConfidence,
} = require('./bala-score-engine.js');

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error('  FAIL:', label);
  }
}

function assertEq(actual, expected, label) {
  if (actual === expected) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// ---------------------------------------------------------------------------
// Suite 1: Emergency gate — must always override everything
// ---------------------------------------------------------------------------
console.log('Suite 1: Emergency gate');

{
  const r = computeBALAScore({ symptom_text: 'chest pain' });
  assert(r.emergency === true, 'chest pain triggers emergency');
  assert(r.score === null, 'emergency score is null');
  assert(typeof r.emergencyReply === 'string' && r.emergencyReply.length > 20, 'emergency reply present');
}

{
  const r = computeBALAScore({ symptom_text: 'trouble breathing' });
  assert(r.emergency === true, 'trouble breathing triggers emergency');
}

{
  const r = computeBALAScore({ symptom_text: 'heart attack' });
  assert(r.emergency === true, 'heart attack triggers emergency');
}

{
  const r = computeBALAScore({ symptom_level: 'urgent' });
  assert(r.emergency === true, 'symptom_level urgent triggers emergency');
}

{
  const r = computeBALAScore({ notes: 'feeling fine, no chest pain today' });
  // "chest pain" appears in denial — do we trigger? By design yes (safety-first)
  assert(r.emergency === true, 'safety-first: chest pain in notes triggers even in denial');
}

{
  const r = computeBALAScore({ symptom_text: 'mild headache' });
  assert(r.emergency === false, 'mild headache is not an emergency');
  assert(r.score !== null, 'mild headache does not hide score');
}

{
  const r = computeBALAScore({ symptom_text: 'feeling tired' });
  assert(r.emergency === false, 'general fatigue is not emergency');
}

// ---------------------------------------------------------------------------
// Suite 2: Recovery contribution
// ---------------------------------------------------------------------------
console.log('Suite 2: Recovery contribution');

{
  const r = _recoveryContribution({
    hrv_today: 60, hrv_baseline7d: 50, // above baseline — good
    rhr_today: 58, rhr_baseline7d: 62, // below baseline — good
    sleep_hours_today: 8, sleep_hours_goal: 7.5,
    spo2_pct: 97,
  });
  assert(r.total >= 28, 'strong recovery inputs score at least 28/35');
  assert(r.total <= 35, 'recovery total never exceeds 35');
  assert(r.signals.length === 4, 'four recovery signals present');
}

{
  const r = _recoveryContribution({}); // no inputs
  assert(r.total === 0, 'no recovery inputs = 0 pts');
  assert(r.signals.length === 0, 'no recovery signals');
}

{
  // HRV well below baseline
  const r = _recoveryContribution({ hrv_today: 30, hrv_baseline7d: 60 });
  const hrvSignal = r.signals.find((s) => s.signal === 'hrv');
  assert(hrvSignal !== undefined, 'hrv signal present');
  assert(hrvSignal.pts < 8, 'low hrv scores lower than baseline');
  assert(typeof hrvSignal.label === 'string', 'hrv label is string');
  assert(!hrvSignal.label.includes('risk'), 'hrv label does not say "risk"');
  assert(!hrvSignal.label.includes('danger'), 'hrv label does not say "danger"');
}

{
  // SpO2 below 95
  const r = _recoveryContribution({ spo2_pct: 92 });
  const sig = r.signals.find((s) => s.signal === 'spo2');
  assert(sig.pts <= 3, 'low SpO2 scores <= 3');
  assert(sig.label.includes('doctor') || sig.label.includes('professional'), 'low SpO2 suggests professional consultation');
}

// ---------------------------------------------------------------------------
// Suite 3: Sleep contribution
// ---------------------------------------------------------------------------
console.log('Suite 3: Sleep contribution');

{
  const r = _sleepContribution({
    sleep_consistency_minutes: 5, // very consistent
    sleep_score: 82,
    late_meal: false,
    evening_caffeine: false,
  });
  assert(r.total >= 17, 'good sleep inputs score at least 17');
  assert(r.total <= 25, 'sleep total never exceeds 25');
}

{
  const r = _sleepContribution({ late_meal: true, evening_caffeine: true });
  assert(r.total < 0, 'late meal + caffeine can push sleep total negative');
  assert(r.total >= -5, 'sleep floor is -5');
}

{
  const r = _sleepContribution({ sleep_consistency_minutes: 90 }); // very inconsistent
  const sig = r.signals.find((s) => s.signal === 'sleep_consistency');
  assert(sig.pts < 5, 'high variance scores low on consistency');
}

// ---------------------------------------------------------------------------
// Suite 4: Activity contribution
// ---------------------------------------------------------------------------
console.log('Suite 4: Activity contribution');

{
  const r = _activityContribution({
    steps_today: 10000, steps_goal: 10000,
    weekly_cardio_pct: 80, day_of_week: 5,
    workout_logged: true,
  });
  assert(r.total >= 17, 'strong activity day scores at least 17');
  assert(r.total <= 20, 'activity total never exceeds 20');
}

{
  const r = _activityContribution({ steps_today: 0, steps_goal: 8000, workout_logged: false });
  const steps = r.signals.find((s) => s.signal === 'steps');
  assert(steps.pts === 0, 'zero steps = 0 pts');
  assert(!steps.label.includes('failure'), 'zero steps label is not judgmental');
  assert(!steps.label.includes('lazy'), 'zero steps label not negative');
}

// ---------------------------------------------------------------------------
// Suite 5: Lifestyle modifier
// ---------------------------------------------------------------------------
console.log('Suite 5: Lifestyle modifier');

{
  const r = _lifestyleModifier({ alcohol_drinks: 4, hydration: 'low', stress_level: 5, travel_today: true });
  assert(r.total <= -14, 'worst lifestyle gives floor -14');
  assert(r.total >= -14, 'lifestyle floor is -14');
}

{
  const r = _lifestyleModifier({});
  assert(r.total === 0, 'no lifestyle inputs = 0 modifier');
}

{
  const r = _lifestyleModifier({ alcohol_drinks: 1 });
  const sig = r.signals.find((s) => s.signal === 'alcohol');
  assert(sig.pts === -1, 'one drink = -1 pts');
  assert(!sig.label.includes('bad'), 'alcohol label not judgmental');
  assert(sig.label.includes('awareness'), 'alcohol framed as awareness');
}

{
  const r = _lifestyleModifier({ stress_level: 1 });
  assert(r.total === 0, 'stress level 1 (lowest) = 0 modifier');
}

{
  const r = _lifestyleModifier({ stress_level: 5 });
  assert(r.total <= -4, 'max stress applies meaningful modifier');
}

// ---------------------------------------------------------------------------
// Suite 6: Symptom modifier
// ---------------------------------------------------------------------------
console.log('Suite 6: Symptom modifier');

{
  const r = _symptomModifier({ symptom_level: 'none' });
  assert(r.emergency === false, 'no symptom not emergency');
  assert(r.pts === 0, 'no symptom no modifier');
}

{
  const r = _symptomModifier({ symptom_level: 'mild' });
  assert(r.emergency === false, 'mild not emergency');
  assert(r.pts === -5, 'mild = -5');
}

{
  const r = _symptomModifier({ symptom_level: 'moderate' });
  assert(r.emergency === false, 'moderate not emergency');
  assert(r.pts === -10, 'moderate = -10');
}

{
  const r = _symptomModifier({ symptom_level: 'urgent' });
  assert(r.emergency === true, 'urgent triggers emergency');
}

// ---------------------------------------------------------------------------
// Suite 7: Confidence calculation
// ---------------------------------------------------------------------------
console.log('Suite 7: Confidence calculation');

{
  // Full signals
  const allInputs = {};
  ALL_SIGNAL_KEYS.forEach((k) => { allInputs[k] = 1; });
  const c = _computeConfidence(allInputs);
  assert(c.level === 'HIGH', 'all signals = HIGH confidence');
  assert(c.ratio === 100, 'all signals = 100% ratio');
}

{
  const c = _computeConfidence({});
  assert(c.level === 'VERY_LOW', 'no signals = VERY_LOW');
  assert(c.available === 0, 'no signals available count = 0');
}

{
  // Partial — 7 of 12
  const partial = { hrv_today: 50, rhr_today: 60, sleep_hours_today: 7, spo2_pct: 97, steps_today: 6000, weekly_cardio_pct: 60, workout_logged: true };
  const c = _computeConfidence(partial);
  assert(c.level === 'MEDIUM' || c.level === 'HIGH', 'partial signals = MEDIUM or HIGH');
}

// ---------------------------------------------------------------------------
// Suite 8: Full computeBALAScore — score range and shape
// ---------------------------------------------------------------------------
console.log('Suite 8: Full computeBALAScore');

{
  // Best possible day
  const best = computeBALAScore({
    hrv_today: 70, hrv_baseline7d: 50,
    rhr_today: 55, rhr_baseline7d: 62,
    sleep_hours_today: 8, sleep_hours_goal: 7.5,
    spo2_pct: 98,
    sleep_consistency_minutes: 5,
    sleep_score: 90,
    steps_today: 12000, steps_goal: 10000,
    weekly_cardio_pct: 100, day_of_week: 7,
    workout_logged: true,
    alcohol_drinks: 0,
    hydration: 'well',
    stress_level: 1,
  });
  assert(!best.emergency, 'best day: no emergency');
  assert(best.score !== null, 'best day: score present');
  assert(best.score >= 80, 'best day scores at least 80');
  assert(best.score <= 100, 'best day max 100');
}

{
  // Worst non-emergency day
  const worst = computeBALAScore({
    hrv_today: 20, hrv_baseline7d: 55,
    rhr_today: 80, rhr_baseline7d: 60,
    sleep_hours_today: 3, sleep_hours_goal: 8,
    spo2_pct: 91,
    sleep_consistency_minutes: 180,
    sleep_score: 25,
    steps_today: 200, steps_goal: 10000,
    weekly_cardio_pct: 5, day_of_week: 6,
    workout_logged: false,
    alcohol_drinks: 5,
    hydration: 'low',
    stress_level: 5,
    travel_today: true,
    symptom_level: 'moderate',
    late_meal: true,
    evening_caffeine: true,
  });
  assert(!worst.emergency, 'worst non-emergency: emergency=false');
  assert(worst.score !== null, 'worst non-emergency: score present');
  assert(worst.score >= 0, 'worst score min 0');
  assert(worst.score <= 50, 'worst day scores at most 50');
}

{
  // Null/empty inputs — graceful
  const empty = computeBALAScore({});
  assert(!empty.emergency, 'empty inputs: no emergency');
  assert(empty.score === 50, 'empty inputs: base score 50');
  assert(empty.confidence.level === 'VERY_LOW', 'empty inputs: VERY_LOW confidence');
  assert(empty.missingSignals.length === ALL_SIGNAL_KEYS.length, 'empty inputs: all signals missing');
}

{
  // Invalid input — no crash
  const bad = computeBALAScore(null);
  assert(!bad.emergency, 'null input: no crash');
}

// ---------------------------------------------------------------------------
// Suite 9: Medical safety — no forbidden terms in labels
// ---------------------------------------------------------------------------
console.log('Suite 9: Medical safety');

const FORBIDDEN = ['diagnos', 'treat', 'prevent', 'predict', 'guaranteed', 'cure', 'at risk of disease'];

function checkNoForbidden(text, context) {
  if (!text) return;
  FORBIDDEN.forEach((term) => {
    assert(!text.toLowerCase().includes(term), `${context}: label must not contain "${term}"`);
  });
}

{
  const scenarios = [
    { hrv_today: 30, hrv_baseline7d: 60 },
    { spo2_pct: 91 },
    { symptom_level: 'moderate' },
    { alcohol_drinks: 5, hydration: 'low', stress_level: 5 },
    { sleep_hours_today: 3, sleep_hours_goal: 8, late_meal: true, evening_caffeine: true },
    { steps_today: 0, steps_goal: 10000 },
  ];

  scenarios.forEach((inputs, i) => {
    const r = computeBALAScore(inputs);
    checkNoForbidden(r.label, `scenario ${i} label`);
    if (r.changeCopy) checkNoForbidden(r.changeCopy, `scenario ${i} changeCopy`);
    if (r.categories) {
      Object.values(r.categories).forEach((cat) => {
        if (cat && Array.isArray(cat.signals)) {
          cat.signals.forEach((s) => checkNoForbidden(s.label, `scenario ${i} signal ${s.signal}`));
        }
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Suite 10: changeCopy — only appears when delta >= 5
// ---------------------------------------------------------------------------
console.log('Suite 10: Change copy');

{
  const r = computeBALAScore(
    { hrv_today: 60, hrv_baseline7d: 45, steps_today: 9000, steps_goal: 10000 },
    { previous_score: 60 }
  );
  // delta would be small (no guarantee which direction)
  // just check it's null or a string
  assert(r.changeCopy === null || typeof r.changeCopy === 'string', 'changeCopy is null or string');
}

{
  // Force a score of ~90, previous 70 => delta ~20
  const r = computeBALAScore(
    { hrv_today: 70, hrv_baseline7d: 50, sleep_hours_today: 8, sleep_hours_goal: 7.5, steps_today: 10000, steps_goal: 10000, workout_logged: true },
    { previous_score: 55 }
  );
  assert(r.changeCopy !== null, 'large delta produces changeCopy');
  assert(typeof r.changeCopy === 'string', 'changeCopy is string');
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
const total = passed + failed;
console.log(`\nBALA Score Engine tests: ${passed}/${total} passed`);
if (failed > 0) {
  console.error(`${failed} test(s) FAILED`);
  process.exit(1);
}
console.log('PASS bala-score-engine.test.js');
