#!/usr/bin/env node
'use strict';

// =============================================================================
// Chintu BALA Safety Skill — Stage 36
// -----------------------------------------------------------------------------
// A standalone, pure-logic module that handles BALA health-awareness queries
// coming through any channel (Telegram, CLI, bridge). It enforces the full
// medical-safety boundary on every response.
//
// Key contract:
//   respondToBALAQuery(text) -> {
//     reply       : string   — the safe, warm response to send
//     safetyTag   : string   — 'emergency' | 'safe_awareness' | 'boundary' | 'discovery'
//     emergency   : boolean  — true only for life-threatening symptom messages
//     footer      : string   — the mandatory non-medical safety footer
//     capabilityId: string   — always 'bala.askSkill'
//   }
//
// Hard rules:
//   * Pure logic. No network, no fs, no shell, no require beyond this file.
//   * Deterministic: same input → same output. No randomness, no clock.
//   * Emergency phrases ALWAYS override everything else.
//   * Medical-claim requests get a firm, warm boundary response.
//   * No unsafe medical claims (validated by chintu-medical-claims.test.js).
//   * All responses carry BALA_SAFETY_FOOTER.
// =============================================================================

const CAPABILITY_ID = 'bala.askSkill';

const BALA_SAFETY_FOOTER =
  'BALA is a health-awareness companion. It does not diagnose, treat, predict, ' +
  'prevent, replace doctors, or provide emergency monitoring.';

// ---------------------------------------------------------------------------
// Text normalisation — lowercase, collapse whitespace, strip punctuation.
// ---------------------------------------------------------------------------
function normalize(text) {
  return String(text == null ? '' : text)
    .toLowerCase()
    .replace(/[`'"]/g, '')
    .replace(/[^a-z0-9\s?]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasAny(s, words) {
  for (const w of words) {
    if (s.indexOf(w) !== -1) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Emergency detector — must match chintu-brain-router.js EMERGENCY_PHRASES.
// ---------------------------------------------------------------------------
const EMERGENCY_PHRASES = [
  'chest pain', 'chest pressure', 'chest tight', 'tight chest',
  'cant breathe', 'can t breathe', 'cannot breathe', 'trouble breathing',
  'shortness of breath', 'short of breath', 'fainting', 'fainted', 'passed out',
  'severe weakness', 'numb on one side', 'face drooping', 'slurred speech',
  'stroke', 'heart attack', 'collapsed', 'unconscious',
];

function isEmergency(s) {
  return hasAny(s, EMERGENCY_PHRASES);
}

const EMERGENCY_REPLY =
  'This sounds urgent. Please stop and seek urgent or emergency care right now — ' +
  'contact your local emergency number or get to the nearest emergency department. ' +
  'Do not wait on any app or score for this. BALA is only a calm daily check-in guide ' +
  'and is not for emergencies.';

// ---------------------------------------------------------------------------
// Medical-claim boundary detector.
// These are requests BALA must never fulfil — diagnosis, treatment, drugs, etc.
// ---------------------------------------------------------------------------
const MEDICAL_BOUNDARY_PHRASES = [
  'diagnose', 'diagnosis', 'treat', 'treatment', 'cure', 'curing',
  'medication', 'prescription', 'prescribe', 'drug', 'drugs',
  'do i have', 'am i sick', 'is this cancer', 'is this serious',
  'medical advice', 'clinical', 'doctor advice', 'hospital advice',
  'prevent disease', 'prevent cancer', 'prevent heart', 'prevent diabetes',
  'predict my risk', 'predict disease', 'predict heart attack',
];

function isMedicalBoundary(s) {
  return hasAny(s, MEDICAL_BOUNDARY_PHRASES);
}

const BOUNDARY_REPLY =
  'BALA is a health-awareness companion, not a medical advisor. It can help you notice ' +
  'your daily patterns and share them with your doctor — but it cannot diagnose, treat, ' +
  'prescribe, or give clinical advice. For medical questions, please speak with a qualified ' +
  'healthcare professional. BALA is here to help you listen to your body, not to replace ' +
  'the people who are trained to care for it.';

// ---------------------------------------------------------------------------
// BALA-topic rule set. Order matters — first match wins (after emergency + boundary gates).
// ---------------------------------------------------------------------------
const TOPIC_RULES = [
  // ---- BALA Score ----
  {
    name: 'bala_score',
    match: (s) => hasAny(s, [
      'bala score', 'my score', 'what is my score', 'what does my score mean',
      'score today', 'score meaning', 'score low', 'score high', 'explain score',
      'score model', 'how is score', 'score calculation',
    ]),
    reply:
      'Your BALA Score is a calm daily reflection guide — not a diagnosis or a verdict. ' +
      'It is built from the signals your wearable and check-ins reported: sleep quality, ' +
      'resting heart rate, HRV trend, SpO₂ readings, activity level, and how you feel. ' +
      'A lower score on one day does not mean something is wrong — it often just means your ' +
      'body is recovering or adjusting. BALA shows you the direction your signals are pointing, ' +
      'so you can notice patterns over time and share them with your doctor if needed. ' +
      'The score is a guide, not a guarantee.',
    tag: 'safe_awareness',
  },

  // ---- Sleep / Recovery ----
  {
    name: 'sleep_recovery',
    match: (s) => hasAny(s, [
      'sleep', 'rest', 'recovery', 'deep sleep', 'rem sleep', 'light sleep',
      'sleep score', 'sleep quality', 'how did i sleep', 'poor sleep', 'bad sleep',
      'tired', 'fatigue', 'exhausted', 'woke up', 'night waking',
    ]),
    reply:
      'Sleep is one of the strongest recovery signals BALA tracks. When your wearable reports ' +
      'deep sleep, REM cycles, and low night-time heart rate, BALA uses those to understand your ' +
      'recovery direction. Consistently low sleep quality often shows up in your HRV and resting ' +
      'heart rate before you feel it consciously. BALA is not a sleep clinic — it cannot diagnose ' +
      'sleep disorders — but it can help you notice your patterns. If your sleep signals concern ' +
      'you, share the trend with your doctor.',
    tag: 'safe_awareness',
  },

  // ---- HRV ----
  {
    name: 'hrv',
    match: (s) => hasAny(s, [
      'hrv', 'heart rate variability', 'heart rate var', 'what is hrv', 'hrv low',
      'hrv high', 'hrv trend', 'hrv drop', 'hrv dip', 'low hrv', 'high hrv',
    ]),
    reply:
      'HRV — Heart Rate Variability — is the variation in time between your heartbeats. ' +
      'A higher HRV often suggests your body is recovering well and your nervous system is balanced. ' +
      'A lower HRV can reflect stress, poor sleep, illness, or overtraining. BALA tracks your HRV ' +
      'trend over time, not just single readings, because day-to-day variation is normal. ' +
      'HRV is a signal to notice, not a verdict — a drop on one day is rarely meaningful on its own. ' +
      'If your HRV trend concerns you, it is a useful data point to share with your doctor.',
    tag: 'safe_awareness',
  },

  // ---- Resting Heart Rate ----
  {
    name: 'resting_hr',
    match: (s) => hasAny(s, [
      'resting heart rate', 'resting hr', 'rhr', 'heart rate at rest',
      'heart rate high', 'heart rate low', 'heart rate trend', 'heart rate elevated',
      'elevated heart rate', 'high heart rate',
    ]),
    reply:
      'Resting Heart Rate (RHR) is your heart rate when you are relaxed and not active. ' +
      'BALA tracks your RHR trend — a gradual downward trend often reflects improving fitness, ' +
      'while a sudden unexplained rise may suggest your body is under stress, fighting illness, ' +
      'or under-recovered. BALA cannot tell you whether your specific RHR is healthy for you — ' +
      'that is a conversation for your doctor. What BALA can do is help you notice when your ' +
      'baseline shifts, so you have something concrete to discuss.',
    tag: 'safe_awareness',
  },

  // ---- SpO2 / Blood Oxygen ----
  {
    name: 'spo2',
    match: (s) => hasAny(s, [
      'spo2', 'blood oxygen', 'oxygen level', 'oxygen saturation', 'o2 level',
      'oxygen reading', 'low oxygen', 'high oxygen',
    ]),
    reply:
      'SpO₂ is your blood oxygen saturation — a measure of how much oxygen your red blood cells ' +
      'are carrying. Most wearables estimate SpO₂ optically and readings can vary. BALA uses ' +
      'SpO₂ as one of several signals, not as a standalone health verdict. Consumer wearable ' +
      'SpO₂ readings are not medical-grade. If you are seeing consistently low or unusual readings, ' +
      'that is a signal to discuss with a healthcare professional, not something to interpret through ' +
      'an app alone.',
    tag: 'safe_awareness',
  },

  // ---- Steps / Activity ----
  {
    name: 'activity_steps',
    match: (s) => hasAny(s, [
      'steps', 'activity', 'active minutes', 'exercise', 'workout', 'calories',
      'move', 'movement', 'daily activity', 'step count', 'step goal',
    ]),
    reply:
      'BALA tracks your daily steps and active minutes as a signal of how much movement you got. ' +
      'Consistent movement is one of the simplest and most reliable wellbeing signals — but the ' +
      'right amount is personal and depends on your health, age, and goals. BALA will show you ' +
      'your trend without setting a one-size-fits-all target. If you are working toward a specific ' +
      'activity goal for health reasons, your doctor or a qualified trainer can give you guidance ' +
      'that is tailored to you.',
    tag: 'safe_awareness',
  },

  // ---- Ask Coach / What should I do ----
  {
    name: 'ask_coach',
    match: (s) => hasAny(s, [
      'ask coach', 'ask bala', 'bala coach', 'what should i do', 'what do i do',
      'coach advice', 'coach guidance', 'coach tip', 'tip today', 'suggestion',
      'what bala says', 'what does bala say', 'bala recommend', 'bala guide',
    ]),
    reply:
      'BALA Coach is your calm daily guide. It looks at your available signals — sleep, HRV, ' +
      'resting heart rate, SpO₂, activity, and your check-in — and offers a gentle awareness nudge: ' +
      'rest a little more, move if you feel ready, hydrate, or just notice how you feel today. ' +
      'BALA Coach does not prescribe, diagnose, or recommend specific treatments. Think of it as ' +
      'a quiet voice that helps you tune in to your own body signals, so you can have better ' +
      'conversations with the people who actually care for your health.',
    tag: 'safe_awareness',
  },

  // ---- Doctor summary ----
  {
    name: 'doctor_summary',
    match: (s) => hasAny(s, [
      'doctor summary', 'doctor report', 'show doctor', 'share with doctor',
      'doctor ready', 'health summary', 'summary for doctor', 'print summary',
    ]),
    reply:
      'BALA\'s Doctor-Ready Summary gives you a clean snapshot of your recent signals — sleep, ' +
      'HRV, resting heart rate, activity, SpO₂, and your check-in notes — in a format that is ' +
      'easy to share at your next appointment. The summary is informational only. It does not ' +
      'include a diagnosis, risk assessment, or recommendation — those are for your doctor. ' +
      'Your health data stays local unless you choose to export and share it yourself.',
    tag: 'safe_awareness',
  },

  // ---- Privacy ----
  {
    name: 'privacy',
    match: (s) => hasAny(s, [
      'privacy', 'my data', 'data sharing', 'who sees', 'is my data safe',
      'stored where', 'data stored', 'local only', 'data sent', 'tracking',
    ]),
    reply:
      'BALA is designed local-first. Your health signals stay on your device — BALA does not ' +
      'send your data to servers, sell it, or share it with third parties. The only data that ' +
      'leaves your device is what you explicitly choose to export (for example, sharing a summary ' +
      'with your doctor). No trackers. No ads. No external health-data APIs. Your data belongs to you.',
    tag: 'safe_awareness',
  },

  // ---- What is BALA / general intro ----
  {
    name: 'what_is_bala',
    match: (s) => hasAny(s, [
      'what is bala', 'tell me about bala', 'about bala', 'how does bala work',
      'bala app', 'bala features', 'what can bala do', 'bala help',
    ]),
    reply:
      'BALA is a calm, free, mobile-first health-awareness companion. It connects to your wearable ' +
      'or Apple Health data and turns your daily signals — sleep, HRV, resting heart rate, SpO₂, ' +
      'steps, and how you feel — into a simple daily guide.\n\n' +
      'BALA\'s core features include:\n' +
      '• BALA Score — a daily reflection guide from your body signals\n' +
      '• Today\'s Guide — gentle awareness nudges based on your check-in\n' +
      '• Health Signal Cards — clear explanations of each signal\n' +
      '• Ask BALA Coach — a calm, safety-first response to your questions\n' +
      '• Doctor-Ready Summary — a clean snapshot to share at appointments\n\n' +
      'BALA does not diagnose, treat, predict, prevent, or replace doctors. ' +
      'It helps you listen to your body earlier, so you can take small steps toward better awareness.',
    tag: 'safe_awareness',
  },
];

// ---------------------------------------------------------------------------
// Discovery reply — when no topic matches.
// ---------------------------------------------------------------------------
const DISCOVERY_REPLY =
  'I am BALA, your calm health-awareness companion. I can help you understand your daily signals: ' +
  'your BALA Score, sleep and recovery, HRV, resting heart rate, SpO₂, and activity. ' +
  'Try asking about one of those, or ask "what is BALA" to learn more. ' +
  'Remember: BALA is a guide, not a medical advisor. ' +
  'For any health concerns, please speak with a qualified healthcare professional.';

// ---------------------------------------------------------------------------
// Main export.
// ---------------------------------------------------------------------------

/**
 * Respond to a BALA health-awareness query.
 *
 * @param {string} text  — raw input from the user
 * @returns {{
 *   reply: string,
 *   safetyTag: 'emergency'|'safe_awareness'|'boundary'|'discovery',
 *   emergency: boolean,
 *   footer: string,
 *   capabilityId: string,
 * }}
 */
function respondToBALAQuery(text) {
  const s = normalize(text);

  // 1. Emergency gate — always first, always overrides everything.
  if (isEmergency(s)) {
    return {
      reply: EMERGENCY_REPLY,
      safetyTag: 'emergency',
      emergency: true,
      footer: BALA_SAFETY_FOOTER,
      capabilityId: CAPABILITY_ID,
    };
  }

  // 2. Medical-claim boundary gate.
  if (isMedicalBoundary(s)) {
    return {
      reply: BOUNDARY_REPLY,
      safetyTag: 'boundary',
      emergency: false,
      footer: BALA_SAFETY_FOOTER,
      capabilityId: CAPABILITY_ID,
    };
  }

  // 3. Topic rules (first match wins).
  for (const rule of TOPIC_RULES) {
    if (rule.match(s)) {
      return {
        reply: rule.reply,
        safetyTag: rule.tag,
        emergency: false,
        footer: BALA_SAFETY_FOOTER,
        capabilityId: CAPABILITY_ID,
      };
    }
  }

  // 4. Discovery fallback.
  return {
    reply: DISCOVERY_REPLY,
    safetyTag: 'discovery',
    emergency: false,
    footer: BALA_SAFETY_FOOTER,
    capabilityId: CAPABILITY_ID,
  };
}

// ---------------------------------------------------------------------------
// CLI quick-test (node scripts/chintu-bala-skill.js "my hrv dropped")
// ---------------------------------------------------------------------------
if (require.main === module) {
  const query = process.argv.slice(2).join(' ') || 'what is my bala score';
  const result = respondToBALAQuery(query);
  console.log('Query:      ' + query);
  console.log('SafetyTag:  ' + result.safetyTag);
  console.log('Emergency:  ' + result.emergency);
  console.log('');
  console.log(result.reply);
  console.log('');
  console.log('— ' + result.footer);
}

module.exports = {
  respondToBALAQuery,
  BALA_SAFETY_FOOTER,
  CAPABILITY_ID,
};
