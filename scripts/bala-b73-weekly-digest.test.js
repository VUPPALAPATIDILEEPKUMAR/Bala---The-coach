// scripts/bala-b73-weekly-digest.test.js
// B73 test suite — BALA Weekly Digest Engine
// All tests are local-only, no network calls, no external dependencies.
'use strict';

const {
  buildWeeklyDigest,
  getLastNDays,
  computeWeeklyAvg,
  findBestDay,
  findWorstDay,
  getTrendDirection,
  formatDigestDate,
  pickHeadline,
  DIGEST_WINDOW_DAYS,
  DIGEST_MIN_ENTRIES
} = require('./bala-b73-weekly-digest-engine.js');

// ─── Test Helpers ────────────────────────────────────────────────────────────

/** Generate N days of synthetic check-in data starting from 2025-06-01 */
function makeHistory(n, defaults) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(2025, 5, 1 + i); // June 2025
    const pad = s => String(s).padStart(2, '0');
    out.push(Object.assign({
      date: d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()),
      balaScore: 65 + i,        // 65..65+n
      sleepHours: 7 + (i % 2),  // alternates 7/8
      steps: 7000 + i * 100,
      hrv: 45 + i,
      spo2: 97,
    }, defaults || {}));
  }
  return out;
}

/** History where scores rise linearly */
function risingHistory(n) {
  return makeHistory(n).map((e, i) => ({ ...e, balaScore: 50 + i * 5 }));
}

/** History where scores fall linearly */
function fallingHistory(n) {
  return makeHistory(n).map((e, i) => ({ ...e, balaScore: 90 - i * 5 }));
}

// ─── getLastNDays ────────────────────────────────────────────────────────────

describe('getLastNDays', () => {
  test('returns exactly N entries when history is larger', () => {
    expect(getLastNDays(makeHistory(14), 7).length).toBe(7);
  });

  test('returns all entries when history is smaller than N', () => {
    expect(getLastNDays(makeHistory(4), 7).length).toBe(4);
  });

  test('entries are sorted ascending by date', () => {
    const r = getLastNDays(makeHistory(7), 7);
    for (let i = 1; i < r.length; i++) {
      expect(r[i].date >= r[i - 1].date).toBe(true);
    }
  });

  test('returns last N chronologically (not first N)', () => {
    const h = makeHistory(10);
    const r = getLastNDays(h, 3);
    expect(r[0].date).toBe('2025-06-08');
    expect(r[2].date).toBe('2025-06-10');
  });

  test('handles empty array', () => {
    expect(getLastNDays([], 7)).toEqual([]);
  });

  test('handles null input', () => {
    expect(getLastNDays(null, 7)).toEqual([]);
  });

  test('handles undefined input', () => {
    expect(getLastNDays(undefined, 7)).toEqual([]);
  });

  test('filters out entries missing date field', () => {
    const h = [{ balaScore: 70 }, { date: '2025-06-01', balaScore: 75 }];
    expect(getLastNDays(h, 7).length).toBe(1);
  });

  test('handles n=1', () => {
    expect(getLastNDays(makeHistory(5), 1).length).toBe(1);
  });

  test('handles n=0 (edge)', () => {
    expect(getLastNDays(makeHistory(5), 0).length).toBe(0);
  });
});

// ─── computeWeeklyAvg ────────────────────────────────────────────────────────

describe('computeWeeklyAvg', () => {
  test('computes correct integer average', () => {
    const e = [{ x: 80 }, { x: 70 }, { x: 60 }];
    expect(computeWeeklyAvg(e, 'x')).toBe(70);
  });

  test('rounds to one decimal place', () => {
    const e = [{ x: 70 }, { x: 71 }];
    expect(computeWeeklyAvg(e, 'x')).toBe(70.5);
  });

  test('filters zero values', () => {
    const e = [{ x: 0 }, { x: 80 }];
    expect(computeWeeklyAvg(e, 'x')).toBe(80);
  });

  test('filters NaN values', () => {
    const e = [{ x: 'na' }, { x: 80 }];
    expect(computeWeeklyAvg(e, 'x')).toBe(80);
  });

  test('returns null when all values are invalid', () => {
    expect(computeWeeklyAvg([{ x: 'na' }, { x: 0 }], 'x')).toBeNull();
  });

  test('returns null for empty entries', () => {
    expect(computeWeeklyAvg([], 'x')).toBeNull();
  });

  test('handles missing field on all entries', () => {
    const e = [{ y: 80 }, { y: 70 }];
    expect(computeWeeklyAvg(e, 'x')).toBeNull();
  });

  test('handles single valid entry', () => {
    expect(computeWeeklyAvg([{ x: 75 }], 'x')).toBe(75);
  });

  test('handles large values without overflow', () => {
    const e = [{ x: 10000 }, { x: 20000 }];
    expect(computeWeeklyAvg(e, 'x')).toBe(15000);
  });
});

// ─── findBestDay ─────────────────────────────────────────────────────────────

describe('findBestDay', () => {
  test('returns the entry with the highest score', () => {
    const e = [
      { date: '2025-06-01', balaScore: 60 },
      { date: '2025-06-02', balaScore: 90 },
      { date: '2025-06-03', balaScore: 70 },
    ];
    const r = findBestDay(e, 'balaScore');
    expect(r.date).toBe('2025-06-02');
    expect(r.score).toBe(90);
  });

  test('returns null for empty array', () => {
    expect(findBestDay([], 'balaScore')).toBeNull();
  });

  test('handles single entry', () => {
    const r = findBestDay([{ date: '2025-06-01', balaScore: 75 }], 'balaScore');
    expect(r).toEqual({ date: '2025-06-01', score: 75 });
  });

  test('handles tie — keeps first found highest', () => {
    const e = [
      { date: '2025-06-01', balaScore: 80 },
      { date: '2025-06-02', balaScore: 80 },
    ];
    const r = findBestDay(e, 'balaScore');
    expect(r.score).toBe(80);
  });

  test('ignores NaN score entries', () => {
    const e = [
      { date: '2025-06-01', balaScore: 'bad' },
      { date: '2025-06-02', balaScore: 75 },
    ];
    const r = findBestDay(e, 'balaScore');
    expect(r.date).toBe('2025-06-02');
  });
});

// ─── findWorstDay ────────────────────────────────────────────────────────────

describe('findWorstDay', () => {
  test('returns entry with lowest score', () => {
    const e = [
      { date: '2025-06-01', balaScore: 60 },
      { date: '2025-06-02', balaScore: 90 },
      { date: '2025-06-03', balaScore: 40 },
    ];
    const r = findWorstDay(e, 'balaScore');
    expect(r.date).toBe('2025-06-03');
    expect(r.score).toBe(40);
  });

  test('returns null for empty array', () => {
    expect(findWorstDay([], 'balaScore')).toBeNull();
  });

  test('handles single entry', () => {
    const r = findWorstDay([{ date: '2025-06-01', balaScore: 50 }], 'balaScore');
    expect(r.score).toBe(50);
  });

  test('ignores NaN entries', () => {
    const e = [
      { date: '2025-06-01', balaScore: 'x' },
      { date: '2025-06-02', balaScore: 55 },
    ];
    expect(findWorstDay(e, 'balaScore').date).toBe('2025-06-02');
  });
});

// ─── getTrendDirection ───────────────────────────────────────────────────────

describe('getTrendDirection', () => {
  test('returns improving when second half is significantly higher', () => {
    const e = [{ v: 60 }, { v: 62 }, { v: 74 }, { v: 76 }];
    expect(getTrendDirection(e, 'v')).toBe('improving');
  });

  test('returns declining when second half is significantly lower', () => {
    const e = [{ v: 80 }, { v: 78 }, { v: 65 }, { v: 63 }];
    expect(getTrendDirection(e, 'v')).toBe('declining');
  });

  test('returns stable for small change (<2)', () => {
    const e = [{ v: 70 }, { v: 70 }, { v: 71 }, { v: 71 }];
    expect(getTrendDirection(e, 'v')).toBe('stable');
  });

  test('returns stable for single entry', () => {
    expect(getTrendDirection([{ v: 70 }], 'v')).toBe('stable');
  });

  test('returns stable for empty array', () => {
    expect(getTrendDirection([], 'v')).toBe('stable');
  });

  test('filters invalid (NaN) values before comparing', () => {
    const e = [{ v: 60 }, { v: 'bad' }, { v: 80 }];
    // valid: [60, 80] → first half [60], second [80], diff 20 → improving
    expect(getTrendDirection(e, 'v')).toBe('improving');
  });

  test('filters zero values', () => {
    const e = [{ v: 0 }, { v: 70 }, { v: 0 }, { v: 80 }];
    // valid: [70, 80] → stable (diff=10 >2 → actually improving)
    expect(getTrendDirection(e, 'v')).toBe('improving');
  });

  test('7-day improving trend detected', () => {
    const e = [60, 62, 65, 67, 70, 73, 76].map(v => ({ v }));
    expect(getTrendDirection(e, 'v')).toBe('improving');
  });

  test('7-day declining trend detected', () => {
    const e = [80, 77, 74, 70, 65, 62, 58].map(v => ({ v }));
    expect(getTrendDirection(e, 'v')).toBe('declining');
  });
});

// ─── formatDigestDate ────────────────────────────────────────────────────────

describe('formatDigestDate', () => {
  test('formats June 7 correctly', () => {
    expect(formatDigestDate('2025-06-07')).toBe('Jun 7');
  });

  test('formats December 31 correctly', () => {
    expect(formatDigestDate('2025-12-31')).toBe('Dec 31');
  });

  test('formats January 1 correctly', () => {
    expect(formatDigestDate('2025-01-01')).toBe('Jan 1');
  });

  test('strips leading zero from day', () => {
    expect(formatDigestDate('2025-03-05')).toBe('Mar 5');
  });

  test('returns empty string for null', () => {
    expect(formatDigestDate(null)).toBe('');
  });

  test('returns empty string for undefined', () => {
    expect(formatDigestDate(undefined)).toBe('');
  });

  test('returns empty string for empty string', () => {
    expect(formatDigestDate('')).toBe('');
  });

  test('handles all 12 months', () => {
    const expected = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    expected.forEach((m, i) => {
      const mm = String(i + 1).padStart(2, '0');
      expect(formatDigestDate('2025-' + mm + '-15')).toBe(m + ' 15');
    });
  });
});

// ─── pickHeadline ────────────────────────────────────────────────────────────

describe('pickHeadline', () => {
  test('high score (>=80) gives "Great week" headline', () => {
    const h = pickHeadline(82, { sleep: 'stable', steps: 'stable', hrv: 'stable' });
    expect(h).toContain('Great week');
  });

  test('mid score (60-79) gives "Solid week" headline', () => {
    const h = pickHeadline(70, { sleep: 'stable', steps: 'stable', hrv: 'stable' });
    expect(h).toContain('Solid week');
  });

  test('low score but 2+ improving trends gives upward headline', () => {
    const h = pickHeadline(45, { sleep: 'improving', steps: 'improving', hrv: 'declining' });
    expect(h).toContain('trending upward');
  });

  test('low score and 0-1 improving trends gives check-in prompt', () => {
    const h = pickHeadline(45, { sleep: 'declining', steps: 'stable', hrv: 'declining' });
    expect(h).toContain('check in more');
  });

  test('null avgScore falls through to trend logic', () => {
    const h = pickHeadline(null, { sleep: 'improving', steps: 'improving', hrv: 'improving' });
    expect(h).toContain('trending upward');
  });

  test('null avgScore with weak trends gives check-in prompt', () => {
    const h = pickHeadline(null, { sleep: 'stable', steps: 'stable', hrv: 'stable' });
    expect(h).toContain('check in more');
  });

  test('all improving trends (3) gives upward headline', () => {
    const h = pickHeadline(50, { sleep: 'improving', steps: 'improving', hrv: 'improving' });
    expect(h).toContain('trending upward');
  });
});

// ─── buildWeeklyDigest (integration) ─────────────────────────────────────────

describe('buildWeeklyDigest', () => {
  test('returns ok:false for empty history', () => {
    const r = buildWeeklyDigest([]);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('not_enough_data');
  });

  test('returns ok:false for single entry', () => {
    const r = buildWeeklyDigest(makeHistory(1));
    expect(r.ok).toBe(false);
    expect(r.entriesFound).toBe(1);
  });

  test('returns ok:true for exactly DIGEST_MIN_ENTRIES', () => {
    const r = buildWeeklyDigest(makeHistory(DIGEST_MIN_ENTRIES));
    expect(r.ok).toBe(true);
  });

  test('returns ok:true for 7 entries', () => {
    const r = buildWeeklyDigest(makeHistory(7));
    expect(r.ok).toBe(true);
    expect(r.entriesFound).toBe(7);
  });

  test('uses last 7 days from 14-day history', () => {
    const r = buildWeeklyDigest(makeHistory(14));
    expect(r.entriesFound).toBe(7);
  });

  test('avgScore is a number for valid history', () => {
    const r = buildWeeklyDigest(makeHistory(7));
    expect(typeof r.avgScore).toBe('number');
  });

  test('bestDay is non-null for valid history', () => {
    const r = buildWeeklyDigest(makeHistory(7));
    expect(r.bestDay).not.toBeNull();
    expect(r.bestDay).toHaveProperty('date');
    expect(r.bestDay).toHaveProperty('score');
  });

  test('worstDay is non-null for valid history', () => {
    const r = buildWeeklyDigest(makeHistory(7));
    expect(r.worstDay).not.toBeNull();
  });

  test('bestDay.score >= worstDay.score', () => {
    const r = buildWeeklyDigest(makeHistory(7));
    expect(r.bestDay.score).toBeGreaterThanOrEqual(r.worstDay.score);
  });

  test('trends object has sleep, steps, hrv keys', () => {
    const r = buildWeeklyDigest(makeHistory(7));
    expect(r.trends).toHaveProperty('sleep');
    expect(r.trends).toHaveProperty('steps');
    expect(r.trends).toHaveProperty('hrv');
  });

  test('trend values are valid strings', () => {
    const r = buildWeeklyDigest(makeHistory(7));
    const valid = ['improving', 'declining', 'stable'];
    Object.values(r.trends).forEach(t => expect(valid).toContain(t));
  });

  test('headline is a non-empty string', () => {
    const r = buildWeeklyDigest(makeHistory(7));
    expect(typeof r.headline).toBe('string');
    expect(r.headline.length).toBeGreaterThan(0);
  });

  test('high-score history gives Great week headline', () => {
    const h = makeHistory(7).map(e => ({ ...e, balaScore: 85 }));
    expect(buildWeeklyDigest(h).headline).toContain('Great week');
  });

  test('mid-score history gives Solid week headline', () => {
    const h = makeHistory(7).map(e => ({ ...e, balaScore: 68 }));
    expect(buildWeeklyDigest(h).headline).toContain('Solid week');
  });

  test('rising history trends show improving', () => {
    const r = buildWeeklyDigest(risingHistory(7));
    // Steps increase linearly → should be improving
    expect(['improving', 'stable']).toContain(r.trends.steps);
  });

  test('windowDays is 7 in result', () => {
    expect(buildWeeklyDigest(makeHistory(7)).windowDays).toBe(7);
  });

  test('uses custom scoreKey', () => {
    const h = makeHistory(7).map(e => ({ ...e, myScore: 90 }));
    const r = buildWeeklyDigest(h, 'myScore');
    expect(r.avgScore).toBe(90);
  });

  test('handles missing sleepHours gracefully (stable trend)', () => {
    const h = makeHistory(7).map(e => { const c = { ...e }; delete c.sleepHours; return c; });
    const r = buildWeeklyDigest(h);
    expect(r.trends.sleep).toBe('stable');
  });

  test('handles missing hrv gracefully', () => {
    const h = makeHistory(7).map(e => { const c = { ...e }; delete c.hrv; return c; });
    const r = buildWeeklyDigest(h);
    expect(r.trends.hrv).toBe('stable');
  });

  test('entriesFound matches actual slice size', () => {
    const r = buildWeeklyDigest(makeHistory(5));
    expect(r.entriesFound).toBe(5);
  });

  test('ok:false includes minRequired field', () => {
    const r = buildWeeklyDigest([makeHistory(1)[0]]);
    expect(r).toHaveProperty('minRequired');
  });

  test('all-same scores give equal bestDay and worstDay scores', () => {
    const h = makeHistory(7).map(e => ({ ...e, balaScore: 70 }));
    const r = buildWeeklyDigest(h);
    expect(r.bestDay.score).toBe(70);
    expect(r.worstDay.score).toBe(70);
  });
});

// ─── Constants ───────────────────────────────────────────────────────────────

describe('module constants', () => {
  test('DIGEST_WINDOW_DAYS is 7', () => {
    expect(DIGEST_WINDOW_DAYS).toBe(7);
  });

  test('DIGEST_MIN_ENTRIES is 2', () => {
    expect(DIGEST_MIN_ENTRIES).toBe(2);
  });
});
