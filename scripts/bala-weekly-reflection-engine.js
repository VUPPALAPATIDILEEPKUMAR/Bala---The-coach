'use strict';
// =============================================================================
// BALA-B45 Weekly Reflection Engine
// Pure local logic. No DOM. No network. No AI inference.
// Deterministic from check-in history only.
//
// Safety rules (enforced throughout):
//   - Never diagnose
//   - Never predict risk
//   - Never say a behavior caused a health outcome
//   - Never give treatment advice
//   - Never imply emergency monitoring
//   - Phrase uncertainty honestly
// =============================================================================

// ---------------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------------
function averageOf(arr) {
  const valid = arr.filter(Number.isFinite);
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
}

function stdDevOf(arr) {
  const valid = arr.filter(Number.isFinite);
  if (valid.length < 2) return null;
  const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
  const variance = valid.reduce((s, v) => s + (v - mean) ** 2, 0) / valid.length;
  return Math.sqrt(variance);
}

// "up" | "down" | "stable" | null — compares first half vs second half of array
function trendDirection(values) {
  const valid = values.filter(Number.isFinite);
  if (valid.length < 3) return null;
  const half  = Math.max(1, Math.floor(valid.length / 2));
  const early = averageOf(valid.slice(0, half));
  const late  = averageOf(valid.slice(-half));
  if (early === null || late === null) return null;
  const delta = late - early;
  if (Math.abs(delta) < 2) return 'stable';
  return delta > 0 ? 'up' : 'down';
}

// "Mon Jun 15" — locale-safe short label
function friendlyDate(dateStr) {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr || '');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  } catch {
    return String(dateStr || '');
  }
}

// ---------------------------------------------------------------------------
// Per-day proxy score — directional only, NOT a BALA Score.
// Used only to identify the "better" vs "harder" day within a week.
// No medical claim attached to this number.
// ---------------------------------------------------------------------------
function dayProxyScore(entry) {
  const parts = [];
  if (Number.isFinite(entry.hrv))   parts.push(entry.hrv);
  if (Number.isFinite(entry.sleep)) parts.push(entry.sleep * 5);
  if (Number.isFinite(entry.rhr))   parts.push(100 - entry.rhr);
  return parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : null;
}

// ---------------------------------------------------------------------------
// Behavior factor label map (mirrors app.js behaviorFactorLabels)
// ---------------------------------------------------------------------------
const BEHAVIOR_FACTOR_LABELS = {
  alcohol:      'Alcohol',
  caffeine:     'Caffeine',
  lateMeal:     'Late meal',
  stress:       'Stress',
  soreness:     'Soreness',
  travel:       'Travel',
  lowMovement:  'Low movement / long sitting',
  exercise:     'Exercise',
  sleep:        'Prioritised sleep',
  hydration:    'Good hydration',
  meditation:   'Meditation or breathwork',
  social:       'Social time',
};

// ---------------------------------------------------------------------------
// Factor pattern summary (reuses logic from existing computeWeeklyFactorReflection)
// ---------------------------------------------------------------------------
function computeFactorPatterns(behaviorHistory, cutoffMs) {
  const cutoff = typeof cutoffMs === 'number' ? cutoffMs : (Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recent = (behaviorHistory || []).filter(entry => {
    try { return new Date(entry.date).getTime() >= cutoff; } catch { return false; }
  });

  const counts = {};
  let totalEntries = 0;
  for (const entry of recent) {
    if (!(entry.factors || []).length) continue;
    totalEntries++;
    for (const f of entry.factors) counts[f] = (counts[f] || 0) + 1;
  }

  if (!totalEntries) return null;

  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({ key, label: BEHAVIOR_FACTOR_LABELS[key] || key, count, days: totalEntries }));

  const patternNotes = [];
  for (const item of sorted.slice(0, 3)) {
    if (item.count >= 5)
      patternNotes.push(`${item.label} appeared most days this week (${item.count} of ${item.days} logged days).`);
    else if (item.count >= 3)
      patternNotes.push(`${item.label} was logged ${item.count} times this week.`);
    else
      patternNotes.push(`${item.label} was noted ${item.count}${item.count > 1 ? ' times' : ' time'} this week.`);
  }

  return { totalEntries, sorted, patternNotes };
}

// ---------------------------------------------------------------------------
// Next-week focus — one small, safe, directional suggestion
// ---------------------------------------------------------------------------
function deriveNextWeekFocus(sleepValues, hrvValues, rhrValues) {
  const sd = stdDevOf(sleepValues);
  if (sd !== null && sd >= 1.0) {
    return 'Sleep timing varied this week. If that felt noticeable, a consistent wind-down time is one small thing to try.';
  }
  const avgHrv = averageOf(hrvValues);
  if (avgHrv !== null && avgHrv < 35) {
    return 'HRV averaged on the lower side. Rest and recovery often support body signals over time — worth keeping an eye on.';
  }
  const avgRhr = averageOf(rhrValues);
  if (avgRhr !== null && avgRhr > 70) {
    return 'Resting heart rate averaged a bit elevated this week. Consistent sleep and light activity often support this signal gradually.';
  }
  return 'You have a baseline to build on. Keep logging daily check-ins — even partial ones — to make this reflection more useful over time.';
}

// ---------------------------------------------------------------------------
// Main: computeWeeklyReflection
// ---------------------------------------------------------------------------

/**
 * @param {object}  metrics          { source?, sleep?, rhr?, hrv?, history?: [{date,sleep,rhr,hrv,...}] }
 * @param {Array}   behaviorHistory  [{ date, factors:[], note:'' }]
 * @param {number}  [_nowMs]         Override Date.now() for deterministic tests
 *
 * @returns {object}  Reflection object — never throws.
 *   {
 *     count:        number,          // check-ins found in past 7 days
 *     isDemo:       boolean,
 *     empty:        boolean,         // true when no history at all
 *     observations: [{key, text}],   // 0–5 items
 *     factorResult: object|null,     // factor patterns from behavior journal
 *     focus:        string,          // next-week nudge
 *     disclaimer:   string,          // medical safety note
 *   }
 */
function computeWeeklyReflection(metrics, behaviorHistory, _nowMs) {
  const nowMs  = typeof _nowMs === 'number' ? _nowMs : Date.now();
  const cutoff = nowMs - 7 * 24 * 60 * 60 * 1000;
  const rawHistory = Array.isArray(metrics?.history) ? metrics.history : [];

  const recent = rawHistory
    .filter(entry => {
      try { return new Date(entry.date).getTime() >= cutoff; }
      catch { return false; }
    })
    .slice(-7);

  const count = recent.length;

  // Empty state — return safe object, never null
  if (!count) {
    return {
      count: 0,
      isDemo: false,
      empty: true,
      observations: [],
      factorResult: computeFactorPatterns(behaviorHistory, cutoff),
      focus: 'Log your first check-in to start building your weekly reflection.',
      disclaimer: 'BALA uses the check-ins you log locally. It does not diagnose or replace professional care.',
    };
  }

  const isDemo = String(metrics?.source || '').toLowerCase().includes('demo');

  // Behavior-note lookup by YYYY-MM-DD key
  const bhMap = {};
  for (const bh of (behaviorHistory || [])) {
    if (bh.date) bhMap[String(bh.date).slice(0, 10)] = bh;
  }

  const sleepValues = recent.map(d => d.sleep).filter(Number.isFinite);
  const hrvValues   = recent.map(d => d.hrv).filter(Number.isFinite);
  const rhrValues   = recent.map(d => d.rhr).filter(Number.isFinite);

  const observations = [];

  // ── Observation 1: Sleep consistency (≥3 readings) ───────────
  if (sleepValues.length >= 3) {
    const sd   = stdDevOf(sleepValues);
    const mean = averageOf(sleepValues);
    const minS = Math.min(...sleepValues).toFixed(1);
    const maxS = Math.max(...sleepValues).toFixed(1);
    if (sd !== null) {
      if (sd < 0.5) {
        observations.push({ key: 'sleep_consistent',
          text: `Sleep was fairly consistent this week (around ${mean.toFixed(1)}h average). Consistency is one pattern worth noticing.` });
      } else if (sd >= 1.0) {
        observations.push({ key: 'sleep_variable',
          text: `Sleep duration ranged from ${minS}h to ${maxS}h this week. Some variation is normal — just worth noticing.` });
      } else {
        observations.push({ key: 'sleep_moderate',
          text: `Sleep averaged around ${mean.toFixed(1)}h this week with moderate variation (${minS}–${maxS}h range).` });
      }
    }
  }

  // ── Observation 2: HRV trend (≥3 readings) ───────────────────
  if (hrvValues.length >= 3) {
    const dir = trendDirection(hrvValues);
    if (dir === 'up') {
      observations.push({ key: 'hrv_rising',
        text: 'HRV trended upward this week. That can reflect improving recovery — though day-to-day variation is completely normal.' });
    } else if (dir === 'down') {
      observations.push({ key: 'hrv_falling',
        text: 'HRV trended slightly lower this week. This often self-corrects with rest and can shift with sleep, activity, or stress.' });
    } else if (dir === 'stable') {
      observations.push({ key: 'hrv_stable',
        text: 'HRV stayed fairly stable this week. Stable readings often reflect a consistent routine.' });
    }
  }

  // ── Observation 3: Resting heart rate trend (≥3 readings) ────
  if (rhrValues.length >= 3) {
    const dir = trendDirection(rhrValues);
    if (dir === 'down') {
      observations.push({ key: 'rhr_falling',
        text: 'Resting heart rate trended slightly lower this week, which can reflect consistent recovery pacing.' });
    } else if (dir === 'up') {
      observations.push({ key: 'rhr_rising',
        text: 'Resting heart rate trended a bit higher this week. Sleep, hydration, and activity can all influence this signal.' });
    }
    // stable RHR — skip to conserve observation slots
  }

  // ── Observation 4/5: Best & toughest day (≥2 scored days) ────
  const scored = recent
    .map(entry => ({
      date:    entry.date,
      dateKey: String(entry.date || '').slice(0, 10),
      proxy:   dayProxyScore(entry),
      bh:      bhMap[String(entry.date || '').slice(0, 10)] || null,
    }))
    .filter(d => d.proxy !== null);

  if (scored.length >= 2) {
    const best     = scored.reduce((a, b) => b.proxy > a.proxy ? b : a);
    const toughest = scored.reduce((a, b) => b.proxy < a.proxy ? b : a);

    if (best.dateKey !== toughest.dateKey) {
      let dayText = `Signals looked strongest around ${friendlyDate(best.date)} and lower around ${friendlyDate(toughest.date)}.`;
      const rawNote = toughest.bh?.note;
      if (rawNote && String(rawNote).trim()) {
        const note = String(rawNote).trim();
        const truncated = note.length > 80 ? note.slice(0, 80) + '…' : note;
        dayText += ` You noted that day: "${truncated}"`;
      }
      observations.push({ key: 'best_toughest_day', text: dayText });
    }
  }

  // Cap at 5
  const finalObservations = observations.slice(0, 5);

  return {
    count,
    isDemo,
    empty: false,
    observations: finalObservations,
    factorResult: computeFactorPatterns(behaviorHistory, cutoff),
    focus: deriveNextWeekFocus(sleepValues, hrvValues, rhrValues),
    disclaimer: 'Based on the check-ins available. This is a pattern to notice, not a medical conclusion. More check-ins will make this reflection more useful. BALA does not diagnose or replace professional care.',
  };
}

// ---------------------------------------------------------------------------
module.exports = {
  computeWeeklyReflection,
  computeFactorPatterns,
  trendDirection,
  averageOf,
  stdDevOf,
  dayProxyScore,
  deriveNextWeekFocus,
  friendlyDate,
  BEHAVIOR_FACTOR_LABELS,
};
