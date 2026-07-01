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
  'github_status', 'github_repo_summary', 'runtime_snapshot', 'os_snapshot', 'creator_pack_latest_trip', 'trip_video_draft', 'youtube_episode_pack_latest', 'trip_video_review',
  'prompt_xml_bala', 'prompt_xml_chintu', 'prompt_costar_both', 'prompt_acr_both', 'prompt_founder_beast_both', 'prompt_overnight_beast_both',
  'action_packet_bala_sprint', 'action_packet_connector_check', 'action_packet_overnight_beast',
  'agent_orchestrator_dry_run', 'morning_operator_report',
  'open_allegro', 'open_bala_local', 'open_bala_public',
  'bala_ask_skill',
  'bala_weekly_skill',
  'hn_brief_skill',
  'chintu_git_push',
];

// Named multi-action sequences the bridge knows how to run. Kept in sync with
// the bridge's SEQUENCES map.
const KNOWN_SEQUENCES = {
  check_everything: ['git_status', 'validate_app', 'connector_readiness', 'release_guard'],
  bala_health_check: ['validate_app', 'release_guard'],
  chintu_health_check: ['git_status', 'connector_status', 'connector_readiness'],
  next_sprint: ['action_packet_bala_sprint', 'prompt_xml_bala'],
  creator_story_sweep: ['creator_pack_latest_trip', 'trip_video_draft', 'youtube_episode_pack_latest', 'trip_video_review'],
  founder_beast_stack: ['validate_app', 'connector_readiness', 'agent_orchestrator_dry_run', 'action_packet_bala_sprint', 'prompt_founder_beast_both'],
  agent_parallel_wave: ['run_validator_dry_run', 'connector_readiness', 'validate_app', 'prompt_xml_bala'],
  agent_release_wave: ['release_guard'],
  overnight_beast_stack: ['validate_app', 'github_repo_summary', 'connector_readiness', 'agent_orchestrator_dry_run', 'action_packet_overnight_beast', 'prompt_overnight_beast_both'],
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
      (hasAny(s, ['what can you do', 'what do you do', 'what can u do', 'help me', 'your commands',
        'list commands', 'what are you', 'how do you work', 'capabilities']) &&
        !hasAny(s, ['what are you doing', 'what are u doing', 'what is chintu doing', 'what is going on', 'whats going on', 'status update', 'live status', 'report me'])) ||
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
    name: 'runtime_snapshot',
    match: (s) =>
      hasAny(s, ['what are you doing', 'what are u doing', 'what are you checking', 'what is going on',
        'whats going on', 'what is chintu doing', 'status update', 'live status', 'report me', 'current status']),
    build: () => ({
      intent: 'runtime_snapshot',
      track: 'chintu',
      risk: RISK.READ,
      type: TYPE.SINGLE,
      actions: ['runtime_snapshot'],
      reply:
        'Pulling the live runtime brief now. I will read the local bridge truth, the latest live agent wave, the automation lane, and the most recent founder-safe action so you can see what Chintu is actually doing on this machine.',
      files: ['scripts/chintu-runtime-brief.js', 'scripts/chintu-local-bridge.js', 'CHINTU_AGENT_RUNS/latest_agent_wave_summary.json'],
      gates: ['Local-only runtime truth', 'No fake green checks', 'No secrets printed'],
      next: 'agent_parallel_wave',
    }),
  },

  {
    name: 'os_snapshot',
    match: (s) =>
      hasAny(s, ['os snapshot', 'chintu os', 'agent os', 'system snapshot', 'show the os snapshot']),
    build: () => ({
      intent: 'os_snapshot',
      track: 'chintu',
      risk: RISK.READ,
      type: TYPE.SINGLE,
      actions: ['os_snapshot'],
      reply:
        'Pulling the Chintu OS snapshot now. I will summarize the live local action count, workflow count, automation scripts, connector gate state, and creator lane readiness from this machine only.',
      files: ['scripts/chintu-os-snapshot.js', 'CHINTU_OUTBOX/latest_os_snapshot.json', 'scripts/chintu-local-bridge.js'],
      gates: ['Local-only summary', 'No secrets printed', 'No fake readiness'],
      next: 'creator_pack_latest_trip',
    }),
  },

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

  {
    name: 'morning_operator_report',
    match: (s) =>
      hasAny(s, ['morning operator', 'morning report', 'send morning report', 'wake-up report',
        'wake up report', 'founder report now', 'run morning report']),
    build: () => ({
      intent: 'morning_operator_report',
      track: 'chintu',
      risk: RISK.LOCAL,
      type: TYPE.SINGLE,
      actions: ['morning_operator_report'],
      reply:
        'Running the morning operator now. I will refresh the live founder brief, run the local operator waves, write the report artifact, and send the founder update through the already-gated Telegram lane.',
      files: ['scripts/chintu-morning-operator.js', 'CHINTU_OUTBOX/latest_morning_operator_report.json', 'CHINTU_OUTBOX/latest_founder_message.md'],
      gates: ['No secrets printed', 'Report links must stay local and real', 'BALA stays health-awareness only'],
      next: 'release_guard',
    }),
  },

  {
    name: 'creator_story_sweep',
    match: (s) =>
      hasAny(s, ['go to that album', 'use that album', 'scan that album', 'full trip album',
        'search each photo', 'each photo', 'use all trip photos', 'use all photos',
        'all 449 items', 'all 469 items', 'why only 24 sec', 'why only 26 sec',
        'why only 24 second', 'why only 26 second', 'longer video', 'full trip video']),
    build: () => ({
      intent: 'creator_story_sweep',
      track: 'chintu',
      risk: RISK.LOCAL,
      type: TYPE.SEQUENCE,
      sequence: 'creator_story_sweep',
      actions: KNOWN_SEQUENCES.creator_story_sweep.slice(),
      reply:
        'Sweeping the full local trip album window now. I will rebuild the creator pack from the Apple photo-library index, write the album inventory, render a longer private draft, and refresh the episode pack plus review cut so you are not stuck with a tiny 24-second slice.',
      files: ['scripts/chintu-private-media.js', 'scripts/chintu-creator-pack.js', 'scripts/chintu-trip-video-draft.js', 'scripts/chintu-youtube-episode-pack.js'],
      gates: ['Local media only', 'No upload happens here', 'No personal data leaves this machine'],
      next: 'trip_video_review',
    }),
  },

  {
    name: 'creator_pack_latest_trip',
    match: (s) =>
      hasAny(s, ['creator pack', 'youtube pack', 'trip pack', 'latest trip pack', 'build creator pack', 'make youtube pack']),
    build: () => ({
      intent: 'creator_pack_latest_trip',
      track: 'chintu',
      risk: RISK.LOCAL,
      type: TYPE.SINGLE,
      actions: ['creator_pack_latest_trip'],
      reply:
        'Building the latest trip creator pack now. I will sweep the wider local Apple photo-library timeline, write the full trip inventory, generate stronger title ideas, a story-first shot order, a voiceover starter, and a free-tool edit stack for the founder review loop.',
      files: ['scripts/chintu-creator-pack.js', 'CHINTU_OUTBOX/latest_creator_pack.json', 'enhancements/06272026'],
      gates: ['Local media only', 'No upload happens here', 'Telegram send stays a separate explicit step'],
      next: 'os_snapshot',
    }),
  },

  {
    name: 'youtube_episode_pack_latest',
    match: (s) =>
      hasAny(s, ['episode pack', 'release pack', 'youtube episode pack', 'upload pack', 'publish pack']),
    build: () => ({
      intent: 'youtube_episode_pack_latest',
      track: 'chintu',
      risk: RISK.LOCAL,
      type: TYPE.SINGLE,
      actions: ['youtube_episode_pack_latest'],
      reply:
        'Building the latest YouTube episode pack now. I will turn the local draft plus creator pack into a release-ready upload plan with visibility guidance, the title, thumbnail direction, and the exact next move.',
      files: ['scripts/chintu-youtube-episode-pack.js', 'CHINTU_OUTBOX/latest_youtube_episode_pack.json', 'CHINTU_OUTBOX/latest_trip_video_draft.json'],
      gates: ['Local files only', 'No upload happens here', 'Visibility guidance must stay real'],
      next: 'trip_video_draft',
    }),
  },

  {
    name: 'trip_video_draft',
    match: (s) =>
      hasAny(s, ['trip video', 'video draft', 'build the video', 'make the video', 'draft video']),
    build: () => ({
      intent: 'trip_video_draft',
      track: 'chintu',
      risk: RISK.LOCAL,
      type: TYPE.SINGLE,
      actions: ['trip_video_draft'],
      reply:
        'Building the private trip video draft now. I will use a wider local trip image sweep, render a longer vertical MP4 locally with ffmpeg, and write a voiceover guide so you can record your narration on top of a real draft without the selfie-heavy noise.',
      files: ['scripts/chintu-trip-video-draft.js', 'CHINTU_OUTBOX/latest_trip_video_draft.json', 'CHINTU_OUTBOX/latest_trip_voiceover.txt'],
      gates: ['Private local render only', 'No upload happens here', 'No personal data leaves this machine'],
      next: 'creator_pack_latest_trip',
    }),
  },

  {
    name: 'trip_video_review',
    match: (s) =>
      hasAny(s, ['review video', 'polish the video', 'final review cut', 'creator review cut', 'go beyond video']),
    build: () => ({
      intent: 'trip_video_review',
      track: 'chintu',
      risk: RISK.LOCAL,
      type: TYPE.SINGLE,
      actions: ['trip_video_review'],
      reply:
        'Polishing the review video now. I will take the local wider trip draft, burn in a cleaner review overlay, and leave you with a real watchable cut for the morning review loop.',
      files: ['scripts/chintu-trip-video-review.js', 'CHINTU_OUTBOX/latest_trip_review_video.json', 'CHINTU_OUTBOX/trip-video-draft'],
      gates: ['Local render only', 'No upload happens here', 'Review copy stays honest'],
      next: 'youtube_episode_pack_latest',
    }),
  },

  {
    name: 'founder_beast_mode',
    match: (s) =>
      hasAny(s, ['founder beast mode', 'beast mode', 'jarvis mode', 'local jarvis', 'one single prompt',
        'single prompt', 'ultra mode', 'go beyond', 'work parallel']),
    build: () => ({
      intent: 'founder_beast_mode',
      track: 'both',
      risk: RISK.LOCAL,
      type: TYPE.SEQUENCE,
      sequence: 'founder_beast_stack',
      actions: KNOWN_SEQUENCES.founder_beast_stack.slice(),
      reply:
        'Switching into founder beast mode. I will run the live local validation stack first, then generate ' +
        'the stronger both-track founder prompt so you have one real prompt for execution, verification, and ' +
        'the next move. Everything stays local and approval-gated. No fake green checks.',
      files: ['CHINTU_ALLEGRO.html', 'scripts/chintu-local-bridge.js', 'scripts/chintu-prompt-engine.js', 'index.html', 'app.js'],
      gates: ['No fake green checks', 'No secrets printed', 'BALA stays health-awareness only'],
      next: 'prompt_founder_beast_both',
    }),
  },

  {
    name: 'agent_parallel_wave',
    match: (s) =>
      hasAny(s, ['run agent wave', 'parallel wave', 'run parallel wave', 'run agent board wave']) || s === 'run agent board',
    build: () => ({
      intent: 'agent_parallel_wave',
      track: 'both',
      risk: RISK.LOCAL,
      type: TYPE.SEQUENCE,
      sequence: 'agent_parallel_wave',
      actions: KNOWN_SEQUENCES.agent_parallel_wave.slice(),
      reply:
        'Running the local parallel agent wave: validator signal, connector readiness, BALA validation, and prompt generation. ' +
        'This is still local-only and dry-run-safe. Release decisions stay in a separate human review wave.',
      files: ['CHINTU_AGENT_RUNS/latest_orchestrator_summary.json', 'scripts/chintu-local-bridge.js', 'CHINTU_ALLEGRO.html'],
      gates: ['No auto-push', 'No real connector send', 'BALA stays health-awareness only'],
      next: 'release_guard',
    }),
  },

  {
    name: 'overnight_beast_mode',
    match: (s) =>
      hasAny(s, ['overnight beast', 'night shift', 'while i sleep', 'before i wake up', 'morning review pack', 'overnight sweep']),
    build: () => ({
      intent: 'overnight_beast_mode',
      track: 'both',
      risk: RISK.LOCAL,
      type: TYPE.SEQUENCE,
      sequence: 'overnight_beast_stack',
      actions: KNOWN_SEQUENCES.overnight_beast_stack.slice(),
      reply:
        'Switching into overnight beast mode. I will run the safe night-shift sweep: validator signal, repo summary, connector readiness, agent board, overnight packet, and the overnight founder prompt. Morning review stays honest: blockers first, real artifacts only, no fake completion.',
      files: ['CHINTU_ALLEGRO.html', 'scripts/chintu-local-bridge.js', 'scripts/chintu-brain-router.js', 'scripts/chintu-prompt-engine.js', 'scripts/chintu-action-packet.js', 'app.js'],
      gates: ['No auto-push', 'No secret printing', 'No real send while sleeping', 'BALA stays health-awareness only'],
      next: 'prompt_overnight_beast_both',
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
    name: 'telegram_dry_run_guide',
    match: (s) => hasAny(s, ['telegram dry run guide', 'telegram setup', 'prepare telegram first test',
      'phone connector guide', 'phone dry run guide', 'telegram fixture guide']),
    build: () => ({
      intent: 'telegram_dry_run_guide',
      track: 'chintu',
      risk: RISK.READ,
      type: TYPE.CONVERSATION,
      reply:
        'Here is the safe Telegram path, bro: first run `node scripts/chintu-telegram-runner.js --fixture scripts\\\\fixtures\\\\telegram-check-everything.json --dry-run`. ' +
        'Later, if you set `TELEGRAM_BOT_TOKEN`, you can poll once with `node scripts/chintu-telegram-runner.js --poll-once --dry-run`. ' +
        'Live send stays OFF unless you explicitly set the Telegram allowlist env vars, `CHINTU_TELEGRAM_SEND_ENABLED=1`, and pass `--send`. Default mode is preview only.',
      next: 'connector_status',
    }),
  },
  {
    name: 'connector_setup_check',
    match: (s) => hasAny(s, ['connector setup check', 'setup check connectors', 'connector checklist']),
    build: () => ({
      intent: 'connector_setup_check',
      track: 'chintu',
      risk: RISK.READ,
      type: TYPE.CONVERSATION,
      reply:
        'Here is the safe connector setup check path, bro: run `node scripts/chintu-telegram-runner.js --setup-check` for Telegram readiness, then run `node scripts/chintu-github-connector.js --status` for the GitHub dry-run lane. Both are preview-only and print no secrets.',
      next: 'github_status',
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
  {
    name: 'github_status',
    match: (s) => hasAny(s, ['github status', 'gh status', 'repo status', 'github connector status']),
    build: () => ({
      intent: 'github_status',
      track: 'chintu',
      risk: RISK.READ,
      type: TYPE.SINGLE,
      actions: ['github_status'],
      reply: 'Checking the local GitHub dry-run status: gh availability, auth state, and safe repo context. No API writes, no pushes.',
      next: 'github_repo_summary',
    }),
  },
  {
    name: 'github_repo_summary',
    match: (s) => hasAny(s, ['repo summary', 'github repo summary', 'gh repo summary']),
    build: () => ({
      intent: 'github_repo_summary',
      track: 'chintu',
      risk: RISK.READ,
      type: TYPE.SINGLE,
      actions: ['github_repo_summary'],
      reply: 'Summarizing the local GitHub repo state for dry-run planning: branch, remotes, recent commits, and dirty files only.',
      next: 'github_status',
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

  // ---- BALA health-awareness questions (Stage 37)

  // ---- BALA weekly digest (C73) -- reads local bala-export.json, returns 7-day summary.
  // Must come BEFORE bala_ask so "my health this week" / "bala digest" routes here.
  // Pure local file-read skill — no network, no Telegram call, no secrets.
  {
    name: 'bala_weekly',
    match: (s) => hasAny(s, [
      'bala digest', 'weekly digest', 'my health this week', 'this week',
      'health this week', 'weekly summary', 'bala summary', 'week summary',
      'how was my week', 'how did i do this week', 'my week', 'my bala week',
      'weekly report', 'bala report', 'bala status', 'health status',
    ]),
    build: () => ({
      intent: 'bala_weekly',
      track: 'bala',
      risk: RISK.READ,
      type: TYPE.SINGLE,
      actions: ['bala_weekly_skill'],
      reply:
        'Reading your local BALA data now — I\'ll send your 7-day digest in a moment.',
      gates: [
        'Reads local bala-export.json only — no network, no external API',
        'Health data never leaves your device',
        'Safety footer always included in reply',
        'No medical claims, no diagnosis, no risk predictions',
      ],
    }),
  },

  // ---- HN Morning Brief (C74) -- fetches top HN headlines, dry-run safe.
  // Free Algolia API, no key. CHINTU_TELEGRAM_SEND_ENABLED guard in skill itself.
  {
    name: 'hn_brief',
    match: (s) => hasAny(s, [
      'hn brief', 'hacker news', 'morning news', 'tech news', 'top stories',
      'hn digest', 'news brief', 'morning brief', 'hn today', 'hn headlines',
      'what is trending', 'trending tech', 'top hn', 'news today',
    ]),
    build: () => ({
      intent: 'hn_brief',
      track: 'chintu',
      risk: RISK.READ,
      type: TYPE.SINGLE,
      actions: ['hn_brief_skill'],
      reply:
        'Fetching top HN stories now — I\'ll format the morning brief for you.',
      gates: [
        'Reads from Algolia HN API only (free, public, no key)',
        'Dry-run output only — Telegram send is human-gated',
        'No secrets, no paid APIs, no tracking',
      ],
      files: ['scripts/chintu-hn-skill.js'],
      next: 'hn_brief_skill',
    }),
  },

  // Handles user queries about their health signals — routed to bala_ask_skill
  // in the Telegram runner which calls respondToBALAQuery() for a safe reply.
  // Must come AFTER improve_score / next_sprint / validate_bala so those more
  // specific routes still win for sprint-planning and validation intents.
  {
    name: 'bala_ask',
    match: (s) => hasAny(s, [
      // HRV
      'hrv', 'heart rate variability', 'heart rate var', 'hrv low', 'hrv high',
      'hrv trend', 'hrv drop', 'low hrv', 'high hrv',
      // Sleep / Recovery
      'deep sleep', 'rem sleep', 'light sleep', 'sleep quality', 'sleep score',
      'how did i sleep', 'poor sleep', 'bad sleep', 'night waking',
      'tired', 'fatigue', 'exhausted', 'woke up',
      // Resting HR
      'resting heart rate', 'resting hr', 'rhr', 'heart rate at rest',
      'heart rate high', 'heart rate low', 'heart rate trend', 'elevated heart rate',
      // SpO2
      'spo2', 'blood oxygen', 'oxygen level', 'oxygen saturation', 'o2 level',
      // Activity / Steps
      'step count', 'step goal', 'active minutes', 'daily activity',
      // Score — awareness queries (not improve/model)
      'my score', 'what is my score', 'what does my score mean',
      'score today', 'score meaning', 'score low', 'score high',
      // BALA Coach
      'ask bala', 'bala coach', 'what should i do', 'what do i do',
      'coach advice', 'coach guidance', 'coach tip', 'tip today',
      'what bala says', 'what does bala say', 'bala recommend', 'bala guide',
      // Doctor summary
      'doctor summary', 'doctor report', 'show doctor', 'share with doctor',
      'doctor ready', 'health summary', 'summary for doctor',
      // Privacy
      'privacy', 'my data', 'is my data safe', 'who sees my data',
      'data stored', 'local only', 'data sent', 'data sharing',
      // What is BALA
      'what is bala', 'tell me about bala', 'about bala', 'how does bala work',
      'bala app', 'bala features', 'what can bala do', 'bala help',
    ]),
    build: () => ({
      intent: 'bala_ask',
      track: 'bala',
      risk: RISK.READ,
      type: TYPE.SINGLE,
      actions: ['bala_ask_skill'],
      reply:
        'Looking at your BALA signals now. One moment — I\'ll give you a calm, clear awareness ' +
        'response based on what BALA knows about this topic.',
      gates: [
        'Pure-logic BALA skill — no network, no fs, no shell',
        'All replies carry non-medical safety footer',
        'Emergency phrases always escalate to urgent-care gate',
        'No diagnosis, treatment, or medical claims ever',
      ],
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
        'Running the agent board summary as a dry run. It coordinates the predefined safe agents (validator, ' +
        'connector-safety, BALA-UX, prompt-engineer, release-manager) and writes an operator summary. Dry run ' +
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
    name: 'git_push',
    // Exact imperative phrases only. Broad terms like 'push' alone are too ambiguous.
    // Triggers RISK.CODE -> requires_approval trace -> Stage 35 enqueue
    // -> Stage 38 Telegram confirmation reply with the exact APPROVE phrase.
    match: (s) => hasAny(s, [
      'push now', 'do the push', 'push branch', 'push main', 'push to main',
      'push origin', 'push to origin', 'push to github', 'push to git',
      'release now', 'ship it', 'deploy now', 'publish now',
      'git push now', 'run git push', 'execute push',
    ]),
    build: () => ({
      intent: 'git_push',
      track: 'chintu',
      risk: RISK.CODE,
      type: TYPE.SINGLE,
      actions: ['chintu_git_push'],
      reply:
        'I have queued a git push for your approval. This is irreversible without a revert commit. '
        + 'Reply with the exact approval phrase shown in your pending-approvals queue to execute. '
        + 'If this was not intentional, you can safely ignore the queued item.',
      gates: [
        'Requires explicit founder approval phrase - never auto-approved',
        'No timeout-based approval - manual only',
        'Irreversible without git revert + push',
        'Push from Windows terminal only - sandbox proxy blocks git push',
      ],
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
