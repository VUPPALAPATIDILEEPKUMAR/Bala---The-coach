// scripts/chintu-hn-skill.test.js — C74 HN Morning Brief tests
'use strict';

const path = require('path');
const {
  parseStories, formatDigest, dryRunText,
  SKILL_ID, SKILL_VERSION, HN_TOP_N, HN_API_URL
} = require(path.join(__dirname, 'chintu-hn-skill.js'));

// Sample API response fixture
function makeAPIResponse(n) {
  var hits = [];
  for (var i = 0; i < n; i++) {
    hits.push({
      title:        'Test Story ' + (i + 1),
      url:          'https://example.com/story/' + (i + 1),
      objectID:     String(1000 + i),
      points:       100 + i * 10,
      num_comments: 50 + i
    });
  }
  return { hits: hits };
}

// ── Constants ─────────────────────────────────────────────────────────
describe('Constants', function () {
  test('SKILL_ID is chintu.hnMorningBrief', function () {
    expect(SKILL_ID).toBe('chintu.hnMorningBrief');
  });
  test('SKILL_VERSION is C74', function () {
    expect(SKILL_VERSION).toBe('C74');
  });
  test('HN_TOP_N is 5', function () {
    expect(HN_TOP_N).toBe(5);
  });
  test('HN_API_URL contains algolia', function () {
    expect(HN_API_URL.toLowerCase()).toContain('algolia');
  });
  test('HN_API_URL targets front_page', function () {
    expect(HN_API_URL).toContain('front_page');
  });
  test('HN_API_URL has no API key', function () {
    expect(HN_API_URL).not.toContain('apiKey');
    expect(HN_API_URL).not.toContain('api_key');
    expect(HN_API_URL).not.toContain('token');
  });
});

// ── parseStories ──────────────────────────────────────────────────────
describe('parseStories', function () {
  test('returns empty array for null input', function () {
    expect(parseStories(null)).toEqual([]);
  });
  test('returns empty array for missing hits', function () {
    expect(parseStories({})).toEqual([]);
  });
  test('returns empty array for non-array hits', function () {
    expect(parseStories({ hits: 'bad' })).toEqual([]);
  });
  test('parses N stories', function () {
    var stories = parseStories(makeAPIResponse(7));
    expect(stories).toHaveLength(HN_TOP_N);
  });
  test('returns all available when fewer than HN_TOP_N', function () {
    var stories = parseStories(makeAPIResponse(3));
    expect(stories).toHaveLength(3);
  });
  test('each story has rank, title, url, points, comments', function () {
    var stories = parseStories(makeAPIResponse(3));
    stories.forEach(function (s) {
      expect(typeof s.rank).toBe('number');
      expect(typeof s.title).toBe('string');
      expect(typeof s.url).toBe('string');
      expect(typeof s.points).toBe('number');
      expect(typeof s.comments).toBe('number');
    });
  });
  test('ranks start at 1', function () {
    var stories = parseStories(makeAPIResponse(3));
    expect(stories[0].rank).toBe(1);
    expect(stories[2].rank).toBe(3);
  });
  test('falls back to HN item URL when no url field', function () {
    var response = { hits: [{ title: 'No URL Story', objectID: '12345', points: 10, num_comments: 5 }] };
    var stories = parseStories(response);
    expect(stories[0].url).toContain('12345');
    expect(stories[0].url).toContain('news.ycombinator.com');
  });
  test('filters out hits with no title', function () {
    var response = { hits: [
      { title: '', url: 'https://example.com', objectID: '1', points: 10, num_comments: 1 },
      { title: 'Good Story', url: 'https://example.com/2', objectID: '2', points: 20, num_comments: 2 }
    ]};
    var stories = parseStories(response);
    expect(stories).toHaveLength(1);
    expect(stories[0].title).toBe('Good Story');
  });
  test('handles missing points gracefully', function () {
    var response = { hits: [{ title: 'Test', url: 'https://example.com', objectID: '1' }] };
    var stories = parseStories(response);
    expect(stories[0].points).toBe(0);
    expect(stories[0].comments).toBe(0);
  });
  test('respects custom n parameter', function () {
    var stories = parseStories(makeAPIResponse(10), 3);
    expect(stories).toHaveLength(3);
  });
});

// ── formatDigest ──────────────────────────────────────────────────────
describe('formatDigest', function () {
  test('returns unavailable message for empty stories', function () {
    var text = formatDigest([]);
    expect(text).toContain('No stories found');
  });
  test('includes HN Morning Brief header', function () {
    var text = formatDigest(parseStories(makeAPIResponse(3)));
    expect(text).toContain('HN Morning Brief');
  });
  test('includes story titles', function () {
    var text = formatDigest(parseStories(makeAPIResponse(3)));
    expect(text).toContain('Test Story 1');
    expect(text).toContain('Test Story 2');
  });
  test('includes story URLs', function () {
    var text = formatDigest(parseStories(makeAPIResponse(3)));
    expect(text).toContain('https://example.com/story/1');
  });
  test('includes point count', function () {
    var text = formatDigest(parseStories(makeAPIResponse(3)));
    expect(text).toContain('pts');
  });
  test('includes comments count', function () {
    var text = formatDigest(parseStories(makeAPIResponse(3)));
    expect(text).toContain('comments');
  });
  test('includes date when provided', function () {
    var text = formatDigest(parseStories(makeAPIResponse(2)), '2026-07-01');
    expect(text).toContain('2026-07-01');
  });
  test('includes skill version footer', function () {
    var text = formatDigest(parseStories(makeAPIResponse(2)));
    expect(text).toContain(SKILL_VERSION);
  });
  test('numbers stories starting at 1', function () {
    var text = formatDigest(parseStories(makeAPIResponse(3)));
    expect(text).toContain('1.');
    expect(text).toContain('2.');
    expect(text).toContain('3.');
  });
});

// ── dryRunText ────────────────────────────────────────────────────────
describe('dryRunText', function () {
  test('ok is true', function () {
    var r = dryRunText(parseStories(makeAPIResponse(3)));
    expect(r.ok).toBe(true);
  });
  test('dryRun is true', function () {
    var r = dryRunText(parseStories(makeAPIResponse(3)));
    expect(r.dryRun).toBe(true);
  });
  test('text is a string', function () {
    var r = dryRunText(parseStories(makeAPIResponse(3)));
    expect(typeof r.text).toBe('string');
  });
  test('skillId is correct', function () {
    var r = dryRunText(parseStories(makeAPIResponse(3)));
    expect(r.skillId).toBe(SKILL_ID);
  });
  test('version is correct', function () {
    var r = dryRunText(parseStories(makeAPIResponse(3)));
    expect(r.version).toBe(SKILL_VERSION);
  });
  test('note mentions CHINTU_TELEGRAM_SEND_ENABLED', function () {
    var r = dryRunText(parseStories(makeAPIResponse(3)));
    expect(r.note).toContain('CHINTU_TELEGRAM_SEND_ENABLED');
  });
  test('stories array is included', function () {
    var s = parseStories(makeAPIResponse(3));
    var r = dryRunText(s);
    expect(r.stories).toHaveLength(3);
  });
});

// ── Safety checks ─────────────────────────────────────────────────────
describe('Safety — Telegram gate + no secrets', function () {
  var FORBIDDEN = ['diagnos', 'treat', 'prescri', 'cardiac arrest', 'heart attack',
    'prevent disease', 'predict', 'balaji died', 'passed away'];

  test('skill source has no CHINTU_TELEGRAM_SEND_ENABLED=1 hardcoded', function () {
    var src = require('fs').readFileSync(
      require('path').join(__dirname, 'chintu-hn-skill.js'), 'utf8');
    // env var name may appear in docs/guards but not assigned to '1'
    expect(src).not.toContain("SEND_ENABLED = true");
    expect(src).not.toContain("=== '1' // always");
  });
  test('skill source has no hardcoded tokens or API keys', function () {
    var src = require('fs').readFileSync(
      require('path').join(__dirname, 'chintu-hn-skill.js'), 'utf8');
    expect(src).not.toContain('Bearer ');
    expect(src).not.toContain('apiKey=');
    expect(src).not.toContain('bot_token');
  });
  test('no medical claims in formatDigest output', function () {
    var text = formatDigest(parseStories(makeAPIResponse(5)));
    FORBIDDEN.forEach(function (w) {
      expect(text.toLowerCase().includes(w)).toBe(false);
    });
  });
  test('HN_API_URL uses HTTPS', function () {
    expect(HN_API_URL.startsWith('https://')).toBe(true);
  });
  test('no sendMessage call in source', function () {
    var src = require('fs').readFileSync(
      require('path').join(__dirname, 'chintu-hn-skill.js'), 'utf8');
    expect(src).not.toContain('sendMessage');
    expect(src).not.toContain('createWebhook');
    expect(src).not.toContain('setWebhook');
  });
});
