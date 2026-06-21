'use strict';
// =============================================================================
// BALA-B50 Ask BALA Coach Engine
// Pure logic. No DOM. No network. No AI inference.
// Provides safe, local, awareness-only responses to user questions.
//
// Safety rules:
//   - EMERGENCY_KEYWORDS always trigger the emergency gate first (non-negotiable)
//   - All responses are awareness-only — never diagnostic, never prescriptive
//   - No outcome promises ("this will fix X", "this means Y is wrong")
//   - No personalised risk assessment from user input
//   - Responses are curated static copy — no generative AI at runtime
//   - Input never leaves the device
// =============================================================================

// ---------------------------------------------------------------------------
// EMERGENCY GATE — keywords that must always surface the emergency copy
// ---------------------------------------------------------------------------
var EMERGENCY_KEYWORDS = [
  'chest pain', 'chest pressure', 'chest tightness',
  'can\'t breathe', 'cannot breathe', 'trouble breathing', 'difficulty breathing',
  'shortness of breath',
  'heart attack', 'cardiac arrest',
  'stroke', 'face drooping', 'arm weakness', 'speech difficulty',
  'fainting', 'fainted', 'passed out', 'unconscious',
  'severe pain', 'severe headache', 'sudden headache',
  'call 999', 'call 911', 'call 000', 'emergency',
];

var EMERGENCY_RESPONSE =
  'If you are experiencing a medical emergency — such as chest pain, trouble breathing, ' +
  'fainting, severe pain, or stroke-like symptoms — please contact emergency services ' +
  'or go to your nearest emergency department immediately.\n\n' +
  'BALA is a wellness awareness tool. It cannot assess emergencies or call for help on your behalf.';

// ---------------------------------------------------------------------------
// TOPIC MAP — keyword arrays → awareness-only response copy
// Order matters: first match wins (most specific first).
// ---------------------------------------------------------------------------
var TOPIC_MAP = [
  {
    keywords: ['hrv', 'heart rate variability'],
    response:
      'HRV (heart-rate variability) reflects the natural variation in time between your heartbeats. ' +
      'Higher day-to-day HRV is often associated with good recovery and readiness, while a dip ' +
      'can signal that your body is working harder — from exercise, stress, poor sleep, or illness. ' +
      'BALA uses your HRV trend as one of several signals, not a standalone measure.',
  },
  {
    keywords: ['rhr', 'resting heart rate', 'resting hr', 'heart rate at rest'],
    response:
      'Resting heart rate (RHR) is how many times your heart beats per minute when you\'re still and calm. ' +
      'A sustained rise in RHR over several days can be worth noticing — it may reflect accumulated fatigue, ' +
      'stress, dehydration, or the early stages of illness. Trends matter more than single readings.',
  },
  {
    keywords: ['spo2', 'spo₂', 'blood oxygen', 'oxygen saturation', 'oxygen level'],
    response:
      'Blood oxygen (SpO₂) measures the percentage of haemoglobin carrying oxygen in your blood. ' +
      'Most wearables measure it at the wrist, which is less accurate than a medical pulse oximeter. ' +
      'Occasional dips overnight can be normal. Persistent or large drops are worth discussing with a doctor.',
  },
  {
    keywords: ['sleep', 'sleeping', 'insomnia', 'can\'t sleep', 'tired', 'fatigue', 'exhausted'],
    response:
      'Sleep is one of the most powerful recovery signals BALA tracks. Consistent low sleep duration ' +
      'tends to show up across other signals — HRV drops, resting heart rate rises, and recovery scores dip. ' +
      'Small habits like consistent sleep and wake times often help more than trying to "catch up" at weekends.',
  },
  {
    keywords: ['steps', 'walking', 'activity', 'exercise', 'move', 'movement', 'sedentary'],
    response:
      'Daily movement — even a short walk — has a measurable relationship with recovery and stress signals. ' +
      'BALA tracks your step count as a proxy for general daily activity. ' +
      'You don\'t need a high step count every day; consistent gentle movement tends to matter more than occasional peaks.',
  },
  {
    keywords: ['stress', 'anxious', 'anxiety', 'worried', 'overwhelmed', 'burnout'],
    response:
      'Stress shows up in body signals before we consciously notice it — HRV often dips and resting heart rate ' +
      'can rise during stressful periods. BALA doesn\'t measure stress directly, but your trend data ' +
      'can help you notice patterns. Small rest periods, breathing, and sleep tend to support recovery.',
  },
  {
    keywords: ['recovery', 'recover', 'readiness', 'ready'],
    response:
      'Recovery reflects how well your body has bounced back from the demands of the previous day — ' +
      'exercise, stress, poor sleep, illness. BALA\'s score combines your recent sleep, HRV, and resting ' +
      'heart rate trends to give you a rough sense of where you are. It\'s a pattern guide, not a precise measure.',
  },
  {
    keywords: ['bala score', 'score', 'what does my score mean', 'what does the score mean'],
    response:
      'The BALA score is a rough composite of your recent sleep, HRV, resting heart rate, and step data. ' +
      'It\'s meant as a daily orientation — a way to notice patterns over time, not a medical measurement. ' +
      'A single day\'s score matters less than the trend across a week.',
  },
  {
    keywords: ['doctor', 'gp', 'physician', 'medical', 'appointment', 'check-up', 'checkup'],
    response:
      'BALA can help you notice patterns worth mentioning at your next appointment. ' +
      'The "Share with your doctor" section generates a plain-text wellness log you can bring to your GP — ' +
      'covering your recent signals, symptom check-ins, and focus history. ' +
      'It is context, not a diagnosis or referral.',
  },
  {
    keywords: ['privacy', 'data', 'store', 'stored', 'share', 'cloud', 'sync', 'server'],
    response:
      'All your BALA data is stored on this device only — in your browser\'s local storage. ' +
      'Nothing is sent to a server or shared with anyone. BALA has no account, no cloud sync, and no analytics. ' +
      'Your health data belongs to you.',
  },
  {
    keywords: ['how does bala work', 'how does it work', 'what is bala', 'what does bala do'],
    response:
      'BALA is a calm health-awareness companion. You log daily check-ins with your wearable or phone data ' +
      '(sleep, HRV, resting heart rate, SpO₂, steps), and BALA helps you notice patterns over time. ' +
      'It is a personal wellness guide — not a diagnostic tool, not a medical device.',
  },
  {
    keywords: ['demo', 'demo mode', 'example data', 'sample data'],
    response:
      'Demo mode shows BALA with example data so you can explore without logging real check-ins. ' +
      'The BALA score, reflection, and signal cards all use realistic (but fictional) data in demo mode. ' +
      'Switch to your own data by connecting your wearable or entering check-in details.',
  },
];

// ---------------------------------------------------------------------------
// DEFAULT RESPONSE — when no topic matches
// ---------------------------------------------------------------------------
var DEFAULT_RESPONSE =
  'I didn\'t quite recognise that question. BALA can help you understand signals like sleep, ' +
  'HRV, resting heart rate, steps, and your BALA score. ' +
  'Try asking about one of those, or tap "Generate my wellness log" to create a summary for your doctor.';

// ---------------------------------------------------------------------------
// isEmergency — returns true if input contains any emergency keyword
// ---------------------------------------------------------------------------
function isEmergency(input) {
  if (typeof input !== 'string') return false;
  var lower = input.toLowerCase();
  return EMERGENCY_KEYWORDS.some(function(kw) { return lower.includes(kw); });
}

// ---------------------------------------------------------------------------
// matchTopic — returns the first TOPIC_MAP entry whose keywords match input
// Returns null if no match.
// ---------------------------------------------------------------------------
function matchTopic(input) {
  if (typeof input !== 'string') return null;
  var lower = input.toLowerCase();
  for (var i = 0; i < TOPIC_MAP.length; i++) {
    var entry = TOPIC_MAP[i];
    if (entry.keywords.some(function(kw) { return lower.includes(kw); })) {
      return entry;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// getCoachResponse — main entry point
//
// input: string (user's question)
// Returns { response: string, type: 'emergency' | 'topic' | 'default' }
//
// Emergency gate always wins — checked before topic matching.
// Empty or whitespace-only input returns { response: '', type: 'empty' }.
// ---------------------------------------------------------------------------
function getCoachResponse(input) {
  if (typeof input !== 'string' || !input.trim()) {
    return { response: '', type: 'empty' };
  }

  // Emergency gate — non-negotiable, always first
  if (isEmergency(input)) {
    return { response: EMERGENCY_RESPONSE, type: 'emergency' };
  }

  // Topic match
  var match = matchTopic(input);
  if (match) {
    return { response: match.response, type: 'topic' };
  }

  // Fallback
  return { response: DEFAULT_RESPONSE, type: 'default' };
}

// ---------------------------------------------------------------------------
// sanitiseInput — trims and truncates to MAX_INPUT_LENGTH
// ---------------------------------------------------------------------------
var MAX_INPUT_LENGTH = 300;
function sanitiseInput(raw) {
  if (typeof raw !== 'string') return '';
  return raw.trim().slice(0, MAX_INPUT_LENGTH);
}

// ---------------------------------------------------------------------------
module.exports = {
  isEmergency,
  matchTopic,
  getCoachResponse,
  sanitiseInput,
  EMERGENCY_KEYWORDS,
  EMERGENCY_RESPONSE,
  TOPIC_MAP,
  DEFAULT_RESPONSE,
  MAX_INPUT_LENGTH,
};
