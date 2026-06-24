/**
 * chintu-groq-tools.js -- C55
 *
 * Groq function-calling (tool use) for Telegram.
 * Groq decides which local tools to run, we execute them, return results.
 * Replaces the static context pre-load in chatWithGroq() with dynamic tool use.
 *
 * Architecture:
 *   1. User message arrives
 *   2. Call Groq with tool schemas + system prompt
 *   3. If Groq returns tool_calls: execute them locally, feed results back
 *   4. Repeat up to MAX_ROUNDS (prevents infinite loops)
 *   5. Return final text answer
 *
 * Tools exposed to Groq (all local, all free, all safe):
 *   git_status        -- current working tree state
 *   git_log           -- last 10 commits with hash + message
 *   git_log_today     -- commits since midnight only
 *   bala_health       -- check BALA core files exist + syntax
 *   read_resume       -- last 40 lines of CONTROL_TOWER_RESUME.md
 *   list_scripts      -- all chintu-*.js scripts
 *   search_web        -- DuckDuckGo instant answer (free, no key needed)
 *   get_time          -- current date + time
 *
 * Exports:
 *   chatWithGroqTools(userMessage, history) -> Promise<string|null>
 *
 * Safety:
 *   - Only runs commands from TOOL_COMMANDS (no shell injection)
 *   - API key never printed. No health data sent.
 *   - search_web: DuckDuckGo JSON API only (no auth, no tracking param)
 *   - Returns null gracefully on any error / missing key
 *   - MAX_ROUNDS = 3 (hard cap on tool-call loops)
 */

'use strict';

const https    = require('https');
const { execSync } = require('child_process');
const fs       = require('fs');
const path     = require('path');

const MODEL       = 'llama-3.3-70b-versatile';
const MAX_TOKENS  = 400;
const TEMPERATURE = 0.6;
const TIMEOUT_MS  = 25000;
const MAX_ROUNDS  = 3;  // max tool-call rounds before forcing final answer

const repoRoot = path.resolve(__dirname, '..');

// ── Safe commands Groq can call ────────────────────────────────────────────
const TOOL_COMMANDS = {
  git_status:    'git status --short',
  git_log:       'git log --oneline -10',
  git_log_today: 'git log --oneline --since=midnight',
  list_scripts:  'node -e "const fs=require(\'fs\'); fs.readdirSync(\'scripts\').filter(f=>/^chintu-/.test(f)).forEach(f=>console.log(f))"',
};

function runTool(name) {
  const cmd = TOOL_COMMANDS[name];
  if (!cmd) return '(unknown tool)';
  try {
    return execSync(cmd, { cwd: repoRoot, timeout: 8000, encoding: 'utf8' }).trim().slice(0, 600) || '(no output)';
  } catch (e) {
    return '(error: ' + e.message.slice(0, 80) + ')';
  }
}

function balaHealth() {
  const files = ['index.html', 'app.js', 'sw.js', 'styles.css', 'coach.js'];
  const results = files.map(f => {
    const exists = fs.existsSync(path.join(repoRoot, f));
    if (!exists) return f + ': MISSING';
    try {
      if (f.endsWith('.js')) execSync('node --check ' + path.join(repoRoot, f), { timeout: 5000 });
      return f + ': OK';
    } catch (_) {
      return f + ': SYNTAX ERROR';
    }
  });
  return results.join('\n');
}

function readResume() {
  try {
    const resumePath = path.join(repoRoot, 'CONTROL_TOWER_RESUME.md');
    if (!fs.existsSync(resumePath)) return '(CONTROL_TOWER_RESUME.md not found)';
    const lines = fs.readFileSync(resumePath, 'utf8').split('\n');
    return lines.slice(-40).join('\n').slice(0, 800);
  } catch (_) {
    return '(could not read resume)';
  }
}

function getTime() {
  return new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST';
}

// DuckDuckGo Instant Answers API -- free, no auth, no tracking required
function searchWeb(query) {
  return new Promise((resolve) => {
    const q = encodeURIComponent(query.slice(0, 120));
    const options = {
      hostname: 'api.duckduckgo.com',
      path:     '/?q=' + q + '&format=json&no_html=1&skip_disambig=1',
      method:   'GET',
      headers:  { 'User-Agent': 'Chintu-OS/1.0 (local personal assistant)' },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const answer = parsed.AbstractText || parsed.Answer || parsed.Definition || '';
          if (answer) return resolve(answer.slice(0, 400));
          // Fall back to related topics
          const topics = (parsed.RelatedTopics || []).slice(0, 3)
            .map(t => t.Text || '').filter(Boolean).join(' | ');
          resolve(topics.slice(0, 400) || '(no instant answer found)');
        } catch (_) {
          resolve('(search parse error)');
        }
      });
    });
    req.on('error', () => resolve('(search unavailable)'));
    req.setTimeout(8000, () => { req.destroy(); resolve('(search timeout)'); });
    req.end();
  });
}

// ── Tool schemas for Groq function calling ────────────────────────────────
const TOOL_SCHEMAS = [
  {
    type: 'function',
    function: {
      name: 'git_status',
      description: 'Get the current git working tree status (modified, staged, untracked files).',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'git_log',
      description: 'Get the last 10 git commits (hash + message). Use to understand recent work.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'git_log_today',
      description: 'Get commits made today (since midnight). Use for "what did I do today?" questions.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'bala_health',
      description: 'Check if BALA app core files exist and have valid syntax. Use for "is BALA healthy?" questions.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_resume',
      description: 'Read the last 40 lines of CONTROL_TOWER_RESUME.md -- the project memory with current stage, goals, and what\'s been built.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_scripts',
      description: 'List all chintu-*.js scripts in the scripts/ directory.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_web',
      description: 'Search the web using DuckDuckGo instant answers. Good for quick facts, definitions, current info.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query.' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_time',
      description: 'Get the current date and time (IST). Use when asked about time or date.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
];

// ── Execute a Groq tool call ───────────────────────────────────────────────
async function executeTool(name, args) {
  switch (name) {
    case 'git_status':    return runTool('git_status');
    case 'git_log':       return runTool('git_log');
    case 'git_log_today': return runTool('git_log_today');
    case 'bala_health':   return balaHealth();
    case 'read_resume':   return readResume();
    case 'list_scripts':  return runTool('list_scripts');
    case 'search_web':    return searchWeb((args && args.query) || '');
    case 'get_time':      return getTime();
    default:              return '(unknown tool: ' + name + ')';
  }
}

// ── Single Groq API call ───────────────────────────────────────────────────
function callGroqAPI(apiKey, messages, useTools) {
  return new Promise((resolve) => {
    const bodyObj = {
      model:       MODEL,
      messages,
      temperature: TEMPERATURE,
      max_tokens:  MAX_TOKENS,
    };
    if (useTools) {
      bodyObj.tools      = TOOL_SCHEMAS;
      bodyObj.tool_choice = 'auto';
    }
    const body = JSON.stringify(bodyObj);

    const options = {
      hostname: 'api.groq.com',
      port:     443,
      path:     '/openai/v1/chat/completions',
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Authorization':  'Bearer ' + apiKey,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) { resolve({ error: parsed.error.message }); return; }
          resolve({ choice: parsed.choices?.[0] });
        } catch (_) {
          resolve({ error: 'parse error' });
        }
      });
    });

    req.on('error', (e) => resolve({ error: e.message }));
    req.setTimeout(TIMEOUT_MS, () => { req.destroy(); resolve({ error: 'timeout' }); });
    req.write(body);
    req.end();
  });
}

// ── System prompt ──────────────────────────────────────────────────────────
const SYSTEM_PROMPT = [
  'You are Chintu, the personal AI assistant for Dileep — founder of BALA (mobile-first health-awareness app).',
  'You run locally on his laptop and respond via Telegram.',
  '',
  'Be warm, direct, conversational. Max 4 sentences unless detail is clearly needed.',
  'You have tools — use them when you need real data. Do not guess what you can look up.',
  'BALA is a health-awareness app. Chintu OS is the local-first agent system.',
  'Never invent technical facts. If unsure, say so honestly.',
  '',
  'When asked about: git state, BALA health, today\'s work, current time, project status, scripts — use your tools.',
  'When asked a general question, search_web for a quick answer before guessing.',
].join('\n');

// ── Main: chat with tool-use loop ──────────────────────────────────────────
async function chatWithGroqTools(userMessage, history) {
  const apiKey = process.env.CHINTU_GROQ_API_KEY;
  if (!apiKey) return null;

  // Build initial messages
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...(Array.isArray(history) ? history : []),
    { role: 'user',   content: userMessage.slice(0, 500) },
  ];

  let round = 0;

  while (round < MAX_ROUNDS) {
    round++;
    const useTools = round < MAX_ROUNDS; // last round: force text answer
    const { choice, error } = await callGroqAPI(apiKey, messages, useTools);
    if (error || !choice) return null;

    const msg = choice.message;
    if (!msg) return null;

    // If Groq returned text (no tool calls), we're done
    if (choice.finish_reason !== 'tool_calls' || !msg.tool_calls?.length) {
      return (msg.content || '').trim() || null;
    }

    // Execute all tool calls, collect results
    messages.push({ role: 'assistant', content: msg.content || '', tool_calls: msg.tool_calls });

    for (const tc of msg.tool_calls) {
      let args = {};
      try { args = JSON.parse(tc.function.arguments || '{}'); } catch (_) {}
      const result = await executeTool(tc.function.name, args);
      messages.push({
        role:         'tool',
        tool_call_id: tc.id,
        content:      String(result).slice(0, 600),
      });
    }
    // Loop: Groq sees tool results, produces next response
  }

  return null;
}

module.exports = { chatWithGroqTools };
