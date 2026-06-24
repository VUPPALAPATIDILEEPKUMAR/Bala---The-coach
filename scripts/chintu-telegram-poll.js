#!/usr/bin/env node
'use strict';

/**
 * Chintu Telegram Poll -- Stage C51
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

// C52: Groq conversational brain (optional -- graceful skip if key missing)
let chatWithGroq;
try {
  ({ chatWithGroq } = require('./chintu-groq-chat'));
} catch (_) {
  chatWithGroq = async () => null; // helper not available
}

// C55: Groq tool-use (function calling) -- upgrades plain chat to smart agent
let chatWithGroqTools;
try {
  ({ chatWithGroqTools } = require('./chintu-groq-tools'));
} catch (_) {
  chatWithGroqTools = null; // tool-use not available, fall back to plain chat
}

// C53: Conversation memory (optional -- graceful skip if module missing)
let loadHistory, appendHistory, clearHistory;
try {
  ({ loadHistory, appendHistory, clearHistory } = require('./chintu-chat-memory'));
} catch (_) {
  loadHistory  = () => [];
  appendHistory = () => {};
  clearHistory  = () => {};
}

// C57: Voice I/O (optional — graceful skip if edge-tts / groq-whisper unavailable)
let transcribeVoiceMessage = null;
let replyWithVoice         = null;
try { ({ transcribeVoiceMessage } = require('./chintu-voice-in'));  } catch (_) {}
try { ({ replyWithVoice }         = require('./chintu-voice-out')); } catch (_) {}
// C60: Location memory (optional — graceful skip if chintu-prefs unavailable)
let saveLocationFn = null;
try { ({ saveLocation: saveLocationFn } = require('./chintu-prefs')); } catch (_) {}

const repoRoot   = path.resolve(__dirname, '..');
const vaultDir   = path.join(repoRoot, 'CHINTU_MEMORY_VAULT');
const offsetFile = path.join(vaultDir, 'telegram_offset.json');
const logDir     = path.join(vaultDir, 'DAILY_LOGS');
const logFile    = path.join(logDir, new Date().toISOString().slice(0, 10) + '-telegram-poll.md');
const auditFile  = path.join(repoRoot, 'CHINTU_OUTBOX', 'telegram_poll_audit.jsonl');

// ── SAFE_COMMANDS allowlist ────────────────────────────────────────────────
// C51: expanded with power commands (push, diff, brain, bala-audit).
// The LLM (and Telegram founder commands) can only trigger keys from this dict.
// Keys marked [WRITE] make external changes -- clearly documented.
const SAFE_COMMANDS = {
  // ── Git ops (read-only) ──────────────────────────────────────────────────
  'git_status':          'git status --short',
  'git_log':             'git log --oneline -10',
  'git_log_today':       'git log --oneline --since=midnight',
  'git_diff':            'git diff --stat HEAD~1',
  'list_untracked':      'git ls-files --others --exclude-standard scripts/',

  // ── Syntax checks ────────────────────────────────────────────────────────
  'node_check_app':      'node --check app.js',
  'node_check_sw':       'node --check sw.js',
  'node_check_brain':    'node --check scripts/chintu-autonomous-brain.js',
  'node_check_poll':     'node --check scripts/chintu-telegram-poll.js',
  'node_check_send':     'node --check scripts/chintu-send-telegram.js',

  // ── Test suite ───────────────────────────────────────────────────────────
  'run_egress_test':     'node scripts/chintu-no-network-egress.test.js',
  'run_medical_test':    'node scripts/chintu-medical-claims.test.js',
  'run_skill_test':      'node -e "require(\'./scripts/chintu-skill-contracts.js\'); console.log(\'skill-contracts: PASS\')"',
  'run_all_tests':       'node scripts/chintu-no-network-egress.test.js && node scripts/chintu-medical-claims.test.js',

  // ── Repo inventory (Node-based, Windows-safe) ────────────────────────────
  'count_scripts':       'node -e "const fs=require(\'fs\'); const n=fs.readdirSync(\'scripts\').filter(f=>/^chintu-/.test(f)).length; console.log(n+\' chintu scripts\')"',
  'list_chintu_scripts': 'node -e "const fs=require(\'fs\'); fs.readdirSync(\'scripts\').filter(f=>/^chintu-/.test(f)).forEach(f=>console.log(f))"',

  // ── Resume context (last 30 lines) ───────────────────────────────────────
  'read_resume_tail':    'node -e "const fs=require(\'fs\'); const lines=fs.readFileSync(\'CONTROL_TOWER_RESUME.md\',\'utf8\').split(\'\\n\'); console.log(lines.slice(-30).join(\'\\n\'))"',

  // ── BALA health audit ────────────────────────────────────────────────────
  'check_bala_files':    'node -e "const fs=require(\'fs\'); const files=[\'index.html\',\'app.js\',\'sw.js\',\'styles.css\']; files.forEach(f=>console.log(f+(fs.existsSync(f)?\' OK\':\' MISSING\')))"',
  'bala_audit':          'node -e "const fs=require(\'fs\'); const files=[\'index.html\',\'app.js\',\'sw.js\',\'styles.css\',\'manifest.webmanifest\',\'privacy.html\']; let ok=0; files.forEach(f=>{const e=fs.existsSync(f); if(e)ok++; console.log((e?\'✓\':\'✗\')+\' \'+f)}); console.log(ok+\'/\'+files.length+\' BALA files present\')"',

  // ── Autonomous brain (dry-run by default -- safe to trigger from phone) ──
  'run_brain':           'node scripts/chintu-autonomous-brain.js',

  // ── [WRITE] Git push tracked files (git add -u only -- no new untracked) ─
  // git add -u updates already-tracked files only. No git add -A. No force-push.
  'git_push':            'git add -u && git commit -m "Chintu: quick push from phone" && git push origin main',
};

// ── Natural language aliases → SAFE_COMMANDS keys ─────────────────────────
// Founder can text these phrases from their phone.
// Special values: 'digest' → multi-command digest (handled in resolveCommand)
const COMMAND_ALIASES = {
  // ── Status / git ────────────────────────────────────────────────────────
  'git status':     'git_status',
  'status':         'git_status',
  's':              'git_status',
  'git log':        'git_log',
  'log':            'git_log',
  'l':              'git_log',
  'today':          'git_log_today',
  'commits':        'git_log_today',
  'diff':           'git_diff',
  'what changed':   'git_diff',
  'last diff':      'git_diff',
  'untracked':      'list_untracked',

  // ── Syntax checks ───────────────────────────────────────────────────────
  'check app':      'node_check_app',
  'check sw':       'node_check_sw',
  'check brain':    'node_check_brain',
  'check poll':     'node_check_poll',

  // ── Tests ───────────────────────────────────────────────────────────────
  'test egress':    'run_egress_test',
  'test medical':   'run_medical_test',
  'test skills':    'run_skill_test',
  'test':           'run_all_tests',
  'tests':          'run_all_tests',
  't':              'run_all_tests',
  'run tests':      'run_all_tests',

  // ── Repo inventory ──────────────────────────────────────────────────────
  'count':          'count_scripts',
  'scripts':        'list_chintu_scripts',
  'list scripts':   'list_chintu_scripts',

  // ── Resume / context ────────────────────────────────────────────────────
  'resume':         'read_resume_tail',
  'tail':           'read_resume_tail',
  'context':        'read_resume_tail',

  // ── BALA ────────────────────────────────────────────────────────────────
  'bala':           'check_bala_files',
  'check bala':     'check_bala_files',
  'bala audit':     'bala_audit',
  'audit bala':     'bala_audit',

  // ── Brain ────────────────────────────────────────────────────────────────
  'brain':          'run_brain',
  'run brain':      'run_brain',
  'think':          'run_brain',

  // ── Power: push from phone ───────────────────────────────────────────────
  'push':           'git_push',
  'quick push':     'git_push',
  'ship':           'git_push',

  // ── Digest (multi-command -- special handling in resolveCommand) ─────────
  'digest':         '__digest__',
  'morning':        '__digest__',
  'd':              '__digest__',
  'summary':        '__digest__',
  'daily':          '__digest__',
  // C53: clear conversation history
  'forget':         '__clear_history__',
  'reset':          '__clear_history__',
  'clear':          '__clear_history__',
};

// Help text sent when founder types "help" or "?" (safe to send -- no secrets)
const HELP_TEXT = [
  '🤖 Chintu C51 -- Telegram Remote',
  '',
  '📊 STATUS',
  '  status / s       -- git status',
  '  log / l          -- last 10 commits',
  '  today / commits  -- commits since midnight',
  '  diff             -- what changed in last commit',
  '  digest / morning -- full digest (status+today+bala)',
  '',
  '🧪 TESTS',
  '  test / t         -- run all tests',
  '  test egress      -- egress safety test',
  '  test medical     -- medical claims test',
  '',
  '🔵 BALA',
  '  bala             -- BALA core files check',
  '  bala audit       -- full BALA file audit',
  '',
  '🧠 BRAIN',
  '  brain            -- run autonomous brain (dry-run)',
  '  resume / context -- last 30 lines of resume doc',
  '',
  '🚀 POWER',
  '  push / ship      -- git add -u + commit + push',
  '  count            -- count chintu scripts',
  '  scripts          -- list all chintu scripts',
  '  check app/sw     -- syntax checks',
  '',
  '  help / ?         -- this message',
  '',
  '🧠 MEMORY (C53)',
  '  forget / reset   -- clear conversation history',
  '',
  '🎙️ VOICE (C57)',
  '  Send a voice note  -- Chintu hears, thinks, replies with voice',
  '  (requires: pip install edge-tts)',
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
      path:     '/bot' + encodeURIComponent(token).replace(/%3A/gi, ':') + '/' + method,
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


// ── C60: Reverse geocode via Nominatim (free, no key) ─────────────────────────
function nominatimReverse(lat, lng) {
  return new Promise((resolve) => {
    const opts = {
      hostname: 'nominatim.openstreetmap.org',
      path:     '/reverse?format=json&lat=' + lat + '&lon=' + lng + '&zoom=10&accept-language=en',
      method:   'GET',
      headers:  { 'User-Agent': 'Chintu-OS/1.0 (personal assistant, local only)' },
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          const a = j.address || {};
          const city  = a.city || a.town || a.village || a.county || '';
          const state = a.state || '';
          const country = a.country || '';
          resolve([city, state, country].filter(Boolean).join(', ') || j.display_name || 'Unknown');
        } catch (_) { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(8000, () => { req.destroy(); resolve(null); });
    req.end();
  });
}

// ── Command resolution ─────────────────────────────────────────────────────
function resolveCommand(text) {
  const norm = text.toLowerCase().replace(/\s+/g, ' ').trim();

  // Help request
  if (norm === 'help' || norm === '?') return { type: 'help' };

  // Exact SAFE_COMMANDS key (typed directly)
  if (SAFE_COMMANDS[norm]) return { type: 'command', key: norm };

  // Natural language alias
  const alias = COMMAND_ALIASES[norm];
  if (alias) {
    // Special multi-command digest
    if (alias === '__digest__') return { type: 'digest' };
    if (alias === '__clear_history__') return { type: 'clear_history' };
    return { type: 'command', key: alias };
  }

  // Partial prefix match (e.g. "git log today" typed with spaces instead of underscores)
  for (const key of Object.keys(SAFE_COMMANDS)) {
    if (norm === key.replace(/_/g, ' ')) return { type: 'command', key };
  }

  return { type: 'chat', rawText: text };
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
    voice:    msg.voice || null,    // C57: voice message object (.file_id, .duration, .mime_type)
    location: msg.location || null,  // C60: Telegram location share
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
  console.log('=== Chintu Telegram Poll -- C51 ===');
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

    const { updateId, chatId, senderId, senderName, text, voice, location } = parsed;

    // Allowlist gate
    const allowed = isAllowlisted(chatId, senderId, process.env);
    if (!allowed) {
      log('BLOCKED update ' + updateId + ' from non-allowlisted sender (masked: ...' + senderId.slice(-3) + ')');
      appendAudit({ type: 'blocked', updateId, reason: 'not_allowlisted' });
      continue;
    }


    // C60: Telegram location share — save + reverse geocode + confirm
    if (location) {
      const { latitude, longitude } = location;
      log('  -> location share (' + latitude + ', ' + longitude + ')');

      if (dryRun) {
        console.log('[DRY-RUN] Would reverse-geocode (' + latitude + ', ' + longitude + ') and save to prefs');
        processed++;
        continue;
      }

      let placeName = 'your location';
      try {
        const geo = await nominatimReverse(latitude, longitude);
        if (geo) placeName = geo;
      } catch (_) {}

      if (saveLocationFn) {
        try { saveLocationFn(latitude, longitude, placeName); } catch (_) {}
      }

      if (sendEnabled) {
        await sendMessage(token, chatId,
          '📍 Location saved: ' + placeName + '.\n' +
          'I\'ll use this for listings, deals, and travel searches. Just ask!'
        );
        replied++;
      }
      appendAudit({ type: 'location_saved', updateId, place: placeName });
      processed++;
      continue;
    }

        // C57: Voice message handler — runs BEFORE text check (voice has no text field)
    if (voice) {
      const groqKey = String(process.env.CHINTU_GROQ_API_KEY || '').trim();
      const hasVoiceModules = transcribeVoiceMessage && replyWithVoice;
      log('  -> voice message (duration: ' + (voice.duration || '?') + 's, modules: ' + (hasVoiceModules ? 'OK' : 'missing') + ')');

      if (dryRun) {
        console.log('[DRY-RUN] Would transcribe voice + reply with voice note (edge-tts + Groq Whisper)');
        processed++;
        continue;
      }

      if (!hasVoiceModules || !groqKey) {
        if (sendEnabled) {
          await sendMessage(token, chatId, '🎙️ Voice mode not ready yet. Run setup-c57.ps1 first.');
        }
        processed++;
        continue;
      }

      if (!sendEnabled) {
        log('  SEND DISABLED -- voice reply skipped (set CHINTU_TELEGRAM_SEND_ENABLED=1)');
        processed++;
        continue;
      }

      // 1. Transcribe voice → text
      const transcript = await transcribeVoiceMessage(voice.file_id, token, groqKey);

      if (!transcript) {
        await sendMessage(token, chatId, '🎙️ Hmm, I couldn\'t catch that. Try again?');
        appendAudit({ type: 'voice_transcribe_failed', updateId });
        processed++;
        replied++;
        continue;
      }

      log('  Transcript: "' + transcript.slice(0, 60) + (transcript.length > 60 ? '…' : '') + '"');

      // 2. Load conversation history, run Groq tool-use brain
      const history = loadHistory(chatId);
      let groqReply = null;

      if (chatWithGroqTools) {
        try { groqReply = await chatWithGroqTools(transcript, history); } catch (_) {}
      }
      if (!groqReply) {
        groqReply = await chatWithGroq(transcript, '', history);
      }

      if (groqReply) {
        // 3. Save to conversation memory
        appendHistory(chatId, 'user',      '🎙️ ' + transcript);
        appendHistory(chatId, 'assistant', groqReply);

        // 4. Reply with voice note; fall back to text if TTS fails
        const voiceSent = await replyWithVoice(chatId, groqReply, token);
        if (voiceSent) {
          log('  Voice reply sent (' + groqReply.length + ' chars)');
        } else {
          // TTS or upload failed — send text so founder gets the answer
          await sendMessage(token, chatId, '🎙️ ' + groqReply);
          log('  TTS failed — sent text fallback');
        }
        replied++;
      } else {
        await sendMessage(token, chatId, '🎙️ Brain offline right now. Try again in a moment.');
        replied++;
      }

      appendAudit({ type: 'voice_message', updateId, transcriptLen: transcript.length });
      processed++;
      continue;   // do not fall through to text command handling
    }

    if (!text) {
      log('Skipping update ' + updateId + ' (no text, no voice)');
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

    } else if (resolved.type === 'digest') {
      // Multi-command morning digest -- runs 3 commands, combines output
      log('  -> digest (multi-command)');
      const ts = new Date().toLocaleString();
      const parts = ['🤖 Chintu Digest [' + ts + ']'];

      const digestSteps = [
        { key: 'git_status',       icon: '📁', label: 'Git' },
        { key: 'git_log_today',    icon: '📅', label: 'Today' },
        { key: 'check_bala_files', icon: '🔵', label: 'BALA' },
      ];

      if (dryRun) {
        parts.push('\n[DRY-RUN] Would run: ' + digestSteps.map(s => s.key).join(', '));
      } else {
        for (const step of digestSteps) {
          const r = runSafeCommand(step.key);
          const out = (r.output || '(no output)').trim().slice(0, 200);
          parts.push('\n' + step.icon + ' ' + step.label + ':\n' + out);
        }
      }

      replyText = parts.join('\n').slice(0, 3500);
      log('  Digest assembled (' + replyText.length + ' chars)');

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

    } else if (resolved.type === 'clear_history') {
      // Forget conversation history for this chat
      clearHistory(chatId);
      replyText = '🧹 Memory cleared. Starting fresh!';
      log('  -> clear_history for chatId (masked: ...' + String(chatId).slice(-3) + ')');
      appendAudit({ type: 'clear_history', updateId });

    } else if (resolved.type === 'chat') {
      // Natural language -> Groq conversational brain (C52)
      // With rolling conversation history (C53)
      log('  -> groq chat: "' + text.slice(0, 60) + '"');
      if (dryRun) {
        replyText = '[DRY-RUN] Would ask Groq: "' + text.slice(0, 60) + '"';
      } else {
        // Load conversation history for multi-turn context
        const history = loadHistory(chatId);
        let groqReply = null;

        // C55: Try tool-use agent first (Groq decides what data to fetch)
        if (chatWithGroqTools) {
          try {
            groqReply = await chatWithGroqTools(text, history);
            if (groqReply) log('  Groq tools replied (' + groqReply.length + ' chars)');
          } catch (_) { groqReply = null; }
        }

        // Fallback: plain Groq chat with pre-built context (C54)
        if (!groqReply) {
          const ctxParts = [];
          try { ctxParts.push('Git status: ' + runSafeCommand('git_status').output.slice(0, 250)); } catch (_) {}
          try { ctxParts.push('Recent commits: ' + runSafeCommand('git_log').output.slice(0, 200)); } catch (_) {}
          try { ctxParts.push('BALA files: ' + runSafeCommand('check_bala_files').output.slice(0, 120)); } catch (_) {}
          try { ctxParts.push('Today commits: ' + runSafeCommand('git_log_today').output.slice(0, 150)); } catch (_) {}
          const ctx = ctxParts.join('\n');
          groqReply = await chatWithGroq(text, ctx, history);
          if (groqReply) log('  Groq plain replied (' + groqReply.length + ' chars)');
        }

        if (groqReply) {
          replyText = '🧠 ' + groqReply;
          // Save to rolling history
          appendHistory(chatId, 'user', text);
          appendHistory(chatId, 'assistant', groqReply);
        } else {
          replyText = '🤔 Brain offline (CHINTU_GROQ_API_KEY not set).\nTry "help" for commands.';
          log('  Groq unavailable -- returning fallback');
        }
      }
      appendAudit({ type: 'chat', updateId, text: text.slice(0, 80) });
    } else {
      // Fallback (should not reach here)
      log('  -> unhandled type: ' + resolved.type);
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
