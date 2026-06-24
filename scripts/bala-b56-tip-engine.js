'use strict';

var TIPS = [
  // Sleep
  { id: 'slp01', cat: 'sleep',    text: 'Keeping a consistent bedtime — even on weekends — helps synchronise your body clock and may improve how rested you feel.' },
  { id: 'slp02', cat: 'sleep',    text: 'A cool, dark room (around 16–19°C / 60–67°F) supports deeper sleep stages for many people.' },
  { id: 'slp03', cat: 'sleep',    text: 'Limiting bright screens in the hour before bed allows melatonin to rise more naturally.' },
  // Recovery / HRV
  { id: 'rec01', cat: 'recovery', text: 'HRV tends to improve alongside consistent sleep timing, steady hydration, and lower daily stress.' },
  { id: 'rec02', cat: 'recovery', text: 'Slow, paced breathing — around 4–6 breaths per minute — can support a calmer nervous system state.' },
  { id: 'rec03', cat: 'recovery', text: 'On days when your body signals suggest fatigue, lighter activity often serves recovery better than pushing through.' },
  // Activity
  { id: 'act01', cat: 'activity', text: 'Short movement breaks spread across the day add up to meaningful totals without requiring a dedicated workout.' },
  { id: 'act02', cat: 'activity', text: 'A 10-minute walk after meals is one of the simplest habits linked to steadier energy levels.' },
  { id: 'act03', cat: 'activity', text: 'Zone 2 cardio — a pace where you can hold a conversation — builds aerobic base without over-stressing recovery.' },
  // Resting HR
  { id: 'rhr01', cat: 'rhr',      text: 'Resting heart rate varies naturally day to day. Weekly trends reveal more than any single reading.' },
  { id: 'rhr02', cat: 'rhr',      text: 'An elevated resting HR can reflect dehydration, early illness, or accumulated stress — check in with how you feel overall.' },
  // SpO2
  { id: 'spo01', cat: 'spo2',     text: 'Consumer blood-oxygen readings can vary with device placement and movement. Look for trends rather than absolute numbers.' },
  // General
  { id: 'gen01', cat: 'general',  text: 'Hydration supports nearly every body system. Steady intake throughout the day tends to work better than large amounts at once.' },
  { id: 'gen02', cat: 'general',  text: 'Your signals reflect a moment in time, not your identity. Week-over-week trends reveal far more than any single day.' },
  { id: 'gen03', cat: 'general',  text: 'Sleep, movement, and stress management interact. Improving one often creates a lift in the others.' },
  { id: 'gen04', cat: 'general',  text: 'Stress and recovery exist on a continuum. Small daily habits compound quietly into meaningful long-term change.' },
  { id: 'gen05', cat: 'general',  text: 'Logging your signals regularly — even imperfectly — gives BALA Coach more context to surface useful patterns.' },
  { id: 'gen06', cat: 'general',  text: 'Everyone\'s baseline is different. Tracking your own trends over time is more useful than comparing to population averages.' },
];

var _CAT_LABEL = {
  sleep:    'Sleep',
  recovery: 'Recovery',
  activity: 'Activity',
  rhr:      'Resting HR',
  spo2:     'Oxygen',
  general:  'Wellness',
};

function _escHtml(s) {
  if (typeof s !== 'string') s = String(s);
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function _dateHash(dateStr) {
  if (typeof dateStr !== 'string' || dateStr.length === 0) return 0;
  var h = 0;
  for (var i = 0; i < dateStr.length; i++) {
    h = (Math.imul(h, 31) + dateStr.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function _isRelevant(tip, metrics) {
  if (!tip || typeof tip !== 'object') return false;
  var m = (metrics && typeof metrics === 'object' && !Array.isArray(metrics)) ? metrics : {};
  switch (tip.cat) {
    case 'sleep':    return typeof m.sleep === 'number' && isFinite(m.sleep) && m.sleep < 7;
    case 'recovery': return typeof m.hrv === 'number' && isFinite(m.hrv) && m.hrv < 45;
    case 'activity': return typeof m.steps === 'number' && isFinite(m.steps) && m.steps < 7000;
    case 'rhr':      return typeof m.rhr === 'number' && isFinite(m.rhr) && m.rhr > 65;
    case 'spo2':     return true;
    case 'general':  return true;
    default:         return false;
  }
}

function selectTip(metrics, dateStr) {
  var date = (typeof dateStr === 'string' && dateStr.length >= 8) ? dateStr : '2026-01-01';
  var relevant = TIPS.filter(function(t) { return _isRelevant(t, metrics); });
  var pool = relevant.length > 0 ? relevant : TIPS;
  var idx = _dateHash(date) % pool.length;
  return pool[idx];
}

function buildTipCardHTML(metrics, dateStr) {
  var tip = selectTip(metrics, dateStr);
  if (!tip) return '';
  var catLabel = _escHtml(_CAT_LABEL[tip.cat] || 'Wellness');
  var catCls = _escHtml(tip.cat || 'general');
  return '<div class="tip-card" role="region" aria-label="Daily wellness tip">' +
    '<div class="tip-card-header">' +
      '<span class="tip-card-title">DAILY TIP</span>' +
      '<span class="tip-cat-chip tip-cat-' + catCls + '">' + catLabel + '</span>' +
    '</div>' +
    '<p class="tip-text">' + _escHtml(tip.text) + '</p>' +
    '<p class="tip-note">General wellness information — not medical advice. Speak with a healthcare provider for personal guidance.</p>' +
    '</div>';
}

module.exports = {
  TIPS: TIPS,
  _CAT_LABEL: _CAT_LABEL,
  _dateHash: _dateHash,
  _isRelevant: _isRelevant,
  selectTip: selectTip,
  buildTipCardHTML: buildTipCardHTML,
};
