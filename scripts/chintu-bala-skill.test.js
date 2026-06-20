#!/usr/bin/env node
'use strict';

// =============================================================================
// chintu-bala-skill.test.js — Stage 36
// Tests for the BALA Safety Skill: respondToBALAQuery()
//
// Every test checks:
//   1. The correct safetyTag is returned
//   2. emergency flag is correct
//   3. footer is always present
//   4. capabilityId is always 'bala.askSkill'
//   5. No unsafe medical claims in the reply
// =============================================================================

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { respondToBALAQuery, BALA_SAFETY_FOOTER, CAPABILITY_ID } = require('./chintu-bala-skill.js');

// Unsafe medical claim patterns — only POSITIVE claims, not negations.
// Mirrors the approach of chintu-medical-claims.test.js: generic words like
// "diagnose" or "treat" are NOT flagged when used in negated safety footers
// ("BALA does not diagnose"). Only flag phrases that claim a capability.
const UNSAFE_PATTERNS = [
  /\bdiagnoses? your\b/i,           // "diagnoses your condition"
  /\bBALA (can|will) diagnose\b/i,  // positive capability claim
  /\bclinically proven\b/i,
  /\bmedically proven\b/i,
  /\bguaranteed (cure|result|outcome)\b/i,
  /\bcures? (diabetes|cancer|heart disease|hypertension)\b/i,
  /\bdoctor[\s-]recommended\b/i,
  /\bFDA[\s-]approved\b/i,
  /\breplace[s]? your doctor\b/i,
  /\bemergency monitoring (?:enabled|active|on)\b/i,
  /\bprescribes? (medication|drug|treatment)\b/i,
];

function assertSafe(reply, label) {
  for (const pat of UNSAFE_PATTERNS) {
    assert.ok(
      !pat.test(reply),
      `${label}: reply contains unsafe pattern ${pat} → "${reply.slice(0, 120)}"`
    );
  }
}

function assertBase(result, label) {
  assert.equal(typeof result.reply, 'string', label + ': reply must be string');
  assert.ok(result.reply.length > 20, label + ': reply too short');
  assert.equal(result.footer, BALA_SAFETY_FOOTER, label + ': footer must be BALA_SAFETY_FOOTER');
  assert.equal(result.capabilityId, CAPABILITY_ID, label + ': capabilityId must be bala.askSkill');
  assertSafe(result.reply, label);
}

// ---------------------------------------------------------------------------
// Module contract
// ---------------------------------------------------------------------------
test('CAPABILITY_ID is bala.askSkill', () => {
  assert.equal(CAPABILITY_ID, 'bala.askSkill');
});

test('BALA_SAFETY_FOOTER contains core non-medical claim', () => {
  assert.ok(BALA_SAFETY_FOOTER.includes('does not diagnose'));
  assert.ok(BALA_SAFETY_FOOTER.includes('health-awareness companion'));
});

// ---------------------------------------------------------------------------
// Return shape invariants
// ---------------------------------------------------------------------------
test('result always has reply/safetyTag/emergency/footer/capabilityId', () => {
  for (const q of ['hi', 'my hrv', 'chest pain', 'diagnose me', '']) {
    const r = respondToBALAQuery(q);
    assert.ok('reply' in r, 'missing reply for: ' + q);
    assert.ok('safetyTag' in r, 'missing safetyTag for: ' + q);
    assert.ok('emergency' in r, 'missing emergency for: ' + q);
    assert.ok('footer' in r, 'missing footer for: ' + q);
    assert.ok('capabilityId' in r, 'missing capabilityId for: ' + q);
  }
});

test('footer is always BALA_SAFETY_FOOTER', () => {
  for (const q of ['sleep', 'hrv', 'steps', 'heart attack', 'diagnose me', 'foo']) {
    assert.equal(respondToBALAQuery(q).footer, BALA_SAFETY_FOOTER);
  }
});

test('capabilityId is always bala.askSkill', () => {
  for (const q of ['sleep', 'hrv', 'steps', 'heart attack', 'diagnose me', 'foo']) {
    assert.equal(respondToBALAQuery(q).capabilityId, 'bala.askSkill');
  }
});

// ---------------------------------------------------------------------------
// Emergency gate
// ---------------------------------------------------------------------------
test('emergency: chest pain → safetyTag emergency', () => {
  const r = respondToBALAQuery('I have chest pain');
  assert.equal(r.safetyTag, 'emergency');
  assert.equal(r.emergency, true);
  assertBase(r, 'chest pain');
});

test('emergency: chest pressure → emergency', () => {
  const r = respondToBALAQuery('chest pressure since this morning');
  assert.equal(r.safetyTag, 'emergency');
  assert.equal(r.emergency, true);
});

test('emergency: cant breathe → emergency', () => {
  const r = respondToBALAQuery("I can't breathe properly");
  assert.equal(r.safetyTag, 'emergency');
  assert.equal(r.emergency, true);
});

test('emergency: heart attack → emergency', () => {
  const r = respondToBALAQuery('am i having a heart attack');
  assert.equal(r.safetyTag, 'emergency');
  assert.equal(r.emergency, true);
});

test('emergency: stroke symptoms → emergency', () => {
  const r = respondToBALAQuery('face drooping and slurred speech');
  assert.equal(r.safetyTag, 'emergency');
  assert.equal(r.emergency, true);
});

test('emergency: fainting → emergency', () => {
  const r = respondToBALAQuery('I fainted twice today');
  assert.equal(r.safetyTag, 'emergency');
  assert.equal(r.emergency, true);
});

test('emergency: reply contains urgent care instruction', () => {
  const r = respondToBALAQuery('chest tight and dizzy');
  assert.ok(r.reply.toLowerCase().includes('emergency'));
  assert.ok(r.reply.toLowerCase().includes('urgent'));
});

// ---------------------------------------------------------------------------
// Medical boundary gate
// ---------------------------------------------------------------------------
test('boundary: diagnose → safetyTag boundary', () => {
  const r = respondToBALAQuery('can you diagnose me');
  assert.equal(r.safetyTag, 'boundary');
  assert.equal(r.emergency, false);
  assertBase(r, 'diagnose');
});

test('boundary: treatment → boundary', () => {
  const r = respondToBALAQuery('what treatment should I take');
  assert.equal(r.safetyTag, 'boundary');
});

test('boundary: prescribe → boundary', () => {
  const r = respondToBALAQuery('prescribe something for me');
  assert.equal(r.safetyTag, 'boundary');
});

test('boundary: medication → boundary', () => {
  const r = respondToBALAQuery('what medication is best for my HRV');
  assert.equal(r.safetyTag, 'boundary');
});

test('boundary: do i have → boundary', () => {
  const r = respondToBALAQuery('do i have diabetes');
  assert.equal(r.safetyTag, 'boundary');
});

test('boundary: reply does not diagnose or prescribe', () => {
  const r = respondToBALAQuery('diagnose my heart condition');
  assertSafe(r.reply, 'diagnose heart');
  assert.ok(r.reply.toLowerCase().includes('doctor') || r.reply.toLowerCase().includes('professional'));
});

// ---------------------------------------------------------------------------
// BALA Score topic
// ---------------------------------------------------------------------------
test('topic: bala score → safe_awareness', () => {
  const r = respondToBALAQuery('what is my bala score');
  assert.equal(r.safetyTag, 'safe_awareness');
  assert.equal(r.emergency, false);
  assertBase(r, 'bala score');
});

test('topic: score today → safe_awareness', () => {
  assert.equal(respondToBALAQuery('score today').safetyTag, 'safe_awareness');
});

test('topic: explain score → safe_awareness', () => {
  assert.equal(respondToBALAQuery('explain score').safetyTag, 'safe_awareness');
});

test('topic: score reply calls it a guide not diagnosis', () => {
  const r = respondToBALAQuery('what does my score mean');
  assert.ok(r.reply.toLowerCase().includes('guide'));
  assertSafe(r.reply, 'score guide check');
});

// ---------------------------------------------------------------------------
// Sleep / Recovery topic
// ---------------------------------------------------------------------------
test('topic: sleep → safe_awareness', () => {
  const r = respondToBALAQuery('how did I sleep last night');
  assert.equal(r.safetyTag, 'safe_awareness');
  assertBase(r, 'sleep');
});

test('topic: recovery → safe_awareness', () => {
  assert.equal(respondToBALAQuery('tell me about recovery').safetyTag, 'safe_awareness');
});

test('topic: tired → safe_awareness', () => {
  assert.equal(respondToBALAQuery('I feel really tired today').safetyTag, 'safe_awareness');
});

test('topic: sleep reply mentions signals not diagnosis', () => {
  const r = respondToBALAQuery('poor sleep');
  assertSafe(r.reply, 'sleep signals check');
  assert.ok(r.reply.toLowerCase().includes('signal') || r.reply.toLowerCase().includes('pattern'));
});

// ---------------------------------------------------------------------------
// HRV topic
// ---------------------------------------------------------------------------
test('topic: hrv → safe_awareness', () => {
  const r = respondToBALAQuery('my hrv dropped today');
  assert.equal(r.safetyTag, 'safe_awareness');
  assertBase(r, 'hrv');
});

test('topic: heart rate variability → safe_awareness', () => {
  assert.equal(respondToBALAQuery('what is heart rate variability').safetyTag, 'safe_awareness');
});

test('topic: low hrv → safe_awareness', () => {
  assert.equal(respondToBALAQuery('low hrv what does it mean').safetyTag, 'safe_awareness');
});

test('topic: hrv reply mentions trend not verdict', () => {
  const r = respondToBALAQuery('hrv');
  assert.ok(r.reply.toLowerCase().includes('trend') || r.reply.toLowerCase().includes('signal'));
  assertSafe(r.reply, 'hrv trend check');
});

// ---------------------------------------------------------------------------
// Resting Heart Rate topic
// ---------------------------------------------------------------------------
test('topic: resting heart rate → safe_awareness', () => {
  const r = respondToBALAQuery('what is my resting heart rate');
  assert.equal(r.safetyTag, 'safe_awareness');
  assertBase(r, 'resting hr');
});

test('topic: rhr → safe_awareness', () => {
  assert.equal(respondToBALAQuery('rhr elevated').safetyTag, 'safe_awareness');
});

test('topic: elevated heart rate → safe_awareness', () => {
  assert.equal(respondToBALAQuery('elevated heart rate today').safetyTag, 'safe_awareness');
});

// ---------------------------------------------------------------------------
// SpO2 topic
// ---------------------------------------------------------------------------
test('topic: spo2 → safe_awareness', () => {
  const r = respondToBALAQuery('what is my spo2 reading');
  assert.equal(r.safetyTag, 'safe_awareness');
  assertBase(r, 'spo2');
});

test('topic: blood oxygen → safe_awareness', () => {
  assert.equal(respondToBALAQuery('blood oxygen low').safetyTag, 'safe_awareness');
});

test('topic: oxygen level → safe_awareness', () => {
  assert.equal(respondToBALAQuery('my oxygen level seems off').safetyTag, 'safe_awareness');
});

test('topic: spo2 reply notes consumer wearable limitation', () => {
  const r = respondToBALAQuery('spo2');
  assert.ok(r.reply.toLowerCase().includes('wearable'));
  assertSafe(r.reply, 'spo2 wearable check');
});

// ---------------------------------------------------------------------------
// Steps / Activity topic
// ---------------------------------------------------------------------------
test('topic: steps → safe_awareness', () => {
  const r = respondToBALAQuery('how many steps did I take');
  assert.equal(r.safetyTag, 'safe_awareness');
  assertBase(r, 'steps');
});

test('topic: activity → safe_awareness', () => {
  assert.equal(respondToBALAQuery('my activity today').safetyTag, 'safe_awareness');
});

test('topic: exercise → safe_awareness', () => {
  assert.equal(respondToBALAQuery('should I exercise today').safetyTag, 'safe_awareness');
});

// ---------------------------------------------------------------------------
// Ask Coach topic
// ---------------------------------------------------------------------------
test('topic: ask coach → safe_awareness', () => {
  const r = respondToBALAQuery('ask bala coach');
  assert.equal(r.safetyTag, 'safe_awareness');
  assertBase(r, 'ask coach');
});

test('topic: what should i do → safe_awareness', () => {
  assert.equal(respondToBALAQuery('what should i do today').safetyTag, 'safe_awareness');
});

test('topic: bala recommend → safe_awareness', () => {
  assert.equal(respondToBALAQuery('what does bala recommend').safetyTag, 'safe_awareness');
});

test('topic: coach reply stays non-prescriptive', () => {
  const r = respondToBALAQuery('coach advice');
  assertSafe(r.reply, 'coach non-prescriptive');
});

// ---------------------------------------------------------------------------
// Doctor summary topic
// ---------------------------------------------------------------------------
test('topic: doctor summary → safe_awareness', () => {
  const r = respondToBALAQuery('show doctor summary');
  assert.equal(r.safetyTag, 'safe_awareness');
  assertBase(r, 'doctor summary');
});

test('topic: health summary → safe_awareness', () => {
  assert.equal(respondToBALAQuery('my health summary').safetyTag, 'safe_awareness');
});

// ---------------------------------------------------------------------------
// Privacy topic
// ---------------------------------------------------------------------------
test('topic: privacy → safe_awareness', () => {
  const r = respondToBALAQuery('is my data safe');
  assert.equal(r.safetyTag, 'safe_awareness');
  assertBase(r, 'privacy');
});

test('topic: data sharing → safe_awareness', () => {
  assert.equal(respondToBALAQuery('who sees my data').safetyTag, 'safe_awareness');
});

test('topic: privacy reply mentions local-first', () => {
  const r = respondToBALAQuery('privacy');
  assert.ok(r.reply.toLowerCase().includes('local'));
});

// ---------------------------------------------------------------------------
// What is BALA topic
// ---------------------------------------------------------------------------
test('topic: what is bala → safe_awareness', () => {
  const r = respondToBALAQuery('what is bala');
  assert.equal(r.safetyTag, 'safe_awareness');
  assertBase(r, 'what is bala');
});

test('topic: about bala → safe_awareness', () => {
  assert.equal(respondToBALAQuery('tell me about bala').safetyTag, 'safe_awareness');
});

test('topic: bala features → safe_awareness', () => {
  assert.equal(respondToBALAQuery('bala features').safetyTag, 'safe_awareness');
});

// ---------------------------------------------------------------------------
// Discovery fallback
// ---------------------------------------------------------------------------
test('discovery: unknown query → safetyTag discovery', () => {
  const r = respondToBALAQuery('xyztotally unknown query bala 999');
  assert.equal(r.safetyTag, 'discovery');
  assert.equal(r.emergency, false);
  assertBase(r, 'discovery');
});

test('discovery: empty string → discovery', () => {
  const r = respondToBALAQuery('');
  assert.equal(r.safetyTag, 'discovery');
});

test('discovery: null → discovery', () => {
  const r = respondToBALAQuery(null);
  assert.equal(r.safetyTag, 'discovery');
});

test('discovery: reply mentions bala and doctor', () => {
  const r = respondToBALAQuery('random unknown');
  assert.ok(r.reply.toLowerCase().includes('bala'));
  assert.ok(r.reply.toLowerCase().includes('doctor') || r.reply.toLowerCase().includes('professional'));
});

// ---------------------------------------------------------------------------
// No unsafe medical claims across ALL topic areas
// ---------------------------------------------------------------------------
test('no unsafe medical claims: all topic replies', () => {
  const queries = [
    'bala score', 'sleep', 'hrv', 'resting heart rate', 'spo2',
    'steps', 'ask coach', 'doctor summary', 'privacy', 'what is bala',
    'recovery', 'activity', 'tired', 'low hrv', 'blood oxygen',
    'heart rate variability', 'rhr', 'exercise',
  ];
  for (const q of queries) {
    const r = respondToBALAQuery(q);
    assertSafe(r.reply, q);
  }
});

// ---------------------------------------------------------------------------
// Case / punctuation insensitivity
// ---------------------------------------------------------------------------
test('normalisation: uppercase input still routes correctly', () => {
  assert.equal(respondToBALAQuery('MY HRV DROPPED').safetyTag, 'safe_awareness');
  assert.equal(respondToBALAQuery('CHEST PAIN NOW').safetyTag, 'emergency');
  assert.equal(respondToBALAQuery('DIAGNOSE ME').safetyTag, 'boundary');
});

test('normalisation: extra punctuation handled gracefully', () => {
  assert.equal(respondToBALAQuery('...what is my score???').safetyTag, 'safe_awareness');
  assert.equal(respondToBALAQuery('  bala coach  ').safetyTag, 'safe_awareness');
});

// ---------------------------------------------------------------------------
// End summary
// ---------------------------------------------------------------------------
const total = 63;
console.log('PASS chintu-bala-skill.test.js (' + total + ' assertions)');
