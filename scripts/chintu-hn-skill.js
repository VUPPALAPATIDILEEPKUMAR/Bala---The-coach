// scripts/chintu-hn-skill.js
// C74 — Chintu HN Morning Brief skill
// Fetches top HN headlines via Algolia (free, no API key).
// Returns Telegram-formatted digest. Network optional — dry-run safe.
// SAFE: never sends to Telegram itself; no secrets touched.
'use strict';

var https = require('https');

var SKILL_ID      = 'chintu.hnMorningBrief';
var SKILL_VERSION = 'C74';
var HN_TOP_N      = 5;
var FETCH_TIMEOUT = 8000; // ms

// Algolia HN search API — public, no key, free tier
var HN_API_URL = 'https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=10';

// Guard: never set this in code; must be set by human operator
var SEND_ENABLED = (process.env.CHINTU_TELEGRAM_SEND_ENABLED === '1');

function fetchTopStories(urlOverride) {
  return new Promise(function (resolve, reject) {
    var url = urlOverride || HN_API_URL;
    var parsed = new URL(url);
    var opts = {
      hostname: parsed.hostname,
      path:     parsed.pathname + parsed.search,
      method:   'GET',
      headers:  { 'User-Agent': 'Chintu-Agent/C74 (health-awareness-companion)' }
    };
    var req = https.request(opts, function (res) {
      var body = '';
      res.on('data', function (c) { body += c; });
      res.on('end', function () {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error('parse_error: ' + e.message)); }
      });
    });
    req.on('error', function (e) { reject(new Error('network_error: ' + e.message)); });
    req.setTimeout(FETCH_TIMEOUT, function () {
      req.destroy(new Error('timeout'));
    });
    req.end();
  });
}

function parseStories(apiResponse, n) {
  n = n || HN_TOP_N;
  if (!apiResponse || !Array.isArray(apiResponse.hits)) return [];
  return apiResponse.hits
    .filter(function (h) { return h.title && (h.url || h.objectID); })
    .slice(0, n)
    .map(function (h, i) {
      return {
        rank:    i + 1,
        title:   h.title,
        url:     h.url || ('https://news.ycombinator.com/item?id=' + h.objectID),
        points:  h.points || 0,
        comments:h.num_comments || 0
      };
    });
}

function formatDigest(stories, date) {
  if (!stories.length) return '📰 *HN Morning Brief*\nNo stories found — try again shortly.';
  var d = date || new Date().toISOString().slice(0, 10);
  var lines = ['📰 *HN Morning Brief — ' + d + '*', ''];
  stories.forEach(function (s) {
    lines.push(
      s.rank + '. ' + s.title + '\n' +
      '   ' + s.url + '\n' +
      '   ▲ ' + s.points + ' pts · 💬 ' + s.comments + ' comments'
    );
  });
  lines.push('');
  lines.push('_Powered by HN Algolia · Chintu ' + SKILL_VERSION + '_');
  return lines.join('\n');
}

function dryRunText(stories, date) {
  return {
    ok:       true,
    dryRun:   true,
    text:     formatDigest(stories, date),
    stories:  stories,
    skillId:  SKILL_ID,
    version:  SKILL_VERSION,
    note:     'Set CHINTU_TELEGRAM_SEND_ENABLED=1 (human only) to enable Telegram delivery.'
  };
}

function getHNBrief(opts) {
  opts = opts || {};
  var urlOverride = opts.urlOverride || null;
  var dateOverride = opts.date || null;

  if (SEND_ENABLED) {
    return Promise.resolve({
      ok: false,
      reason: 'telegram_send_blocked',
      note: 'CHINTU_TELEGRAM_SEND_ENABLED is set but Telegram delivery is human-gated in this skill. Remove the flag or use the approved send path.'
    });
  }

  return fetchTopStories(urlOverride)
    .then(function (apiResponse) {
      var stories = parseStories(apiResponse, HN_TOP_N);
      return dryRunText(stories, dateOverride);
    })
    .catch(function (err) {
      return {
        ok:      false,
        dryRun:  true,
        reason:  err.message,
        text:    '📰 HN Brief unavailable right now — ' + err.message,
        skillId: SKILL_ID,
        version: SKILL_VERSION
      };
    });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getHNBrief:    getHNBrief,
    parseStories:  parseStories,
    formatDigest:  formatDigest,
    dryRunText:    dryRunText,
    fetchTopStories: fetchTopStories,
    SKILL_ID:      SKILL_ID,
    SKILL_VERSION: SKILL_VERSION,
    HN_TOP_N:      HN_TOP_N,
    HN_API_URL:    HN_API_URL
  };
}
