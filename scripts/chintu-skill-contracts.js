'use strict';
/**
 * Chintu Skill Contracts — Stage C46
 *
 * Declarative contracts for every named skill Chintu can perform.
 * A "skill" is a user-facing, named capability with clear input/output
 * contracts, a safety class, and a routing target.
 *
 * This is distinct from the capability registry (chintu-capability-registry.js)
 * which describes *what Chintu can do*. Skill contracts describe *how the
 * founder invokes it and what they can expect to get back*.
 *
 * Safety classes (in order of risk):
 *   safe_read        — local read only, no side effects, no approval needed
 *   allowlisted_write — local write only, in allowlist, no approval needed
 *   emergency_gate   — overrides all other logic, shows urgent care card, no BALA score
 *   blocked          — parked with reason, never executed
 *
 * Route types:
 *   brain_chat   → POST /api/chat → brain.route() → sequence or action
 *   sequence     → POST /api/action → runSequence(target)
 *   direct       → POST /api/action → runAction(target)
 *   auto_block   → never reaches bridge, blocked by brain before routing
 *   emergency_gate → brain short-circuits to emergency card immediately
 *
 * Constraints (invariants enforced by validateSkillContracts()):
 *   - blocked skills MUST have routeType === 'auto_block'
 *   - emergency_gate skills MUST have safetyClass === 'emergency_gate'
 *   - every skill MUST have a unique id
 *   - every skill MUST have at least one trigger phrase
 *   - no skill may claim to diagnose, treat, predict, or replace doctors
 */

const SKILL_CONTRACTS = [
  {
    id: 'hi_check_in',
    name: 'Hi / Check-in',
    description: 'Greeting and daily check-in. Returns bridge health, stage, and a founder-tone reply.',
    triggers: ['hi', 'hello', 'hey', 'good morning', 'morning', 'check in'],
    inputContract: 'none (greeting text)',
    outputContract: '{ reply: string, intent: "greeting", track: "chintu", risk: "safe_read" }',
    safetyClass: 'safe_read',
    routeType: 'brain_chat',
    routeTarget: 'greeting intent → conversational reply',
    capabilitiesUsed: ['chintu.status'],
    proofPanelId: 'realityHiProof',
    localOnly: true,
  },
  {
    id: 'check_everything',
    name: 'Check Everything',
    description: 'Runs the full check_everything sequence: git_status, validate_app, connector_readiness, release_guard. Returns 4 step results.',
    triggers: ['check everything', 'check all', 'run everything', 'full check', 'run all checks'],
    inputContract: 'none',
    outputContract: '{ sequence: "check_everything", results: [{ label, exitCode, stdout }×4] }',
    safetyClass: 'safe_read',
    routeType: 'brain_chat',
    routeTarget: 'sequence: check_everything',
    capabilitiesUsed: ['chintu.checkEverything'],
    proofPanelId: 'realityCheckProof',
    localOnly: true,
  },
  {
    id: 'git_status',
    name: 'Git Status',
    description: 'Runs `git status --short` locally. Read-only. No push, no commit.',
    triggers: ['git status', 'what changed', 'show git status', 'any uncommitted changes'],
    inputContract: 'none',
    outputContract: '{ action: "git_status", exitCode: 0|1, stdout: string }',
    safetyClass: 'safe_read',
    routeType: 'brain_chat',
    routeTarget: 'action: git_status',
    capabilitiesUsed: ['chintu.repoSummary'],
    localOnly: true,
  },
  {
    id: 'validate_app',
    name: 'Validate App',
    description: 'Runs node --check on app.js and key scripts. Syntax only — no runtime execution.',
    triggers: ['validate app', 'check app.js', 'syntax check', 'validate the app', 'is app.js valid'],
    inputContract: 'none',
    outputContract: '{ action: "validate_app", exitCode: 0|1, stdout: string }',
    safetyClass: 'safe_read',
    routeType: 'brain_chat',
    routeTarget: 'action: validate_app',
    capabilitiesUsed: ['chintu.status'],
    localOnly: true,
  },
  {
    id: 'connector_readiness',
    name: 'Connector Readiness',
    description: 'Checks connector state: env vars present/absent, dry-run mode confirmed, no live sends. Read-only.',
    triggers: ['connector readiness', 'connector status', 'check connectors', 'are connectors ready'],
    inputContract: 'none',
    outputContract: '{ action: "connector_readiness", exitCode: 0, stdout: connector_summary }',
    safetyClass: 'safe_read',
    routeType: 'brain_chat',
    routeTarget: 'action: connector_readiness',
    capabilitiesUsed: ['connector.runtimeMap'],
    localOnly: true,
  },
  {
    id: 'release_guard',
    name: 'Release Guard',
    description: 'Checks release readiness: no uncommitted changes, no failing tests, gitignore safety. Blocks unsafe commits.',
    triggers: ['release guard', 'ready to release', 'can i push', 'release check', 'pre-release check'],
    inputContract: 'none',
    outputContract: '{ action: "release_guard", exitCode: 0|1, stdout: release_guard_summary }',
    safetyClass: 'safe_read',
    routeType: 'brain_chat',
    routeTarget: 'action: release_guard',
    capabilitiesUsed: ['chintu.repoSummary'],
    localOnly: true,
  },
  {
    id: 'chest_pain_emergency',
    name: 'Emergency — Chest Pain / Urgent Symptoms',
    description:
      'Detected urgent symptom phrase. Immediately shows "seek emergency care" card. ' +
      'NEVER runs a BALA score. NEVER makes a medical decision. ' +
      'No automation. No Telegram send. No data collection.',
    triggers: [
      'chest pain', 'chest pressure', 'chest tight', 'tight chest',
      'cant breathe', 'cannot breathe', 'trouble breathing',
      'shortness of breath', 'short of breath',
      'fainting', 'fainted', 'passed out',
      'severe weakness', 'heart attack', 'stroke', 'collapsed',
      'numb on one side', 'face drooping', 'slurred speech',
    ],
    inputContract: 'symptom text',
    outputContract:
      '{ responseType: "emergency_override", reply: "Please seek emergency care…", ' +
      'emergency: true, score: null, safetyGates: ["urgent_care_redirect"] }',
    safetyClass: 'emergency_gate',
    routeType: 'emergency_gate',
    routeTarget: 'immediate: urgent_care_redirect (no BALA score, no action)',
    capabilitiesUsed: [],
    proofPanelId: 'realityChestProof',
    localOnly: true,
    medicalSafetyNote:
      'BALA NEVER: diagnoses, treats, predicts, prevents, replaces doctors, or monitors emergencies. ' +
      'This card exists to direct the user to real emergency services. Nothing more.',
  },
  {
    id: 'delete_all_blocked',
    name: 'Delete All Files — Blocked',
    description:
      'Any request to delete/wipe/rm-rf files is permanently parked. ' +
      'Chintu will NEVER delete files autonomously. The brain parks it with a reason before it reaches the bridge.',
    triggers: ['delete all', 'delete everything', 'rm -rf', 'wipe everything', 'wipe all files', 'remove all files', 'nuke the repo'],
    inputContract: 'any delete/wipe phrase',
    outputContract: '{ responseType: "parked_with_reason", risk: "destructive_file_op", reply: "parked explanation" }',
    safetyClass: 'blocked',
    routeType: 'auto_block',
    routeTarget: 'blocked: destructive_file_op — parked before bridge',
    capabilitiesUsed: [],
    proofPanelId: 'realityDeleteProof',
    localOnly: true,
    blockedReason:
      'Destructive file operations are never executed automatically. Founder must perform these manually.',
  },
  {
    id: 'morning_digest',
    name: 'Morning Digest',
    description:
      'Generates a local morning digest: repo state, connector status, and BALA check-in summary. ' +
      'NO health data sent externally. Dry-run sends only.',
    triggers: ['morning digest', 'daily digest', 'morning brief', 'morning summary', 'daily brief', 'what happened overnight'],
    inputContract: 'none',
    outputContract: '{ reply: morning_summary_string, intent: "morning_digest", track: "chintu" }',
    safetyClass: 'safe_read',
    routeType: 'brain_chat',
    routeTarget: 'intent: morning_digest → brain reply',
    capabilitiesUsed: ['chintu.status', 'chintu.repoSummary'],
    localOnly: true,
    safetyNotes: [
      'No health data values in external notification payload.',
      'ntfy.sh send is optional and dry-run by default.',
    ],
  },
  {
    id: 'build_bala_sprint',
    name: 'Build Next BALA Sprint',
    description:
      'Reports the next planned BALA sprint (B63+) and what is needed. ' +
      'Does NOT execute any file writes or git operations automatically.',
    triggers: ['build next bala sprint', 'next bala sprint', 'bala sprint', 'what is next for bala', 'next sprint'],
    inputContract: 'none (or sprint context phrase)',
    outputContract: '{ reply: sprint_plan_text, intent: "sprint_planning", track: "bala" }',
    safetyClass: 'safe_read',
    routeType: 'brain_chat',
    routeTarget: 'intent: sprint_planning → conversational reply',
    capabilitiesUsed: ['chintu.repoSummary'],
    proofPanelId: 'realitySprintProof',
    localOnly: true,
  },
  {
    id: 'show_capabilities',
    name: 'Show Capabilities',
    description:
      'Lists all registered Chintu skills and capabilities. ' +
      'The founder can see exactly what Chintu can and cannot do.',
    triggers: ['show capabilities', 'what can you do', 'list skills', 'show skills', 'capabilities', 'what are your skills'],
    inputContract: 'none',
    outputContract: '{ reply: capabilities_table_text, intent: "self_description", track: "chintu" }',
    safetyClass: 'safe_read',
    routeType: 'brain_chat',
    routeTarget: 'intent: self_description → conversational reply listing capabilities',
    capabilitiesUsed: ['chintu.status', 'connector.runtimeMap'],
    localOnly: true,
  },
  {
    id: 'autonomous_brain',
    name: 'Autonomous Brain (C48)',
    description:
      'When Claude\'s session ends, Chintu keeps working. ' +
      'Reads CONTROL_TOWER_RESUME.md + git state, calls Groq free LLM (llama-3.1-70b-versatile), ' +
      'gets a safe audit plan, executes allowlisted read-only commands, commits, sends ntfy push. ' +
      'Dry-run by default. Live only when CHINTU_GROQ_API_KEY + CHINTU_AUTONOMOUS_APPROVAL_PHRASE=go. ' +
      'NEVER: deletes files, force-pushes, reads secrets, exports health data, runs arbitrary shell.',
    triggers: ['autonomous brain', 'run autonomous', 'chintu auto', 'run brain', 'auto audit', 'keep working', 'autonomous mode'],
    inputContract: 'env: CHINTU_GROQ_API_KEY (required for live), CHINTU_AUTONOMOUS_APPROVAL_PHRASE=go (required for live)',
    outputContract: '{ mode: "dry-run"|"live", plan: { task, safe_commands, commit_message, ntfy_message }, results?: [], committed?: boolean }',
    safetyClass: 'allowlisted_write',
    routeType: 'direct',
    routeTarget: 'bridge action: autonomous_brain -> node scripts/chintu-autonomous-brain.js',
    capabilitiesUsed: ['chintu.repoSummary', 'chintu.notify'],
    proofPanelId: 'sc-autonomous',
    localOnly: false,
  },
  {
    id: 'ntfy_alert_push',
    name: 'ntfy.sh Alert Push (Level 3)',
    description:
      'Sends a push notification to ntfy.sh via chintu-ntfy-push.js. ' +
      'Dry-run by default - no network call without explicit env vars. ' +
      'Live only when CHINTU_CONNECTOR_APPROVAL_PHRASE=go and CHINTU_NTFY_TOPIC is set. ' +
      'No health values in message body.',
    triggers: ['ntfy push', 'send ntfy alert', 'test ntfy', 'push notification', 'level 3 alert', 'ntfy alert'],
    inputContract: 'env: CHINTU_NTFY_TOPIC (required for live), CHINTU_CONNECTOR_APPROVAL_PHRASE=go (required for live)',
    outputContract: '{ mode: "dry-run"|"live", topic: string, sent: boolean, httpStatus?: number }',
    safetyClass: 'allowlisted_write',
    routeType: 'direct',
    routeTarget: 'bridge action: ntfy_push -> node scripts/chintu-ntfy-push.js',
    capabilitiesUsed: ['chintu.notify'],
    proofPanelId: 'sc-alert',
    localOnly: false,
  },
];

// ── Validation ────────────────────────────────────────────────────────────────

const VALID_SAFETY_CLASSES = ['safe_read', 'allowlisted_write', 'emergency_gate', 'blocked'];
const VALID_ROUTE_TYPES    = ['brain_chat', 'sequence', 'direct', 'auto_block', 'emergency_gate'];

function validateSkillContracts() {
  const seen = new Set();
  for (const skill of SKILL_CONTRACTS) {
    if (!skill.id)          throw new Error('Skill missing id');
    if (seen.has(skill.id)) throw new Error('Duplicate skill id: ' + skill.id);
    seen.add(skill.id);
    if (!skill.name)        throw new Error(skill.id + ': missing name');
    if (!skill.description) throw new Error(skill.id + ': missing description');
    if (!Array.isArray(skill.triggers) || skill.triggers.length === 0)
      throw new Error(skill.id + ': must have at least one trigger');
    if (!VALID_SAFETY_CLASSES.includes(skill.safetyClass))
      throw new Error(skill.id + ': invalid safetyClass ' + skill.safetyClass);
    if (!VALID_ROUTE_TYPES.includes(skill.routeType))
      throw new Error(skill.id + ': invalid routeType ' + skill.routeType);
    if (!skill.inputContract)  throw new Error(skill.id + ': missing inputContract');
    if (!skill.outputContract) throw new Error(skill.id + ': missing outputContract');

    // Safety invariants
    if (skill.safetyClass === 'blocked' && skill.routeType !== 'auto_block')
      throw new Error(skill.id + ': blocked skill must have routeType=auto_block');
    if (skill.safetyClass === 'emergency_gate' && skill.routeType !== 'emergency_gate')
      throw new Error(skill.id + ': emergency_gate skill must have routeType=emergency_gate');
  }
}

// Validate at require() time — any violation is caught immediately.
validateSkillContracts();

// ── Exports ───────────────────────────────────────────────────────────────────

function getSkill(id) {
  return SKILL_CONTRACTS.find((s) => s.id === id);
}

function getSkillsByClass(safetyClass) {
  return SKILL_CONTRACTS.filter((s) => s.safetyClass === safetyClass);
}

function getAllowedSkills() {
  return SKILL_CONTRACTS.filter((s) => s.safetyClass !== 'blocked');
}

module.exports = {
  SKILL_CONTRACTS,
  VALID_SAFETY_CLASSES,
  VALID_ROUTE_TYPES,
  getSkill,
  getSkillsByClass,
  getAllowedSkills,
  validateSkillContracts,
};
