// scripts/chintu-bala-weekly-skill.test.js -- C73
// Tests for Chintu BALA Weekly Digest Skill
// All tests are local-only: no network, no external deps, no Telegram calls.
'use strict';

const os   = require('os');
const fs   = require('fs');
const path = require('path');

const {
  getBALAWeeklyDigest,
  computeDigest,
  loadBALAExport,
  formatDigestText,
  formatHeadline,
  fmtDate,
  getLastNDays,
  numAvg,
  trendDir,
  bestDay,
  resolveExportPath,
  SKILL_ID,
  SKILL_VERSION,
  SAFETY_FOOTER,
  DIGEST_DAYS,
  DIGEST_MIN,
} = require('./chintu-bala-weekly-skill.js');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTmpExport(data) {
  const tmp = path.join(os.tmpdir(), 'bala-test-' + Date.now() + '.json');
  fs.writeFileSync(tmp, JSON.stringify(data), 'utf-8');
  return tmp;
}

function makeHistory(n, scoreBase) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(2025, 5, 1 + i);
    const pad = x => String(x).padStart(2, '0');
    out.push({
      date: d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()),
      balaScore: (scoreBase || 70) + i,
      sleepHours: 7 + (i % 2),
      steps: 7000 + i * 100,
      hrv: 45 + i,
    });
  }
  return out;
}

function makeExportV2(n, scoreBase) {
  const history = makeHistory(n, scoreBase);
  return { exportVersion: 2, today: history[history.length - 1], history };
}

// ─── resolveExportPath ───────────────────────────────────────────────────────

describe('resolveExportPath', () => {
  test('returns override when provided', () => {
    expect(resolveExportPath('/tmp/foo.json')).toBe('/tmp/foo.json');
  });

  test('returns default path when no override or env var', () => {
    const old = process.env.CHINTU_BALA_EXPORT_PATH;
    delete process.env.CHINTU_BALA_EXPORT_PATH;
    const r = resolveExportPath(null);
    expect(r.endsWith('bala-export.json')).toBe(true);
    if (old !== undefined) process.env.CHINTU_BALA_EXPORT_PATH = old;
  });

  test('returns env var path when set', () => {
    process.env.CHINTU_BALA_EXPORT_PATH = '/custom/path.json';
    expect(resolveExportPath(null)).toBe('/custom/path.json');
    delete process.env.CHINTU_BALA_EXPORT_PATH;
  });
});

// ─── loadBALAExport ──────────────────────────────────────────────────────────

describe('loadBALAExport', () => {
  test('returns ok:false for missing file', () => {
    const r = loadBALAExport('/nonexistent/path/bala.json');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('export_not_found');
  });

  test('loads exportVersion:2 format', () => {
    const tmp = makeTmpExport(makeExportV2(5));
    const r = loadBALAExport(tmp);
    fs.unlinkSync(tmp);
    expect(r.ok).toBe(true);
    expect(Array.isArray(r.history)).toBe(true);
    expect(r.history.length).toBe(5);
  });

  test('loads bala-export-v1 format (format B)', () => {
    const tmp = makeTmpExport({
      format: 'bala-export-v1',
      data: { health: { history: makeHistory(4), sleepHours: 7 } }
    });
    const r = loadBALAExport(tmp);
    fs.unlinkSync(tmp);
    expect(r.ok).toBe(true);
    expect(r.history.length).toBe(4);
  });

  test('loads bare history array format (format C)', () => {
    const tmp = makeTmpExport({ history: makeHistory(3) });
    const r = loadBALAExport(tmp);
    fs.unlinkSync(tmp);
    expect(r.ok).toBe(true);
    expect(r.history.length).toBe(3);
  });

  test('returns ok:false for unknown format', () => {
    const tmp = makeTmpExport({ random: 'data' });
    const r = loadBALAExport(tmp);
    fs.unlinkSync(tmp);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('unknown_format');
  });

  test('returns ok:false for invalid JSON', () => {
    const tmp = path.join(os.tmpdir(), 'bad.json');
    fs.writeFileSync(tmp, 'NOT JSON', 'utf-8');
    const r = loadBALAExport(tmp);
    fs.unlinkSync(tmp);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('parse_error');
  });

  test('empty history array is ok', () => {
    const tmp = makeTmpExport({ exportVersion: 2, today: {}, history: [] });
    const r = loadBALAExport(tmp);
    fs.unlinkSync(tmp);
    expect(r.ok).toBe(true);
    expect(r.history.length).toBe(0);
  });
});

// ─── getLastNDays ────────────────────────────────────────────────────────────

describe('getLastNDays', () => {
  test('returns last 7 from 14', () => {
    expect(getLastNDays(makeHistory(14), 7).length).toBe(7);
  });
  test('returns all when fewer than n', () => {
    expect(getLastNDays(makeHistory(4), 7).length).toBe(4);
  });
  test('handles empty array', () => {
    expect(getLastNDays([], 7)).toEqual([]);
  });
  test('handles n=0', () => {
    expect(getLastNDays(makeHistory(5), 0).length).toBe(0);
  });
  test('entries sorted ascending', () => {
    const r = getLastNDays(makeHistory(7), 7);
    expect(r[0].date < r[6].date).toBe(true);
  });
});

// ─── numAvg ─────────────────────────────────────────────────────────────────

describe('numAvg', () => {
  test('correct average', () => {
    expect(numAvg([{x:80},{x:60}], 'x')).toBe(70);
  });
  test('null for empty', () => {
    expect(numAvg([], 'x')).toBeNull();
  });
  test('filters zeros', () => {
    expect(numAvg([{x:0},{x:80}], 'x')).toBe(80);
  });
  test('rounds to one decimal', () => {
    expect(numAvg([{x:70},{x:71}], 'x')).toBe(70.5);
  });
});

// ─── trendDir ────────────────────────────────────────────────────────────────

describe('trendDir', () => {
  test('↑ when second half higher', () => {
    const e = [{v:60},{v:62},{v:74},{v:76}];
    expect(trendDir(e, 'v')).toBe('↑');
  });
  test('↓ when second half lower', () => {
    const e = [{v:80},{v:78},{v:65},{v:63}];
    expect(trendDir(e, 'v')).toBe('↓');
  });
  test('stable for small change', () => {
    const e = [{v:70},{v:70},{v:71},{v:71}];
    expect(trendDir(e, 'v')).toBe('stable');
  });
  test('stable for single entry', () => {
    expect(trendDir([{v:70}], 'v')).toBe('stable');
  });
  test('stable for empty', () => {
    expect(trendDir([], 'v')).toBe('stable');
  });
});

// ─── bestDay ────────────────────────────────────────────────────────────────

describe('bestDay', () => {
  test('finds highest score entry', () => {
    const e = [
      {date:'2025-06-01',balaScore:60},
      {date:'2025-06-02',balaScore:90},
      {date:'2025-06-03',balaScore:70}
    ];
    expect(bestDay(e).date).toBe('2025-06-02');
  });
  test('null for empty', () => {
    expect(bestDay([])).toBeNull();
  });
});

// ─── fmtDate ────────────────────────────────────────────────────────────────

describe('fmtDate', () => {
  test('formats Jun 7', () => {
    expect(fmtDate('2025-06-07')).toBe('Jun 7');
  });
  test('formats Dec 31', () => {
    expect(fmtDate('2025-12-31')).toBe('Dec 31');
  });
  test('returns ? for null', () => {
    expect(fmtDate(null)).toBe('?');
  });
});

// ─── computeDigest ──────────────────────────────────────────────────────────

describe('computeDigest', () => {
  test('ok:false for empty history', () => {
    expect(computeDigest([]).ok).toBe(false);
  });
  test('ok:false for 1 entry', () => {
    expect(computeDigest(makeHistory(1)).ok).toBe(false);
  });
  test('ok:true for 2 entries', () => {
    expect(computeDigest(makeHistory(2)).ok).toBe(true);
  });
  test('ok:true for 7 entries', () => {
    const d = computeDigest(makeHistory(7));
    expect(d.ok).toBe(true);
    expect(d.entriesFound).toBe(7);
  });
  test('uses last 7 from 14', () => {
    expect(computeDigest(makeHistory(14)).entriesFound).toBe(7);
  });
  test('includes avgScore', () => {
    expect(typeof computeDigest(makeHistory(7)).avgScore).toBe('number');
  });
  test('includes trend arrows or stable', () => {
    const d = computeDigest(makeHistory(7));
    const valid = ['↑','↓','stable'];
    expect(valid).toContain(d.sleepTrend);
    expect(valid).toContain(d.stepsTrend);
    expect(valid).toContain(d.hrvTrend);
  });
  test('includes best day', () => {
    const d = computeDigest(makeHistory(7));
    expect(d.best).not.toBeNull();
    expect(d.best).toHaveProperty('date');
    expect(d.best).toHaveProperty('score');
  });
});

// ─── formatHeadline ─────────────────────────────────────────────────────────

describe('formatHeadline', () => {
  test('Great week for score >=80', () => {
    expect(formatHeadline(85)).toContain('Great week');
  });
  test('Solid week for 60-79', () => {
    expect(formatHeadline(70)).toContain('Solid week');
  });
  test('check in more for <60', () => {
    expect(formatHeadline(45)).toContain('check in more');
  });
  test('generic message for null score', () => {
    expect(formatHeadline(null).length).toBeGreaterThan(0);
  });
});

// ─── formatDigestText ────────────────────────────────────────────────────────

describe('formatDigestText', () => {
  const sampleDigest = {
    ok: true, entriesFound: 7,
    avgScore: 74, avgSleep: 7.5, avgHRV: 48, avgSteps: 7500,
    sleepTrend: '↑', stepsTrend: 'stable', hrvTrend: '↑',
    best: { date: '2025-06-05', score: 82 }
  };

  test('includes BALA 7-Day Digest header', () => {
    expect(formatDigestText(sampleDigest)).toContain('BALA 7-Day Digest');
  });
  test('includes avg BALA score', () => {
    expect(formatDigestText(sampleDigest)).toContain('74');
  });
  test('includes best day date', () => {
    expect(formatDigestText(sampleDigest)).toContain('Jun 5');
  });
  test('includes sleep trend arrow', () => {
    expect(formatDigestText(sampleDigest)).toContain('↑');
  });
  test('includes safety footer', () => {
    expect(formatDigestText(sampleDigest)).toContain(SAFETY_FOOTER);
  });
  test('no medical claims in output', () => {
    const t = formatDigestText(sampleDigest).toLowerCase();
    const forbidden = ['diagnos', 'treat', 'prescri', 'predict', 'heart attack', 'cardiac'];
    forbidden.forEach(w => {
      expect(t.includes(w)).toBe(false);
    });
  });
});

// ─── getBALAWeeklyDigest (integration) ───────────────────────────────────────

describe('getBALAWeeklyDigest', () => {
  test('ok:false for missing file', () => {
    const r = getBALAWeeklyDigest('/nonexistent/bala.json');
    expect(r.ok).toBe(false);
    expect(r.text.length).toBeGreaterThan(0);
    expect(r.reason).toBe('export_not_found');
  });

  test('ok:false for empty history', () => {
    const tmp = makeTmpExport({ exportVersion: 2, today: {}, history: [] });
    const r = getBALAWeeklyDigest(tmp);
    fs.unlinkSync(tmp);
    expect(r.ok).toBe(false);
    expect(r.text).toContain('Not enough');
  });

  test('ok:true for 7-entry export', () => {
    const tmp = makeTmpExport(makeExportV2(7));
    const r = getBALAWeeklyDigest(tmp);
    fs.unlinkSync(tmp);
    expect(r.ok).toBe(true);
    expect(r.text).toContain('BALA 7-Day Digest');
  });

  test('always includes safety footer in text', () => {
    const tmp = makeTmpExport(makeExportV2(7));
    const r = getBALAWeeklyDigest(tmp);
    fs.unlinkSync(tmp);
    expect(r.text).toContain(SAFETY_FOOTER);
  });

  test('ok:false text always has safety footer', () => {
    const r = getBALAWeeklyDigest('/nonexistent/bala.json');
    expect(r.text).toContain(SAFETY_FOOTER);
  });

  test('result includes skillId', () => {
    const r = getBALAWeeklyDigest('/nonexistent/bala.json');
    expect(r.skillId).toBe(SKILL_ID);
  });

  test('result includes version', () => {
    const r = getBALAWeeklyDigest('/nonexistent/bala.json');
    expect(r.version).toBe(SKILL_VERSION);
  });

  test('raw digest included on ok:true', () => {
    const tmp = makeTmpExport(makeExportV2(7));
    const r = getBALAWeeklyDigest(tmp);
    fs.unlinkSync(tmp);
    expect(r.raw).toBeDefined();
    expect(r.raw.ok).toBe(true);
  });

  test('handles invalid JSON file gracefully', () => {
    const tmp = path.join(os.tmpdir(), 'bad-bala.json');
    fs.writeFileSync(tmp, 'NOT_JSON');
    const r = getBALAWeeklyDigest(tmp);
    fs.unlinkSync(tmp);
    expect(r.ok).toBe(false);
    expect(r.text.length).toBeGreaterThan(0);
  });

  test('never throws — always returns an object', () => {
    expect(() => getBALAWeeklyDigest('/dev/null')).not.toThrow();
  });

  test('high-score history gives Great week headline in text', () => {
    const history = makeHistory(7, 82);
    const tmp = makeTmpExport({ exportVersion: 2, today: history[6], history });
    const r = getBALAWeeklyDigest(tmp);
    fs.unlinkSync(tmp);
    expect(r.text).toContain('Great week');
  });

  test('exports bala-export-v1 format also works', () => {
    const tmp = makeTmpExport({
      format: 'bala-export-v1',
      data: { health: { history: makeHistory(7) } }
    });
    const r = getBALAWeeklyDigest(tmp);
    fs.unlinkSync(tmp);
    expect(r.ok).toBe(true);
  });
});

// ─── Safety: no medical claims in any output ─────────────────────────────────

describe('Safety: no medical claims', () => {
  const FORBIDDEN = [
    'diagnos', 'treat', 'prescri', 'cardiac arrest', 'heart attack',
    'prevent disease', 'predict', 'risk of', 'passed away', 'balaji died'
  ];

  test('no forbidden phrases in ok:true output', () => {
    const tmp = makeTmpExport(makeExportV2(7));
    const r = getBALAWeeklyDigest(tmp);
    fs.unlinkSync(tmp);
    const t = r.text.toLowerCase();
    FORBIDDEN.forEach(w => expect(t.includes(w)).toBe(false));
  });

  test('no forbidden phrases in ok:false (missing file) output', () => {
    const r = getBALAWeeklyDigest('/nonexistent.json');
    const t = r.text.toLowerCase();
    FORBIDDEN.forEach(w => expect(t.includes(w)).toBe(false));
  });
});

// ─── Constants ───────────────────────────────────────────────────────────────

describe('module constants', () => {
  test('SKILL_ID is set', () => {
    expect(typeof SKILL_ID).toBe('string');
    expect(SKILL_ID.includes('bala')).toBe(true);
  });
  test('SKILL_VERSION is C73', () => {
    expect(SKILL_VERSION).toBe('C73');
  });
  test('DIGEST_DAYS is 7', () => {
    expect(DIGEST_DAYS).toBe(7);
  });
  test('DIGEST_MIN is 2', () => {
    expect(DIGEST_MIN).toBe(2);
  });
  test('SAFETY_FOOTER is non-empty string', () => {
    expect(typeof SAFETY_FOOTER).toBe('string');
    expect(SAFETY_FOOTER.length).toBeGreaterThan(0);
  });
});
