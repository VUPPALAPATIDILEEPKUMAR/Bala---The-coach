#!/usr/bin/env node
'use strict';

// =============================================================================
// Chintu Brain Router test — Stage 24
// Proves the deterministic router's behaviour and safety contract.
// Pure logic, read-only, no network.
// =============================================================================

const assert = require('assert');
const brain = require('./chintu-brain-router.js');

let fails = 0;
function ok(cond, msg) {
  if (cond) { console.log('  PASS: ' + msg); }
  else { fails++; console.error('  FAIL: ' + msg); }
}

console.log('Chintu Brain Router test\n');

// --- Shape ------------------------------------------------------------------
console.log('Output shape:');
const r = brain.route('hi');
for (const key of ['ok', 'message', 'intent', 'track', 'risk', 'responseType', 'reply', 'actions', 'nextSuggestedAction', 'safetyGates', 'filesLikely']) {
  ok(Object.prototype.hasOwnProperty.call(r, key), 'result has "' + key + '"');
}
ok(Array.isArray(r.actions), 'actions is an array');

// --- Determinism ------------------------------------------------------------
console.log('\nDeterminism:');
ok(JSON.stringify(brain.route('check everything')) === JSON.stringify(brain.route('check everything')),
  'same input gives identical output');

// --- Greeting (the headline fix) -------------------------------------------
console.log('\nGreeting:');
const hi = brain.route('hi');
ok(hi.intent === 'greeting', '"hi" is classified as greeting (not a planning packet)');
ok(hi.responseType === 'conversational_reply', '"hi" is conversational');
ok(hi.actions.length === 0, '"hi" runs no bridge actions');
ok(/chintu is live/i.test(hi.reply), '"hi" reply is the live founder-tone greeting');
ok(brain.route('hey bro').intent === 'greeting', '"hey bro" is a greeting');
ok(brain.route('').intent === 'greeting', 'empty input is treated as a greeting, not an error');

// --- What's next ------------------------------------------------------------
console.log('\nWhat\'s next:');
const next = brain.route('bro what\'s next');
ok(next.intent === 'whats_next', '"bro what\'s next" -> whats_next');
ok(next.actions[0] === 'git_status', 'whats_next runs git_status first');

// --- Check everything -------------------------------------------------------
console.log('\nCheck everything:');
const ce = brain.route('check everything');
ok(ce.intent === 'check_everything', '"check everything" -> check_everything');
ok(ce.responseType === 'multi_bridge_sequence', 'it is a multi-action sequence');
ok(JSON.stringify(ce.actions) === JSON.stringify(['git_status', 'validate_app', 'connector_readiness', 'release_guard']),
  'sequence is git_status,validate_app,connector_readiness,release_guard');

// --- Single intents ---------------------------------------------------------
console.log('\nSingle intents:');
ok(brain.route('run validator').actions[0] === 'run_validator_dry_run', '"run validator" -> run_validator_dry_run');
ok(brain.route('check connectors').actions[0] === 'connector_readiness', '"check connectors" -> connector_readiness');
ok(brain.route('Telegram Dry Run Guide').intent === 'telegram_dry_run_guide', '"Telegram Dry Run Guide" -> telegram_dry_run_guide');
ok(brain.route('connector setup check').intent === 'connector_setup_check', '"connector setup check" -> connector_setup_check');
ok(brain.route('github status').actions[0] === 'github_status', '"github status" -> github_status');
ok(brain.route('repo summary').actions[0] === 'github_repo_summary', '"repo summary" -> github_repo_summary');
ok(brain.route('run release guard').actions[0] === 'release_guard', '"run release guard" -> release_guard');
ok(brain.route('check git').actions[0] === 'git_status', '"check git" -> git_status');
ok(brain.route('validate Bala').sequence === 'bala_health_check', '"validate Bala" -> bala_health_check sequence');
ok(brain.route('create Claude prompt').actions[0] === 'prompt_xml_bala', '"create Claude prompt" -> prompt_xml_bala');
ok(brain.route('create Codex prompt').actions[0] === 'prompt_xml_chintu', '"create Codex prompt" -> prompt_xml_chintu');
ok(brain.route('run agent board dry run').actions[0] === 'agent_orchestrator_dry_run', 'agent board -> agent_orchestrator_dry_run');
ok(brain.route('open Bala public link').actions[0] === 'open_bala_public', '"open Bala public link" -> open_bala_public');

// --- Build / improve --------------------------------------------------------
console.log('\nBuild / improve:');
const better = brain.route('make Bala better');
ok(better.intent === 'next_sprint', '"make Bala better" -> next_sprint');
ok(JSON.stringify(better.actions) === JSON.stringify(['action_packet_bala_sprint', 'prompt_xml_bala']),
  'next_sprint = action packet + xml prompt (no fake code change)');
ok(brain.route('improve Bala score').intent === 'improve_score', '"improve Bala score" -> improve_score');

// --- Capabilities -----------------------------------------------------------
console.log('\nCapabilities:');
ok(brain.route('what can you do').intent === 'capabilities', '"what can you do" -> capabilities');
ok(brain.route('what can you do').actions.length === 0, 'capabilities runs nothing, just explains');

// --- Unknown (must NOT be a fake packet) -----------------------------------
console.log('\nUnknown input:');
const unk = brain.route('asdf qwerty zxcv');
ok(unk.intent === 'unknown', 'gibberish -> unknown');
ok(unk.responseType === 'conversational_reply', 'unknown is conversational, not a planning packet');
ok(unk.actions.length === 0, 'unknown runs no actions');
ok(/dont have a confident action|don.t have a confident action/i.test(unk.reply), 'unknown reply is honest about not knowing');
ok(!/i ran|i executed|completed the/i.test(unk.reply), 'unknown reply makes no fake "I ran it" claim');

// --- Emergency override (critical safety) ----------------------------------
console.log('\nEmergency override:');
for (const phrase of ['I have chest pain', 'bro I cant breathe', 'someone is fainting', 'stroke symptoms']) {
  const e = brain.route(phrase);
  ok(e.intent === 'health_emergency', '"' + phrase + '" -> health_emergency');
  ok(e.risk === 'health_sensitive', '"' + phrase + '" risk is health_sensitive');
  ok(e.actions.length === 0, 'emergency runs no bridge actions');
  ok(/urgent or emergency care/i.test(e.reply), 'emergency reply routes to urgent care');
}
// Emergency beats everything else even if other keywords are present.
ok(brain.route('check everything but I have chest pain').intent === 'health_emergency',
  'emergency phrase overrides "check everything"');

// --- Only names real actions ------------------------------------------------
console.log('\nAction integrity:');
const sampleInputs = ['hi', 'check everything', 'validate bala', 'run validator', 'make bala better',
  'create claude prompt', 'create codex prompt', 'open bala public link', 'run agent board dry run',
  'github status', 'repo summary',
  'check connectors', 'what can you do', 'asdf'];
let allReal = true;
for (const m of sampleInputs) {
  for (const a of brain.route(m).actions) {
    if (brain.KNOWN_ACTIONS.indexOf(a) === -1) { allReal = false; console.error('    unknown action: ' + a + ' from "' + m + '"'); }
  }
}
ok(allReal, 'every action the router names is a known bridge action');

// --- No unsafe medical claims in any reply ---------------------------------
console.log('\nMedical-claim safety:');
const unsafe = [/diagnoses? your/i, /replace[s]? your doctor/i, /emergency monitoring (enabled|active|on)/i,
  /clinically proven/i, /fda[\s-]approved/i, /cures? (diabetes|cancer|heart disease)/i];
let clean = true;
for (const m of sampleInputs.concat(['explain report plan', 'I have chest pain'])) {
  const reply = brain.route(m).reply;
  for (const re of unsafe) if (re.test(reply)) { clean = false; console.error('    unsafe phrase for "' + m + '"'); }
}
ok(clean, 'no router reply contains an unsafe medical claim');

console.log('');
if (fails === 0) {
  console.log('Brain router: PASS');
  process.exit(0);
} else {
  console.error('Brain router: FAIL (' + fails + ' issue(s))');
  process.exit(1);
}
