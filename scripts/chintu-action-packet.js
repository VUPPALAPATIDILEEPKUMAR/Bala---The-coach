#!/usr/bin/env node
// chintu-action-packet.js — Stage 22
// Generates and validates Chintu Action Packets locally.
// Does NOT execute actions. Does NOT send externally. Does NOT print secrets.
// Local-only. No network calls.
'use strict';

const fs   = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

// ── Packet templates ──────────────────────────────────────────────────────────
const TEMPLATES = {
  'bala-sprint': {
    intent: 'Build next BALA sprint',
    understood: 'Plan the next BALA product sprint with safe scope boundaries and a copy-paste-ready Claude prompt.',
    track: 'bala',
    lane: 'BALA Your Coach — Sprint Planning',
    riskLevel: 'low',
    connectorRequired: 'none',
    approvalRequired: false,
    approvalPhrase: null,
    filesLikelyInvolved: [
      'BALA_NEXT_SAFE_SPRINT_PLAN.md',
      'BALA_PRODUCT_POLISH_QUEUE.md',
      'BALA_SCORE_MODEL_REVIEW_PLAN.md',
      'index.html', 'app.js', 'styles.css',
    ],
    suggestedAgents: ['validator-agent', 'medical-claims-checker'],
    validationCommands: [
      'node --check app.js',
      'node scripts\\chintu-medical-claims.test.js',
      'node scripts\\chintu-bala-safe-docs.test.js',
      'powershell -ExecutionPolicy Bypass -File scripts\\chintu-release-guard.ps1',
    ],
    safetyGates: [
      'No medical diagnosis copy in any new UI',
      'Health data stays local by default',
      'No external API keys added to frontend files',
      'BALA safety disclaimer on all new screens',
      'Emergency symptoms always redirect to urgent care',
    ],
    parkedItems: [
      'Live wearable API integration',
      'AI model inference or cloud coaching',
      'Push notifications (requires backend)',
      'Cloud sync or account system',
    ],
    nextHumanAction: 'Copy the generated prompt → paste into Claude → review the sprint plan → bring back approved scope.',
  },

  'connector-readiness': {
    intent: 'Check connector readiness',
    understood: 'Run a full readiness check on all Chintu connectors — Telegram, env vars, dry-run health.',
    track: 'chintu',
    lane: 'Chintu OS — Connector Readiness',
    riskLevel: 'low',
    connectorRequired: 'none',
    approvalRequired: false,
    approvalPhrase: null,
    filesLikelyInvolved: [
      'scripts/chintu-connector-send.js',
      'scripts/chintu-connector-send.test.js',
      'CHINTU_CONNECTOR_READINESS.md',
    ],
    suggestedAgents: [],
    validationCommands: [
      'node scripts\\chintu-connector-send.js --readiness',
      'node scripts\\chintu-connector-send.js --validate-env',
      'node scripts\\chintu-connector-send.test.js',
      'node scripts\\chintu-connector-policy.test.js',
    ],
    safetyGates: [
      'Validate env only — no secrets printed',
      'Dry-run mode stays on until founder explicitly approves',
      'No health data in connector messages by default',
    ],
    parkedItems: [
      'GitHub connector activation',
      'Slack/Discord connectors',
      'Any live external send without founder approval',
    ],
    nextHumanAction: 'Run the readiness commands in your terminal. Review output. If Telegram shows READY, request telegram-setup packet.',
  },

  'telegram-setup': {
    intent: 'Prepare Telegram first test',
    understood: 'Set up and run the Telegram connector for the first time with all safety gates active.',
    track: 'chintu',
    lane: 'Chintu OS — Telegram First Activation',
    riskLevel: 'medium',
    connectorRequired: 'telegram',
    approvalRequired: true,
    approvalPhrase: 'approve telegram-test-send',
    filesLikelyInvolved: [
      'scripts/chintu-connector-send.js',
      'CHINTU_CONNECTOR_ACTIVATION_GUIDE.md',
      'CHINTU_CONNECTOR_ACTIVATION_MATRIX.md',
    ],
    suggestedAgents: [],
    validationCommands: [
      'node scripts\\chintu-connector-send.js --validate-env',
      'node scripts\\chintu-connector-send.js --dry-run --message "Chintu first test"',
      'node scripts\\chintu-connector-send.test.js',
    ],
    safetyGates: [
      'Never print TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID',
      'Set env vars locally — never commit to repo',
      'Preview message before send',
      'Explicit approval phrase required',
      'No BALA health data in messages by default',
    ],
    parkedItems: [
      'Live send — requires approval phrase "approve telegram-test-send"',
      'Automated scheduled messages',
      'Telegram group sends',
    ],
    nextHumanAction: 'Set env vars in local PowerShell → run validate → run dry-run → review preview → say "approve telegram-test-send" when ready.',
  },

  'validator-dry-run': {
    intent: 'Run validator agent dry run',
    understood: 'Run the validator agent in dry-run mode to check repo health without making any changes.',
    track: 'chintu',
    lane: 'Chintu OS — Agent Runner',
    riskLevel: 'low',
    connectorRequired: 'none',
    approvalRequired: false,
    approvalPhrase: null,
    filesLikelyInvolved: [
      'scripts/chintu-agent-runner.ps1',
      'scripts/chintu-agent-runner.test.js',
      'CHINTU_AGENT_RUNS/',
      'CHINTU_AGENT_RUNS_INDEX.md',
    ],
    suggestedAgents: ['validator-agent'],
    validationCommands: [
      'powershell -ExecutionPolicy Bypass -File scripts\\chintu-agent-runner.ps1 -Agent "validator-agent" -DryRun',
      'node scripts\\chintu-agent-runner.test.js',
      'git status --short',
    ],
    safetyGates: [
      'DryRun flag must be set — no real commits or sends',
      'Review output before approving follow-on actions',
      'Agent runner does not push',
    ],
    parkedItems: [
      'Live agent execution without DryRun flag',
      'Automated push from agent runner',
    ],
    nextHumanAction: 'Run the PowerShell command in your terminal. Review output in CHINTU_AGENT_RUNS/. Return with validation report.',
  },
};

// ── Packet generator ──────────────────────────────────────────────────────────
function generatePacket(options = {}) {
  const { template, command } = options;

  let base = {};
  if (template && TEMPLATES[template]) {
    base = { ...TEMPLATES[template] };
  } else if (command) {
    base = {
      intent: command,
      understood: `Founder command: "${command.substring(0, 120)}"`,
      track: 'both',
      lane: 'Needs clarification',
      riskLevel: 'low',
      connectorRequired: 'none',
      approvalRequired: false,
      approvalPhrase: null,
      filesLikelyInvolved: [],
      suggestedAgents: [],
      validationCommands: ['git status --short'],
      safetyGates: ['Clarify track before proceeding'],
      parkedItems: [],
      nextHumanAction: 'Clarify the command and try a named template.',
    };
  } else {
    throw new Error('Provide --template <name> or --command "<text>"');
  }

  const id = 'CA-' + Date.now().toString(36).toUpperCase();
  const packet = {
    id,
    timestamp: new Date().toISOString(),
    source: 'chintu-action-packet-cli',
    ...base,
    generatedPrompt: base.generatedPrompt || '[Use chintu-prompt-engine.js to generate the full prompt]',
    auditLog: [
      { event: 'generated', timestamp: new Date().toISOString(), source: 'chintu-action-packet-cli' },
    ],
  };

  return packet;
}

// ── Packet validator ──────────────────────────────────────────────────────────
function validatePacket(packet) {
  const errors = [];
  const required = ['id', 'timestamp', 'intent', 'track', 'riskLevel', 'approvalRequired'];
  for (const field of required) {
    if (packet[field] === undefined || packet[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  }
  if (packet.riskLevel === 'high' && !packet.approvalRequired) {
    errors.push('High-risk packets must have approvalRequired: true');
  }
  if (packet.approvalRequired && !packet.approvalPhrase) {
    errors.push('Packets with approvalRequired must have an approvalPhrase');
  }
  // Safety: check for secrets
  const json = JSON.stringify(packet);
  const secretPatterns = ['token', 'password', 'secret', 'api_key', 'bearer', 'private_key'];
  for (const p of secretPatterns) {
    const idx = json.toLowerCase().indexOf(p);
    if (idx !== -1) {
      // Check context — allow in field names like "connectorRequired"
      const context = json.substring(Math.max(0, idx - 5), idx + p.length + 30);
      if (!context.includes('Required') && !context.includes('approvalPhrase') && !context.includes('gates')) {
        errors.push(`Possible secret value near "${context.trim()}" — do not include secrets in packets`);
      }
    }
  }
  return errors;
}

// ── CLI ───────────────────────────────────────────────────────────────────────
function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.length === 0) {
    console.log(`
chintu-action-packet.js — Stage 22

Usage:
  node scripts\\chintu-action-packet.js --template <name>
  node scripts\\chintu-action-packet.js --command "<text>"
  node scripts\\chintu-action-packet.js --validate <file.json>
  node scripts\\chintu-action-packet.js --list-templates

Options:
  --template <name>   Generate packet from a named template
  --command <text>    Generate packet from a natural-language command
  --validate <file>   Validate an existing packet JSON file
  --export            Write packet to CHINTU_OUTBOX/pending/ (creates dir if needed)
  --list-templates    Show available template names
    `);
    return;
  }

  if (args.includes('--list-templates')) {
    console.log('\nAvailable templates:');
    for (const [k, v] of Object.entries(TEMPLATES)) {
      console.log(`  ${k.padEnd(24)} ${v.intent}`);
    }
    return;
  }

  if (args.includes('--validate')) {
    const filePath = args[args.indexOf('--validate') + 1];
    if (!filePath) { console.error('ERROR: --validate requires a file path'); process.exit(1); }
    const raw = fs.readFileSync(path.resolve(filePath), 'utf8');
    const packet = JSON.parse(raw);
    const errors = validatePacket(packet);
    if (errors.length === 0) {
      console.log(`✅ Packet ${packet.id} is valid.`);
    } else {
      console.error('❌ Packet validation failed:');
      errors.forEach(e => console.error('  -', e));
      process.exit(1);
    }
    return;
  }

  let packet;
  if (args.includes('--template')) {
    const tpl = args[args.indexOf('--template') + 1];
    if (!tpl) { console.error('ERROR: --template requires a name'); process.exit(1); }
    if (!TEMPLATES[tpl]) { console.error(`ERROR: Unknown template "${tpl}". Run --list-templates.`); process.exit(1); }
    packet = generatePacket({ template: tpl });
  } else if (args.includes('--command')) {
    const cmd = args[args.indexOf('--command') + 1];
    if (!cmd) { console.error('ERROR: --command requires a text argument'); process.exit(1); }
    packet = generatePacket({ command: cmd });
  } else {
    console.error('ERROR: Provide --template or --command. Run --help for usage.');
    process.exit(1);
  }

  const errors = validatePacket(packet);
  if (errors.length > 0) {
    console.error('❌ Generated packet failed validation:');
    errors.forEach(e => console.error('  -', e));
    process.exit(1);
  }

  const json = JSON.stringify(packet, null, 2);

  if (args.includes('--export')) {
    const outboxDir = path.join(repoRoot, 'CHINTU_OUTBOX', 'pending');
    fs.mkdirSync(outboxDir, { recursive: true });
    const outFile = path.join(outboxDir, `${packet.id}.json`);
    fs.writeFileSync(outFile, json, 'utf8');
    console.log(`✅ Packet exported to: CHINTU_OUTBOX/pending/${packet.id}.json`);
  } else {
    console.log(json);
  }
}

main();
