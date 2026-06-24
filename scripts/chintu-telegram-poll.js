#!/usr/bin/env node
'use strict';

/**
 * Chintu Telegram Poll -- Stage C50
 *
 * One-shot poller. Run by Task Scheduler every 1 minute.
 * Loads offset from disk -> polls ALL pending Telegram updates ->
 * executes SAFE_COMMANDS -> sends replies -> saves new offset -> exits.
 *
 * No infinite loop. Exits cleanly after one poll cycle.
 *
 * Required env vars (set once via setup-c50.ps1):
 *   TELEGRAM_BOT_TOKEN                  -- your bot token (never printed)
 *   CHINTU_TELEGRAM_ALLOWED_CHAT_IDS    -- comma-separated chat IDs (founder only)
 *   CHINTU_TELEGRAM_ALLOWED_SENDER_IDS  -- comma-separated sender IDs (founder only)
 *   CHINTU_TELEGRAM_SEND_ENABLED=1      -- must be exactly "1" to send replies
 *
 * Optional:
 *   CHINTU_TELEGRAM_POLL_LIMIT=10       -- max updates per poll (default 10)
 *
 * Usage:
 *   node scripts/chintu-telegram-poll.js            -- live (needs env vars)
 *   node scripts/chintu-telegram-poll.js --dry-run  -- no send, no execute, show plan
 *   node scripts/chintu-telegram-poll.js --status   -- show last poll result
 *
 * Security rules (enforced in code):
 *   NEVER print token, chat IDs, sender IDs, or health data.
 *   NEVER execute commands from non-allowlisted senders.
 *   NEVER run commands not in SAFE_COMMANDS allowlist.
 *   NEVER send replies without CHINTU_TELEGRAM_SEND_ENABLED=1.
 *   NEVER commit offset file (in .gitignore).
 */

const fs         = require('fs');
const path       = require('path');
const https      = require('https');
const { execSync } = require('child_process');

const repoRoot   = path.resolve(__dirname, '..');
const vaultDir   = path.join(repoRoot, 'CHINTU_MEMORY_VAULT');
const offsetFile = path.join(vaultDir, 'telegram_offset.json');
const logDir     = path.join(vaultDir, 'DAILY_LOGS');
const logFile    = path.join(logDir, new Date().toISOString().slice(0, 10) + '-telegram-poll.md');
const auditFile  = path.join(repoRoot, 'CHINTU_OUTBOX', 'telegram_poll_audit.jsonl');

// ── SAFE_COMMANDS allowlist ────────────────────────────────────────────────
// C50: same list as chintu-autonomous-brain.js.
// The LLM (and Telegram founder commands) can only trigger keys from this dict.
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

  // Repo inventory (Node-based, Windows-safe)
  'count_scripts':       'node -e "const fs=require(\'fs\'); const n=fs.readdirSync(\'scripts\').filter(f=>/^chintu-/.test(f)).length; console.log(n+\' chintu scripts\')"',
  'list_chintu_scripts': 'node -e "const fs=require(\'fs\'); fs.readdirSync(\'scripts\').filter(f=>/^chintu-/.test(f)).forEach(f=>console.log(f))"',

  // Resume context (last 30 lines)
  'read_resume_tail':    'node -e "const fs=require(\'fs\'); const lines=fs.readFileSync(\'CONTROL_TOWER_RESUME.md\',\'utf8\').split(\'\\n\'); console.log(lines.slice(-30).join(\'\\n\'))"',

  // BALA health check
  'check_bala_files':    'node -e "const fs=require(\'fs\'); const files=[\'index.html\',\'app.js\',\'sw.js\',\'styles.css\']; files.forEach(f=>console.log(f+(fs.existsSync(f)?\' OK\':\' MISSING\')))"',
};

// ── Natural language aliases → SAFE_COMMANDS keys ─────────────────────────
// Founder can text these phrases from their phone.
const COMMAND_ALIASES = {
  'git status':     'git_status',
  'status':         'git_status',
  'git log':        'git_log',
  'log':            'git_log',
  'today':          'git_log_today',
  'untracked':      'list_untracked',
  'check app':      'node_check_app',
  'check sw':       'node_check_sw',
  'check brain':    'node_check_brain',
  'test egress':    'run_egress_test',
  'test medical':   'run_medical_test',
  'test skills':    'run_skill_test',
  'test':           'run_all_tests',
  'tests':          'run_all_tests',
  'run tests':      'run_all_tests',
  'count':          'count_scripts',
  'scripts':        'list_chintu_scripts',
  'list scripts':   'list_chintu_scripts',
  'resume':         'read_resume_tail',
  'tail':           'read_resume_tail',
  'bala':           'check_bala_files',
  'check bala':     'check_bala_files',
};

// Help text sent when founder types "help" or "?" (safe to send -- no secrets)
const HELP_TEXT = [
  'Chintu C50 -- Telegram command bridge',
  '',
  'Available commands:',
  '  status / git status   -- git status --short',
  '  log / git log         -- last 10 commits',
  '  today                 -- commits since midnight',
  '  test / run tests      -- full test suite',
  '  bala / check bala     -- BALA file health',
  '  count                 -- count chintu scripts',
  '  scripts / list scripts-- list all chintu scripts',
  '  resume / tail         -- last 30 lines of resume doc',
  '  check app/sw/brain    -- syntax check',
  '  help / ?              -- this message',
  '',
  'Or use exact key names:',
  '  ' + Object.keys(SAFE_COMMANDS).join(', '),
].join('\n');

// ── Logging ────────────────────────────────────────────────────────────────
function log(msg) {
  const ts = new Date().toISOString();
  const line = '[' + ts + '] ' + msg;
  console.log(line);
  try {
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(logFile, line + '\n');
  } catch (_) { /* non-fatal */ }
}

function appendAudit(entry) {
  try {
    const dir = path.join(repoRoot, 'CHINTU_OUTBOX');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(auditFile, JSON.stringify(
      Object.assign({ timestamp: new Date().toISOString() }, entry)
    ) + '\n');
  } catch (_) { /* non-fatal */ }
}

// ── Offset persistence ─────────────────────────────────────────────────────
function loadOffset() {
  try {
    const raw = fs.readFileSync(offsetFile, 'utf8');
    const parsed = JSON.parse(raw);
    return Number.isFinite(parsed.offset) ? parsed.offset : null;
  } catch (_) {
    return null; // first run -- no offset yet
  }
}

function saveOffset(offset) {
  try {
    if (!fs.existsSync(vaultDir)) fs.mkdirSync(vaultDir, { recursive: true });
    fs.writeFileSync(offsetFile, JSON.stringify({ offset, savedAt: new Date().toISOString() }));
  } catch (e) {
    log('WARNING: could not save offset: ' + e.message);
  }
}

// ── Token handling (never print) ───────────────────────────────────────────
function loadToken(env) {
  return String(env.TELEGRAM_BOT_TOKEN || '').trim().replace(/^["']|["']$/g, '').replace(/^bot/i, '');
}

function redactToken(text, token) {
  if (!token || token.length < 8) return text;
  return String(text).replace(new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '[REDACTED]');
}

// ── Allowlist check ────────────────────────────────────────────────────────
function csvIds(env, name) {
  return String(env[name] || '').split(',').map(s => s.trim()).filter(Boolean);
}

function isAllowlisted(chatId, senderId, env) {
  const chatIds   = csvIds(env, 'CHINTU_TELEGRAM_ALLOWED_CHAT_IDS');
  const senderIds = csvIds(env, 'CHINTU_TELEGRAM_ALLOWED_SENDER_IDS');
  if (chatIds.length === 0 && senderIds.length === 0) return false;
  if (chatIds.length   > 0 && !chatIds.includes(String(chatId)))   return false;
  if (senderIds.length > 0 && !senderIds.includes(String(senderId))) return false;
  return true;
}

// ── Telegram HTTP helpers ──────────────────────────────────────────────────
const TELEGRAM_TIMEOUT_MS = 12000;

function telegramRequest(token, method, bodyObj) {
  return new Promise((resolve, reject) => {
    const body = bodyObj ? JSON.stringify(bodyObj) : null;
    const opts = {
      protocol: 'https:',
      hostname: 'api.telegram.org',
      path:     '/bot' + token + '/' + method,
      method:   body ? 'POST' : 'GET',
      headers:  body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {},
    };
    const req = https.request(opts, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try { json = JSON.parse(raw); } catch (_) { reject(new Error('Non-JSON response from Telegram')); return; }
        resolve({ statusCode: res.statusCode, json });
      });
    });
    req.setTimeout(TELEGRAM_TIMEOUT_MS, () => { req.destroy(); reject(new Error('Telegram request timed out')); });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function getUpdates(token, offset, limit) {
  const params = 'timeout=1&limit=' + (limit || 10) + '&allowed_updates=%5B%22message%22%5D' +
    (Number.isFinite(offset) ? '&offset=' + offset : '');
  const res = await telegramRequest(token, 'getUpdates?' + params, null);
  if (res.statusCode !== 200 || !res.json || res.json.ok !== true) {
    throw new Error('getUpdates failed: HTTP ' + res.statusCode);
  }
  return res.json.result || [];
}

async function sendMessage(token, chatId, text) {
  const res = await telegramRequest(token, 'sendMessage', { chat_id: chatId, text, disable_web_page_preview: true });
  if (res.statusCode !== 200 || !res.json || res.json.ok !== true) {
    throw new Error('sendMessage failed: HTTP ' + res.statusCode);
  }
  return res.json.result;
}

// ── Command resolution ─────────────────────────────────────────────────────
function resolveCommand(text) {
  const norm = text.toLowerCase().replace(/\s+/g, ' ').trim();

  // Help request
  if (norm === 'help' || norm === '?') return { type: 'help' };

  // Exact SAFE_COMMANDS key
  if (SAFE_COMMANDS[norm]) return { type: 'command', key: norm };

  // Natural language alias
  if (COMMAND_ALIASES[norm]) return { type: 'command', key: COMMAND_ALIASES[norm] };

  // Partial prefix match (e.g. "git_log_today" typed with underscore)
  for (const key of Object.keys(SAFE_COMMANDS)) {
    if (norm === key.replace(/_/g, ' ')) return { type: 'command', key };
  }

  return { type: 'unknown', norm };
}

// ── Safe command execution ─────────────────────────────────────────────────
function runSafeCommand(key) {
  const cmd = SAFE_COMMANDS[key];
  if (!cmd) return { ok: false, output: 'Unknown command key: ' + key };
  try {
    const stdout = execSync(cmd, { cwd: repoRoot, encoding: 'utf8', timeout: 30000 });
    return { ok: true, output: stdout.trim().slice(0, 480) || '(no output)' };
  } catch (e) {
    const out = ((e.stdout || '') + (e.stderr || '') + (e.message || '')).slice(0, 480);
    return { ok: false, output: 'FAIL: ' + out };
  }
}

// ── Extract message fields from a Telegram update ─────────────────────────
function parseUpdate(update) {
  const msg    = update.message || update.edited_message;
  if (!msg) return null;
  const chat   = msg.chat   || {};
  const from   = msg.from   || {};
  return {
    updateId: update.update_id,
    chatId:   String(chat.id   || ''),
    senderId: String(from.id   || ''),
    senderName: [from.first_name, from.last_name].filter(Boolean).join(' ') || from.username || '(unknown)',
    text:     (msg.text || '').trim(),
  };
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  // --status: show last poll log
  if (process.argv.includes('--status')) {
    try {
      const files = fs.readdirSync(logDir).filter(f => f.endsWith('-telegram-poll.md')).sort().reverse();
      if (!files.length) { console.log('(no poll logs yet)'); return; }
      console.log(fs.readFileSync(path.join(logDir, files[0]), 'utf8'));
    } catch (_) { console.log('(log dir missing -- no runs yet)'); }
    return;
  }

  const dryRun    = process.argv.includes('--dry-run');
  const sendEnabled = String(process.env.CHINTU_TELEGRAM_SEND_ENABLED || '').trim() === '1';
  const token     = loadToken(process.env);
  const limit     = Number(process.env.CHINTU_TELEGRAM_POLL_LIMIT) || 10;

  console.log('');
  console.log('=== Chintu Telegram Poll -- C50 ===');
  console.log('Mode: ' + (dryRun ? 'DRY-RUN' : (sendEnabled ? 'LIVE (send enabled)' : 'LIVE (send DISABLED -- set CHINTU_TELEGRAM_SEND_ENABLED=1)')));
  console.log('');

  log('=== Poll run started (mode: ' + (dryRun ? 'dry-run' : 'live') + ') ===');

  if (!token) {
    log('ABORT: TELEGRAM_BOT_TOKEN not set. Run .\\setup-c50.ps1 first.');
    console.error('ERROR: TELEGRAM_BOT_TOKEN not set. Run .\\setup-c50.ps1 first.');
    process.exit(1);
  }

  // Load stored offset
  const offset = loadOffset();
  log('Polling Telegram (offset=' + (offset == null ? 'none (first run)' : offset) + ', limit=' + limit + ')');

  // Poll
  let updates;
  try {
    updates = await getUpdates(token, offset, limit);
  } catch (e) {
    log('ABORT: getUpdates failed: ' + redactToken(e.message, token));
    console.error('ERROR: ' + redactToken(e.message, token));
    process.exit(1);
  }

  log('Updates received: ' + updates.length);

  if (updates.length === 0) {
    log('No new updates. Nothing to do.');
    console.log('No new Telegram messages.');
    // No new offset to save when empty (keep current offset)
    process.exit(0);
  }

  // Compute new offset = max(update_id) + 1
  const maxUpdateId = Math.max.apply(null, updates.map(u => u.update_id || 0));
  const newOffset   = maxUpdateId + 1;

  let processed = 0;
  let replied   = 0;

  for (const update of updates) {
    const parsed = parseUpdate(update);
    if (!parsed) {
      log('Skipping update ' + update.update_id + ' (no message field)');
      continue;
    }

    const { updateId, chatId, senderId, senderName, text } = parsed;

    // Allowlist gate
    const allowed = isAllowlisted(chatId, senderId, process.env);
    if (!allowed) {
      log('BLOCKED update ' + updateId + ' from non-allowlisted sender (masked: ...' + senderId.slice(-3) + ')');
      appendAudit({ type: 'blocked', updateId, reason: 'not_allowlisted' });
      continue;
    }

    if (!text) {
      log('Skipping update ' + updateId + ' (no text)');
      continue;
    }

    log('Processing update ' + updateId + ' from ' + senderName + ': "' + text.slice(0, 60) + '"');
    processed++;

    // Resolve command
    const resolved = resolveCommand(text);
    let replyText  = '';

    if (resolved.type === 'help') {
      replyText = HELP_TEXT;
      log('  -> help requested');

    } else if (resolved.type === 'command') {
      const key = resolved.key;
      log('  -> command: ' + key);
      if (dryRun) {
        replyText = '[DRY-RUN] Would run: ' + key + '\n  $ ' + SAFE_COMMANDS[key];
      } else {
        log('  Running: ' + key + ' -> ' + SAFE_COMMANDS[key]);
        const result = runSafeCommand(key);
        replyText = (result.ok ? '' : '⚠️ ') + key + ':\n' + result.output;
        log('  Result: ' + (result.ok ? 'OK' : 'FAIL') + ' (' + result.output.length + ' chars)');
        appendAudit({
          type:     'command_executed',
          updateId,
          key,
          ok:       result.ok,
          outputLen: result.output.length,
        });
      }

    } else {
      // Unknown command -- friendly hint
      replyText =
        '🤔 Unknown command: "' + text.slice(0, 60) + '"\n\n' +
        'Send "help" to see available commands.';
      log('  -> unknown command');
      appendAudit({ type: 'unknown_command', updateId, text: text.slice(0, 80) });
    }

    // Send reply
    if (!replyText) continue;

    if (dryRun) {
      console.log('[DRY-RUN] Would send to chatId (masked): reply length=' + replyText.length);
      console.log('[DRY-RUN] Reply preview: ' + replyText.slice(0, 120));
    } else if (!sendEnabled) {
      log('  SEND DISABLED -- set CHINTU_TELEGRAM_SEND_ENABLED=1 to enable replies');
      console.log('Reply ready but SEND DISABLED. Set CHINTU_TELEGRAM_SEND_ENABLED=1.');
    } else {
      try {
        await sendMessage(token, chatId, replyText);
        log('  Replied to update ' + updateId);
        replied++;
        appendAudit({ type: 'reply_sent', updateId, replyLen: replyText.length });
      } catch (e) {
        log('  sendMessage FAILED: ' + redactToken(e.message, token));
        appendAudit({ type: 'send_error', updateId, error: redactToken(e.message, token) });
      }
    }
  }

  // Save new offset (even if dry-run -- advances position so we don't reprocess)
  saveOffset(newOffset);
  log('Offset advanced to ' + newOffset);

  // Summary
  const summary = 'Poll done. updates=' + updates.length + ' processed=' + processed + ' replied=' + replied;
  log(summary);
  console.log('');
  console.log(summary);
  console.log('Next offset: ' + newOffset);

  log('=== Poll run complete ===');
  process.exit(0);
}

main().catch((e) => {
  const safe = String(e && e.message ? e.message : e).replace(/[A-Za-z0-9_-]{20,}:[A-Za-z0-9_-]{20,}/g, '[REDACTED]');
  console.error('Fatal: ' + safe);
  process.exit(1);
});
