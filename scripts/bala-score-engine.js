#!/usr/bin/env node
'use strict';

// =============================================================================
// BALA Score Engine — Stage 43
// -----------------------------------------------------------------------------
// Computes a daily BALA Score (0–100) from wearable and lifestyle signals.
//
// This is a health-AWARENESS score, not a medical index.
//   * Never claims to predict, prevent, diagnose, or treat anything.
//   * Baseline-relative: compares today vs your own recent 7-day average.
//   * Graceful: missing signals lower confidence but do not crash the score.
//   * Emergency override: any urgent symptom hides the score entirely and
//     returns urgent-care guidance — non-negotiable, highest-priority gate.
//   * Safe copy: warm, non-clinical labels only. No "at risk", "bad", "danger".
//
// All weights from BALA_SCORE_MODEL_REVIEW_PLAN.md (Stage 22 approved spec).
// =============================================================================

// ---------------------------------------------------------------------------
// Emergency phrases — must match chintu-brain-router.js EMERGENCY_PHRASES
// ---------------------------------------------------------------------------
const EMERGENCY_PHRASES = [
  'chest pain', 'chest pressure', 'chest tight', 'tight chest',
  'cant breathe', 'cannot breathe', 'trouble breathing',
  'shortness of breath', 'short of breath', 'fainting', 'fainted',
  'passed out', 'severe weakness', 'numb on one side', 'face drooping',
  'slurred speech', 'stroke', 'heart attack', 'collapsed', 'unconscious',
];

const EMERGENCY_REPLY =
  'This sounds urgent. Please stop and seek urgent or emergency care right ' +
  'now — contact your local emergency number or get to the nearest emergency ' +
  'department. Do not wait on any app or score for this. ' +
  'BALA is only a calm daily check-in guide and is not for emergencies.';

function hasEmergency(text) {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase();
  return EMERGENCY_PHRASES.some((p) => lower.includes(p));
}

// ---------------------------------------------------------------------------
// Clamp helper
// ---------------------------------------------------------------------------
function clamp(value, min, max) {
  if (typeof value !== 'number' || isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

// ---------------------------------------------------------------------------
// Baseline comparison
// Returns a value in [0, 1]: 1.0 = well above baseline, 0.5 = at baseline,
// 0 = well below baseline. Uses the 7-day recent average as the reference.
// ---------------------------------------------------------------------------
function baselineRatio(today, baseline7d) {
  if (typeof today !== 'number' || typeof baseline7d !== 'number') return null;
  if (baseline7d === 0) return 0.5; // avoid division by zero
  return clamp(today / baseline7d, 0, 2);
}

// ---------------------------------------------------------------------------
// Category 1 — Recovery Signals  (0–35 pts)
// HRV(0-15) + RHR(0-10) + sleep_duration(0-10) + SpO2(0-5)
// ---------------------------------------------------------------------------
function recoveryContribution(inputs) {
  const signals = [];
  let total = 0;
  let possible = 0;

  // HRV vs 7-day baseline: 0–15 pts
  possible += 15;
  if (typeof inputs.hrv_today === 'number' && typeof inputs.hrv_baseline7d === 'number') {
    const ratio = baselineRatio(inputs.hrv_today, inputs.hrv_baseline7d);
    const pts = clamp(ratio * 10, 0, 15);
    total += pts;
    signals.push({
      signal: 'hrv',
      pts: Math.round(pts),
      label: ratio >= 1.05
        ? 'Your HRV looks a bit higher than recent days — a positive recovery signal.'
        : ratio >= 0.9
          ? 'Your HRV is close to your recent pattern.'
          : 'Your HRV looks a bit lower than recent days — a rest day may help.',
    });
  }

  // Resting heart rate vs baseline: 0–10 pts (lower RHR = better)
  possible += 10;
  if (typeof inputs.rhr_today === 'number' && typeof inputs.rhr_baseline7d === 'number') {
    const ratio = baselineRatio(inputs.rhr_today, inputs.rhr_baseline7d);
    // Lower RHR is better — invert the ratio
    const invertedRatio = 2 - ratio; // ratio < 1 means RHR below baseline = good
    const pts = clamp(invertedRatio * 5, 0, 10);
    total += pts;
    signals.push({
      signal: 'rhr',
      pts: Math.round(pts),
      label: inputs.rhr_today < inputs.rhr_baseline7d
        ? 'Resting heart rate is below your recent pattern — a calm signal.'
        : inputs.rhr_today === inputs.rhr_baseline7d
          ? 'Resting heart rate is close to your recent pattern.'
          : 'Resting heart rate is above your recent pattern — worth noticing.',
    });
  }

  // Sleep duration vs goal: 0–10 pts
  possible += 10;
  if (typeof inputs.sleep_hours_today === 'number') {
    const goal = typeof inputs.sleep_hours_goal === 'number' ? inputs.sleep_hours_goal : 7.5;
    const ratio = clamp(inputs.sleep_hours_today / goal, 0, 1.3);
    const pts = clamp(ratio * 8, 0, 10);
    total += pts;
    const diff = inputs.sleep_hours_today - goal;
    signals.push({
      signal: 'sleep_duration',
      pts: Math.round(pts),
      label: diff >= -0.5 && diff <= 1
        ? 'Sleep duration was close to your goal.'
        : diff < -0.5
          ? `Sleep was about ${Math.abs(diff).toFixed(1)}h shorter than your goal.`
          : 'Sleep was a bit longer than your goal — your body may have needed it.',
    });
  }

  // SpO2: 0–5 pts
  possible += 5;
  if (typeof inputs.spo2_pct === 'number') {
    let pts = 0;
    if (inputs.spo2_pct >= 95) pts = 5;
    else if (inputs.spo2_pct >= 93) pts = 3;
    else pts = 1;
    total += pts;
    signals.push({
      signal: 'spo2',
      pts,
      label: inputs.spo2_pct >= 95
        ? 'Blood oxygen looks within the typical range.'
        : 'Blood oxygen is outside typical range — discuss any persistent concerns with a doctor.',
    });
  }

  return { total: clamp(total, 0, 35), possible, signals };
}

// ---------------------------------------------------------------------------
// Category 2 — Sleep Quality  (−5 to +25 pts)
// sleep_consistency(0-10) + sleep_score(0-10) + late_meal(-3) + caffeine(-2)
// ---------------------------------------------------------------------------
function sleepContribution(inputs) {
  const signals = [];
  let total = 0;
  let possible = 0;

  // Sleep timing consistency: 0–10 pts
  possible += 10;
  if (typeof inputs.sleep_consistency_minutes === 'number') {
    // Variance in minutes from usual bedtime — lower is better
    const variance = Math.abs(inputs.sleep_consistency_minutes);
    const pts = clamp(10 - variance / 6, 0, 10);
    total += pts;
    signals.push({
      signal: 'sleep_consistency',
      pts: Math.round(pts),
      label: variance <= 15
        ? 'Sleep timing was consistent with your recent pattern.'
        : variance <= 45
          ? 'Sleep timing shifted a bit — consistency helps your recovery signals.'
          : 'Sleep timing was noticeably different — your body clock may take a day to adjust.',
    });
  }

  // Device sleep score: 0–10 pts (normalized from 0–100 device score)
  possible += 10;
  if (typeof inputs.sleep_score === 'number') {
    const pts = clamp((inputs.sleep_score / 100) * 10, 0, 10);
    total += pts;
    signals.push({
      signal: 'sleep_score',
      pts: Math.round(pts),
      label: inputs.sleep_score >= 75
        ? 'Sleep quality from your device looks good.'
        : inputs.sleep_score >= 55
          ? 'Sleep quality from your device was moderate.'
          : 'Sleep quality from your device looks lower than usual.',
    });
  }

  // Late meal modifier: −3
  if (inputs.late_meal === true) {
    total += -3;
    signals.push({
      signal: 'late_meal',
      pts: -3,
      label: 'Late meal noted — this may affect sleep quality for some people.',
    });
  }

  // Evening caffeine modifier: −2
  if (inputs.evening_caffeine === true) {
    total += -2;
    signals.push({
      signal: 'evening_caffeine',
      pts: -2,
      label: 'Afternoon or evening caffeine noted — caffeine affects sleep differently for each person.',
    });
  }

  return { total: clamp(total, -5, 25), possible, signals };
}

// ---------------------------------------------------------------------------
// Category 3 — Activity  (0–20 pts)
// steps(0-8) + weekly_cardio(0-7) + workout_logged(0-5)
// ---------------------------------------------------------------------------
function activityContribution(inputs) {
  const signals = [];
  let total = 0;
  let possible = 0;

  // Steps vs baseline: 0–8 pts
  possible += 8;
  if (typeof inputs.steps_today === 'number') {
    const goal = typeof inputs.steps_goal === 'number' ? inputs.steps_goal : 8000;
    const ratio = clamp(inputs.steps_today / goal, 0, 1.25);
    const pts = clamp(ratio * 7, 0, 8);
    total += pts;
    const pct = Math.round((inputs.steps_today / goal) * 100);
    signals.push({
      signal: 'steps',
      pts: Math.round(pts),
      label: pct >= 90
        ? `Steps look strong — at ${pct}% of your daily target.`
        : pct >= 60
          ? `Steps at ${pct}% of your daily target.`
          : `Steps are lighter today — at ${pct}% of your target. A short walk can close the gap.`,
    });
  }

  // Weekly cardio progress: 0–7 pts
  possible += 7;
  if (typeof inputs.weekly_cardio_pct === 'number') {
    const pct = clamp(inputs.weekly_cardio_pct, 0, 100);
    // Scale to day of week — partial week is expected progress
    const dayOfWeek = typeof inputs.day_of_week === 'number' ? clamp(inputs.day_of_week, 1, 7) : 7;
    const expectedPct = (dayOfWeek / 7) * 100;
    const ratio = expectedPct > 0 ? pct / expectedPct : (pct / 100);
    const pts = clamp(ratio * 6, 0, 7);
    total += pts;
    signals.push({
      signal: 'weekly_cardio',
      pts: Math.round(pts),
      label: pct >= expectedPct * 0.9
        ? `Weekly cardio is on track at ${Math.round(pct)}%.`
        : `Weekly cardio at ${Math.round(pct)}% — a moderate session can make good progress.`,
    });
  }

  // Workout logged: 0–5 pts
  possible += 5;
  if (inputs.workout_logged === true) {
    total += 5;
    signals.push({ signal: 'workout_logged', pts: 5, label: 'Workout detected — active day.' });
  } else if (inputs.workout_logged === false) {
    signals.push({ signal: 'workout_logged', pts: 0, label: 'No workout logged today.' });
  }

  return { total: clamp(total, 0, 20), possible, signals };
}

// ---------------------------------------------------------------------------
// Category 4 — Lifestyle Context  (−14 to 0 pts)
// alcohol(0 to −6) + hydration(0 to −3) + stress(0 to −5) + travel(0/−3)
// ---------------------------------------------------------------------------
function lifestyleModifier(inputs) {
  const signals = [];
  let total = 0;

  // Alcohol: 0 drinks = 0, 1 = −1, 2 = −2, 3 = −4, 4+ = −6
  if (typeof inputs.alcohol_drinks === 'number' && inputs.alcohol_drinks > 0) {
    const drinks = inputs.alcohol_drinks;
    const pts = drinks >= 4 ? -6 : drinks >= 3 ? -4 : drinks >= 2 ? -2 : -1;
    total += pts;
    signals.push({
      signal: 'alcohol',
      pts,
      label: 'Alcohol noted — an awareness signal, not a judgment. This can affect recovery signals.',
    });
  }

  // Hydration: well(0), okay(-1), low(-3)
  if (inputs.hydration === 'low') {
    total += -3;
    signals.push({ signal: 'hydration', pts: -3, label: 'Low hydration noted — may affect how your body signals look.' });
  } else if (inputs.hydration === 'okay') {
    total += -1;
    signals.push({ signal: 'hydration', pts: -1, label: 'Hydration was moderate today.' });
  }

  // Stress: 1-5 scale → 0 to −5
  if (typeof inputs.stress_level === 'number') {
    const stress = clamp(Math.round(inputs.stress_level), 1, 5);
    const pts = -(stress - 1); // 1=0, 2=-1, 3=-2, 4=-3, 5=-4… capped at -5
    const actualPts = clamp(pts, -5, 0);
    if (actualPts < 0) {
      total += actualPts;
      signals.push({
        signal: 'stress',
        pts: actualPts,
        label: `Stress noted at level ${stress}/5 — stress often shows up in recovery signals.`,
      });
    }
  }

  // Travel / time zone shift: −3
  if (inputs.travel_today === true) {
    total += -3;
    signals.push({
      signal: 'travel',
      pts: -3,
      label: 'Travel noted — your baseline may shift for a day or two after crossing time zones.',
    });
  }

  return { total: clamp(total, -14, 0), possible: 0, signals };
}

// ---------------------------------------------------------------------------
// Category 5 — Symptom override  (score visible or hidden)
// none(0) | mild(-5) | moderate(-10) | urgent(EMERGENCY — score hidden)
// ---------------------------------------------------------------------------
function symptomModifier(inputs) {
  // Text-based emergency check first
  const symptomText = [
    inputs.symptom_text,
    inputs.notes,
  ].filter(Boolean).join(' ');

  if (hasEmergency(symptomText)) {
    return {
      emergency: true,
      pts: 0,
      label: EMERGENCY_REPLY,
    };
  }

  const level = inputs.symptom_level || 'none';

  if (level === 'urgent') {
    return {
      emergency: true,
      pts: 0,
      label: EMERGENCY_REPLY,
    };
  }

  if (level === 'moderate') {
    return {
      emergency: false,
      pts: -10,
      label: 'Moderate symptoms noted — may be worth monitoring if they persist.',
    };
  }

  if (level === 'mild') {
    return {
      emergency: false,
      pts: -5,
      label: 'Mild symptoms noted — listening to your body is a healthy habit.',
    };
  }

  return { emergency: false, pts: 0, label: null };
}

// ---------------------------------------------------------------------------
// Confidence calculation
// ---------------------------------------------------------------------------
const ALL_SIGNAL_KEYS = [
  'hrv_today', 'rhr_today', 'sleep_hours_today', 'spo2_pct',
  'sleep_consistency_minutes', 'sleep_score',
  'steps_today', 'weekly_cardio_pct', 'workout_logged',
  'alcohol_drinks', 'hydration', 'stress_level',
];

function computeConfidence(inputs) {
  const available = ALL_SIGNAL_KEYS.filter((k) => inputs[k] != null).length;
  const total = ALL_SIGNAL_KEYS.length;
  const ratio = available / total;
  let level;
  if (ratio >= 0.8) level = 'HIGH';
  else if (ratio >= 0.5) level = 'MEDIUM';
  else if (ratio >= 0.25) level = 'LOW';
  else level = 'VERY_LOW';
  return { ratio: Math.round(ratio * 100), level, available, total };
}

// ---------------------------------------------------------------------------
// Score label — warm, non-clinical
// ---------------------------------------------------------------------------
function scoreLabel(score, confidence) {
  if (confidence.level === 'VERY_LOW') {
    return 'Limited data — add more signals to improve your score.';
  }
  if (score >= 80) return 'Your body signals look strong today.';
  if (score >= 65) return 'Your signals look steady and balanced.';
  if (score >= 50) return 'A moderate day — a good time to listen to your body.';
  if (score >= 35) return 'Your signals suggest today may be a good day to rest or take it easy.';
  return 'Your body signals suggest a lighter day. Rest, hydrate, and check in with how you feel.';
}

// ---------------------------------------------------------------------------
// "Why This Changed" copy (when score changes ≥5 pts from yesterday)
// ---------------------------------------------------------------------------
function buildChangeCopy(allSignals, scoreDelta) {
  if (typeof scoreDelta !== 'number' || Math.abs(scoreDelta) < 5) return null;
  const direction = scoreDelta > 0 ? 'improved' : 'lower';

  // Pick the most impactful signal pair for the explanation
  const positive = allSignals
    .filter((s) => s.pts > 0)
    .sort((a, b) => b.pts - a.pts)[0];
  const negative = allSignals
    .filter((s) => s.pts < 0)
    .sort((a, b) => a.pts - b.pts)[0];

  if (direction === 'improved' && positive) {
    return `Your score ${direction} — ${positive.label}`;
  }
  if (direction === 'lower' && negative) {
    return `Your score is ${direction} today — ${negative.label}`;
  }
  return `Your signals ${direction === 'improved' ? 'look a bit better' : 'are a bit lower'} than yesterday.`;
}

// ---------------------------------------------------------------------------
// Top contributors summary (positive and negative, for "why this score")
// ---------------------------------------------------------------------------
function topContributors(allSignals) {
  const positive = allSignals
    .filter((s) => s.pts > 0)
    .sort((a, b) => b.pts - a.pts)
    .slice(0, 3);
  const warnings = allSignals
    .filter((s) => s.pts < 0)
    .sort((a, b) => a.pts - b.pts)
    .slice(0, 2);
  return { positive, warnings };
}

// ---------------------------------------------------------------------------
// Main export: computeBALAScore
// ---------------------------------------------------------------------------
/**
 * Compute the BALA Score from today's signals.
 *
 * @param {object} inputs — signal values (see ALL_SIGNAL_KEYS + symptom fields)
 * @param {object} [options]
 * @param {number} [options.previous_score] — yesterday's score, for change copy
 *
 * @returns {object} result
 *   .emergency {boolean} — true if urgent symptoms detected
 *   .emergencyReply {string} — only present if emergency=true
 *   .score {number|null} — null if emergency
 *   .confidence {object} — .ratio, .level, .available, .total
 *   .label {string} — warm non-clinical summary
 *   .changeCopy {string|null} — why it changed vs yesterday
 *   .contributors {object} — .positive[], .warnings[]
 *   .categories {object} — per-category totals and signals
 */
function computeBALAScore(inputs, options) {
  const safeInputs = inputs && typeof inputs === 'object' ? inputs : {};
  const opts = options && typeof options === 'object' ? options : {};

  // ---- Emergency gate (highest priority, always wins) ----
  const symptom = symptomModifier(safeInputs);
  if (symptom.emergency) {
    return {
      emergency: true,
      emergencyReply: EMERGENCY_REPLY,
      score: null,
      confidence: null,
      label: EMERGENCY_REPLY,
      changeCopy: null,
      contributors: { positive: [], warnings: [] },
      categories: {},
    };
  }

  // ---- Category contributions ----
  const recovery = recoveryContribution(safeInputs);
  const sleep = sleepContribution(safeInputs);
  const activity = activityContribution(safeInputs);
  const lifestyle = lifestyleModifier(safeInputs);

  const base = 50;
  const rawScore =
    base +
    recovery.total +
    sleep.total +
    activity.total +
    lifestyle.total +
    symptom.pts;
  const score = clamp(Math.round(rawScore), 0, 100);

  const confidence = computeConfidence(safeInputs);

  const allSignals = [
    ...recovery.signals,
    ...sleep.signals,
    ...activity.signals,
    ...lifestyle.signals,
    ...(symptom.label ? [{ signal: 'symptom', pts: symptom.pts, label: symptom.label }] : []),
  ];

  const scoreDelta =
    typeof opts.previous_score === 'number' ? score - opts.previous_score : null;

  return {
    emergency: false,
    score,
    confidence,
    label: scoreLabel(score, confidence),
    changeCopy: buildChangeCopy(allSignals, scoreDelta),
    contributors: topContributors(allSignals),
    categories: {
      recovery: { total: recovery.total, possible: recovery.possible, signals: recovery.signals },
      sleep: { total: sleep.total, possible: sleep.possible, signals: sleep.signals },
      activity: { total: activity.total, possible: activity.possible, signals: activity.signals },
      lifestyle: { total: lifestyle.total, signals: lifestyle.signals },
      symptom: { total: symptom.pts, label: symptom.label },
    },
    missingSignals: ALL_SIGNAL_KEYS.filter((k) => safeInputs[k] == null),
  };
}

// Export RISK levels and constants for callers
const CONFIDENCE = { HIGH: 'HIGH', MEDIUM: 'MEDIUM', LOW: 'LOW', VERY_LOW: 'VERY_LOW' };

module.exports = {
  computeBALAScore,
  ALL_SIGNAL_KEYS,
  CONFIDENCE,
  EMERGENCY_REPLY,
  // For testing:
  _recoveryContribution: recoveryContribution,
  _sleepContribution: sleepContribution,
  _activityContribution: activityContribution,
  _lifestyleModifier: lifestyleModifier,
  _symptomModifier: symptomModifier,
  _computeConfidence: computeConfidence,
};
