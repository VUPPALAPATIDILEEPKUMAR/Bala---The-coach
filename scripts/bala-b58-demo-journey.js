// =============================================================================
// BALA B58 — Founder Demo Journey Engine
// =============================================================================
// A seven-step guided journey that walks through every core BALA feature using
// safe demo data. Runs entirely in the browser — no network, no health data
// uploaded, no medical claims.
//
// Safe-language contract (NEVER use):
//   diagnos | predict | prevent | cure | treat | detect disease
//   cardiac arrest | heart attack | stroke | prescription
// =============================================================================
'use strict';

const JOURNEY_STEPS = [
  {
    id: 'score',
    title: 'Your BALA Score',
    emoji: '\u{1F49A}',
    subtitle: 'A calm daily signal — not a clinical label.',
    body: 'The BALA Score reflects patterns from your recent check-ins. A higher score may suggest your body signals are in balance. A lower score may suggest a day to rest or pay attention to recovery.',
    safeNote: 'This is a guide, not a medical measurement. It cannot diagnose any condition.',
  },
  {
    id: 'signals',
    title: 'What Influenced Today',
    emoji: '\u{1F4CA}',
    subtitle: 'Signals BALA noticed from your check-in.',
    body: 'BALA uses sleep, heart rate variability, resting heart rate, blood oxygen, steps, and activity — signals you can observe. Missing signals are shown clearly so you always know what was used.',
    safeNote: 'BALA works only with what you share. For concerns about missing signals, speak with your doctor.',
  },
  {
    id: 'detail',
    title: 'Signal History',
    emoji: '\u{1F50D}',
    subtitle: 'See a signal\'s trend across your recent check-ins.',
    body: 'Tap any signal card to see its recent history. Trends may help you notice patterns — for example, whether your sleep has been consistent, or when your HRV tends to dip.',
    safeNote: 'Trends are observations, not predictions. Involve your doctor for any health decisions.',
  },
  {
    id: 'reflection',
    title: 'Weekly Reflection',
    emoji: '\u{1F33F}',
    subtitle: 'A gentle look at how your week has gone.',
    body: 'Once you have a week of check-ins, BALA shows a reflection: which days felt strong, which may need attention, and a plain-language summary of your signal patterns.',
    safeNote: 'Reflections are based on your own data only. For any patterns of concern, speak with your doctor.',
  },
  {
    id: 'coach',
    title: 'Ask BALA Coach',
    emoji: '\u{1F91D}',
    subtitle: 'Get calm, plain-English guidance about a signal.',
    body: 'Ask BALA about sleep quality, HRV trends, resting heart rate, steps, or recovery. BALA responds with educational context about what that signal may mean — not a clinical opinion.',
    safeNote: 'BALA Coach does not replace a doctor. For medical decisions, always speak with a qualified healthcare professional.',
  },
  {
    id: 'summary',
    title: 'Doctor-Ready Summary',
    emoji: '\u{1F4CB}',
    subtitle: 'A plain-English summary you can share with your doctor.',
    body: 'BALA can generate a short document showing your recent signals, trends, and any patterns you\'ve noticed — designed to support, not replace, a conversation with your doctor.',
    safeNote: 'This summary is for awareness only. It is not a medical record, diagnosis, or prescription.',
  },
  {
    id: 'closing',
    title: 'BALA is Your Guide',
    emoji: '\u{1F331}',
    subtitle: 'Health awareness starts with listening to your own body.',
    body: 'BALA helps you notice signals earlier and take small steps toward better awareness. Your data stays on your device. No account needed. Always free.\n\nBuilt in memory of Balaji — whose name inspired BALA.',
    safeNote: 'BALA is not a medical device. For urgent symptoms — chest pain, difficulty breathing, or sudden weakness — seek emergency care immediately.',
  },
];

const PROHIBITED_CLINICAL_WORDS = [
  'diagnos', 'predict', 'prevent cardiac', 'cure', 'treats ', 'detect disease',
  'cardiac arrest', 'heart attack in', 'stroke detection', 'prescription',
];

function scanStepForUnsafeCopy(step) {
  const full = [step.title, step.subtitle, step.body].join(' ').toLowerCase(); // safeNote excluded — it legitimately says 'cannot diagnose'
  return PROHIBITED_CLINICAL_WORDS.filter(function(w) { return full.indexOf(w) !== -1; });
}

function auditAllSteps() {
  var violations = [];
  for (var i = 0; i < JOURNEY_STEPS.length; i++) {
    var step = JOURNEY_STEPS[i];
    var hits = scanStepForUnsafeCopy(step);
    if (hits.length > 0) violations.push({ step: step.id, hits: hits });
  }
  return violations;
}

function createJourneyState() {
  return {
    active: false,
    currentStep: 0,
    totalSteps: JOURNEY_STEPS.length,
    startedAt: null,
    completedAt: null,
    stepsViewed: [],
  };
}

function journeyAdvanceState(state) {
  if (!state.active) return state;
  var next = Math.min(state.currentStep + 1, state.totalSteps - 1);
  var viewed = state.stepsViewed.indexOf(state.currentStep) === -1
    ? state.stepsViewed.concat([state.currentStep])
    : state.stepsViewed;
  var isLast = next === state.totalSteps - 1;
  return {
    active: state.active,
    currentStep: next,
    totalSteps: state.totalSteps,
    startedAt: state.startedAt,
    completedAt: (isLast && next === state.currentStep) ? (state.completedAt || new Date().toISOString()) : state.completedAt,
    stepsViewed: viewed,
  };
}

function journeyBackState(state) {
  if (!state.active) return state;
  return Object.assign({}, state, { currentStep: Math.max(state.currentStep - 1, 0) });
}

function journeyStartState(state) {
  return {
    active: true,
    currentStep: 0,
    totalSteps: JOURNEY_STEPS.length,
    startedAt: new Date().toISOString(),
    completedAt: null,
    stepsViewed: [],
  };
}

function journeyExitState(state) {
  return Object.assign({}, state, { active: false });
}

function getJourneyCurrentStep(state) {
  return JOURNEY_STEPS[state.currentStep] || JOURNEY_STEPS[0];
}

function getJourneyProgress(state) {
  return {
    current: state.currentStep + 1,
    total: state.totalSteps,
    percent: Math.round(((state.currentStep + 1) / state.totalSteps) * 100),
    isFirst: state.currentStep === 0,
    isLast: state.currentStep === state.totalSteps - 1,
    stepsViewed: state.stepsViewed.length,
  };
}

const DEMO_DATA_SPEC = {
  requiredFields: ['source', 'sleep', 'rhr', 'hrv', 'spo2', 'steps'],
  safeSourceLabel: 'BALA demo',
};

function validateDemoData(data) {
  if (!data || typeof data !== 'object') return { valid: false, reason: 'No data provided' };
  var src = String(data.source || '').toLowerCase();
  if (src.indexOf('demo') === -1) return { valid: false, reason: 'Source must include "demo"' };
  var missing = DEMO_DATA_SPEC.requiredFields.filter(function(f) { return !(f in data); });
  if (missing.length > 0) return { valid: false, reason: 'Missing fields: ' + missing.join(', ') };
  return { valid: true };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    JOURNEY_STEPS,
    PROHIBITED_CLINICAL_WORDS,
    DEMO_DATA_SPEC,
    createJourneyState,
    journeyAdvanceState,
    journeyBackState,
    journeyStartState,
    journeyExitState,
    getJourneyCurrentStep,
    getJourneyProgress,
    scanStepForUnsafeCopy,
    auditAllSteps,
    validateDemoData,
  };
}
