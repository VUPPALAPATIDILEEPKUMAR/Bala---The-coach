// scripts/bala-b73-weekly-digest-engine.js
// B73 -- BALA Weekly Digest Engine
// 7-day health summary: avg score, best/worst day, signal trends, headline.
// CommonJS for tests + referenced inline from app.js (browser).
// LOCAL-ONLY -- zero network calls, zero paid APIs.
'use strict';

var DIGEST_WINDOW_DAYS = 7;
var DIGEST_MIN_ENTRIES = 2;

function getLastNDays(history, n) {
  if (!Array.isArray(history)) return [];
  if (n <= 0) return [];
  var sorted = history
    .filter(function (e) { return e && e.date; })
    .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  return sorted.slice(-n);
}

function computeWeeklyAvg(entries, field) {
  var vals = entries
    .map(function (e) { return parseFloat(e[field]); })
    .filter(function (v) { return !isNaN(v) && v > 0; });
  if (!vals.length) return null;
  var sum = vals.reduce(function (s, v) { return s + v; }, 0);
  return Math.round((sum / vals.length) * 10) / 10;
}

function findBestDay(entries, scoreKey) {
  if (!entries.length) return null;
  var best = null;
  entries.forEach(function (e) {
    var s = parseFloat(e[scoreKey]);
    if (!isNaN(s) && (best === null || s > best.score)) {
      best = { date: e.date, score: s };
    }
  });
  return best;
}

function findWorstDay(entries, scoreKey) {
  if (!entries.length) return null;
  var worst = null;
  entries.forEach(function (e) {
    var s = parseFloat(e[scoreKey]);
    if (!isNaN(s) && (worst === null || s < worst.score)) {
      worst = { date: e.date, score: s };
    }
  });
  return worst;
}

function getTrendDirection(entries, field) {
  var vals = entries
    .map(function (e) { return parseFloat(e[field]); })
    .filter(function (v) { return !isNaN(v) && v > 0; });
  if (vals.length < 2) return 'stable';
  var mid = Math.ceil(vals.length / 2);
  var first  = vals.slice(0, mid);
  var second = vals.slice(Math.floor(vals.length / 2));
  var avgFirst  = first.reduce(function (s, v) { return s + v; }, 0) / first.length;
  var avgSecond = second.reduce(function (s, v) { return s + v; }, 0) / second.length;
  var diff = avgSecond - avgFirst;
  if (Math.abs(diff) < 2) return 'stable';
  return diff > 0 ? 'improving' : 'declining';
}

function formatDigestDate(dateStr) {
  if (!dateStr) return '';
  var parts = dateStr.split('-');
  if (parts.length < 3) return '';
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var m = parseInt(parts[1], 10) - 1;
  var d = parseInt(parts[2], 10);
  return (months[m] || parts[1]) + ' ' + d;
}

function pickHeadline(avgScore, trends) {
  var trendVals = Object.keys(trends).map(function (k) { return trends[k]; });
  var improvingCount = trendVals.filter(function (t) { return t === 'improving'; }).length;
  if (avgScore !== null && avgScore >= 80) {
    return 'Great week — your body signals look strong.';
  }
  if (avgScore !== null && avgScore >= 60) {
    return 'Solid week — keep listening to your body signals.';
  }
  if (improvingCount >= 2) {
    return 'Your signals are trending upward — keep going.';
  }
  return 'Your body is talking — check in more this week.';
}

function buildWeeklyDigest(history, scoreKey) {
  scoreKey = scoreKey || 'balaScore';
  var entries = getLastNDays(history, DIGEST_WINDOW_DAYS);

  if (entries.length < DIGEST_MIN_ENTRIES) {
    return {
      ok: false,
      reason: 'not_enough_data',
      entriesFound: entries.length,
      minRequired: DIGEST_MIN_ENTRIES
    };
  }

  var avgScore = computeWeeklyAvg(entries, scoreKey);
  var bestDay  = findBestDay(entries, scoreKey);
  var worstDay = findWorstDay(entries, scoreKey);
  var trends   = {
    sleep : getTrendDirection(entries, 'sleepHours'),
    steps : getTrendDirection(entries, 'steps'),
    hrv   : getTrendDirection(entries, 'hrv')
  };
  var headline = pickHeadline(avgScore, trends);

  return {
    ok: true,
    entriesFound: entries.length,
    windowDays: DIGEST_WINDOW_DAYS,
    avgScore: avgScore,
    bestDay: bestDay,
    worstDay: worstDay,
    trends: trends,
    headline: headline
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    buildWeeklyDigest: buildWeeklyDigest,
    getLastNDays: getLastNDays,
    computeWeeklyAvg: computeWeeklyAvg,
    findBestDay: findBestDay,
    findWorstDay: findWorstDay,
    getTrendDirection: getTrendDirection,
    formatDigestDate: formatDigestDate,
    pickHeadline: pickHeadline,
    DIGEST_WINDOW_DAYS: DIGEST_WINDOW_DAYS,
    DIGEST_MIN_ENTRIES: DIGEST_MIN_ENTRIES
  };
}
