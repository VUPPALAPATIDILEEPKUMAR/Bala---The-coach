// BALA-B54 Weekly Trend Summary Card Engine
// Computes 7-day average and trend direction per signal
// and renders a compact summary card for the dashboard.
// CommonJS — no DOM dependencies, browser-safe equivalent is inline.

'use strict';

// ── Signal configuration ──────────────────────────────────────────────────────

// Polarity: 'up' means increasing is improving, 'down' means decreasing is improving
var TREND_SIGNALS = [
  { key: 'sleep',    label: 'Sleep',      unit: 'h',   polarity: 'up',   decimals: 1 },
  { key: 'hrv',      label: 'HRV',        unit: 'ms',  polarity: 'up',   decimals: 0 },
  { key: 'rhr',      label: 'Resting HR', unit: 'bpm', polarity: 'down', decimals: 0 },
  { key: 'steps',    label: 'Steps',      unit: '',    polarity: 'up',   decimals: 0 },
  { key: 'exercise', label: 'Cardio',     unit: 'min', polarity: 'up',   decimals: 0 },
];

var TREND_THRESHOLD = 0.05; // 5% difference triggers up/down direction

// ── Utilities ─────────────────────────────────────────────────────────────────

function _avg(arr) {
  var f = arr.filter(function(v) { return Number.isFinite(v); });
  return f.length
    ? f.reduce(function(s, v) { return s + v; }, 0) / f.length
    : null;
}

function formatAvg(key, avg, decimals) {
  if (!Number.isFinite(avg)) return '—';
  if (key === 'steps') return Math.round(avg).toLocaleString();
  return avg.toFixed(decimals);
}

// ── Core computation ──────────────────────────────────────────────────────────

// Returns average value for a signal key across last n history entries.
// Returns null if fewer than 1 valid reading.
function computeSignalAvg(historyArr, key, n) {
  if (!Array.isArray(historyArr) || !historyArr.length) return null;
  var n2 = (typeof n === 'number' && n > 0) ? n : 7;
  var rows = historyArr.slice(-n2);
  return _avg(rows.map(function(e) { return e[key]; }));
}

// Returns trend direction for a signal key.
// Compares first-half vs second-half averages with TREND_THRESHOLD.
// Returns 'up', 'down', or 'flat'. Requires ≥2 valid values.
function computeSignalDir(historyArr, key, n) {
  if (!Array.isArray(historyArr) || !historyArr.length) return 'flat';
  var n2 = (typeof n === 'number' && n > 0) ? n : 7;
  var rows = historyArr.slice(-n2);
  var vals = rows.map(function(e) {
    return Number.isFinite(e[key]) ? e[key] : null;
  });
  var validCount = vals.filter(function(v) { return v !== null; }).length;
  if (validCount < 2) return 'flat';

  var half = Math.floor(rows.length / 2);
  var firstHalf = vals.slice(0, half).filter(function(v) { return v !== null; });
  var secondHalf = vals.slice(half).filter(function(v) { return v !== null; });
  var a1 = _avg(firstHalf);
  var a2 = _avg(secondHalf);
  if (!Number.isFinite(a1) || !Number.isFinite(a2) || a1 === 0) return 'flat';
  var ratio = (a2 - a1) / Math.abs(a1);
  if (ratio > TREND_THRESHOLD) return 'up';
  if (ratio < -TREND_THRESHOLD) return 'down';
  return 'flat';
}

// Returns a full trend row object for one signal.
// Returns null if fewer than 2 valid readings.
function computeTrendRow(historyArr, signalCfg) {
  var key = signalCfg.key;
  var n = 7;
  if (!Array.isArray(historyArr)) return null;
  var rows = historyArr.slice(-n);
  var vals = rows.map(function(e) {
    return Number.isFinite(e[key]) ? e[key] : null;
  });
  var validCount = vals.filter(function(v) { return v !== null; }).length;
  if (validCount < 2) return null;

  var avg = computeSignalAvg(historyArr, key, n);
  var dir = computeSignalDir(historyArr, key, n);
  var polarity = signalCfg.polarity;

  // Determine visual class
  var cls;
  if (dir === 'flat') {
    cls = 'tc-flat';
  } else if (
    (dir === 'up' && polarity === 'up') ||
    (dir === 'down' && polarity === 'down')
  ) {
    cls = 'tc-good';
  } else {
    cls = 'tc-watch';
  }

  // Arrow icon
  var icon = dir === 'up' ? '↑' : dir === 'down' ? '↓' : '→';

  // Trend label
  var trendLabel = dir === 'flat'
    ? 'steady'
    : (cls === 'tc-good' ? 'improving' : 'elevated');

  var fmtAvg = formatAvg(key, avg, signalCfg.decimals);
  var unit = signalCfg.unit ? ' ' + signalCfg.unit : '';

  return {
    key:        key,
    label:      signalCfg.label,
    avg:        avg,
    formattedAvg: fmtAvg + unit,
    dir:        dir,
    cls:        cls,
    icon:       icon,
    trendLabel: trendLabel,
  };
}

// ── HTML builder ──────────────────────────────────────────────────────────────

// Returns a trend card HTML string.
// historyArr: full metrics.history array (or slice).
// Returns '' if no signals have enough data.
function buildTrendCardHTML(historyArr) {
  if (!Array.isArray(historyArr) || historyArr.length < 2) return '';

  var rowsHtml = '';
  TREND_SIGNALS.forEach(function(cfg) {
    var row = computeTrendRow(historyArr, cfg);
    if (!row) return;
    rowsHtml +=
      '<tr class="tc-row">' +
        '<td class="tc-label">' + cfg.label + '</td>' +
        '<td class="tc-avg">'   + row.formattedAvg + '</td>' +
        '<td class="tc-trend ' + row.cls + '">' +
          row.icon + ' ' + row.trendLabel +
        '</td>' +
      '</tr>';
  });

  if (!rowsHtml) return '';

  return '<div class="trend-card">' +
    '<div class="trend-card-header">' +
      '<span class="trend-card-title">7-day signals</span>' +
    '</div>' +
    '<table class="tc-table">' + rowsHtml + '</table>' +
    '<p class="trend-card-note">' +
      'Trends compare the first and second half of your last 7 check-ins. ' +
      'Day-to-day variation is normal.' +
    '</p>' +
  '</div>';
}

module.exports = {
  TREND_SIGNALS,
  TREND_THRESHOLD,
  computeSignalAvg,
  computeSignalDir,
  computeTrendRow,
  buildTrendCardHTML,
};
