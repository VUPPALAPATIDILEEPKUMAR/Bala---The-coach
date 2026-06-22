// =============================================================================
// BALA B58 — Founder Demo Journey Tests
// =============================================================================
'use strict';
const assert = require('assert');
const {
  JOURNEY_STEPS,
  PROHIBITED_CLINICAL_WORDS,
  DEMO_DATA_SPEC,
  createJourneyState,
  journeyAdvanceState,
  journeyBackState,
  journeyStartState,
  journeyExitState,
  getJourneyCurrentStep,
  getJourneyProgress,
  scanStepForUnsafeCopy,
  auditAllSteps,
  validateDemoData,
} = require('./bala-b58-demo-journey.js');

let pass = 0;
let fail = 0;
const tests = [];

function test(name, fn) { tests.push({ name, fn }); }

function run() {
  for (const t of tests) {
    try { t.fn(); console.log('  PASS', t.name); pass++; }
    catch (e) { console.error('  FAIL', t.name, '—', e.message); fail++; }
  }
  console.log('\n' + (fail === 0 ? 'ALL PASS' : 'FAILURES: ' + fail) + ' (' + pass + '/' + (pass + fail) + ')');
  process.exit(fail > 0 ? 1 : 0);
}

// ---------------------------------------------------------------------------
// Suite 1 — Journey step definitions
// ---------------------------------------------------------------------------
test('has 7 journey steps', () => assert.strictEqual(JOURNEY_STEPS.length, 7));
test('step ids are unique', () => {
  const ids = JOURNEY_STEPS.map(s => s.id);
  assert.strictEqual(new Set(ids).size, 7);
});
test('every step has title, emoji, subtitle, body, safeNote', () => {
  for (const s of JOURNEY_STEPS) {
    assert.ok(s.title, `step ${s.id} missing title`);
    assert.ok(s.emoji, `step ${s.id} missing emoji`);
    assert.ok(s.subtitle, `step ${s.id} missing subtitle`);
    assert.ok(s.body, `step ${s.id} missing body`);
    assert.ok(s.safeNote, `step ${s.id} missing safeNote`);
  }
});
test('score step is first', () => assert.strictEqual(JOURNEY_STEPS[0].id, 'score'));
test('closing step is last', () => assert.strictEqual(JOURNEY_STEPS[6].id, 'closing'));

// ---------------------------------------------------------------------------
// Suite 2 — Medical safety scan
// ---------------------------------------------------------------------------
test('all steps pass medical safety audit', () => {
  const violations = auditAllSteps();
  assert.deepStrictEqual(violations, [], 'Unsafe clinical language found: ' + JSON.stringify(violations));
});
test('scanStepForUnsafeCopy returns empty for safe step', () => {
  const step = { id: 'x', title: 'Guide', subtitle: 'Awareness', body: 'Safe body text', safeNote: 'Always see doctor' };
  assert.deepStrictEqual(scanStepForUnsafeCopy(step), []);
});
test('scanStepForUnsafeCopy catches unsafe word', () => {
  const step = { id: 'x', title: 'We can diagnos', subtitle: '', body: '', safeNote: '' };
  const hits = scanStepForUnsafeCopy(step);
  assert.ok(hits.length > 0, 'should have caught "diagnos"');
});
test('no step body contains "diagnos"', () => {
  for (const s of JOURNEY_STEPS) {
    assert.ok(!s.body.toLowerCase().includes('diagnos'), `step ${s.id} body contains "diagnos"`);
  }
});
test('no step body says "prevent cardiac" or "cardiac arrest"', () => {
  for (const s of JOURNEY_STEPS) {
    const txt = (s.body + s.subtitle + s.title).toLowerCase();
    assert.ok(!txt.includes('cardiac arrest'), `step ${s.id} mentions cardiac arrest`);
    assert.ok(!txt.includes('prevent cardiac'), `step ${s.id} says prevent cardiac`);
  }
});

// ---------------------------------------------------------------------------
// Suite 3 — Journey state machine
// ---------------------------------------------------------------------------
test('createJourneyState returns inactive state at step 0', () => {
  const s = createJourneyState();
  assert.strictEqual(s.active, false);
  assert.strictEqual(s.currentStep, 0);
  assert.strictEqual(s.totalSteps, 7);
  assert.deepStrictEqual(s.stepsViewed, []);
});
test('journeyStartState activates state', () => {
  const s = journeyStartState(createJourneyState());
  assert.strictEqual(s.active, true);
  assert.strictEqual(s.currentStep, 0);
  assert.ok(s.startedAt);
});
test('journeyAdvanceState increments step', () => {
  let s = journeyStartState(createJourneyState());
  s = journeyAdvanceState(s);
  assert.strictEqual(s.currentStep, 1);
});
test('journeyAdvanceState tracks viewed steps', () => {
  let s = journeyStartState(createJourneyState());
  s = journeyAdvanceState(s); // step 0 → 1, viewed=[0]
  assert.ok(s.stepsViewed.includes(0));
});
test('journeyBackState decrements step', () => {
  let s = journeyStartState(createJourneyState());
  s = journeyAdvanceState(s);  // step 1
  s = journeyBackState(s);     // step 0
  assert.strictEqual(s.currentStep, 0);
});
test('journeyBackState does not go below 0', () => {
  let s = journeyStartState(createJourneyState());
  s = journeyBackState(s);
  assert.strictEqual(s.currentStep, 0);
});
test('journeyAdvanceState does not exceed last step', () => {
  let s = journeyStartState(createJourneyState());
  for (let i = 0; i < 20; i++) s = journeyAdvanceState(s);
  assert.strictEqual(s.currentStep, 6);
});
test('journeyExitState deactivates', () => {
  let s = journeyStartState(createJourneyState());
  s = journeyExitState(s);
  assert.strictEqual(s.active, false);
});
test('advance on inactive state does nothing', () => {
  const s = journeyAdvanceState(createJourneyState());
  assert.strictEqual(s.currentStep, 0);
  assert.strictEqual(s.active, false);
});

// ---------------------------------------------------------------------------
// Suite 4 — Current step + progress
// ---------------------------------------------------------------------------
test('getJourneyCurrentStep returns step 0 on fresh state', () => {
  const s = createJourneyState();
  const step = getJourneyCurrentStep(s);
  assert.strictEqual(step.id, 'score');
});
test('getJourneyCurrentStep returns correct step after advance', () => {
  let s = journeyStartState(createJourneyState());
  s = journeyAdvanceState(s);
  const step = getJourneyCurrentStep(s);
  assert.strictEqual(step.id, 'signals');
});
test('getJourneyProgress correct values at step 0', () => {
  const s = journeyStartState(createJourneyState());
  const p = getJourneyProgress(s);
  assert.strictEqual(p.current, 1);
  assert.strictEqual(p.total, 7);
  assert.strictEqual(p.isFirst, true);
  assert.strictEqual(p.isLast, false);
});
test('getJourneyProgress isLast true at final step', () => {
  let s = journeyStartState(createJourneyState());
  for (let i = 0; i < 6; i++) s = journeyAdvanceState(s);
  const p = getJourneyProgress(s);
  assert.strictEqual(p.isLast, true);
  assert.strictEqual(p.current, 7);
});

// ---------------------------------------------------------------------------
// Suite 5 — Demo data validation
// ---------------------------------------------------------------------------
test('validateDemoData rejects null', () => {
  const r = validateDemoData(null);
  assert.strictEqual(r.valid, false);
});
test('validateDemoData rejects non-demo source', () => {
  const r = validateDemoData({ source: 'Apple Health', sleep: 7, rhr: 62, hrv: 55, spo2: 98, steps: 8000 });
  assert.strictEqual(r.valid, false);
  assert.ok(r.reason.includes('demo'));
});
test('validateDemoData rejects missing required field', () => {
  const r = validateDemoData({ source: 'BALA demo', sleep: 7, rhr: 62, hrv: 55, spo2: 98 }); // missing steps
  assert.strictEqual(r.valid, false);
  assert.ok(r.reason.includes('steps'));
});
test('validateDemoData accepts valid demo data', () => {
  const r = validateDemoData({
    source: 'BALA demo',
    sleep: 7.2,
    rhr: 62,
    hrv: 55,
    spo2: 98,
    steps: 8000,
  });
  assert.strictEqual(r.valid, true);
});
test('DEMO_DATA_SPEC has 6 required fields', () => {
  assert.strictEqual(DEMO_DATA_SPEC.requiredFields.length, 6);
});

// ---------------------------------------------------------------------------
// Suite 6 — Journey content integrity
// ---------------------------------------------------------------------------
test('every step body is at least 80 chars', () => {
  for (const s of JOURNEY_STEPS) {
    assert.ok(s.body.length >= 80, `step ${s.id} body too short (${s.body.length})`);
  }
});
test('every step safeNote mentions doctor or care', () => {
  for (const s of JOURNEY_STEPS) {
    const note = s.safeNote.toLowerCase();
    const hasSafeRef = note.includes('doctor') || note.includes('care') || note.includes('medical') || note.includes('healthcare');
    assert.ok(hasSafeRef, `step ${s.id} safeNote lacks doctor/care reference`);
  }
});
test('closing step mentions emergency care', () => {
  const closing = JOURNEY_STEPS.find(s => s.id === 'closing');
  assert.ok(closing);
  assert.ok(closing.safeNote.toLowerCase().includes('emergency'), 'closing step should mention emergency care');
});
test('summary step does not say "medical record"', () => {
  const summary = JOURNEY_STEPS.find(s => s.id === 'summary');
  // safeNote can say "not a medical record" - that is safe
  assert.ok(!summary.body.toLowerCase().includes('medical record'), 'summary body should not claim to be a medical record');
});
test('coach step references "doctor"', () => {
  const coach = JOURNEY_STEPS.find(s => s.id === 'coach');
  assert.ok(coach.safeNote.toLowerCase().includes('doctor'));
});

// ---------------------------------------------------------------------------
// Suite 7 — Founder demo journey UX rules
// ---------------------------------------------------------------------------
test('journey has exactly 7 steps (full feature coverage)', () => {
  assert.strictEqual(JOURNEY_STEPS.length, 7);
});
test('required feature steps are present', () => {
  const ids = new Set(JOURNEY_STEPS.map(s => s.id));
  for (const required of ['score', 'signals', 'detail', 'reflection', 'coach', 'summary', 'closing']) {
    assert.ok(ids.has(required), 'missing step: ' + required);
  }
});
test('journey can complete full forward pass', () => {
  let s = journeyStartState(createJourneyState());
  for (let i = 0; i < JOURNEY_STEPS.length - 1; i++) s = journeyAdvanceState(s);
  const p = getJourneyProgress(s);
  assert.strictEqual(p.isLast, true);
  assert.strictEqual(p.stepsViewed, JOURNEY_STEPS.length - 1);
});
test('journey can navigate backwards after going forward', () => {
  let s = journeyStartState(createJourneyState());
  s = journeyAdvanceState(s);
  s = journeyAdvanceState(s);
  s = journeyBackState(s);
  assert.strictEqual(s.currentStep, 1);
});

run();
