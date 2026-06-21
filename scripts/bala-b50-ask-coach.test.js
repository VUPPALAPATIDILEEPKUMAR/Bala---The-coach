'use strict';
// =============================================================================
// BALA-B50 Ask BALA Coach — Test Suite
// Tests bala-ask-coach-engine.js (CommonJS, no DOM, no network)
// =============================================================================

const {
  isEmergency,
  matchTopic,
  getCoachResponse,
  sanitiseInput,
  EMERGENCY_KEYWORDS,
  EMERGENCY_RESPONSE,
  TOPIC_MAP,
  DEFAULT_RESPONSE,
  MAX_INPUT_LENGTH,
} = require('./bala-ask-coach-engine.js');

let passed = 0;
let failed = 0;

function assert(label, condition, detail) {
  if (condition) {
    console.log('  ✓', label);
    passed++;
  } else {
    console.error('  ✗', label, detail !== undefined ? '→ ' + JSON.stringify(detail) : '');
    failed++;
  }
}

// ---------------------------------------------------------------------------
// Suite 1: isEmergency
// ---------------------------------------------------------------------------
console.log('\nSuite 1: isEmergency');
assert('null input → false',         isEmergency(null) === false);
assert('empty string → false',       isEmergency('') === false);
assert('normal question → false',    isEmergency('what does my hrv mean?') === false);
assert('"chest pain" → true',        isEmergency('I have chest pain') === true);
assert('"chest pressure" → true',    isEmergency('feeling chest pressure') === true);
assert('"heart attack" → true',      isEmergency('am I having a heart attack?') === true);
assert('"stroke" → true',            isEmergency('I think I am having a stroke') === true);
assert('"can\'t breathe" → true',    isEmergency("I can't breathe properly") === true);
assert('"shortness of breath" → true', isEmergency('shortness of breath since morning') === true);
assert('"fainting" → true',          isEmergency('I keep fainting') === true);
assert('"passed out" → true',        isEmergency('I just passed out') === true);
assert('"severe pain" → true',       isEmergency('severe pain in my chest') === true);
assert('case-insensitive match',     isEmergency('CHEST PAIN') === true);
assert('"emergency" keyword → true', isEmergency('is this an emergency?') === true);

// ---------------------------------------------------------------------------
// Suite 2: matchTopic
// ---------------------------------------------------------------------------
console.log('\nSuite 2: matchTopic');
assert('null → null',                 matchTopic(null) === null);
assert('"hrv" → hrv topic',           matchTopic('what is hrv?') !== null && matchTopic('what is hrv?').keywords.includes('hrv'));
assert('"heart rate variability" → hrv', matchTopic('explain heart rate variability').keywords.includes('hrv'));
assert('"sleep" → sleep topic',       matchTopic('my sleep is bad').keywords.includes('sleep'));
assert('"tired" → sleep topic',       matchTopic('I feel tired').keywords.includes('tired'));
assert('"steps" → steps topic',       matchTopic('how many steps should I do?').keywords.includes('steps'));
assert('"exercise" → steps topic',    matchTopic('does exercise help?').keywords.includes('exercise'));
assert('"stress" → stress topic',     matchTopic('I am stressed').keywords.includes('stress'));
assert('"recovery" → recovery topic', matchTopic('what does recovery mean?').keywords.includes('recovery'));
assert('"bala score" → score topic',  matchTopic('what does my bala score mean?').keywords.includes('bala score'));
assert('"privacy" → privacy topic',   matchTopic('where is my data stored?').keywords.includes('privacy'));
assert('"doctor" → doctor topic',     matchTopic('should I see a doctor?').keywords.includes('doctor'));
assert('"spo2" → spo2 topic',         matchTopic('what is spo2?').keywords.includes('spo2'));
assert('"rhr" → rhr topic',           matchTopic('what is rhr?').keywords.includes('rhr'));
assert('unknown → null',              matchTopic('what is the weather like?') === null);
assert('case-insensitive: "HRV"',     matchTopic('what is HRV?') !== null);

// ---------------------------------------------------------------------------
// Suite 3: getCoachResponse — empty/null input
// ---------------------------------------------------------------------------
console.log('\nSuite 3: getCoachResponse — empty/null');
{
  const r = getCoachResponse('');
  assert('empty string → type:empty', r.type === 'empty');
  assert('empty string → empty response', r.response === '');
}
{
  const r = getCoachResponse('   ');
  assert('whitespace → type:empty', r.type === 'empty');
}
{
  const r = getCoachResponse(null);
  assert('null → type:empty', r.type === 'empty');
}
{
  const r = getCoachResponse(42);
  assert('number → type:empty', r.type === 'empty');
}

// ---------------------------------------------------------------------------
// Suite 4: getCoachResponse — emergency gate
// ---------------------------------------------------------------------------
console.log('\nSuite 4: getCoachResponse — emergency gate');
{
  const r = getCoachResponse('I have chest pain');
  assert('emergency → type:emergency', r.type === 'emergency');
  assert('emergency → includes emergency services', r.response.toLowerCase().includes('emergency services'));
  assert('emergency → includes disclaimer about BALA limits', r.response.toLowerCase().includes('bala'));
}
{
  const r = getCoachResponse('What is HRV and I have chest pain');
  assert('emergency overrides topic match', r.type === 'emergency');
}
{
  const r = getCoachResponse('having trouble breathing and my hrv is low');
  assert('trouble breathing → emergency, not topic', r.type === 'emergency');
}

// ---------------------------------------------------------------------------
// Suite 5: getCoachResponse — topic matches
// ---------------------------------------------------------------------------
console.log('\nSuite 5: getCoachResponse — topic matches');
{
  const r = getCoachResponse('what does hrv mean?');
  assert('hrv question → type:topic', r.type === 'topic');
  assert('hrv response mentions variability', r.response.toLowerCase().includes('variab'));
}
{
  const r = getCoachResponse('my sleep has been bad lately');
  assert('sleep question → type:topic', r.type === 'topic');
  assert('sleep response mentions sleep', r.response.toLowerCase().includes('sleep'));
}
{
  const r = getCoachResponse('what is my resting heart rate?');
  assert('rhr question → type:topic', r.type === 'topic');
}
{
  const r = getCoachResponse('tell me about blood oxygen levels');
  assert('spo2 question → type:topic', r.type === 'topic');
}
{
  const r = getCoachResponse('how many steps should I take?');
  assert('steps question → type:topic', r.type === 'topic');
}
{
  const r = getCoachResponse('I am feeling stressed at work');
  assert('stress question → type:topic', r.type === 'topic');
}
{
  const r = getCoachResponse('what does recovery mean in bala?');
  assert('recovery question → type:topic', r.type === 'topic');
}
{
  const r = getCoachResponse('where is my data stored?');
  assert('privacy question → type:topic', r.type === 'topic');
  assert('privacy response mentions device', r.response.toLowerCase().includes('device'));
}
{
  const r = getCoachResponse('should I see a doctor?');
  assert('doctor question → type:topic', r.type === 'topic');
}

// ---------------------------------------------------------------------------
// Suite 6: getCoachResponse — default fallback
// ---------------------------------------------------------------------------
console.log('\nSuite 6: getCoachResponse — default fallback');
{
  const r = getCoachResponse('what is the best restaurant in London?');
  assert('off-topic → type:default', r.type === 'default');
  assert('default response is non-empty', r.response.length > 10);
  assert('default response is the DEFAULT_RESPONSE constant', r.response === DEFAULT_RESPONSE);
}
{
  const r = getCoachResponse('ajksdhaksjdh');
  assert('gibberish → type:default', r.type === 'default');
}

// ---------------------------------------------------------------------------
// Suite 7: sanitiseInput
// ---------------------------------------------------------------------------
console.log('\nSuite 7: sanitiseInput');
assert('trims whitespace', sanitiseInput('  hello  ') === 'hello');
assert('null → ""', sanitiseInput(null) === '');
assert('number → ""', sanitiseInput(42) === '');
assert('truncates at MAX_INPUT_LENGTH', sanitiseInput('a'.repeat(MAX_INPUT_LENGTH + 50)).length === MAX_INPUT_LENGTH);
assert('short string unchanged', sanitiseInput('hi') === 'hi');
assert('MAX_INPUT_LENGTH is a positive number', typeof MAX_INPUT_LENGTH === 'number' && MAX_INPUT_LENGTH > 0);

// ---------------------------------------------------------------------------
// Suite 8: Copy safety — no medical claims in any response
// ---------------------------------------------------------------------------
console.log('\nSuite 8: Copy safety');

const FORBIDDEN_CLAIMS = [
  'diagnose', 'diagnoses', 'will cure', 'will treat', 'will prevent',
  'cardiac arrest', 'heart attack', 'predicts', 'guarantees',
  'replaces your doctor', 'replace a doctor', 'will fix', 'will detect',
];

// Check all TOPIC_MAP responses
TOPIC_MAP.forEach(function(entry, i) {
  const respLower = entry.response.toLowerCase();
  FORBIDDEN_CLAIMS.forEach(function(phrase) {
    assert(
      'topic[' + i + ']: no "' + phrase + '"',
      !respLower.includes(phrase)
    );
  });
});

// Check DEFAULT_RESPONSE
const defLower = DEFAULT_RESPONSE.toLowerCase();
assert('DEFAULT: no "diagnose"',  !defLower.includes('diagnose'));
assert('DEFAULT: no "treat"',     !defLower.includes('will treat'));

// EMERGENCY_RESPONSE must mention emergency services and not diagnose
assert('EMERGENCY: mentions emergency services', EMERGENCY_RESPONSE.toLowerCase().includes('emergency services'));
assert('EMERGENCY: no "diagnose"', !EMERGENCY_RESPONSE.toLowerCase().includes('diagnose'));
assert('EMERGENCY: says cannot assess emergencies', EMERGENCY_RESPONSE.toLowerCase().includes('cannot assess'));

// ---------------------------------------------------------------------------
// Suite 9: Exports and structure
// ---------------------------------------------------------------------------
console.log('\nSuite 9: Exports and structure');
assert('EMERGENCY_KEYWORDS is array', Array.isArray(EMERGENCY_KEYWORDS));
assert('EMERGENCY_KEYWORDS has entries', EMERGENCY_KEYWORDS.length >= 10);
assert('EMERGENCY_KEYWORDS are lowercase strings', EMERGENCY_KEYWORDS.every(function(k){ return typeof k === 'string' && k === k.toLowerCase(); }));
assert('TOPIC_MAP is array', Array.isArray(TOPIC_MAP));
assert('TOPIC_MAP has entries', TOPIC_MAP.length >= 8);
assert('each TOPIC_MAP entry has keywords array', TOPIC_MAP.every(function(e){ return Array.isArray(e.keywords) && e.keywords.length > 0; }));
assert('each TOPIC_MAP entry has response string', TOPIC_MAP.every(function(e){ return typeof e.response === 'string' && e.response.length > 20; }));
assert('EMERGENCY_RESPONSE is string', typeof EMERGENCY_RESPONSE === 'string' && EMERGENCY_RESPONSE.length > 20);
assert('DEFAULT_RESPONSE is string', typeof DEFAULT_RESPONSE === 'string' && DEFAULT_RESPONSE.length > 20);
assert('isEmergency is function',    typeof isEmergency === 'function');
assert('matchTopic is function',     typeof matchTopic === 'function');
assert('getCoachResponse is function', typeof getCoachResponse === 'function');
assert('sanitiseInput is function',  typeof sanitiseInput === 'function');

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n' + '─'.repeat(55));
console.log('BALA-B50 Ask BALA Coach tests: ' + (passed + failed) + ' total');
console.log(passed + ' passed  ·  ' + failed + ' failed');
if (failed === 0) {
  console.log('PASS bala-b50-ask-coach.test.js');
  process.exit(0);
} else {
  console.error('FAIL bala-b50-ask-coach.test.js');
  process.exit(1);
}
