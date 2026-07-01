// scripts/chintu-morning-digest-skill.test.js — C75 Morning Digest tests
'use strict';

const path = require('path');
const {
  formatMorningDigest, buildGreeting,
  SKILL_ID, SKILL_VERSION
} = require(path.join(__dirname, 'chintu-morning-digest-skill.js'));

// Sample BALA result
function makeBalaResult(ok) {
  if (!ok) return { ok: false, reason: 'no_data' };
  return {
    ok: true,
    text: '📊 BALA 7-Day Digest\nAvg Score: 72 · Best day: Jun 28\nSleep ↑ · Steps → · HRV ↓\nSolid week — keep listening to your body signals.',
    dryRun: true,
    skillId: 'chintu.balaWeeklySkill',
    version: 'C73'
  };
}

// Sample HN result
function makeHNResult(ok) {
  if (!ok) return { ok: false, reason: 'network_error: timeout' };
  return {
    ok: true,
    dryRun: true,
    text: '📰 *HN Morning Brief — 2026-07-01*\n\n1. Some Tech Story\n   https://example.com/1\n   ▲ 500 pts · 💬 120 comments\n\n2. Another Tech Story\n   https://example.com/2\n   ▲ 400 pts · 💬 80 comments\n\n_Powered by HN Algolia · Chintu C74_',
    stories: [],
    skillId: 'chintu.hnMorningBrief',
    version: 'C74'
  };
}

// ── Constants ─────────────────────────────────────────────────────────
describe('Constants', function () {
  test('SKILL_ID is chintu.morningDigest', function () {
    expect(SKILL_ID).toBe('chintu.morningDigest');
  });
  test('SKILL_VERSION is C75', function () {
    expect(SKILL_VERSION).toBe('C75');
  });
});

// ── buildGreeting ─────────────────────────────────────────────────────
describe('buildGreeting', function () {
  test('returns a non-empty string', function () {
    expect(buildGreeting().length).toBeGreaterThan(0);
  });
  test('contains a greeting word', function () {
    var text = buildGreeting().toLowerCase();
    var hasGreeting = text.includes('morning') || text.includes('afternoon') || text.includes('evening');
    expect(hasGreeting).toBe(true);
  });
});

// ── formatMorningDigest ───────────────────────────────────────────────
describe('formatMorningDigest — both ok', function () {
  var text;
  test('produces a string', function () {
    text = formatMorningDigest(makeBalaResult(true), makeHNResult(true), '2026-07-01');
    expect(typeof text).toBe('string');
  });
  test('includes date in header', function () {
    text = formatMorningDigest(makeBalaResult(true), makeHNResult(true), '2026-07-01');
    expect(text).toContain('2026-07-01');
  });
  test('includes BALA section header', function () {
    text = formatMorningDigest(makeBalaResult(true), makeHNResult(true), '2026-07-01');
    expect(text).toContain('BALA');
  });
  test('includes HN section header', function () {
    text = formatMorningDigest(makeBalaResult(true), makeHNResult(true), '2026-07-01');
    expect(text).toContain('Top Tech Stories');
  });
  test('includes BALA text content', function () {
    text = formatMorningDigest(makeBalaResult(true), makeHNResult(true), '2026-07-01');
    expect(text).toContain('Avg Score');
  });
  test('includes HN story content', function () {
    text = formatMorningDigest(makeBalaResult(true), makeHNResult(true), '2026-07-01');
    expect(text).toContain('Tech Story');
  });
  test('includes skill version footer', function () {
    text = formatMorningDigest(makeBalaResult(true), makeHNResult(true), '2026-07-01');
    expect(text).toContain(SKILL_VERSION);
  });
  test('includes local-first note', function () {
    text = formatMorningDigest(makeBalaResult(true), makeHNResult(true), '2026-07-01');
    expect(text.toLowerCase()).toContain('local');
  });
});

describe('formatMorningDigest — BALA missing', function () {
  test('shows fallback BALA message', function () {
    var text = formatMorningDigest(makeBalaResult(false), makeHNResult(true), '2026-07-01');
    expect(text).toContain('No BALA data');
  });
  test('still includes HN content', function () {
    var text = formatMorningDigest(makeBalaResult(false), makeHNResult(true), '2026-07-01');
    expect(text).toContain('Tech Story');
  });
});

describe('formatMorningDigest — HN missing', function () {
  test('shows HN unavailable fallback', function () {
    var text = formatMorningDigest(makeBalaResult(true), makeHNResult(false), '2026-07-01');
    expect(text).toContain('unavailable');
  });
  test('still includes BALA content', function () {
    var text = formatMorningDigest(makeBalaResult(true), makeHNResult(false), '2026-07-01');
    expect(text).toContain('Avg Score');
  });
});

describe('formatMorningDigest — both missing', function () {
  test('produces a valid string with fallbacks', function () {
    var text = formatMorningDigest(makeBalaResult(false), makeHNResult(false), '2026-07-01');
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(0);
  });
  test('includes both fallback messages', function () {
    var text = formatMorningDigest(makeBalaResult(false), makeHNResult(false), '2026-07-01');
    expect(text).toContain('No BALA data');
    expect(text).toContain('unavailable');
  });
});

describe('formatMorningDigest — null inputs', function () {
  test('handles null bala result gracefully', function () {
    var text = formatMorningDigest(null, makeHNResult(true), '2026-07-01');
    expect(typeof text).toBe('string');
    expect(text).toContain('No BALA data');
  });
  test('handles null hn result gracefully', function () {
    var text = formatMorningDigest(makeBalaResult(true), null, '2026-07-01');
    expect(typeof text).toBe('string');
    expect(text).toContain('unavailable');
  });
  test('handles both null gracefully', function () {
    expect(function () { formatMorningDigest(null, null, '2026-07-01'); }).not.toThrow();
  });
});

// ── Safety ────────────────────────────────────────────────────────────
describe('Safety — no secrets, no medical claims, Telegram gated', function () {
  var FORBIDDEN = ['diagnos', 'treat', 'prescri', 'cardiac arrest', 'heart attack',
    'prevent disease', 'predict', 'balaji died', 'passed away'];

  test('skill source has no hardcoded tokens', function () {
    var src = require('fs').readFileSync(
      path.join(__dirname, 'chintu-morning-digest-skill.js'), 'utf8');
    expect(src).not.toContain('Bearer ');
    expect(src).not.toContain('bot_token');
    expect(src).not.toContain('sendMessage');
    expect(src).not.toContain('SEND_ENABLED = true');
  });
  test('digest text has no medical claims', function () {
    var text = formatMorningDigest(makeBalaResult(true), makeHNResult(true), '2026-07-01');
    FORBIDDEN.forEach(function (w) {
      expect(text.toLowerCase().includes(w)).toBe(false);
    });
  });
  test('note field mentions CHINTU_TELEGRAM_SEND_ENABLED', function () {
    // Verify the note string is in the source
    var src = require('fs').readFileSync(
      path.join(__dirname, 'chintu-morning-digest-skill.js'), 'utf8');
    expect(src).toContain('CHINTU_TELEGRAM_SEND_ENABLED');
  });
});
