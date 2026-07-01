// scripts/chintu-morning-digest-skill.js
// C75 — Chintu Morning Digest Skill
// Combines BALA weekly check-in + HN top stories into one morning briefing.
// Dry-run safe. CHINTU_TELEGRAM_SEND_ENABLED is NEVER set here.
// No secrets. No trackers. No paid APIs.
'use strict';

var SKILL_ID      = 'chintu.morningDigest';
var SKILL_VERSION = 'C75';

// Import sub-skills
var balaWeeklySkill = require('./chintu-bala-weekly-skill.js');
var hnSkill         = require('./chintu-hn-skill.js');

// Guard — must never be hardcoded to '1' here
var SEND_ENABLED = (process.env.CHINTU_TELEGRAM_SEND_ENABLED === '1');

function buildGreeting() {
  var h = new Date().getHours();
  if (h < 12) return '🌅 Good morning!';
  if (h < 17) return '☀️ Good afternoon!';
  return '🌙 Good evening!';
}

function formatMorningDigest(balaResult, hnResult, date) {
  var d = date || new Date().toISOString().slice(0, 10);
  var lines = [];

  lines.push(buildGreeting());
  lines.push('*Chintu Morning Digest — ' + d + '*');
  lines.push('');

  // ── BALA Section ──
  lines.push('*🩺 Your BALA Health Signal*');
  if (balaResult && balaResult.ok) {
    lines.push(balaResult.text || 'Health data ready.');
  } else {
    lines.push('No BALA data yet — log a few days to see your digest here.');
  }

  lines.push('');

  // ── HN Section ──
  lines.push('*📰 Top Tech Stories*');
  if (hnResult && hnResult.ok && hnResult.text) {
    // Extract just the story lines (skip header line of HN digest)
    var hnLines = hnResult.text.split('\n').filter(function (l) {
      return l.trim() && !l.includes('HN Morning Brief') && !l.includes('Powered by');
    });
    lines = lines.concat(hnLines.slice(0, 20)); // cap at 20 lines
  } else {
    lines.push('HN headlines unavailable right now.');
  }

  lines.push('');
  lines.push('_Chintu ' + SKILL_VERSION + ' · Local-first · Privacy safe_');

  return lines.join('\n');
}

function getMorningDigest(opts) {
  opts = opts || {};
  var dateOverride     = opts.date || null;
  var balaPathOverride = opts.balaPath || null;
  var hnUrlOverride    = opts.hnUrl || null;

  if (SEND_ENABLED) {
    return Promise.resolve({
      ok: false,
      reason: 'telegram_send_blocked',
      note: 'CHINTU_TELEGRAM_SEND_ENABLED is set but Telegram send is human-gated in this skill.'
    });
  }

  // Run both sub-skills in parallel
  var balaPromise = Promise.resolve(balaWeeklySkill.getBALAWeeklyDigest(balaPathOverride))
    .catch(function (e) {
      return { ok: false, reason: 'bala_error: ' + e.message };
    });

  var hnPromise = hnSkill.getHNBrief({ urlOverride: hnUrlOverride, date: dateOverride })
    .catch(function (e) {
      return { ok: false, reason: 'hn_error: ' + e.message };
    });

  return Promise.all([balaPromise, hnPromise]).then(function (results) {
    var balaResult = results[0];
    var hnResult   = results[1];
    var text = formatMorningDigest(balaResult, hnResult, dateOverride);
    return {
      ok:        true,
      dryRun:    true,
      text:      text,
      balaOk:   balaResult && balaResult.ok,
      hnOk:     hnResult && hnResult.ok,
      skillId:  SKILL_ID,
      version:  SKILL_VERSION,
      note:     'Set CHINTU_TELEGRAM_SEND_ENABLED=1 (human only) to enable Telegram delivery.'
    };
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getMorningDigest:     getMorningDigest,
    formatMorningDigest:  formatMorningDigest,
    buildGreeting:        buildGreeting,
    SKILL_ID:             SKILL_ID,
    SKILL_VERSION:        SKILL_VERSION
  };
}
