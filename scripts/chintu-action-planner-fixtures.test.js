#!/usr/bin/env node
// Chintu action-planner fixture contract test.
//
// Loads planner-state fixtures and verifies the expected ranking
// contract without running any external command:
//   1. safe-now actions rank before needs-approval actions.
//   2. needs-approval actions create approval-card ids.
//   3. parked/research examples remain non-sending.
//   4. push-pending appears only when unpushed commits exist.
//   5. no real connector send language exists in action copy.
//   6. no unsafe medical claims are introduced.
//   7. no protected BALA app file is required.
//
// Read-only. No network. No edits.

'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const fixturesDir = path.join(repoRoot, 'scripts', 'fixtures', 'chintu-action-planner');
const plannerScript = path.join(repoRoot, 'scripts', 'chintu-action-planner.ps1');

const PROTECTED_BALA = new Set([
  'app.js',
  'index.html',
  'styles.css',
  'sw.js',
  'coach.js',
  'manifest.webmanifest',
  'privacy.html',
  'functions/api/coach.js',
]);

const FORBIDDEN_SEND = [
  /\bsend(?:s|ing)? telegram\b/i,
  /\bpost(?:ed|ing)? to slack\b/i,
  /\bnotify discord channel\b/i,
  /\bgmail send\b/i,
];

const FORBIDDEN_MEDICAL = [
  /\bdiagnos(?:e|es|ing)\b/i,
  /\btreat(?:s|ing|ment)\b/i,
  /\bpredict(?:s|ing|ion)?\b/i,
  /\bprevent(?:s|ing|ion)?\b/i,
  /\bemergency monitoring\b/i,
];

let fails = 0;
function fail(msg) {
  fails++;
  console.error('FAIL: ' + msg);
}

function buildActions(state) {
  const actions = [
    {
      id: 'A1-refresh-founder-message',
      category: 'safe-now',
      approvalNeeded: false,
      connectorActivation: false,
      balaTouched: false,
      filesTouched: ['CHINTU_DAILY_BRIEF.md', 'CHINTU_OUTBOX/latest_founder_message.md', 'CHINTU_OUTBOX/founder_message_history.md'],
      why: 'Stage 12 voice. One quick read of what is working, what needs attention, the best next move.',
      command: 'powershell -ExecutionPolicy Bypass -File scripts\\chintu-founder-message.ps1',
    },
    {
      id: 'A2-render-dry-run-payloads',
      category: 'safe-now',
      approvalNeeded: false,
      connectorActivation: false,
      balaTouched: false,
      filesTouched: ['CHINTU_OUTBOX/dry_run_payloads/telegram_preview.json', 'CHINTU_OUTBOX/dry_run_payloads/slack_preview.json', 'CHINTU_OUTBOX/dry_run_payloads/discord_preview.json'],
      why: 'Make the Telegram/Slack/Discord shape visible without sending. Useful evidence for any future flip-to-ready decision.',
      command: 'node scripts\\chintu-message-dry-run.js',
    },
    {
      id: 'A3-bridge-reality-check',
      category: 'safe-now',
      approvalNeeded: false,
      connectorActivation: false,
      balaTouched: false,
      filesTouched: ['CHINTU_BRIDGE_LOOP_REALITY_CHECK.md'],
      why: 'Confirms Windows -> shared bridge -> iMac Option 12 is still GREEN before any iMac pull.',
      command: 'powershell -ExecutionPolicy Bypass -File scripts\\chintu-bridge-loop-reality-check.ps1',
    },
  ];

  if (state.unpushed > 0) {
    actions.push({
      id: 'A4-push-pending-commits',
      category: 'needs-approval',
      approvalNeeded: true,
      connectorActivation: false,
      balaTouched: false,
      filesTouched: ['(remote ref only)'],
      why: 'Ship the work that has already passed every safety test.',
      command: 'git push origin main',
    });
  }

  actions.push(
    {
      id: 'A5-bala-tier1-audit',
      category: 'safe-now',
      approvalNeeded: false,
      connectorActivation: false,
      balaTouched: false,
      filesTouched: ['(none - read-only)'],
      why: 'Catch any drift toward predictive/clinical phrasing before the next BALA commit. Zero risk - reading only.',
      command: 'open privacy.html and coach.js in your editor; open the PWA on a phone',
    },
    {
      id: 'A6-flip-telegram-dry-run',
      category: 'needs-approval',
      approvalNeeded: true,
      connectorActivation: true,
      balaTouched: false,
      filesTouched: ['CHINTU_CONNECTORS.md', 'CHINTU_CONNECTORS_CONFIG.example.json'],
      why: 'Would let the dry-run adapter mark Telegram as exercised. Still NO real send. See CHINTU_TELEGRAM_STATUS_PLAN.md.',
      command: '(founder edits the registry and example config, then commits)',
    },
    {
      id: 'A7-voice-coach-spec-reread',
      category: 'research',
      approvalNeeded: false,
      connectorActivation: false,
      balaTouched: false,
      filesTouched: ['(none - research)'],
      why: 'Keep the smallest BALA voice slice (Web Speech API play button) in mind without acting on it.',
      command: 'open BALA_VOICE_COACH_SAFE_SPEC.md',
    },
  );

  const grouped = {
    'safe-now': actions.filter((a) => a.category === 'safe-now'),
    'needs-approval': actions.filter((a) => a.category === 'needs-approval'),
    research: actions.filter((a) => a.category === 'research'),
  };

  const ranked = [...grouped['safe-now'], ...grouped['needs-approval'], ...grouped.research];
  return {
    actions,
    ranked,
    top5: ranked.slice(0, 5),
    approvalCardIds: ranked.slice(0, 5).filter((a) => a.approvalNeeded).map((a) => a.id),
  };
}

if (!fs.existsSync(fixturesDir)) {
  fail('fixtures directory missing: scripts/fixtures/chintu-action-planner');
}
if (!fs.existsSync(plannerScript)) {
  fail('planner script missing: scripts/chintu-action-planner.ps1');
}

const fixtureFiles = fs.existsSync(fixturesDir)
  ? fs.readdirSync(fixturesDir).filter((f) => f.endsWith('.json')).sort()
  : [];

if (fixtureFiles.length === 0) {
  fail('no fixture files found under scripts/fixtures/chintu-action-planner');
}

for (const file of fixtureFiles) {
  const fixture = JSON.parse(fs.readFileSync(path.join(fixturesDir, file), 'utf8'));
  const result = buildActions(fixture.input);
  const actualTop5Ids = result.top5.map((a) => a.id);
  const actualApprovalIds = result.approvalCardIds;

  if (JSON.stringify(actualTop5Ids) !== JSON.stringify(fixture.expect.top5_ids)) {
    fail(`${fixture.name}: top5 ids mismatch. expected ${fixture.expect.top5_ids.join(', ')} got ${actualTop5Ids.join(', ')}`);
  }
  if (JSON.stringify(actualApprovalIds) !== JSON.stringify(fixture.expect.approval_card_ids)) {
    fail(`${fixture.name}: approval card ids mismatch. expected ${fixture.expect.approval_card_ids.join(', ')} got ${actualApprovalIds.join(', ')}`);
  }

  const firstApprovalIndex = result.top5.findIndex((a) => a.category === 'needs-approval');
  const safeAfterApproval = result.top5.some((a, index) => a.category === 'safe-now' && firstApprovalIndex !== -1 && index > firstApprovalIndex);
  if (safeAfterApproval) {
    fail(`${fixture.name}: safe-now action ranked after needs-approval action`);
  }

  const hasPushAction = actualTop5Ids.includes('A4-push-pending-commits');
  if (hasPushAction !== fixture.expect.push_action_present) {
    fail(`${fixture.name}: push action presence mismatch`);
  }
  if ((fixture.input.unpushed > 0) !== hasPushAction) {
    fail(`${fixture.name}: push action did not match unpushed fixture state`);
  }

  const researchActions = result.actions.filter((a) => a.category === 'research');
  for (const action of researchActions) {
    if (action.approvalNeeded) fail(`${fixture.name}: research action unexpectedly needs approval: ${action.id}`);
  }

  const parkedActions = result.actions.filter((a) => a.connectorActivation);
  for (const action of parkedActions) {
    if (!action.approvalNeeded) fail(`${fixture.name}: parked connector action missing approval gate: ${action.id}`);
  }

  for (const action of result.actions) {
    const textBlob = `${action.id}\n${action.why}\n${action.command}\n${action.filesTouched.join('\n')}`;
    for (const re of FORBIDDEN_SEND) {
      if (re.test(textBlob)) fail(`${fixture.name}: forbidden send language in ${action.id}: ${re}`);
    }
    for (const re of FORBIDDEN_MEDICAL) {
      if (re.test(textBlob)) fail(`${fixture.name}: unsafe medical language in ${action.id}: ${re}`);
    }
    if (action.balaTouched) fail(`${fixture.name}: action unexpectedly marked as touching a BALA app file: ${action.id}`);
    for (const fileTouched of action.filesTouched) {
      const normalized = fileTouched.replace(/\\/g, '/').trim();
      if (PROTECTED_BALA.has(normalized)) {
        fail(`${fixture.name}: protected BALA app file listed in ${action.id}: ${fileTouched}`);
      }
    }
  }
}

if (fs.existsSync(plannerScript)) {
  const scriptText = fs.readFileSync(plannerScript, 'utf8');
  if (!scriptText.includes('CHINTU_ACTION_QUEUE_TRACKED.md')) {
    fail('planner script missing tracked queue snapshot output');
  }
}

if (fails > 0) {
  console.error(`\n${fails} failure(s) in chintu-action-planner-fixtures.test.js`);
  process.exit(1);
}

console.log(`PASS chintu-action-planner-fixtures.test.js (${fixtureFiles.length} fixture(s))`);
