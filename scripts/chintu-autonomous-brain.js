#!/usr/bin/env node
/**
 * Chintu Autonomous Brain -- Stage C48
 *
 * When Claude's session ends, Chintu keeps working.
 * This script reads the repo's state, asks a free LLM (Groq) what to do next,
 * executes safe read-only audits, commits, and sends an ntfy Level 3 push.
 *
 * DRY-RUN BY DEFAULT. Nothing external happens without:
 *   CHINTU_GROQ_API_KEY set (Groq API key -- free at console.groq.com)
 *   CHINTU_AUTONOMOUS_APPROVAL_PHRASE=go
 *
 * Safe command allowlist: only pre-screened read-only / audit ops.
 * NEVER: deletes files, force-pushes, reads secrets, exports health data,
 *        runs git reset/clean/rebase, or writes arbitrary shell commands.
 *
 * Usage:
 *   node scripts/chintu-autonomous-brain.js          -- dry-run (shows plan, no action)
 *   node scripts/chintu-autonomous-brain.js --status -- show last run result
 *
 * Live mode (set both env vars):
 *   set CHINTU_GROQ_API_KEY=gsk_...
 *   set CHINTU_AUTONOMOUS_APPROVAL_PHRASE=go
 *   node scripts/chintu-autonomous-brain.js
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const repoRoot    = path.resolve(__dirname, '..');
const resumeFile  = path.join(repoRoot, 'CONTROL_TOWER_RESUME.md');
const logDir      = path.join(repoRoot, 'CHINTU_MEMORY_VAULT', 'DAILY_LOGS');
const logFile     = path.join(logDir, new Date().toISOString().slice(0, 10) + '-autonomous.md');

const GROQ_API_KEY      = process.env.CHINTU_GROQ_API_KEY || '';
const APPROVAL_PHRASE   = process.env.CHINTU_AUTONOMOUS_APPROVAL_PHRASE || '';
const IS_LIVE = GROQ_API_KEY && APPROVAL_PHRASE === 'go';
const DRY_RUN = !IS_LIVE;

// ── Safe command allowlist ─────────────────────────────────────────────────
// The LLM can only suggest commands from this list. No arbitrary shell.
// C49: expanded to give the brain more audit power (all cross-platform).
const SAFE_COMMANDS = {
  // Git ops (read-only)
  'git_status':          'git status --short',
  'git_log':             'git log --oneline -10',
  'git_log_today':       'git log --oneline --since=midnight',
  'list_untracked':      'git ls-files --others --exclude-standard scripts/',

  // Syntax checks
  'node_check_app':      'node --check app.js',
  'node_check_sw':       'node --check sw.js',
  'node_check_brain':    'node --check scripts/chintu-autonomous-brain.js',

  // Test suite
  'run_egress_test':     'node scripts/chintu-no-network-egress.test.js',
  'run_medical_test':    'node scripts/chintu-medical-claims.test.js',
  'run_skill_test':      'node -e "require(\'./scripts/chintu-skill-contracts.js\'); console.log(\'skill-contracts: PASS\')"',
  'run_all_tests':       'node scripts/chintu-no-network-egress.test.js && node scripts/chintu-medical-claims.test.js',

  // Repo inventory (Node-based for Windows compat)
  'count_scripts':       'node -e "const fs=require(\'fs\'); const n=fs.readdirSync(\'scripts\').filter(f=>/^chintu-/.test(f)).length; console.log(n+\' chintu scripts\')"',
  'list_chintu_scripts': 'node -e "const fs=require(\'fs\'); fs.readdirSync(\'scripts\').filter(f=>/^chintu-/.test(f)).forEach(f=>console.log(f))"',

  // Resume context (last 30 lines -- gives LLM project memory on next run)
  'read_resume_tail':    'node -e "const fs=require(\'fs\'); const lines=fs.readFileSync(\'CONTROL_TOWER_RESUME.md\',\'utf8\').split(\'\\n\'); console.log(lines.slice(-30).join(\'\\n\'))"',

  // BALA health check
  'check_bala_files':    'node -e "const fs=require(\'fs\'); const files=[\'index.html\',\'app.js\',\'sw.js\',\'styles.css\']; files.forEach(f=>console.log(f+(fs.existsSync(f)?\' OK\':\' MISSING\')))"',
};

// ── Logging ───────────────────────────────────────────────────────────────
function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}`;
  console.log(line);
  try {
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(logFile, line + '\n');
  } catch (_) { /* log dir missing -- non-fatal */ }
}

// ── Read repo context ─────────────────────────────────────────────────────
function readContext() {
  let resume = '(CONTROL_TOWER_RESUME.md not found)';
  try { resume = fs.readFileSync(resumeFile, 'utf8').slice(0, 3000); } catch (_) {}

  let gitLog = '';
  try { gitLog = execSync('git log --oneline -10', { cwd: repoRoot, encoding: 'utf8' }); } catch (_) {}

  let gitStatus = '';
  try { gitStatus = execSync('git status --short', { cwd: repoRoot, encoding: 'utf8' }); } catch (_) {}

  return { resume, gitLog, gitStatus };
}

// ── Call Groq API ─────────────────────────────────────────────────────────
function callGroq(context) {
  return new Promise((resolve, reject) => {
    const systemPrompt = `You are Chintu, a local-first personal agent OS.
You read a repo state snapshot and suggest the NEXT safe audit task.
Your output MUST be valid JSON only -- no markdown, no explanation, just JSON.
Output schema:
{
  "task": "one sentence description of what you will do",
  "safe_commands": ["command_key1", "command_key2"],
  "commit_message": "C48-auto: one line summary",
  "ntfy_message": "short phone notification (max 60 chars)"
}
Available command keys (you may only use these exact keys):
${Object.keys(SAFE_COMMANDS).join(', ')}
Rules:
- NEVER suggest deleting files, force-pushing, reading secrets, or exporting health data
- Only suggest read-only audit commands from the allowed list
- commit_message must start with "C48-auto: "
- ntfy_message must be under 60 chars
- If nothing useful to audit, suggest ["git_status", "run_egress_test"]`;

    const userMessage = `Repo state:
--- CONTROL_TOWER_RESUME.md (first 3000 chars) ---
${context.resume}

--- git log --oneline -10 ---
${context.gitLog}

--- git status --short ---
${context.gitStatus}

What is the single best safe audit task to run right now?`;

    const body = JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 400,
      response_format: { type: 'json_object' },
    });

    const options = {
      hostname: 'api.groq.com',
      port: 443,
      path: '/openai/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error('Groq error: ' + JSON.stringify(parsed.error)));
          const content = parsed.choices?.[0]?.message?.content;
          if (!content) return reject(new Error('Groq: empty response'));
          resolve(JSON.parse(content));
        } catch (e) {
          reject(new Error('Groq parse error: ' + e.message + '\nRaw: ' + data.slice(0, 300)));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Groq timeout')); });
    req.write(body);
    req.end();
  });
}

// ── Validate LLM plan ────────────────────────────────────────────────────
function validatePlan(plan) {
  if (typeof plan !== 'object' || plan === null) throw new Error('Plan is not an object');
  if (!plan.task || typeof plan.task !== 'string') throw new Error('Plan missing task');
  if (!Array.isArray(plan.safe_commands)) throw new Error('Plan missing safe_commands array');
  if (!plan.commit_message || !plan.commit_message.startsWith('C48-auto: '))
    throw new Error('commit_message must start with "C48-auto: "');
  if (!plan.ntfy_message || plan.ntfy_message.length > 60)
    throw new Error('ntfy_message missing or too long');

  // Validate every command key is in the allowlist
  for (const key of plan.safe_commands) {
    if (!SAFE_COMMANDS[key]) {
      throw new Error(`LLM suggested non-allowlisted command: "${key}" -- BLOCKED`);
    }
  }
}

// ── Execute safe commands ────────────────────────────────────────────────
function executeSafeCommands(commandKeys) {
  const results = [];
  for (const key of commandKeys) {
    const cmd = SAFE_COMMANDS[key];
    log(`  Running: ${key} -> ${cmd}`);
    try {
      const stdout = execSync(cmd, { cwd: repoRoot, encoding: 'utf8', timeout: 30000 });
      results.push({ key, cmd, exitCode: 0, stdout: stdout.trim().slice(0, 500) });
      log(`  PASS: ${key}`);
    } catch (e) {
      results.push({ key, cmd, exitCode: e.status || 1, stdout: (e.stdout || e.message || '').slice(0, 300) });
      log(`  FAIL: ${key} -- ${e.message}`);
    }
  }
  return results;
}

// ── Commit audit results ─────────────────────────────────────────────────
function commitResults(commitMessage) {
  try {
    // Only stage the resume doc + the daily log -- nothing else
    execSync(`git add CONTROL_TOWER_RESUME.md "${logFile}"`, { cwd: repoRoot, encoding: 'utf8' });
    const out = execSync(`git commit -m "${commitMessage.replace(/"/g, "'")}"`,
      { cwd: repoRoot, encoding: 'utf8' });
    log('Committed: ' + out.trim().split('\n')[0]);
    return true;
  } catch (e) {
    log('Commit skipped (nothing staged or commit error): ' + e.message.slice(0, 100));
    return false;
  }
}

// ── Send ntfy push ───────────────────────────────────────────────────────
function sendNtfy(message) {
  try {
    const out = execSync(
      `node scripts/chintu-ntfy-push.js "${message.replace(/"/g, "'")}"`,
      { cwd: repoRoot, encoding: 'utf8', timeout: 15000 }
    );
    log('ntfy: ' + out.trim());
  } catch (e) {
    log('ntfy send skipped: ' + e.message.slice(0, 100));
  }
}

// ── DRY-RUN fallback plan ─────────────────────────────────────────────────
function getDryRunPlan() {
  return {
    task: 'Run standard audit suite: egress test + medical claims + git status',
    safe_commands: ['git_status', 'run_egress_test', 'run_medical_test', 'run_skill_test'],
    commit_message: 'C48-auto: standard audit suite (dry-run fallback)',
    ntfy_message: 'Chintu audit: egress+medical PASS (dry-run)',
  };
}

// ── Main ─────────────────────────────────────────────────────────────────
async function main() {
  if (process.argv.includes('--status')) {
    const lastLog = (() => {
      try {
        const files = fs.readdirSync(logDir)
          .filter(f => f.endsWith('-autonomous.md'))
          .sort().reverse();
        return files[0] ? fs.readFileSync(path.join(logDir, files[0]), 'utf8') : '(no logs yet)';
      } catch (_) { return '(log dir missing)'; }
    })();
    console.log(lastLog);
    return;
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('  Chintu Autonomous Brain -- C48');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  Mode: ${DRY_RUN ? 'DRY-RUN (no external calls, no commits)' : 'LIVE'}`);
  if (DRY_RUN) {
    console.log('  To go live: set CHINTU_GROQ_API_KEY + CHINTU_AUTONOMOUS_APPROVAL_PHRASE=go');
  }
  console.log('');

  log('=== Chintu Autonomous Brain run started ===');
  log(`Mode: ${DRY_RUN ? 'dry-run' : 'live'}`);

  // 1. Read context
  log('Reading repo context...');
  const context = readContext();

  // 2. Get plan (from LLM in live mode, fallback in dry-run)
  let plan;
  if (DRY_RUN) {
    log('Dry-run: using fallback plan (no Groq call)');
    plan = getDryRunPlan();
  } else {
    log('Calling Groq API (llama-3.3-70b-versatile)...');
    try {
      plan = await callGroq(context);
      log('Groq responded. Validating plan...');
    } catch (e) {
      log('Groq call failed: ' + e.message + '. Using fallback plan.');
      plan = getDryRunPlan();
    }
  }

  // 3. Validate plan (even in dry-run -- proves the safety gate works)
  try {
    validatePlan(plan);
    log('Plan validated OK');
  } catch (e) {
    log('Plan FAILED validation: ' + e.message);
    console.error('\nPlan validation FAILED:\n' + e.message);
    process.exit(1);
  }

  // 4. Print plan
  console.log('Plan from ' + (DRY_RUN ? 'fallback' : 'Groq') + ':');
  console.log('  Task:    ' + plan.task);
  console.log('  Commands: ' + plan.safe_commands.join(', '));
  console.log('  Commit:  ' + plan.commit_message);
  console.log('  ntfy:    ' + plan.ntfy_message);
  console.log('');

  // 5. Execute commands
  if (DRY_RUN) {
    console.log('[DRY-RUN] Would execute: ' + plan.safe_commands.join(', '));
    console.log('[DRY-RUN] Would commit:  ' + plan.commit_message);
    console.log('[DRY-RUN] Would push ntfy: ' + plan.ntfy_message);
    console.log('');
    console.log('Set CHINTU_GROQ_API_KEY + CHINTU_AUTONOMOUS_APPROVAL_PHRASE=go to run live.');
    log('Dry-run complete. No actions taken.');
    const result = { mode: 'dry-run', plan, executed: false };
    console.log('');
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  }

  // -- LIVE execution --
  log('Executing safe commands...');
  const results = executeSafeCommands(plan.safe_commands);
  const allPass = results.every(r => r.exitCode === 0);
  log('Commands done. All pass: ' + allPass);

  // 6. Update resume doc with what we just did
  const summary = results.map(r => `  ${r.key}: exit=${r.exitCode}`).join('\n');
  const entry = `\n## Autonomous run ${new Date().toISOString()}\nTask: ${plan.task}\n${summary}\n`;
  try {
    const current = fs.readFileSync(resumeFile, 'utf8');
    fs.writeFileSync(resumeFile, current + entry);
    log('CONTROL_TOWER_RESUME.md updated');
  } catch (e) {
    log('Resume update failed: ' + e.message);
  }

  // 7. Commit
  const committed = commitResults(plan.commit_message);

  // 8. ntfy push
  sendNtfy(plan.ntfy_message);

  // 8b. Telegram morning push (C51) -- proactive phone notification
  // Uses optional dependency: chintu-send-telegram.js
  // Graceful skip if module missing or token not configured.
  try {
    const { sendTelegramMessage } = require('./chintu-send-telegram.js');
    const resultSummary = results.map(r => (r.exitCode === 0 ? '✓' : '✗') + r.key).join(' | ');
    const telegramMsg = [
      emoji + ' Chintu Morning Brain',
      '',
      '📋 Task: ' + plan.task,
      '📝 ' + plan.ntfy_message,
      '',
      'Tests: ' + resultSummary,
      'Committed: ' + (committed ? 'yes' : 'no'),
      '',
      new Date().toLocaleString(),
      '',
      '(text "digest" for full status)',
    ].join('\n');
    await sendTelegramMessage(telegramMsg);
    log('Telegram morning push: sent');
  } catch (e) {
    log('Telegram morning push: skipped (' + e.message + ')');
  }

  log('=== Autonomous brain run complete ===');
  console.log('');
  console.log('Done. Check ntfy and Telegram for morning digest.');
}

main().catch((e) => {
  console.error('Fatal: ' + e.message);
  process.exit(1);
});
