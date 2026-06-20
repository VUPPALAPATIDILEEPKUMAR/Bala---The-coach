'use strict';

// =============================================================================
// BALA Coach Pattern Engine
// =============================================================================
// Pure local pattern-based engine: score + signals → warm, safe, context-aware
// daily guidance. No network calls. No AI inference. No medical claims.
//
// Safety contract:
//   - Never diagnose, treat, prevent, predict, or guarantee
//   - Never mention disease names
//   - Emergency phrases trigger safety-only reply (mirrors bala-score-engine.js)
//   - All output passes the safety_classifier prompt spec from prompt library
//
// Exports:
//   buildCoachGuide(scoreResult, options)   — main entry point
//   buildSignalExplanation(signalKey)       — explain one signal in plain language
//   buildAskReply(userText, scoreResult)    — reply to a free-text health question
//   SIGNAL_EXPLAINERS                        — map of signal → explanation object
// =============================================================================

// ---------------------------------------------------------------------------
// Emergency phrases — must mirror bala-score-engine.js EMERGENCY_PHRASES
// ---------------------------------------------------------------------------
const EMERGENCY_PHRASES = [
  'chest pain', 'chest pressure', 'heart attack', 'myocardial',
  'trouble breathing', 'can\'t breathe', 'cannot breathe',
  'shortness of breath', 'short of breath',
  'stroke', 'face drooping', 'arm weakness', 'sudden numbness',
  'fainting', 'fainted', 'passed out', 'loss of consciousness',
  'severe weakness', 'can\'t move', 'cannot move',
  'call 911', 'ambulance', 'emergency room', 'going to the hospital',
];

const EMERGENCY_REPLY = {
  emergency: true,
  message: 'Your message mentions symptoms that may need immediate attention. '
    + 'Please contact emergency services or go to your nearest emergency room now. '
    + 'BALA is a personal awareness guide — it is not the right tool for urgent symptoms. '
    + 'Call for help first.',
  action: 'seek_emergency_care',
};

function _hasEmergency(text) {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase();
  return EMERGENCY_PHRASES.some((p) => lower.includes(p));
}

// ---------------------------------------------------------------------------
// Safety disclaimer — appended to every guide output
// ---------------------------------------------------------------------------
const DISCLAIMER = 'BALA is a personal awareness guide, not medical advice. '
  + 'If something feels urgent, please contact a healthcare professional.';

// ---------------------------------------------------------------------------
// Score labels → coach tone mapping
// ---------------------------------------------------------------------------
const SCORE_TONE_MAP = {
  'Thriving': {
    openingOptions: [
      'Your body is in a great rhythm today.',
      'The signals look strong — your body is working well.',
      'Today\'s picture is one of good balance and recovery.',
    ],
    nudge: 'Keep riding this wave — your consistency is showing.',
  },
  'Balanced': {
    openingOptions: [
      'Your signals are in a steady place today.',
      'Things look balanced — your body is holding its rhythm.',
      'A solid check-in: most signals are on track.',
    ],
    nudge: 'Small choices today will carry you into tomorrow.',
  },
  'Recovering': {
    openingOptions: [
      'Your body is in recovery mode today — that\'s worth honoring.',
      'The signals suggest your system is working a bit harder than usual.',
      'Today looks like a gentler day for your body.',
    ],
    nudge: 'Give yourself permission to go easier today.',
  },
  'Rest Day': {
    openingOptions: [
      'Your signals are asking for rest today.',
      'The picture today is one of a body that needs more recovery.',
      'Low-energy days have a purpose — your body is rebuilding.',
    ],
    nudge: 'Rest is training too. Protect it.',
  },
};

function _getToneForScore(score, label) {
  if (!label) {
    if (score === null) return SCORE_TONE_MAP['Rest Day'];
    if (score >= 75) return SCORE_TONE_MAP['Thriving'];
    if (score >= 55) return SCORE_TONE_MAP['Balanced'];
    if (score >= 35) return SCORE_TONE_MAP['Recovering'];
    return SCORE_TONE_MAP['Rest Day'];
  }
  return SCORE_TONE_MAP[label] || SCORE_TONE_MAP['Balanced'];
}

function _pickOpening(options) {
  // Deterministic pick based on current minute — avoids randomness while still varying
  const index = new Date().getMinutes() % options.length;
  return options[index];
}

// ---------------------------------------------------------------------------
// Signal explainers — plain language, no clinical framing
// ---------------------------------------------------------------------------
const SIGNAL_EXPLAINERS = {
  hrv: {
    name: 'Heart Rate Variability (HRV)',
    what: 'HRV measures the natural variation between your heartbeats. '
      + 'Think of it like the breathing room between each beat — more room usually means '
      + 'your nervous system is relaxed and ready to handle whatever the day brings.',
    affects: ['Sleep quality', 'Stress levels', 'Recovery from exercise', 'Hydration'],
    improving: 'Consistent sleep, staying hydrated, and lower stress tend to lift HRV over time.',
    lowSignal: 'When HRV dips below your usual pattern, your body may be working harder than normal — '
      + 'a good signal to take it easy.',
    highSignal: 'HRV tracking above your baseline is your body saying it\'s recovered and ready.',
  },
  rhr: {
    name: 'Resting Heart Rate (RHR)',
    what: 'Resting heart rate is how many times your heart beats per minute when you\'re still. '
      + 'For most people, lower is generally better — it suggests your heart is efficient.',
    affects: ['Fitness level', 'Sleep', 'Caffeine', 'Stress', 'Hydration'],
    improving: 'Regular movement and good sleep are the biggest levers for RHR over time.',
    lowSignal: 'RHR below your usual pattern is often a positive sign — your heart is working efficiently.',
    highSignal: 'RHR sitting higher than your norm can mean your body is working overtime. '
      + 'Extra rest and water can help.',
  },
  spo2: {
    name: 'Blood Oxygen (SpO2)',
    what: 'SpO2 measures how much oxygen your blood is carrying. '
      + 'Most people sit between 95-100%. A big drop from your norm is worth noticing.',
    affects: ['Altitude', 'Sleep quality', 'Breathing patterns', 'Activity'],
    improving: 'Deep breathing exercises and good sleep position can help maintain solid SpO2.',
    lowSignal: 'If SpO2 drops noticeably below your usual, it\'s a good time to check in with '
      + 'a healthcare professional — especially if you feel breathless.',
    highSignal: 'SpO2 at or near 100% is a sign your body is well oxygenated.',
  },
  sleep_hours: {
    name: 'Sleep Duration',
    what: 'Total hours of sleep in a night. Your body does its deepest repair work while you sleep — '
      + 'everything from memory to muscle recovery depends on it.',
    affects: ['HRV', 'Energy', 'Focus', 'Mood', 'Appetite'],
    improving: 'A consistent bedtime is often more valuable than adding more hours randomly.',
    lowSignal: 'Short sleep nights affect HRV and energy the next day — '
      + 'your body feels it even when your mind pushes through.',
    highSignal: 'You got solid sleep. Let that support you through today.',
  },
  sleep_consistency: {
    name: 'Sleep Timing Consistency',
    what: 'How consistent your sleep and wake times are across nights. '
      + 'Your body loves a rhythm — irregular sleep timing can disrupt recovery even when total hours are fine.',
    affects: ['HRV', 'Cortisol', 'Energy patterns', 'Hunger timing'],
    improving: 'Going to bed within 30 minutes of the same time each night makes a measurable difference.',
    lowSignal: 'Variable sleep timing can leave you feeling off even after a full night\'s sleep.',
    highSignal: 'Consistent sleep timing is one of the most underrated recovery habits.',
  },
  steps: {
    name: 'Daily Steps',
    what: 'A simple measure of how much you\'ve moved today. '
      + 'Movement — even gentle walking — supports circulation, mood, and energy.',
    affects: ['Energy', 'Mood', 'Sleep quality', 'Cardiovascular health over time'],
    improving: 'Short walks spread through the day often do more than one long burst.',
    lowSignal: 'Light movement days are totally fine — especially on recovery days.',
    highSignal: 'You\'ve been moving — that compounds quietly over weeks and months.',
  },
  sleep_score: {
    name: 'Sleep Quality Score',
    what: 'A summary score for the quality of your sleep — '
      + 'usually blending depth, interruptions, and timing into one number.',
    affects: ['HRV next day', 'Recovery score', 'Energy', 'Focus'],
    improving: 'Avoiding screens and late meals in the hour before bed often improves this score.',
    lowSignal: 'A lower sleep score can explain afternoon tiredness — '
      + 'your body is telling you it didn\'t fully recharge.',
    highSignal: 'Good sleep quality is the foundation everything else builds on.',
  },
  weekly_cardio: {
    name: 'Weekly Cardio Activity',
    what: 'How many of this week\'s days included meaningful cardio movement. '
      + 'Regular cardio supports heart efficiency, sleep quality, and energy over time.',
    affects: ['RHR', 'HRV', 'Sleep depth', 'Energy baseline'],
    improving: 'Consistency across the week matters more than any single hard session.',
    lowSignal: 'A lighter week of cardio is normal — especially after high-intensity periods.',
    highSignal: 'Strong cardio consistency this week will show up in your recovery signals.',
  },
  stress_level: {
    name: 'Perceived Stress',
    what: 'Your self-reported sense of how much mental or emotional load you\'re carrying. '
      + 'Stress is one of the strongest influencers of recovery signals.',
    affects: ['HRV', 'Sleep', 'RHR', 'Energy', 'Appetite'],
    improving: 'Even a 5-minute pause — breathing, walking, or stepping away from screens — '
      + 'can shift your nervous system.',
    lowSignal: 'Low stress days are a gift — your body recovers faster when the mental load is lighter.',
    highSignal: 'High stress days affect multiple signals. Give yourself extra grace today.',
  },
  hydration: {
    name: 'Hydration',
    what: 'How well-hydrated your body is today. '
      + 'Water affects nearly every system — from heart rate efficiency to how sharp you feel.',
    affects: ['RHR', 'Energy', 'Focus', 'SpO2', 'HRV'],
    improving: 'Starting the morning with water before caffeine sets a strong foundation.',
    lowSignal: 'Low hydration days show up in energy and sometimes RHR — '
      + 'the fix is the simplest one: more water.',
    highSignal: 'Well-hydrated body, well-functioning signals.',
  },
};

// ---------------------------------------------------------------------------
// Lowest-category → suggested action
// ---------------------------------------------------------------------------
const CATEGORY_ACTIONS = {
  recovery: [
    'Your HRV and recovery signals could use some support today — consider a gentle walk or 20 minutes of intentional rest.',
    'Your body\'s recovery signals are lower than usual. Prioritize sleep tonight and keep intensity light today.',
    'Recovery is on the lower end today. Hydration and a short nap (20 minutes) can make a real difference.',
  ],
  sleep: [
    'Your sleep signals suggest your body didn\'t fully recharge. Try to protect a short rest window this afternoon.',
    'Sleep quality was lighter than usual. Keep tonight\'s environment calm and aim to be in bed 30 minutes earlier.',
    'Your sleep patterns have been variable. A consistent bedtime — even by 15 minutes — compounds over time.',
  ],
  activity: [
    'Movement has been low recently. A 15-minute walk after lunch is one of the most effective things you can do today.',
    'Your step count is below your usual. Even short walks between tasks count — try 5 minutes every hour.',
    'Your activity signals could use a gentle boost. Consider a 20-minute walk — no intensity needed.',
  ],
  lifestyle: [
    'Some lifestyle signals are pulling your score down. The simplest lever: drink a large glass of water now.',
    'Your lifestyle signals suggest your body is under a bit more load today. A mindful pause — even 3 minutes — helps.',
    'Stress or lifestyle factors are affecting your recovery. Protect one 10-minute window of stillness today.',
  ],
};

function _getLowestCategory(scoreResult) {
  if (!scoreResult || !scoreResult.categories) return null;
  const cats = scoreResult.categories;
  let lowest = null;
  let lowestPts = Infinity;
  Object.entries(cats).forEach(([key, cat]) => {
    if (cat && typeof cat.total === 'number' && cat.total < lowestPts) {
      lowestPts = cat.total;
      lowest = key;
    }
  });
  return lowest;
}

function _pickAction(category) {
  const options = CATEGORY_ACTIONS[category] || CATEGORY_ACTIONS.recovery;
  const index = new Date().getHours() % options.length;
  return options[index];
}

// ---------------------------------------------------------------------------
// Change copy generator
// ---------------------------------------------------------------------------
function _buildChangeCopy(scoreResult) {
  if (!scoreResult.changeCopy) return null;
  return scoreResult.changeCopy; // already built by score engine
}

// ---------------------------------------------------------------------------
// Missing signals guidance
// ---------------------------------------------------------------------------
function _buildMissingSignalsNote(scoreResult) {
  if (!scoreResult.missingSignals || scoreResult.missingSignals.length === 0) return null;
  const count = scoreResult.missingSignals.length;
  if (count >= 8) {
    return 'Connect more health data to sharpen your BALA picture — '
      + 'the score today is based on limited signals.';
  }
  if (count >= 4) {
    return `${count} signals are missing today — adding HRV, sleep, and step data would make this score more precise.`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// buildCoachGuide — main entry point
// ---------------------------------------------------------------------------
/**
 * Build a complete coach guide from a bala-score-engine result.
 *
 * @param {object} scoreResult - Output from computeBALAScore()
 * @param {object} [options]
 * @param {string} [options.userName] - First name for personalization
 * @param {string} [options.dayContext] - Optional day context (e.g. "Monday")
 * @returns {object} coach guide with sections + disclaimer
 */
function buildCoachGuide(scoreResult, options = {}) {
  if (!scoreResult) {
    return {
      emergency: false,
      sections: [],
      disclaimer: DISCLAIMER,
      error: 'No score result provided',
    };
  }

  // Emergency override — always first
  if (scoreResult.emergency) {
    return {
      emergency: true,
      message: EMERGENCY_REPLY.message,
      action: EMERGENCY_REPLY.action,
      disclaimer: null, // emergency reply replaces all other content
    };
  }

  const userName = options.userName || null;
  const tone = _getToneForScore(scoreResult.score, scoreResult.label);
  const lowestCat = _getLowestCategory(scoreResult);

  const sections = [];

  // 1. Opening — personalized greeting + score context
  const opening = _pickOpening(tone.openingOptions);
  const greeting = userName
    ? `${userName}, ${opening.charAt(0).toLowerCase()}${opening.slice(1)}`
    : opening;

  sections.push({
    id: 'greeting',
    label: 'How you\'re doing',
    text: greeting,
  });

  // 2. Score summary
  const scoreText = scoreResult.score !== null
    ? `Your BALA Score today is ${scoreResult.score} — ${scoreResult.label || 'see your signals below'}.`
    : 'Your BALA Score is limited today due to missing data — but your available signals still tell a story.';

  const confidenceNote = (scoreResult.confidence && (
    scoreResult.confidence.level === 'LOW' || scoreResult.confidence.level === 'VERY_LOW'
  ))
    ? ' (based on limited signals — connect more health data for a fuller picture)'
    : '';

  sections.push({
    id: 'score',
    label: 'BALA Score',
    text: scoreText + confidenceNote,
  });

  // 3. Change copy (only if present — delta ≥ 5 pts)
  const changeCopy = _buildChangeCopy(scoreResult);
  if (changeCopy) {
    sections.push({
      id: 'change',
      label: 'What changed',
      text: changeCopy,
    });
  }

  // 4. Top signal insights — reference the two most informative signals
  const topSignals = [];
  if (scoreResult.categories) {
    Object.values(scoreResult.categories).forEach((cat) => {
      if (cat && Array.isArray(cat.signals)) {
        cat.signals.forEach((s) => {
          if (s.pts > 0 || s.pts < 0) topSignals.push(s);
        });
      }
    });
  }
  // Sort by absolute pts to find most influential
  topSignals.sort((a, b) => Math.abs(b.pts) - Math.abs(a.pts));
  const top2 = topSignals.slice(0, 2);

  if (top2.length > 0) {
    const signalLines = top2
      .map((s) => {
        const explainer = SIGNAL_EXPLAINERS[s.signal];
        const signalName = explainer ? explainer.name : s.signal;
        return `${signalName}: ${s.label}`;
      })
      .join(' | ');

    sections.push({
      id: 'signals',
      label: 'What your body is signaling',
      text: signalLines,
    });
  }

  // 5. Today's action — based on lowest category
  if (lowestCat && CATEGORY_ACTIONS[lowestCat]) {
    sections.push({
      id: 'action',
      label: 'Today\'s small win',
      text: _pickAction(lowestCat),
    });
  } else {
    sections.push({
      id: 'action',
      label: 'Today\'s small win',
      text: tone.nudge,
    });
  }

  // 6. Missing signals note (only if notable)
  const missingNote = _buildMissingSignalsNote(scoreResult);
  if (missingNote) {
    sections.push({
      id: 'data_quality',
      label: 'Sharpen your picture',
      text: missingNote,
    });
  }

  return {
    emergency: false,
    score: scoreResult.score,
    label: scoreResult.label,
    confidence: scoreResult.confidence ? scoreResult.confidence.level : 'VERY_LOW',
    sections,
    disclaimer: DISCLAIMER,
  };
}

// ---------------------------------------------------------------------------
// buildSignalExplanation — explain a single signal in plain language
// ---------------------------------------------------------------------------
/**
 * Get a plain-language explanation for one health signal key.
 *
 * @param {string} signalKey - e.g. 'hrv', 'rhr', 'spo2', 'steps'
 * @param {object} [options]
 * @param {number|null} [options.userValue] - Today's value (optional)
 * @param {number|null} [options.userBaseline] - 7-day average (optional)
 * @returns {object} explanation object with what/affects/context
 */
function buildSignalExplanation(signalKey, options = {}) {
  const explainer = SIGNAL_EXPLAINERS[signalKey];
  if (!explainer) {
    return {
      found: false,
      signalKey,
      message: `BALA doesn't have a built-in explanation for "${signalKey}" yet.`,
    };
  }

  const result = {
    found: true,
    signalKey,
    name: explainer.name,
    what: explainer.what,
    affects: explainer.affects,
    improving: explainer.improving,
  };

  const { userValue, userBaseline } = options;

  if (userValue !== undefined && userValue !== null) {
    if (userBaseline !== undefined && userBaseline !== null) {
      const delta = userValue - userBaseline;
      const pct = Math.round(Math.abs(delta / userBaseline) * 100);
      if (Math.abs(delta) < userBaseline * 0.03) {
        result.yourContext = `Your ${explainer.name} is right in line with your usual pattern today.`;
      } else if (delta > 0) {
        result.yourContext = `Your ${explainer.name} is about ${pct}% above your recent average — ${explainer.highSignal}`;
      } else {
        result.yourContext = `Your ${explainer.name} is about ${pct}% below your recent average — ${explainer.lowSignal}`;
      }
    } else {
      result.yourContext = `Your ${explainer.name} is at ${userValue} today.`;
    }
  }

  result.disclaimer = DISCLAIMER;
  return result;
}

// ---------------------------------------------------------------------------
// buildAskReply — respond to a free-text health question from the user
// ---------------------------------------------------------------------------
/**
 * Pattern-match a free-text health question and produce a safe, warm reply.
 * Used by bala_ask Telegram intent.
 *
 * @param {string} userText - Raw text from user
 * @param {object} [scoreResult] - Most recent computeBALAScore() output (optional)
 * @returns {object} reply object with message and disclaimer
 */
function buildAskReply(userText, scoreResult = null) {
  if (!userText || typeof userText !== 'string') {
    return {
      matched: false,
      message: 'BALA is here to help you understand your body signals. '
        + 'Try asking about HRV, sleep, steps, stress, or your BALA Score.',
      disclaimer: DISCLAIMER,
    };
  }

  // Emergency check always first
  if (_hasEmergency(userText)) {
    return {
      matched: true,
      emergency: true,
      message: EMERGENCY_REPLY.message,
      disclaimer: null,
    };
  }

  const lower = userText.toLowerCase();

  // Pattern: HRV questions
  if (/\bhrv\b/.test(lower) || /heart rate variab/.test(lower)) {
    const ex = SIGNAL_EXPLAINERS.hrv;
    const scoreLine = (scoreResult && scoreResult.score !== null)
      ? ` Your BALA Score today is ${scoreResult.score} (${scoreResult.label}).`
      : '';
    return {
      matched: true,
      signal: 'hrv',
      message: `${ex.what} ${ex.lowSignal}${scoreLine} ${ex.improving}`,
      disclaimer: DISCLAIMER,
    };
  }

  // Pattern: sleep questions
  if (/\bsleep\b/.test(lower) || /\binsomnia\b/.test(lower) || /\btired\b/.test(lower)
      || /\bexhausted\b/.test(lower) || /\bfatigue\b/.test(lower)) {
    const ex = SIGNAL_EXPLAINERS.sleep_hours;
    return {
      matched: true,
      signal: 'sleep_hours',
      message: `${ex.what} ${ex.improving}`,
      disclaimer: DISCLAIMER,
    };
  }

  // Pattern: stress questions
  if (/\bstress\b/.test(lower) || /\banxious\b/.test(lower) || /\banxiety\b/.test(lower)
      || /\boverwhelm/.test(lower) || /\bburnout\b/.test(lower)) {
    const ex = SIGNAL_EXPLAINERS.stress_level;
    return {
      matched: true,
      signal: 'stress_level',
      message: `${ex.highSignal} ${ex.improving} ${ex.affects.slice(0, 3).join(', ')} are all affected by stress levels.`,
      disclaimer: DISCLAIMER,
    };
  }

  // Pattern: steps / movement questions
  if (/\bsteps\b/.test(lower) || /\bwalk\b/.test(lower) || /\bmovement\b/.test(lower)
      || /\bactive\b/.test(lower) || /\bactivity\b/.test(lower)) {
    const ex = SIGNAL_EXPLAINERS.steps;
    return {
      matched: true,
      signal: 'steps',
      message: `${ex.what} ${ex.improving}`,
      disclaimer: DISCLAIMER,
    };
  }

  // Pattern: SpO2 questions
  if (/\bspo2\b/.test(lower) || /\boxygen\b/.test(lower) || /\bblood oxygen\b/.test(lower)) {
    const ex = SIGNAL_EXPLAINERS.spo2;
    return {
      matched: true,
      signal: 'spo2',
      message: `${ex.what} ${ex.lowSignal}`,
      disclaimer: DISCLAIMER,
    };
  }

  // Pattern: hydration
  if (/\bhydrat/.test(lower) || /\bwater\b/.test(lower) || /\bdrink\b/.test(lower)) {
    const ex = SIGNAL_EXPLAINERS.hydration;
    return {
      matched: true,
      signal: 'hydration',
      message: `${ex.what} ${ex.improving}`,
      disclaimer: DISCLAIMER,
    };
  }

  // Pattern: score questions
  if (/\bbala score\b/.test(lower) || /\bmy score\b/.test(lower) || /\bwhat.{0,15}score\b/.test(lower)) {
    if (scoreResult && scoreResult.score !== null) {
      return {
        matched: true,
        signal: 'bala_score',
        message: `Your BALA Score is ${scoreResult.score} today — ${scoreResult.label}. `
          + 'The score blends your recovery, sleep, activity, and lifestyle signals '
          + 'into one daily picture. It\'s personal to your own baseline.',
        disclaimer: DISCLAIMER,
      };
    }
    return {
      matched: true,
      signal: 'bala_score',
      message: 'Your BALA Score pulls together recovery, sleep, activity, and lifestyle signals '
        + 'into one daily picture — based on your own personal baseline, not population averages. '
        + 'Connect your wearable data to see your score.',
      disclaimer: DISCLAIMER,
    };
  }

  // Pattern: RHR
  if (/\bresting heart rate\b/.test(lower) || /\brhr\b/.test(lower)) {
    const ex = SIGNAL_EXPLAINERS.rhr;
    return {
      matched: true,
      signal: 'rhr',
      message: `${ex.what} ${ex.improving}`,
      disclaimer: DISCLAIMER,
    };
  }

  // Pattern: general "how am I doing" / today questions
  if (/\bhow am i\b/.test(lower) || /\bhow.{0,10}doing\b/.test(lower)
      || /\bhow.{0,10}today\b/.test(lower) || /\bam i ok\b/.test(lower)) {
    if (scoreResult && scoreResult.score !== null) {
      const guide = buildCoachGuide(scoreResult, {});
      const summarySection = guide.sections.find((s) => s.id === 'score');
      const actionSection = guide.sections.find((s) => s.id === 'action');
      return {
        matched: true,
        signal: 'general_check',
        message: (summarySection ? summarySection.text + ' ' : '')
          + (actionSection ? actionSection.text : ''),
        disclaimer: DISCLAIMER,
      };
    }
    return {
      matched: true,
      signal: 'general_check',
      message: 'BALA is here to help you check in with your body. '
        + 'Connect your health data to get a personalized daily picture.',
      disclaimer: DISCLAIMER,
    };
  }

  // No pattern matched — friendly guide reply
  return {
    matched: false,
    message: 'BALA can help you understand your body signals — ask about HRV, sleep, '
      + 'steps, stress, SpO2, or your BALA Score. '
      + 'Or say "how am I doing today" for a full check-in.',
    disclaimer: DISCLAIMER,
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = {
  buildCoachGuide,
  buildSignalExplanation,
  buildAskReply,
  SIGNAL_EXPLAINERS,
  DISCLAIMER,
  // Internals exported for testing
  _hasEmergency,
  _getToneForScore,
  _getLowestCategory,
  _buildMissingSignalsNote,
  EMERGENCY_REPLY,
};
