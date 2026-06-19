#!/usr/bin/env node
'use strict';

// =============================================================================
// Chintu Brain Router — Stage 24
// -----------------------------------------------------------------------------
// The deterministic "brain" that makes Chintu Allegro feel alive. It turns a
// casual founder message ("hi", "bro what's next", "check everything") into a
// structured decision: a natural reply, the intent, the track, the risk level,
// the response type, the allowlisted bridge actions to run, the files likely
// involved, the safety gates, and the next suggested action.
//
// Hard properties (see scripts/chintu-brain-router.test.js):
//   * Pure logic. No network, no fs, no shell, no requires beyond this file.
//   * Deterministic: same input -> same output. No randomness, no clock.
//   * Only ever names bridge actions / named sequences that actually exist.
//     It NEVER executes anything itself — it only decides.
//   * Health-emergency phrasing ALWAYS overrides everything and routes the
//     founder to urgent care. Never gated behind a BALA score.
//   * No unsafe medical claims, ever (matches chintu-medical-claims.test.js).
//   * Unknown input is a friendly guiding reply — NOT a generic planning packet.
//
// The bridge (scripts/chintu-local-bridge.js) is the ONLY thing that executes
// the actions this router names, and only if they are on its allowlist.
// =============================================================================

// Allowlisted single bridge actions this router is allowed to name. Kept in
// sync with scripts/chintu-local-bridge.js ACTIONS. The bridge re-validates.
const KNOWN_ACTIONS = [
  'status', 'git_status', 'git_log',
  'release_guard', 'validate_app', 'run_validator_dry_run',
  'connector_readiness', 'connector_status',
  'prompt_xml_bala', 'prompt_xml_chintu', 'prompt_costar_both', 'prompt_acr_both',
  'action_packet_bala_sprint', 'action_packet_connector_check',
  'agent_orchestrator_dry_run',
  'open_allegro', 'open_bala_local', 'open_bala_public',
];

// Named multi-action sequences the bridge knows how to run. Kept in sync with
// the bridge's SEQUENCES map.
const KNOWN_SEQUENCES = {
  check_everything: ['git_status', 'validate_app', 'connector_readiness', 'release_guard'],
  bala_health_check: ['validate_app', 'release_guard'],
  chintu_health_check: ['git_status', 'connector_status', 'connector_readiness'],
  next_sprint: ['action_packet_bala_sprint', 'prompt_xml_bala'],
};

// Response types.
const TYPE = {
  CONVERSATION: 'conversational_reply',
  SINGLE: 'single_bridge_action',
  SEQUENCE: 'multi_bridge_sequence',
  PROMPT: 'prompt_generation',
  PACKET: 'action_packet',
  PARKED: 'parked_with_reason',
};

// Risk levels.
const RISK = {
  READ: 'safe_read',
  LOCAL: 'safe_local_action',
  CODE: 'code_change',
  SEND: 'external_send',
  HEALTH: 'health_sensitive',
};

// -----------------------------------------------------------------------------
// Text normalization — lowercase, collapse whitespace, strip most punctuation
// but keep word boundaries. Deterministic.
// -----------------------------------------------------------------------------
function normalize(text) {
  return String(text == null ? '' : text)
    .toLowerCase()
    .replace(/[`'"]/g, '')
    .replace(/[^a-z0-9\s?]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasAny(s, words) {
  for (const w of words) if (s.indexOf(w) !== -1) return true;
  return false;
}

// -----------------------------------------------------------------------------
// Health-emergency detector. This is the most important safety gate. If the
// message looks like an urgent physical symptom, we override every other
// intent and tell the founder to seek urgent care. We never run a score.
// -----------------------------------------------------------------------------
const EMERGENCY_PHRASES = [
  'chest pain', 'chest pressure', 'chest tight', 'tight chest',
  'cant breathe', 'can t breathe', 'cannot breathe', 'trouble breathing',
  'shortness of breath', 'short of breath', 'fainting', 'fainted', 'passed out',
  'severe weakness', 'numb on one side', 'face drooping', 'slurred speech',
  'stroke', 'heart attack', 'collapsed', 'unconscious',
];
function isEmergency(s) {
  return hasAny(s, EMERGENCY_PHRASES);
}

const EMERGENCY_REPLY =
  'This sounds urgent. Please stop and seek urgent or emergency care right now — ' +
  'contact your local emergency number or get to the nearest emergency department. ' +
  'Do not wait on any app or score for this. BALA is only a calm daily check-in guide ' +
  'and is not for emergencies.';

// -----------------------------------------------------------------------------
// Intent table. Order matters — first match wins (after the emergency gate).
// Each rule: { name, match(s), build(s) -> partial decision }.
// build() returns the decision-specific fields; the engine fills defaults.
// -----------------------------------------------------------------------------
const RULES = [
  // ---- Capabilities / help (check before greeting so "what can you do" wins)
  {
    name: 'capabilities',
    match: (s) =>
      hasAny(s, ['what can you do', 'what do you do', 'what can u do', 'help me', 'your commands',
        'list commands', 'what are you', 'how do you work', 'capabilities']) ||
      s === 'help' || s === 'commands' || s === '?',
    build: () => ({
      intent: 'capabilities',
      track: 'both',
      risk: RISK.READ,
      type: TYPE.CONVERSATION,
      reply:
        'Here is what I can do for you right now, bro:\n' +
        '• Check state — "check git", "bro what\'s next", "check everything"\n' +
        '• BALA health — "validate Bala", "run release guard"\n' +
        '• Connectors — "check connectors"\n' +
        '• Build work — "build next Bala sprint", "make Bala better"\n' +
        '• Prompts — "create Claude prompt", "create Codex prompt"\n' +
        '• Agents — "run agent board dry run"\n' +
        '• Open — "open Bala public link"\n' +
        'Everything I run locally is on a fixed safe allowlist. Try "check everything".',
      next: 'check_everything',
    }),
  },

  // ---- Improve score (BALA score explanation focus). Must come BEFORE
  //      next_sprint so "improve Bala score" routes to score clarity, not a
  //      generic sprint.
  {
    name: 'improve_score',
    match: (s) => hasAny(s, ['improve bala score', 'improve score', 'better score', 'fix score',
      'score model', 'scoring model', 'bala score', 'explain score', 'score explanation']),
    build: () => ({
      intent: 'improve_score',
      track: 'bala',
      risk: RISK.LOCAL,
      type: TYPE.PACKET,
      actions: ['action_packet_bala_sprint'],
      reply:
        'Good call. The BALA Score should stay a calm reflection guide, not a verdict. I\'ll draft a ' +
        'sprint packet focused on score clarity: which signals were available, which were missing, a ' +
        'confidence level, and the top non-medical contributors. Safe wording stays: the score is a ' +
        'reflection guide from your check-in signals, not a diagnosis or emergency monitor.',
      files: ['BALA_SCORE_MODEL_REVIEW_PLAN.md', 'index.html', 'app.js'],
      gates: ['Score is a guide, never a diagnosis', 'Emergency symptoms override the score'],
      next: 'validate_app',
    }),
  },

  // ---- Build the next BALA sprint (scoping + prompt, no code change here)
  {
    name: 'next_sprint',
    match: (s) =>
      hasAny(s, ['next bala sprint', 'next sprint', 'build next bala', 'build bala', 'bala sprint',
        'make bala better', 'improve bala', 'enhance bala', 'better bala', 'work on bala']),
    build: () => ({
      intent: 'next_sprint',
      track: 'bala',
      risk: RISK.LOCAL,
      type: TYPE.SEQUENCE,
      sequence: 'next_sprint',
      actions: KNOWN_SEQUENCES.next_sprint.slice(),
      reply:
        'On it. I\'ll prepare the next BALA sprint as a real action packet and an XML build ' +
        'prompt you can hand to Claude or Codex. I am NOT changing app code in this step — ' +
        'I am scoping the work and generating the plan. After you review it, say "validate Bala" ' +
        'to gate any change.',
      files: ['BALA_NEXT_SAFE_SPRINT_PLAN.md', 'BALA_PRODUCT_POLISH_QUEUE.md', 'index.html', 'app.js'],
      gates: ['No medical diagnosis copy', 'Health data stays local', 'Disclaimer on new screens'],
      next: 'validate_app',
    }),
  },

  // ---- Check everything (full safe sequence)
  {
    name: 'check_everything',
    match: (s) => hasAny(s, ['check everything', 'check all', 'run everything', 'full check',
      'check the whole', 'run all validations', 'run all checks', 'check it all']),
    build: () => ({
      intent: 'check_everything',
      track: 'both',
      risk: RISK.READ,
      type: TYPE.SEQUENCE,
      sequence: 'check_everything',
      actions: KNOWN_SEQUENCES.check_everything.slice(),
      reply:
        'Running the full safe sweep: git status, BALA app validation, connector readiness, then the ' +
        'release guard. These are all read-only / guard checks — nothing gets pushed or sent. I\'ll ' +
        'summarize what each one returns.',
      next: 'git_log',
    }),
  },

  // ---- Validator dry run (specific)
  {
    name: 'run_validator',
    match: (s) => hasAny(s, ['run validator', 'run the validator', 'validator dry', 'validator dryrun',
      'dry run validator', 'validator agent']),
    build: () => ({
      intent: 'run_validator',
      track: 'both',
      risk: RISK.LOCAL,
      type: TYPE.SINGLE,
      actions: ['run_validator_dry_run'],
      reply: 'Running the validator as a dry run through the bridge — no files get changed. I\'ll show you the output.',
      next: 'validate_app',
    }),
  },

  // ---- Release guard
  {
    name: 'release_guard',
    match: (s) => hasAny(s, ['release guard', 'release gate', 'run release', 'release check', 'can i push', 'safe to push']),
    build: () => ({
      intent: 'release_guard',
      track: 'both',
      risk: RISK.READ,
      type: TYPE.SINGLE,
      actions: ['release_guard'],
      reply: 'Running the release guard. It checks the gates that decide whether a push is safe. Read-only — it never pushes.',
      next: 'git_status',
    }),
  },

  // ---- Connectors
  {
    name: 'check_connectors',
    match: (s) => hasAny(s, ['check connector', 'check connectors', 'connector readiness',
      'connector check', 'connectors ready', 'are connectors']),
    build: () => ({
      intent: 'check_connectors',
      track: 'chintu',
      risk: RISK.READ,
      type: TYPE.SINGLE,
      actions: ['connector_readiness'],
      reply: 'Checking connector readiness. This is a local report only — it does not send anything anywhere. Real sends stay parked behind explicit activation.',
      next: 'connector_status',
    }),
  },
  {
    name: 'connector_status',
    match: (s) => hasAny(s, ['connector status', 'connector config', 'connector mode']),
    build: () => ({
      intent: 'connector_status',
      track: 'chintu',
      risk: RISK.READ,
      type: TYPE.SINGLE,
      actions: ['connector_status'],
      reply: 'Showing the local connector status (mode + which connectors are configured). No secrets are printed.',
      next: 'connector_readiness',
    }),
  },

  // ---- Validate BALA (broader than validator dry run)
  {
    name: 'validate_bala',
    match: (s) => hasAny(s, ['validate bala', 'validate app', 'check app', 'check bala', 'bala health',
      'review bala app', 'review bala', 'test bala', 'qa bala']),
    build: () => ({
      intent: 'validate_bala',
      track: 'bala',
      risk: RISK.READ,
      type: TYPE.SEQUENCE,
      sequence: 'bala_health_check',
      actions: KNOWN_SEQUENCES.bala_health_check.slice(),
      reply:
        'Validating BALA: I\'ll run the app validation and the release guard together so you get one clear ' +
        'health read. Both are read-only checks.',
      files: ['index.html', 'app.js', 'sw.js', 'styles.css'],
      next: 'release_guard',
    }),
  },

  // ---- Agent orchestrator
  {
    name: 'agent_board',
    match: (s) => hasAny(s, ['agent board', 'agent orchestrator', 'run agents', 'agent queue',
      'orchestrator dry', 'agent dry run', 'run the agents']),
    build: () => ({
      intent: 'agent_board',
      track: 'chintu',
      risk: RISK.LOCAL,
      type: TYPE.SINGLE,
      actions: ['agent_orchestrator_dry_run'],
      reply:
        'Running the agent board as a dry run. It coordinates the predefined safe agents (validator, ' +
        'connector-safety, BALA-UX, prompt-engineer, release-manager) and writes a run summary. Dry run ' +
        'only — it reports, it does not change files.',
      next: 'release_guard',
    }),
  },

  // ---- Prompt generation
  {
    name: 'prompt_claude',
    match: (s) => (hasAny(s, ['claude prompt', 'prompt for claude', 'make claude', 'create claude'])) ||
      (s.indexOf('claude') !== -1 && s.indexOf('prompt') !== -1 && s.indexOf('codex') === -1),
    build: () => ({
      intent: 'prompt_claude',
      track: 'bala',
      risk: RISK.LOCAL,
      type: TYPE.PROMPT,
      actions: ['prompt_xml_bala'],
      reply: 'Generating a structured XML build prompt for Claude (BALA track). You can copy it straight into a Claude session.',
      next: 'action_packet_bala_sprint',
    }),
  },
  {
    name: 'prompt_codex',
    match: (s) => hasAny(s, ['codex prompt', 'prompt for codex', 'make codex', 'create codex']) ||
      (s.indexOf('codex') !== -1 && s.indexOf('prompt') !== -1),
    build: () => ({
      intent: 'prompt_codex',
      track: 'chintu',
      risk: RISK.LOCAL,
      type: TYPE.PROMPT,
      actions: ['prompt_xml_chintu'],
      reply: 'Generating a structured XML build prompt for Codex (Chintu track). Copy-paste ready.',
      next: 'status',
    }),
  },

  // ---- Git / what's next
  {
    name: 'git_check',
    match: (s) => hasAny(s, ['check git', 'git status', 'git state', 'git log', 'whats changed', 'what changed']),
    build: () => ({
      intent: 'git_check',
      track: 'chintu',
      risk: RISK.READ,
      type: TYPE.SINGLE,
      actions: ['git_status'],
      reply: 'Pulling git status so you can see what\'s staged and what\'s pending.',
      next: 'git_log',
    }),
  },
  {
    name: 'whats_next',
    match: (s) => hasAny(s, ['whats next', 'what next', 'what now', 'whats now', 'bro what', 'what should i do',
      'where are we', 'where do we stand', 'next step', 'whats the plan']),
    build: () => ({
      intent: 'whats_next',
      track: 'both',
      risk: RISK.READ,
      type: TYPE.SINGLE,
      actions: ['git_status'],
      reply:
        'Let me look at the repo first so I\'m not guessing. I\'ll pull git status, then from there a good ' +
        'next move is usually "check everything" for a full health read or "validate Bala" before any change.',
      next: 'check_everything',
    }),
  },

  // ---- Open BALA
  {
    name: 'open_bala_public',
    match: (s) => (s.indexOf('open') !== -1 && s.indexOf('public') !== -1) ||
      hasAny(s, ['open bala public', 'bala public link', 'open the public link', 'open live bala']),
    build: () => ({
      intent: 'open_bala_public',
      track: 'bala',
      risk: RISK.LOCAL,
      type: TYPE.SINGLE,
      actions: ['open_bala_public'],
      reply: 'Opening the public BALA link in your browser.',
      next: 'status',
    }),
  },
  {
    name: 'open_bala_local',
    match: (s) => hasAny(s, ['open bala', 'open app', 'open index', 'open bala app', 'open bala local']),
    build: () => ({
      intent: 'open_bala_local',
      track: 'bala',
      risk: RISK.LOCAL,
      type: TYPE.SINGLE,
      actions: ['open_bala_local'],
      reply: 'Opening the local BALA app (index.html).',
      next: 'validate_app',
    }),
  },

  // ---- Report explainer (parked, health-sensitive)
  {
    name: 'explain_report_plan',
    match: (s) => hasAny(s, ['report plan', 'explain report', 'report explainer', 'report metric',
      'explain my report', 'read my report', 'lab report', 'blood report', 'x ray', 'xray', 'scan report']),
    build: () => ({
      intent: 'explain_report_plan',
      track: 'bala',
      risk: RISK.HEALTH,
      type: TYPE.PARKED,
      reply:
        'Here is the honest boundary: BALA can help you ORGANIZE report values and prepare good questions ' +
        'for your doctor. It cannot diagnose conditions, read scans, or tell you what treatment to take — ' +
        'and that stays parked on purpose for safety. The plan for a safe "Report Explainer" lives in ' +
        'BALA_REPORT_METRIC_EXPLAINER_PLAN.md. Want me to scope the safe, non-diagnostic version as a sprint?',
      files: ['BALA_REPORT_METRIC_EXPLAINER_PLAN.md', 'BALA_REPORT_EXPLAINER_SAFETY_PLAN.md'],
      gates: ['No diagnosis', 'No treatment advice', 'No scan/X-ray reading', 'No cloud upload of reports'],
      next: 'next_sprint',
    }),
  },

  // ---- Greeting (broad, so keep late)
  {
    name: 'greeting',
    match: (s) => s === '' || /^(hi|hey|hello|yo|hii+|heya|hola|sup|namaste|good morning|good evening|good afternoon)\b/.test(s) ||
      hasAny(s, ['hi bro', 'hey bro', 'hello chintu', 'hey chintu', 'you there', 'are you alive', 'you alive']),
    build: () => ({
      intent: 'greeting',
      track: 'both',
      risk: RISK.READ,
      type: TYPE.CONVERSATION,
      reply:
        'Hey bro, Chintu is live. I can check BALA, run validations, check connectors, generate prompts, ' +
        'or build the next sprint. Try saying "validate Bala", "check connectors", or "check everything".',
      next: 'check_everything',
    }),
  },
];

// -----------------------------------------------------------------------------
// Fallback for unknown input. The key behaviour change for Stage 24:
// unknown text becomes a friendly, guiding reply — NOT a generic planning packet
// and NEVER a fake claim that work was done.
// -----------------------------------------------------------------------------
function fallback(original) {
  const snippet = String(original || '').trim().slice(0, 80);
  return {
    intent: 'unknown',
    track: 'both',
    risk: RISK.READ,
    type: TYPE.CONVERSATION,
    reply:
      'I hear you' + (snippet ? ' on "' + snippet + '"' : '') + ', but I don\'t have a confident action for ' +
      'that one yet — so I won\'t fake a result. Here\'s what works well: "check everything", ' +
      '"validate Bala", "check connectors", "build next Bala sprint", or "create Claude prompt". ' +
      'Say "what can you do" for the full list.',
    actions: [],
    next: 'check_everything',
  };
}

// -----------------------------------------------------------------------------
// Engine. Returns a complete, stable decision object.
// -----------------------------------------------------------------------------
function route(message) {
  const original = String(message == null ? '' : message);
  const s = normalize(original);

  // 1) Emergency override — always first, always wins.
  if (isEmergency(s)) {
    return finalize(original, {
      intent: 'health_emergency',
      track: 'bala',
      risk: RISK.HEALTH,
      type: TYPE.PARKED,
      reply: EMERGENCY_REPLY,
      actions: [],
      next: null,
      gates: ['Emergency symptoms always route to urgent care', 'Never gated behind a BALA score'],
    });
  }

  // 2) Intent rules — first match wins.
  for (const rule of RULES) {
    if (rule.match(s)) {
      return finalize(original, rule.build(s));
    }
  }

  // 3) Friendly guiding fallback.
  return finalize(original, fallback(original));
}

// Fill defaults, validate action names, and lock the shape.
function finalize(original, partial) {
  const actions = Array.isArray(partial.actions) ? partial.actions.slice() : [];
  // If a sequence is named, expand it (defensive — engine usually passes both).
  let resolvedActions = actions;
  if (partial.sequence && KNOWN_SEQUENCES[partial.sequence] && resolvedActions.length === 0) {
    resolvedActions = KNOWN_SEQUENCES[partial.sequence].slice();
  }
  // Safety: drop any action that is not actually known to the bridge.
  resolvedActions = resolvedActions.filter((a) => KNOWN_ACTIONS.indexOf(a) !== -1);

  const next = partial.next == null ? null : partial.next;

  return {
    ok: true,
    message: original,
    normalized: normalize(original),
    intent: partial.intent,
    track: partial.track,
    risk: partial.risk,
    responseType: partial.type,
    reply: partial.reply,
    sequence: partial.sequence || null,
    actions: resolvedActions,
    filesLikely: Array.isArray(partial.files) ? partial.files.slice() : [],
    safetyGates: Array.isArray(partial.gates) ? partial.gates.slice() : defaultGates(partial),
    nextSuggestedAction: next,
  };
}

function defaultGates(partial) {
  const base = ['Localhost-only bridge', 'Allowlisted actions only', 'No external send', 'No secrets printed'];
  if (partial.track === 'bala' || partial.track === 'both') {
    base.push('No medical claims — BALA is a check-in guide, not a diagnosis or emergency monitor');
  }
  return base;
}

// CLI smoke test: `node scripts/chintu-brain-router.js "hi"`
function cli() {
  const msg = process.argv.slice(2).join(' ') || 'hi';
  const out = route(msg);
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
}

module.exports = {
  route,
  normalize,
  isEmergency,
  KNOWN_ACTIONS,
  KNOWN_SEQUENCES,
  TYPE,
  RISK,
};

if (require.main === module) {
  cli();
}
