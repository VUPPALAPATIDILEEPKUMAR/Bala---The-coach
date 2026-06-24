'use strict';

var MILESTONES = [
  { days: 3,  label: '3-Day',   badge: '3d'  },
  { days: 7,  label: '7-Day',   badge: '7d'  },
  { days: 14, label: '2-Week',  badge: '14d' },
  { days: 30, label: 'Monthly', badge: '30d' },
];

var _testToday = null;
function _setTestToday(s) { _testToday = (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)) ? s : null; }
function _todayStr() { return _testToday || new Date().toISOString().slice(0, 10); }

function _escHtml(s) {
  if (typeof s !== 'string') s = String(s);
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function _daysBetween(d1, d2) {
  if (typeof d1 !== 'string' || typeof d2 !== 'string') return NaN;
  var t1 = new Date(d1 + 'T00:00:00Z').getTime();
  var t2 = new Date(d2 + 'T00:00:00Z').getTime();
  if (isNaN(t1) || isNaN(t2)) return NaN;
  return Math.round((t2 - t1) / 86400000);
}

function _offsetDay(d, n) {
  if (typeof d !== 'string' || typeof n !== 'number') return '';
  var dt = new Date(d + 'T00:00:00Z');
  if (isNaN(dt.getTime())) return '';
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

function _uniqueSortedDesc(historyArr) {
  if (!Array.isArray(historyArr)) return [];
  var seen = {}, unique = [];
  historyArr.forEach(function(e) {
    if (e && typeof e.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && !seen[e.date]) {
      seen[e.date] = true;
      unique.push(e.date);
    }
  });
  return unique.sort().reverse();
}

function _computeCurrentStreak(sortedDesc, today) {
  if (!Array.isArray(sortedDesc) || !sortedDesc.length) return 0;
  if (typeof today !== 'string') return 0;
  var yesterday = _offsetDay(today, -1);
  var newest = sortedDesc[0];
  if (newest !== today && newest !== yesterday) return 0;
  var streak = 1;
  for (var i = 1; i < sortedDesc.length; i++) {
    var diff = _daysBetween(sortedDesc[i], sortedDesc[i - 1]);
    if (diff === 1) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

function _computeBestStreak(sortedDesc) {
  if (!Array.isArray(sortedDesc) || !sortedDesc.length) return 0;
  var asc = sortedDesc.slice().reverse();
  var best = 1, cur = 1;
  for (var i = 1; i < asc.length; i++) {
    var diff = _daysBetween(asc[i - 1], asc[i]);
    if (diff === 1) {
      cur++;
      if (cur > best) best = cur;
    } else {
      cur = 1;
    }
  }
  return best;
}

function computeStreak(historyArr) {
  var empty = { current: 0, best: 0, todayLogged: false, earnedMilestones: [], nextMilestone: MILESTONES[0] || null };
  if (!Array.isArray(historyArr) || historyArr.length === 0) return empty;
  var dates = _uniqueSortedDesc(historyArr);
  if (!dates.length) return empty;
  var today = _todayStr();
  var current = _computeCurrentStreak(dates, today);
  var best = _computeBestStreak(dates);
  if (current > best) best = current;
  var todayLogged = dates[0] === today;
  var earned = MILESTONES.filter(function(m) { return current >= m.days; });
  var next = MILESTONES.find(function(m) { return current < m.days; }) || null;
  return { current: current, best: best, todayLogged: todayLogged, earnedMilestones: earned, nextMilestone: next };
}

function buildStreakCardHTML(historyArr) {
  var data = computeStreak(historyArr);
  var cur = data.current;
  if (cur === 0) return '';
  var best = data.best;
  var todayLogged = data.todayLogged;
  var next = data.nextMilestone;

  var cc = cur >= 7 ? 'streak-count-good' : cur >= 3 ? 'streak-count-watch' : 'streak-count-flat';
  var badges = MILESTONES.map(function(m) {
    var e = cur >= m.days;
    var cls = 'streak-badge' + (e ? ' streak-badge-earned' : '');
    return '<span class="' + cls + '" title="' + _escHtml(m.label + ' streak' + (e ? ' — earned' : ' — ' + m.days + ' days')) + '">' + _escHtml(m.badge) + (e ? ' ✓' : '') + '</span>';
  }).join('');
  var nextHtml = next
    ? '<div class="streak-next">Next: ' + _escHtml(next.label) + ' badge in ' + _escHtml(String(next.days - cur)) + ' ' + (next.days - cur === 1 ? 'day' : 'days') + '</div>'
    : '<div class="streak-next streak-next-max">All milestones reached! 🏆</div>';
  var statusHtml = todayLogged
    ? '<div class="streak-today streak-today-done">Logged today ✓</div>'
    : '<div class="streak-today">Log today to continue your streak</div>';

  return '<div class="streak-card" role="region" aria-label="Check-in streak">' +
    '<div class="streak-header"><span class="streak-title">CHECK-IN STREAK</span></div>' +
    '<div class="streak-main">' +
      '<span class="streak-flame" aria-hidden="true">🔥</span>' +
      '<span class="streak-count ' + _escHtml(cc) + '">' + _escHtml(String(cur)) + '</span>' +
      '<span class="streak-unit">' + (cur === 1 ? 'day' : 'days') + '</span>' +
    '</div>' +
    (best > 0 ? '<div class="streak-best">Best: ' + _escHtml(String(best)) + ' ' + (best === 1 ? 'day' : 'days') + '</div>' : '') +
    '<div class="streak-badges" aria-label="Milestone badges">' + badges + '</div>' +
    nextHtml +
    statusHtml +
    '<p class="streak-note">Log your signals daily to build your streak.</p>' +
    '</div>';
}

module.exports = {
  MILESTONES: MILESTONES,
  computeStreak: computeStreak,
  buildStreakCardHTML: buildStreakCardHTML,
  _setTestToday: _setTestToday,
  _daysBetween: _daysBetween,
  _offsetDay: _offsetDay,
  _uniqueSortedDesc: _uniqueSortedDesc,
  _computeCurrentStreak: _computeCurrentStreak,
  _computeBestStreak: _computeBestStreak,
};
