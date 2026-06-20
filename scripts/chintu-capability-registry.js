'use strict';
/**
 * Chintu Capability Registry — Stage 33
 *
 * Declarative registry of every capability Chintu knows about.
 * Risk levels: safe_read | dry_run | requires_approval | blocked
 *
 * Rules:
 *  - blocked capabilities MUST have executionAllowed: false
 *  - requires_approval capabilities MUST have requiresApproval: true
 *  - health-sensitive capabilities MUST have riskLevel: 'blocked'
 *  - all capabilities MUST have a testFile
 *  - localOnly: true on all non-diagnostic capabilities
 */

const CAPABILITIES = [
  {
    id: 'chintu.status',
    description: 'Report current Chintu OS status: bridge health, connector state, stage.',
    inputShape: 'none',
    outputShape: 'status object with bridge, connector, stage fields',
    riskLevel: 'safe_read',
    dryRunSupported: true,
    executionAllowed: true,
    requiresApproval: false,
    localOnly: true,
    testFile: 'scripts/chintu-local-bridge.test.js',
  },
  {
    id: 'chintu.repoSummary',
    description: 'Read-only repo summary: git log, status, recent commits.',
    inputShape: 'none',
    outputShape: 'git summary text',
    riskLevel: 'safe_read',
    dryRunSupported: true,
    executionAllowed: true,
    requiresApproval: false,
    localOnly: true,
    testFile: 'scripts/chintu-brain-router.test.js',
  },
  {
    id: 'chintu.checkEverything',
    description: 'Run the check_everything sequence: git_status, validate_app, connector_readiness, release_guard.',
    inputShape: 'none',
    outputShape: 'sequence result array',
    riskLevel: 'dry_run',
    dryRunSupported: true,
    executionAllowed: true,
    requiresApproval: false,
    localOnly: true,
    testFile: 'scripts/chintu-brain-router.test.js',
  },
  {
    id: 'chintu.githubStatusDryRun',
    description: 'Read-only GitHub repo status via gh CLI. Never pushes.',
    inputShape: 'none',
    outputShape: 'gh repo view summary',
    riskLevel: 'dry_run',
    dryRunSupported: true,
    executionAllowed: true,
    requiresApproval: false,
    localOnly: true,
    testFile: 'scripts/chintu-github-connector.test.js',
  },
  {
    id: 'chintu.gitPush',
    description: 'Push current branch to origin. Irreversible without revert.',
    inputShape: 'branch name (optional)',
    outputShape: 'push result',
    riskLevel: 'requires_approval',
    dryRunSupported: true,
    executionAllowed: false,
    requiresApproval: true,
    localOnly: true,
    testFile: 'scripts/chintu-safety-boundary.test.js',
    blockedReason: 'Requires explicit founder approval before any push. Use release guard script.',
  },
  {
    id: 'bala.localHealthSummaryReadOnly',
    description: 'Read local BALA app state: test results, build status, app.js syntax.',
    inputShape: 'none',
    outputShape: 'BALA status summary',
    riskLevel: 'safe_read',
    dryRunSupported: true,
    executionAllowed: true,
    requiresApproval: false,
    localOnly: true,
    testFile: 'scripts/chintu-bala-safe-docs.test.js',
    safetyNotes: [
      'Never interprets health data as medical advice.',
      'Only reads local repo/test state, no live user health data.',
    ],
  },
  {
    id: 'bala.doctorSummaryPreview',
    description: 'Generate a doctor-ready summary preview from demo/local fixture data only.',
    inputShape: 'demo fixture data (no live user data)',
    outputShape: 'markdown summary preview',
    riskLevel: 'safe_read',
    dryRunSupported: true,
    executionAllowed: true,
    requiresApproval: false,
    localOnly: true,
    testFile: 'scripts/chintu-bala-safe-docs.test.js',
    safetyNotes: [
      'Demo/fixture data only — never live user health data.',
      'No diagnosis, treatment, prediction, or prevention language.',
      'Output is a preview only — not sent to any doctor automatically.',
    ],
  },
  {
    id: 'bala.askSkill',
    description: 'Answer BALA health-awareness questions via Telegram or CLI. Enforces full medical-safety boundary on every response.',
    inputShape: 'text query from user',
    outputShape: '{ reply, safetyTag, emergency, footer, capabilityId }',
    riskLevel: 'safe_read',
    dryRunSupported: true,
    executionAllowed: true,
    requiresApproval: false,
    localOnly: true,
    testFile: 'scripts/chintu-bala-skill.test.js',
    safetyNotes: [
      'Pure logic — no network, no fs, no shell calls.',
      'Emergency phrases always routed to seek-emergency-care reply.',
      'Medical-claim requests always receive firm boundary reply.',
      'All replies carry BALA_SAFETY_FOOTER non-medical disclaimer.',
      'Never diagnoses, treats, prescribes, or replaces doctors.',
    ],
  },
  {
    id: 'bala.interpretLiveHealthData',
    description: 'Interpret live wearable/health data as medical advice.',
    inputShape: 'n/a',
    outputShape: 'n/a',
    riskLevel: 'blocked',
    dryRunSupported: false,
    executionAllowed: false,
    requiresApproval: false,
    localOnly: true,
    testFile: 'scripts/chintu-medical-claims.test.js',
    blockedReason: 'BALA is health-awareness only. No diagnosis, treatment, or medical interpretation.',
  },
  {
    id: 'telegram.discoverIds',
    description: 'Poll getUpdates once to reveal chat_id and sender_id. Never sends.',
    inputShape: 'TELEGRAM_BOT_TOKEN in env',
    outputShape: 'discovery summary with masked IDs',
    riskLevel: 'safe_read',
    dryRunSupported: true,
    executionAllowed: true,
    requiresApproval: false,
    localOnly: false,
    testFile: 'scripts/chintu-telegram-runner.test.js',
    safetyNotes: ['Network call to Telegram getUpdates only. No send. No offset set.'],
  },
  {
    id: 'telegram.tokenCheck',
    description: 'Validate TELEGRAM_BOT_TOKEN via getMe and getWebhookInfo. Never prints token.',
    inputShape: 'TELEGRAM_BOT_TOKEN in env',
    outputShape: 'bot identity + webhook status (token never printed)',
    riskLevel: 'safe_read',
    dryRunSupported: true,
    executionAllowed: true,
    requiresApproval: false,
    localOnly: false,
    testFile: 'scripts/chintu-telegram-runner.test.js',
    safetyNotes: ['Token is never printed or logged. Only safe bot identity fields shown.'],
  },
  {
    id: 'telegram.sendMessage',
    description: 'Send a Telegram message to a chat.',
    inputShape: 'chatId, text',
    outputShape: 'message_id',
    riskLevel: 'requires_approval',
    dryRunSupported: true,
    executionAllowed: false,
    requiresApproval: true,
    localOnly: false,
    testFile: 'scripts/chintu-telegram-runner.test.js',
    blockedReason: 'CHINTU_TELEGRAM_SEND_ENABLED must be 1 AND founder must approve. Default: disabled.',
  },
  {
    id: 'telegram.deleteWebhook',
    description: 'Delete active Telegram webhook to restore getUpdates polling.',
    inputShape: 'TELEGRAM_BOT_TOKEN in env',
    outputShape: 'webhook deletion confirmation',
    riskLevel: 'requires_approval',
    dryRunSupported: true,
    executionAllowed: false,
    requiresApproval: true,
    localOnly: false,
    testFile: 'scripts/chintu-telegram-runner.test.js',
    blockedReason: 'Founder must explicitly type APPROVE DELETE WEBHOOK before running without --dry-run.',
  },
  {
    id: 'connector.runtimeMap',
    description: 'Display the current connector architecture map (read-only doc).',
    inputShape: 'none',
    outputShape: 'connector architecture summary',
    riskLevel: 'safe_read',
    dryRunSupported: true,
    executionAllowed: true,
    requiresApproval: false,
    localOnly: true,
    testFile: 'scripts/chintu-connector-policy.test.js',
  },
  {
    id: 'connector.webhookActivation',
    description: 'Activate a Telegram or external webhook.',
    inputShape: 'n/a',
    outputShape: 'n/a',
    riskLevel: 'blocked',
    dryRunSupported: false,
    executionAllowed: false,
    requiresApproval: false,
    localOnly: false,
    testFile: 'scripts/chintu-connector-policy.test.js',
    blockedReason: 'Webhook activation is permanently blocked in this stage. Poll-once only.',
  },
  {
    id: 'chintu.healthEmergencyAction',
    description: 'Execute any automated action in response to a health emergency message.',
    inputShape: 'n/a',
    outputShape: 'n/a',
    riskLevel: 'blocked',
    dryRunSupported: false,
    executionAllowed: false,
    requiresApproval: false,
    localOnly: true,
    testFile: 'scripts/chintu-medical-claims.test.js',
    blockedReason: 'Health-sensitive commands must NEVER trigger local automation. Urgent care redirect only.',
  },
];

/**
 * Look up a capability by id. Returns undefined if not found.
 */
function getCapability(id) {
  return CAPABILITIES.find((c) => c.id === id);
}

/**
 * Returns all capabilities at or below a given risk level.
 * Order: safe_read < dry_run < requires_approval < blocked
 */
const RISK_ORDER = ['safe_read', 'dry_run', 'requires_approval', 'blocked'];

function getCapabilitiesUpTo(maxRisk) {
  const maxIdx = RISK_ORDER.indexOf(maxRisk);
  if (maxIdx === -1) throw new Error('Unknown riskLevel: ' + maxRisk);
  return CAPABILITIES.filter((c) => RISK_ORDER.indexOf(c.riskLevel) <= maxIdx);
}

/**
 * Check if a capability is safe to execute without approval.
 * Returns { allowed: boolean, reason: string }
 */
function checkExecutionAllowed(id) {
  const cap = getCapability(id);
  if (!cap) {
    return { allowed: false, reason: 'Capability not registered: ' + id };
  }
  if (!cap.executionAllowed) {
    return { allowed: false, reason: cap.blockedReason || ('Capability ' + id + ' is not executable: riskLevel=' + cap.riskLevel) };
  }
  if (cap.requiresApproval) {
    return { allowed: false, reason: 'Capability requires explicit approval before execution.' };
  }
  return { allowed: true, reason: null };
}

/**
 * Validate registry integrity. Throws on violation.
 */
function validateRegistry() {
  const seen = new Set();
  for (const cap of CAPABILITIES) {
    if (!cap.id) throw new Error('Capability missing id');
    if (seen.has(cap.id)) throw new Error('Duplicate capability id: ' + cap.id);
    seen.add(cap.id);
    if (!cap.description) throw new Error(cap.id + ': missing description');
    if (!RISK_ORDER.includes(cap.riskLevel)) throw new Error(cap.id + ': invalid riskLevel ' + cap.riskLevel);
    if (typeof cap.executionAllowed !== 'boolean') throw new Error(cap.id + ': executionAllowed must be boolean');
    if (typeof cap.requiresApproval !== 'boolean') throw new Error(cap.id + ': requiresApproval must be boolean');
    if (typeof cap.localOnly !== 'boolean') throw new Error(cap.id + ': localOnly must be boolean');
    if (!cap.testFile) throw new Error(cap.id + ': missing testFile');

    // Safety invariants
    if (cap.riskLevel === 'blocked' && cap.executionAllowed) {
      throw new Error(cap.id + ': blocked capability has executionAllowed=true — SAFETY VIOLATION');
    }
    if (cap.requiresApproval && cap.executionAllowed) {
      throw new Error(cap.id + ': requires_approval capability has executionAllowed=true — SAFETY VIOLATION');
    }
  }
}

// Validate at require() time so any violation is caught immediately.
validateRegistry();

module.exports = {
  CAPABILITIES,
  RISK_ORDER,
  getCapability,
  getCapabilitiesUpTo,
  checkExecutionAllowed,
  validateRegistry,
};
