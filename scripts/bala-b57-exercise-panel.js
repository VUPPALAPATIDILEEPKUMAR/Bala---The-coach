'use strict';

var WEEKLY_GOAL = 150; // minutes — general wellness guideline (WHO)

function _escHtml(s) {
  if (typeof s !== 'string') s = String(s);
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function _extractExercise(historyArr, offsetFromEnd, n) {
  // Returns last n exercise values starting at `offsetFromEnd` from the sorted end.
  // offsetFromEnd=0 → latest n; offsetFromEnd=7 → prior week.
  if (!Array.isArray(historyArr) || historyArr.length === 0) return [];
  var valid = historyArr.filter(function(e) {
    return e && typeof e.date === 'string' && e.date.length >= 8;
  });
  valid.sort(function(a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  var end = valid.length - offsetFromEnd;
  if (end <= 0) return [];
  var start = Math.max(0, end - n);
  return valid.slice(start, end).map(function(e) {
    var v = typeof e.exercise === 'number' && isFinite(e.exercise) && e.exercise >= 0 ? e.exercise : 0;
    return v;
  });
}

function computeWeekSummary(historyArr) {
  var empty = { total: 0, activeDays: 0, totalDays: 0, goalPct: 0, goalMet: false, goalTier: 'low', dots: '', deltAvg: null, hasData: false };
  if (!Array.isArray(historyArr) || historyArr.length === 0) return empty;
  var thisWeek = _extractExercise(historyArr, 0, 7);
  var lastWeek = _extractExercise(historyArr, 7, 7);
  if (!thisWeek.length) return empty;

  var total = thisWeek.reduce(function(s, v) { return s + v; }, 0);
  var activeDays = thisWeek.filter(function(v) { return v > 0; }).length;
  var thisAvg = total / thisWeek.length;
  var hasData = thisWeek.some(function(v) { return v > 0; });

  var deltAvg = null;
  if (lastWeek.length > 0) {
    var lastTotal = lastWeek.reduce(function(s, v) { return s + v; }, 0);
    var lastAvg = lastTotal / lastWeek.length;
    deltAvg = Math.round(thisAvg - lastAvg);
  }

  var goalPct = Math.min(100, Math.round(total / WEEKLY_GOAL * 100));
  var goalMet = total >= WEEKLY_GOAL;
  var goalTier = total >= WEEKLY_GOAL ? 'met' : total >= Math.floor(WEEKLY_GOAL * 0.67) ? 'close' : 'low';
  var dots = thisWeek.map(function(v) { return v > 0 ? '●' : '○'; }).join('');

  return {
    total: Math.round(total),
    activeDays: activeDays,
    totalDays: thisWeek.length,
    goalPct: goalPct,
    goalMet: goalMet,
    goalTier: goalTier,
    dots: dots,
    deltAvg: deltAvg,
    hasData: hasData,
  };
}

function buildExercisePanelHTML(historyArr) {
  if (!Array.isArray(historyArr) || historyArr.length === 0) return '';
  var s = computeWeekSummary(historyArr);
  if (!s.hasData) return '';

  var goalCls = _escHtml('ex-goal-' + s.goalTier);
  var goalStatus = s.goalMet ? 'Goal met ✓' : (_escHtml(String(s.goalPct)) + '% of goal');

  var deltHtml = '';
  if (s.deltAvg !== null) {
    var sign = s.deltAvg >= 0 ? '+' : '';
    var arrow = s.deltAvg > 0 ? '↑' : s.deltAvg < 0 ? '↓' : '→';
    var dcls = s.deltAvg > 0 ? 'ex-delta-up' : s.deltAvg < 0 ? 'ex-delta-down' : 'ex-delta-flat';
    deltHtml = '<div class="ex-vs-last ' + _escHtml(dcls) + '">vs last 7 days: ' + _escHtml(sign + String(s.deltAvg)) + ' min/day avg ' + arrow + '</div>';
  }

  return '<div class="ex-panel">' +
    '<div class="ex-panel-header"><span class="ex-panel-title">7-DAY EXERCISE SUMMARY</span></div>' +
    '<div class="ex-goal-label">Weekly total: <strong>' + _escHtml(String(s.total)) + ' min</strong> · goal 150 min</div>' +
    '<div class="ex-goal-bar" role="progressbar" aria-valuenow="' + _escHtml(String(s.goalPct)) + '" aria-valuemin="0" aria-valuemax="100">' +
      '<div class="ex-goal-fill ' + goalCls + '" style="width:' + _escHtml(String(s.goalPct)) + '%"></div>' +
    '</div>' +
    '<div class="ex-goal-status ' + goalCls + '">' + goalStatus + '</div>' +
    '<div class="ex-active-row">Active days: <strong>' + _escHtml(String(s.activeDays)) + ' of ' + _escHtml(String(s.totalDays)) + '</strong> <span class="ex-dots">' + _escHtml(s.dots) + '</span></div>' +
    deltHtml +
    '<p class="ex-note">150 min/week is a general wellness guideline — not personalised advice. Speak with a healthcare provider about exercise goals.</p>' +
    '</div>';
}

module.exports = {
  WEEKLY_GOAL: WEEKLY_GOAL,
  _extractExercise: _extractExercise,
  computeWeekSummary: computeWeekSummary,
  buildExercisePanelHTML: buildExercisePanelHTML,
};
