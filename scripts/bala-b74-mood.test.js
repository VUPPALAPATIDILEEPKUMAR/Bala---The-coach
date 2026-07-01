// scripts/bala-b74-mood.test.js
// B74 test suite -- BALA Mood & Energy Quick Log Engine
'use strict';

const {
  logMoodEntry, getRecentEntries, getEntryForDate,
  computeMoodAvg, computeEnergyAvg, buildMoodSummary,
  clampRating, getMoodLabel, getEnergyLabel, getMoodEmoji, getEnergyEmoji,
  MOOD_KEY, MOOD_MIN, MOOD_MAX, MOOD_LABELS, ENERGY_LABELS
} = require('./bala-b74-mood-engine.js');

// --- Fake localStorage ---
function makeFakeStorage(initial) {
  const store = {};
  if (initial) store[MOOD_KEY] = JSON.stringify(initial);
  return {
    getItem(k)    { return store[k] !== undefined ? store[k] : null; },
    setItem(k, v) { store[k] = v; },
    removeItem(k) { delete store[k]; },
    _store: store
  };
}

function makeEntries(n, moodVal, energyVal) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(2025, 5, 1 + i);
    out.push({
      date: d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'),
      mood: moodVal !== undefined ? moodVal : (1 + (i % 5)),
      energy: energyVal !== undefined ? energyVal : (1 + (i % 5)),
      ts: Date.now()
    });
  }
  return out;
}

// --- clampRating ---
describe('clampRating', () => {
  test('returns integer in [1,5] for valid input', () => {
    expect(clampRating(3)).toBe(3);
  });
  test('clamps below min to 1', () => {
    expect(clampRating(0)).toBe(1);
    expect(clampRating(-5)).toBe(1);
  });
  test('clamps above max to 5', () => {
    expect(clampRating(6)).toBe(5);
    expect(clampRating(100)).toBe(5);
  });
  test('parses string "4" to 4', () => {
    expect(clampRating('4')).toBe(4);
  });
  test('returns null for NaN string', () => {
    expect(clampRating('abc')).toBeNull();
  });
  test('returns null for undefined', () => {
    expect(clampRating(undefined)).toBeNull();
  });
  test('returns null for null', () => {
    expect(clampRating(null)).toBeNull();
  });
  test('handles boundary 1', () => { expect(clampRating(1)).toBe(1); });
  test('handles boundary 5', () => { expect(clampRating(5)).toBe(5); });
  test('handles float 3.7 -> 3', () => { expect(clampRating(3.7)).toBe(3); });
});

// --- logMoodEntry ---
describe('logMoodEntry', () => {
  test('saves an entry and returns ok:true', () => {
    const s = makeFakeStorage();
    const r = logMoodEntry(4, 3, '2025-06-01', s);
    expect(r.ok).toBe(true);
    expect(r.entry.mood).toBe(4);
    expect(r.entry.energy).toBe(3);
  });

  test('upserts same date entry', () => {
    const s = makeFakeStorage();
    logMoodEntry(3, 3, '2025-06-01', s);
    logMoodEntry(5, 5, '2025-06-01', s);
    const entries = getRecentEntries(10, s);
    expect(entries.filter(e => e.date === '2025-06-01').length).toBe(1);
    expect(entries.find(e => e.date === '2025-06-01').mood).toBe(5);
  });

  test('returns ok:false for invalid mood', () => {
    const s = makeFakeStorage();
    const r = logMoodEntry('bad', 3, '2025-06-01', s);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('invalid_rating');
  });

  test('returns ok:false for invalid energy', () => {
    const s = makeFakeStorage();
    const r = logMoodEntry(3, null, '2025-06-01', s);
    expect(r.ok).toBe(false);
  });

  test('clamps out-of-range mood to valid', () => {
    const s = makeFakeStorage();
    const r = logMoodEntry(10, 3, '2025-06-01', s);
    expect(r.entry.mood).toBe(5);
  });

  test('stores timestamp', () => {
    const s = makeFakeStorage();
    const r = logMoodEntry(4, 4, '2025-06-01', s);
    expect(typeof r.entry.ts).toBe('number');
  });

  test('keeps entries sorted by date', () => {
    const s = makeFakeStorage();
    logMoodEntry(3, 3, '2025-06-03', s);
    logMoodEntry(4, 4, '2025-06-01', s);
    const e = getRecentEntries(10, s);
    expect(e[0].date).toBe('2025-06-01');
    expect(e[1].date).toBe('2025-06-03');
  });

  test('respects 90-day cap', () => {
    const initial = makeEntries(90, 3, 3);
    const s = makeFakeStorage(initial);
    logMoodEntry(4, 4, '2025-09-30', s);
    expect(getRecentEntries(200, s).length).toBe(90);
  });

  test('multiple dates accumulate', () => {
    const s = makeFakeStorage();
    for (let i = 0; i < 5; i++) {
      logMoodEntry(3, 3, '2025-06-0' + (i + 1), s);
    }
    expect(getRecentEntries(10, s).length).toBe(5);
  });
});

// --- getRecentEntries ---
describe('getRecentEntries', () => {
  test('returns last N entries', () => {
    const s = makeFakeStorage(makeEntries(10, 3, 3));
    expect(getRecentEntries(7, s).length).toBe(7);
  });

  test('returns all if fewer than N', () => {
    const s = makeFakeStorage(makeEntries(4, 3, 3));
    expect(getRecentEntries(10, s).length).toBe(4);
  });

  test('returns empty for empty storage', () => {
    const s = makeFakeStorage();
    expect(getRecentEntries(7, s)).toEqual([]);
  });

  test('handles n=0', () => {
    const s = makeFakeStorage(makeEntries(5, 3, 3));
    expect(getRecentEntries(0, s).length).toBe(0);
  });
});

// --- getEntryForDate ---
describe('getEntryForDate', () => {
  test('returns entry matching date', () => {
    const s = makeFakeStorage(makeEntries(5, 4, 3));
    const e = getEntryForDate('2025-06-03', s);
    expect(e).not.toBeNull();
    expect(e.date).toBe('2025-06-03');
  });

  test('returns null for missing date', () => {
    const s = makeFakeStorage(makeEntries(5, 3, 3));
    expect(getEntryForDate('2025-07-15', s)).toBeNull();
  });

  test('returns null for empty storage', () => {
    const s = makeFakeStorage();
    expect(getEntryForDate('2025-06-01', s)).toBeNull();
  });
});

// --- computeMoodAvg ---
describe('computeMoodAvg', () => {
  test('returns correct average', () => {
    const e = [{ mood: 4 }, { mood: 2 }, { mood: 3 }];
    expect(computeMoodAvg(e)).toBe(3);
  });

  test('returns null for empty', () => {
    expect(computeMoodAvg([])).toBeNull();
  });

  test('rounds to one decimal', () => {
    const e = [{ mood: 4 }, { mood: 3 }];
    expect(computeMoodAvg(e)).toBe(3.5);
  });

  test('filters out non-numeric moods', () => {
    const e = [{ mood: 'bad' }, { mood: 4 }];
    expect(computeMoodAvg(e)).toBe(4);
  });

  test('single entry returns that value', () => {
    expect(computeMoodAvg([{ mood: 5 }])).toBe(5);
  });
});

// --- computeEnergyAvg ---
describe('computeEnergyAvg', () => {
  test('returns correct average', () => {
    const e = [{ energy: 5 }, { energy: 3 }];
    expect(computeEnergyAvg(e)).toBe(4);
  });

  test('returns null for empty', () => {
    expect(computeEnergyAvg([])).toBeNull();
  });

  test('rounds to one decimal', () => {
    const e = [{ energy: 4 }, { energy: 3 }];
    expect(computeEnergyAvg(e)).toBe(3.5);
  });
});

// --- buildMoodSummary ---
describe('buildMoodSummary', () => {
  test('returns ok:false for empty entries', () => {
    expect(buildMoodSummary([]).ok).toBe(false);
  });

  test('returns ok:true for valid entries', () => {
    expect(buildMoodSummary(makeEntries(5, 4, 3)).ok).toBe(true);
  });

  test('includes count', () => {
    expect(buildMoodSummary(makeEntries(5, 4, 3)).count).toBe(5);
  });

  test('includes moodAvg', () => {
    const r = buildMoodSummary(makeEntries(5, 4, 3));
    expect(r.moodAvg).toBe(4);
  });

  test('includes energyAvg', () => {
    const r = buildMoodSummary(makeEntries(5, 4, 3));
    expect(r.energyAvg).toBe(3);
  });

  test('includes bestDay', () => {
    const r = buildMoodSummary(makeEntries(5, 4, 3));
    expect(r.bestDay).not.toBeNull();
    expect(r.bestDay).toHaveProperty('date');
  });

  test('includes moodLabel string', () => {
    const r = buildMoodSummary(makeEntries(5, 4, 3));
    expect(typeof r.moodLabel).toBe('string');
    expect(r.moodLabel.length).toBeGreaterThan(0);
  });

  test('includes energyLabel string', () => {
    const r = buildMoodSummary(makeEntries(5, 4, 3));
    expect(typeof r.energyLabel).toBe('string');
  });

  test('bestDay has highest mood', () => {
    const e = [
      { date: '2025-06-01', mood: 3, energy: 3 },
      { date: '2025-06-02', mood: 5, energy: 4 },
      { date: '2025-06-03', mood: 2, energy: 2 },
    ];
    const r = buildMoodSummary(e);
    expect(r.bestDay.date).toBe('2025-06-02');
    expect(r.bestDay.mood).toBe(5);
  });
});

// --- Label / Emoji helpers ---
describe('getMoodLabel', () => {
  test('returns correct label for 5', () => {
    expect(getMoodLabel(5)).toBe('Great');
  });
  test('returns correct label for 1', () => {
    expect(getMoodLabel(1)).toBe('Low');
  });
  test('returns label for 3', () => {
    expect(getMoodLabel(3)).toBe('OK');
  });
});

describe('getEnergyLabel', () => {
  test('returns correct label for 5', () => {
    expect(getEnergyLabel(5)).toBe('Vibrant');
  });
  test('returns correct label for 1', () => {
    expect(getEnergyLabel(1)).toBe('Drained');
  });
});

describe('getMoodEmoji', () => {
  test('returns emoji for 5', () => {
    expect(getMoodEmoji(5)).toBe('😄');
  });
  test('returns emoji for 1', () => {
    expect(getMoodEmoji(1)).toBe('😔');
  });
  test('all ratings have an emoji', () => {
    for (let i = 1; i <= 5; i++) {
      expect(getMoodEmoji(i).length).toBeGreaterThan(0);
    }
  });
});

describe('getEnergyEmoji', () => {
  test('returns emoji for 5', () => {
    expect(getEnergyEmoji(5)).toBe('✨');
  });
  test('returns emoji for 1', () => {
    expect(getEnergyEmoji(1)).toBe('🪫');
  });
});

// --- Constants ---
describe('module constants', () => {
  test('MOOD_MIN is 1', () => { expect(MOOD_MIN).toBe(1); });
  test('MOOD_MAX is 5', () => { expect(MOOD_MAX).toBe(5); });
  test('MOOD_LABELS has 6 entries (index 0 empty)', () => { expect(MOOD_LABELS.length).toBe(6); });
  test('ENERGY_LABELS has 6 entries', () => { expect(ENERGY_LABELS.length).toBe(6); });
  test('MOOD_KEY is a non-empty string', () => {
    expect(typeof MOOD_KEY).toBe('string');
    expect(MOOD_KEY.length).toBeGreaterThan(0);
  });
});
