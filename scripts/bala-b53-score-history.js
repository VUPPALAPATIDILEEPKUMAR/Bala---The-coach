// BALA-B53 Readiness Score History Engine
// Computes readiness score for each history entry and
// renders a 7-day score-bar table for the readiness detail panel.
// CommonJS — no DOM dependencies, browser-safe equivalent is inline.

'use strict';

// ── Utilities ────────────────────────────────────────────────────────────────

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatShortDate(d) {
  if (typeof d !== 'string') return String(d);
  var p = d.split('-');
  if (p.length !== 3) return d;
  var y = parseInt(p[0], 10);
  var m = parseInt(p[1], 10);
  var dy = parseInt(p[2], 10);
  if (!y || m < 1 || m > 12 || dy < 1 || dy > 31) return d;
  var months = [
    'Jan','Feb','Mar','Apr','May','Jun',
    'Jul','Aug','Sep','Oct','Nov','Dec'
  ];
  return months[m - 1] + ' ' + dy;
}

// ── Scoring ───────────────────────────────────────────────────────────────────

function _clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function _avg(arr) {
  var f = arr.filter(function(v) {
    return Number.isFinite(v);
  });
  return f.length
    ? f.reduce(function(s, v) { return s + v; }, 0) / f.length
    : null;
}

// Compute readiness score for a single history entry.
// priorEntries: history entries strictly before this one
// (used to derive HRV/RHR baselines — mirrors scoreBreakdown logic).
function scoreForEntry(entry, priorEntries) {
  if (!entry || typeof entry !== 'object') return 70;
  var prior = Array.isArray(priorEntries) ? priorEntries : [];
  var hrvBase = _avg(prior.map(function(d) { return d.hrv; }));
  var rhrBase = _avg(prior.map(function(d) { return d.rhr; }));
  var parts = [];

  function add(score, weight) {
    var s = _clamp(Math.round(score), 25, 100);
    if (Number.isFinite(s)) parts.push({ score: s, weight: weight });
  }

  // Sleep (weight 32)
  if (Number.isFinite(entry.sleep)) {
    var sl = entry.sleep;
    var ss = sl >= 7 && sl <= 9
      ? 92 - Math.abs(8 - sl) * 4
      : sl < 7
        ? 92 - (7 - sl) * 18
        : 88 - (sl - 9) * 10;
    add(ss, 32);
  }

  // HRV (weight 23)
  if (Number.isFinite(entry.hrv)) {
    var hr = hrvBase ? entry.hrv / hrvBase : null;
    add(hr ? 75 + _clamp((hr - 1) * 70, -40, 20) : 75, 23);
  }

  // RHR (weight 20)
  if (Number.isFinite(entry.rhr)) {
    var diff = rhrBase ? entry.rhr - rhrBase : 0;
    add(rhrBase ? 82 - _clamp(diff * 5, -10, 45) : 76, 20);
  }

  // Activity: steps + exercise (weight 20)
  if (Number.isFinite(entry.steps) || Number.isFinite(entry.exercise)) {
    var stSc = Number.isFinite(entry.steps)
      ? _clamp((entry.steps / 8000) * 90, 35, 100)
      : 70;
    var exSc = Number.isFinite(entry.exercise)
      ? _clamp((entry.exercise / 30) * 90, 35, 100)
      : 70;
    add(stSc * 0.65 + exSc * 0.35, 20);
  }

  // SpO₂ (weight 5)
  if (Number.isFinite(entry.spo2)) {
    var sp = entry.spo2 >= 97 ? 90
           : entry.spo2 >= 95 ? 78
           : entry.spo2 >= 92 ? 62
           : 45;
    add(sp, 5);
  }

  var w = parts.reduce(function(s, p) { return s + p.weight; }, 0);
  return w
    ? Math.round(
        parts.reduce(function(s, p) {
          return s + p.score * p.weight;
        }, 0) / w
      )
    : 70;
}

// Score tier: 'good' ≥80, 'watch' ≥65, 'low' <65
function scoreTier(score) {
  if (!Number.isFinite(score)) return 'watch';
  return score >= 80 ? 'good' : score >= 65 ? 'watch' : 'low';
}

// ── HTML builder ─────────────────────────────────────────────────────────────

// Returns a hist-block HTML string showing 7-day readiness score bars.
// historyArr: full history array from metrics.history
function buildScoreHistoryHTML(historyArr) {
  if (!Array.isArray(historyArr) || historyArr.length === 0) return '';
  var rows = historyArr.slice(-7);
  var html = '<div class="hist-block">'
    + '<div class="hist-header">'
    + '<span class="hist-label">READINESS HISTORY</span>'
    + '</div>'
    + '<table class="hist-table">';

  rows.forEach(function(entry, i) {
    // Prior = everything in the full array before this entry
    var fullIdx = historyArr.indexOf(entry);
    var prior = fullIdx > 0 ? historyArr.slice(0, fullIdx) : [];
    var score = scoreForEntry(entry, prior);
    var tier = scoreTier(score);
    var cls = tier === 'good'
      ? 'hist-good'
      : tier === 'low'
        ? 'hist-low'
        : 'hist-watch';
    var dateStr = escHtml(formatShortDate(entry.date));
    var pct = Math.round((score / 100) * 100);
    html += '<tr>'
      + '<td class="hist-date">' + dateStr + '</td>'
      + '<td><div class="score-bar">'
      + '<div class="score-fill ' + cls
      + '" style="width:' + pct + '%"></div>'
      + '</div></td>'
      + '<td class="hist-val ' + cls + '">' + score + '</td>'
      + '</tr>';
  });

  html += '</table></div>';
  return html;
}

module.exports = {
  escHtml,
  formatShortDate,
  scoreForEntry,
  scoreTier,
  buildScoreHistoryHTML,
};
