'use strict';

// BALA-B52 History Detail Engine
// Maps detail-dialog signal key to history entry key
var HISTORY_KEY_MAP = {
  sleep: 'sleep',
  heart: 'rhr',
  hrv: 'hrv',
  spo2: 'spo2',
  steps: 'steps',
  cardio: 'exercise',
  breathing: 'breathing',
  temperature: 'temperature',
};

// Trend polarity for colour coding:
// 'up'   = higher is better (green when rising)
// 'down' = lower is better (green when falling)
// 'flat' = stability preferred (always grey)
var HISTORY_POLARITY = {
  sleep: 'up',
  heart: 'down',
  hrv: 'up',
  spo2: 'up',
  steps: 'up',
  cardio: 'up',
  breathing: 'flat',
  temperature: 'flat',
};


// HTML-escape a string to prevent injection in innerHTML context.
function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatValue(signalKey, val) {
  if (typeof val !== 'number' || !isFinite(val)) {
    return '—';
  }
  if (signalKey === 'sleep') {
    return val.toFixed(1) + ' h';
  }
  if (signalKey === 'heart') {
    return Math.round(val) + ' bpm';
  }
  if (signalKey === 'hrv') {
    return Math.round(val) + ' ms';
  }
  if (signalKey === 'spo2') {
    return Math.round(val) + '%';
  }
  if (signalKey === 'steps') {
    return Math.round(val).toLocaleString('en-US');
  }
  if (signalKey === 'cardio') {
    return Math.round(val) + ' min';
  }
  if (signalKey === 'breathing') {
    return val.toFixed(1) + ' brpm';
  }
  if (signalKey === 'temperature') {
    var sign = val >= 0 ? '+' : '';
    return sign + val.toFixed(1) + '°F';
  }
  return String(Math.round(val));
}

function formatShortDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return '';
  var parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  var months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  var m = parseInt(parts[1], 10) - 1;
  var d = parseInt(parts[2], 10);
  if (isNaN(m) || isNaN(d) || m < 0 || m > 11) return dateStr;
  return months[m] + ' ' + d;
}

function extractSignalHistory(history, signalKey, n) {
  if (typeof n !== 'number' || n < 1) n = 7;
  if (!Array.isArray(history) || history.length === 0) {
    return [];
  }
  var hk = HISTORY_KEY_MAP[signalKey];
  if (!hk) return [];
  return history.slice(-n).map(function(entry) {
    var v = entry && entry[hk];
    var num = (typeof v === 'number' && isFinite(v))
      ? v : null;
    return {
      date: (entry && typeof entry.date === 'string')
        ? entry.date : '',
      value: num,
    };
  });
}

function trendIcon(signalKey, entries) {
  var vals = entries
    .map(function(e) { return e.value; })
    .filter(function(v) { return v !== null; });
  if (vals.length < 2) {
    return { icon: '—', cls: 'hist-flat' };
  }
  var prev = vals[vals.length - 2];
  var last = vals[vals.length - 1];
  var mx = Math.max.apply(null, vals);
  var mn = Math.min.apply(null, vals);
  var range = mx - mn;
  if (range === 0) {
    return { icon: '→', cls: 'hist-flat' };
  }
  var ch = (last - prev) / range;
  var pol = HISTORY_POLARITY[signalKey] || 'up';
  if (Math.abs(ch) < 0.05) {
    return { icon: '→', cls: 'hist-flat' };
  }
  var isUp = ch > 0;
  if (pol === 'flat') {
    return {
      icon: isUp ? '↑' : '↓',
      cls: 'hist-flat',
    };
  }
  var good = (pol === 'up') === isUp;
  return {
    icon: isUp ? '↑' : '↓',
    cls: good ? 'hist-good' : 'hist-watch',
  };
}

function buildHistoryTableHTML(history, signalKey) {
  var entries = extractSignalHistory(history, signalKey, 7);
  if (!entries.length) return '';
  var hasValid = entries.some(function(e) {
    return e.value !== null;
  });
  if (!hasValid) return '';
  var trend = trendIcon(signalKey, entries);
  var rows = entries.map(function(e) {
    return '<tr>' +
      '<td class="hist-date">' +
      escHtml(formatShortDate(e.date)) + '</td>' +
      '<td class="hist-val">' +
      formatValue(signalKey, e.value) + '</td>' +
      '</tr>';
  }).join('');
  return '<div class="hist-block">' +
    '<div class="hist-header">' +
    '<span class="hist-label">7-day history</span>' +
    '<span class="hist-trend ' +
    trend.cls + '">' + trend.icon + '</span>' +
    '</div>' +
    '<table class="hist-table">' +
    '<tbody>' + rows + '</tbody>' +
    '</table>' +
    '</div>';
}

function buildHistoryHTML(history, signalKey) {
  if (!HISTORY_KEY_MAP[signalKey]) return '';
  return buildHistoryTableHTML(history, signalKey);
}

module.exports = {
  HISTORY_KEY_MAP,
  HISTORY_POLARITY,
  formatValue,
  formatShortDate,
  extractSignalHistory,
  trendIcon,
  buildHistoryTableHTML,
  buildHistoryHTML,
};
