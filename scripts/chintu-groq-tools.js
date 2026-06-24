/**
 * chintu-groq-tools.js -- C56
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
 *   read_file         -- read any file in the repo (safety-guarded, C56)
 *   get_git_diff      -- diff of last commit (C56)
 *   get_weather       -- current weather via wttr.in (free, no key, C56)
 *
 * Exports:
 *   chatWithGroqTools(userMessage, history) -> Promise<string|null>
 *
 * Safety:
 *   - Only runs commands from TOOL_COMMANDS (no shell injection)
 *   - API key never printed. No health data sent.
 *   - search_web: DuckDuckGo JSON API only (no auth, no tracking param)
 *   - read_file: no ../ escapes, no MEMORY_VAULT, no dotfiles, stays inside repoRoot
 *   - get_weather: wttr.in plain text, city param length-capped and URL-encoded
 *   - Returns null gracefully on any error / missing key
 *   - MAX_ROUNDS = 3 (hard cap on tool-call loops)
 */

'use strict';

const https    = require('https');
const { execSync, spawnSync } = require('child_process');
const fs       = require('fs');
const path     = require('path');

const MODEL       = 'llama-3.3-70b-versatile';
const MAX_TOKENS  = 600;
const TEMPERATURE = 0.6;
const TIMEOUT_MS  = 25000;
const MAX_ROUNDS  = 5;  // max tool-call rounds (C60: agent chains need more rounds)

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

// C56: Read any file within the repo (safety: no ../, no vault, no dotfiles, max 2000 chars)
function readFile(filePath) {
  if (!filePath) return '(no path given)';
  const cleaned = filePath.replace(/\\/g, '/').replace(/\.\.\/+/g, '');
  if (cleaned.includes('MEMORY_VAULT') || cleaned.startsWith('.')) return '(access denied)';
  const allowed = /^[\w\-./]+$/.test(cleaned);
  if (!allowed) return '(path contains unsafe characters)';
  try {
    const target = path.resolve(repoRoot, cleaned);
    if (!target.startsWith(repoRoot)) return '(path outside repo)';
    if (!fs.existsSync(target)) return '(file not found: ' + cleaned + ')';
    const stat = fs.statSync(target);
    if (!stat.isFile()) return '(not a file)';
    const content = fs.readFileSync(target, 'utf8');
    const lines = content.split('\n');
    const preview = content.slice(0, 2000);
    return (lines.length > 60 ? '[first 2000 chars of ' + lines.length + ' lines]\n' : '') + preview;
  } catch (_) {
    return '(read error)';
  }
}

// C56: Git diff of last commit (what actually changed)
function getGitDiff() {
  try {
    const stat  = execSync('git diff --stat HEAD~1 HEAD', { cwd: repoRoot, timeout: 6000, encoding: 'utf8' }).trim();
    const patch = execSync('git diff HEAD~1 HEAD', { cwd: repoRoot, timeout: 6000, encoding: 'utf8' }).slice(0, 1000).trim();
    return 'Stat:\n' + stat.slice(0, 400) + '\n\nDiff (first 1000 chars):\n' + patch;
  } catch (_) {
    try {
      return execSync('git show --stat HEAD', { cwd: repoRoot, timeout: 6000, encoding: 'utf8' }).slice(0, 600).trim();
    } catch (_2) { return '(no diff available)'; }
  }
}

// C56: Free weather via wttr.in (no key, plain text output)
function getWeather(city) {
  const q = encodeURIComponent((city || 'Chennai').slice(0, 60));
  return new Promise((resolve) => {
    const options = {
      hostname: 'wttr.in',
      path:     '/' + q + '?format=3',
      method:   'GET',
      headers:  { 'User-Agent': 'Chintu-OS/1.0' },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve(data.trim().slice(0, 200) || '(no weather data)'));
    });
    req.on('error', () => resolve('(weather unavailable)'));
    req.setTimeout(8000, () => { req.destroy(); resolve('(weather timeout)'); });
    req.end();
  });
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


// ── C60: Preference memory (chintu-prefs.json at os.homedir, never in repo) ──
const { getPreferences, savePreference } = require('./chintu-prefs');

// ── C60: Specialized search helpers (DuckDuckGo + smart query construction) ──
function searchDeals(query, location, budget) {
  let q = String(query || '').trim();
  if (location) q += ' ' + String(location).slice(0, 40);
  if (budget)   q += ' ' + String(budget).slice(0, 30);
  return searchWeb(q + ' price best deal India 2024');
}

function searchListings(type, location, budget, config) {
  const typeMap = {
    rental: 'flat rent', buy: 'property sale',
    pg: 'PG accommodation', office: 'office space rent', land: 'land for sale',
  };
  let q = '';
  if (config) q += String(config).slice(0, 20) + ' ';
  q += (typeMap[type] || 'property') + ' ';
  q += String(location || '').slice(0, 40);
  if (budget) q += ' under ' + String(budget).slice(0, 30);
  return searchWeb(q + ' India 99acres magicbricks');
}

function searchCars(query, condition, budget, location) {
  let q = String(query || '').trim();
  if (condition === 'used') q += ' second hand used Cars24 OLX';
  else if (condition === 'new') q += ' new 2024 showroom price';
  if (budget)   q += ' ' + String(budget).slice(0, 30);
  if (location) q += ' ' + String(location).slice(0, 30);
  return searchWeb(q + ' India cardekho');
}

function searchTravel(type, fromCity, to, date, budget) {
  const typeMap = {
    flight: 'flights', train: 'trains IRCTC', hotel: 'hotels',
    bus: 'bus tickets', package: 'tour packages',
  };
  let q = (typeMap[type] || 'travel') + ' ';
  if (fromCity) q += String(fromCity).slice(0, 30) + ' to ';
  q += String(to || '').slice(0, 30);
  if (date)   q += ' ' + String(date).slice(0, 20);
  if (budget) q += ' under ' + String(budget).slice(0, 20);
  return searchWeb(q + ' cheapest India makemytrip');
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
  // C56 tools
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read a file from the project (repo root). Use when asked "what does X do?", "show me X", or to inspect any project file. Path is relative to repo root (e.g. "app.js", "scripts/chintu-groq-tools.js").',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative file path from repo root.' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_git_diff',
      description: 'Get the diff of the last commit -- what files changed and what the actual code changes were. Use for "what changed?", "what did the last commit do?", "explain the last commit".',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get current weather for a city using wttr.in (free, no key). Use when asked about weather.',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string', description: 'City name (default: Chennai).' },
        },
        required: [],
      },
    },
  },
  // C60: Memory tools
  {
    type: 'function',
    function: {
      name: 'remember_preference',
      description: "Save a personal preference for Dileep (monthly budget, rental budget, car budget, car type, home city, etc.). Call this IMMEDIATELY when Dileep states any budget or preference.",
      parameters: {
        type: 'object',
        properties: {
          key:   { type: 'string', description: 'Preference key: monthly_budget, car_budget, rental_budget, home_city, car_type, home_config, etc.' },
          value: { type: 'string', description: 'Preference value: 20000, Honda City, Hyderabad, 2BHK, etc.' },
        },
        required: ['key', 'value'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'recall_preferences',
      description: "Read ALL saved personal preferences (budgets, city, car type, etc.). ALWAYS call this before answering budget or location questions so you never ask Dileep twice.",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_my_location',
      description: "Get the last location Dileep shared via Telegram (city name + GPS coords). Use for 'near me', 'listings here', 'around my area' requests.",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  // C58: Vision + clipboard tools
  {
    type: 'function',
    function: {
      name: 'analyze_screenshot',
      description: 'Take a screenshot of the current Windows screen and analyze it with Groq vision. Use when user asks what is on screen, to read error messages, or describe what they see.',
      parameters: {
        type: 'object',
        properties: {
          question: { type: 'string', description: 'What to analyze or ask about the screenshot. Default: describe what you see.' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_clipboard',
      description: "Read the current text content of the Windows clipboard. Use when the user says 'I copied something' or 'check my clipboard' or pastes a URL/text they want analyzed.",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  // C60: Agentic search tools
  {
    type: 'function',
    function: {
      name: 'search_deals',
      description: "Find the best deals and prices on any product. Chain 2-3 calls with different query variations to cover multiple platforms.",
      parameters: {
        type: 'object',
        properties: {
          query:    { type: 'string', description: "Product name, e.g. 'iPhone 15 128GB' or 'LG washing machine 7kg'." },
          location: { type: 'string', description: 'Optional city.' },
          budget:   { type: 'string', description: "Optional budget, e.g. 'under 50000'." },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_listings',
      description: "Search property listings: flats to rent/buy, PGs, offices, plots. Use for any housing or real-estate request.",
      parameters: {
        type: 'object',
        properties: {
          type:     { type: 'string', enum: ['rental', 'buy', 'pg', 'office', 'land'], description: 'Listing type.' },
          location: { type: 'string', description: 'City or area.' },
          budget:   { type: 'string', description: "Rent or price budget, e.g. '25000 per month' or '80 lakhs'." },
          config:   { type: 'string', description: '1BHK, 2BHK, 3BHK, villa, studio, etc.' },
        },
        required: ['location'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_cars',
      description: "Search for cars — new, used, or EV. Find prices and deals. Use for any car-buying or research query.",
      parameters: {
        type: 'object',
        properties: {
          query:     { type: 'string', description: "Car name/type, e.g. 'Honda City', 'EV under 15 lakhs', '7-seater SUV automatic'." },
          condition: { type: 'string', enum: ['new', 'used', 'any'], description: 'New, used, or any.' },
          budget:    { type: 'string', description: "Budget, e.g. 'under 10 lakhs' or 'EMI under 15000'." },
          location:  { type: 'string', description: 'City for local listings.' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_travel',
      description: "Search flights, trains, hotels, buses, or tour packages. Use for any travel planning.",
      parameters: {
        type: 'object',
        properties: {
          type:   { type: 'string', enum: ['flight', 'train', 'hotel', 'bus', 'package'], description: 'Travel type.' },
          from:   { type: 'string', description: 'Origin city or airport code.' },
          to:     { type: 'string', description: 'Destination city or airport code.' },
          date:   { type: 'string', description: "Date or range, e.g. 'tomorrow', 'July 15', 'next weekend'." },
          budget: { type: 'string', description: "Budget, e.g. 'under 5000'." },
        },
        required: ['to'],
      },
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
    case 'read_file':     return readFile(args && args.path);
    case 'get_git_diff':  return getGitDiff();
    case 'get_weather':   return getWeather(args && args.city);
    // C60: memory + agent tools
    case 'remember_preference': {
      const k = String((args && args.key)   || '').trim().slice(0, 50);
      const v = String((args && args.value) || '').trim().slice(0, 200);
      if (!k) return '(missing key)';
      const saved = savePreference(k, v);
      const count = Object.keys(saved).filter(x => !x.startsWith('_')).length;
      return `Saved: ${k} = ${v}  (${count} preference${count !== 1 ? 's' : ''} stored)`;
    }
    case 'recall_preferences': {
      const prefs = getPreferences();
      const keys = Object.keys(prefs).filter(k => !k.startsWith('_'));
      if (!keys.length) return 'No preferences saved yet. I can save budgets, home city, car type, etc.';
      return 'Saved preferences:\n' + keys.map(k => `  ${k}: ${prefs[k]}`).join('\n');
    }
    case 'get_my_location': {
      const prefs = getPreferences();
      const loc = prefs._location;
      if (!loc) return 'No location saved. Ask Dileep to share Telegram location (📎 > Location).';
      const ageMin = Math.round((Date.now() - new Date(loc.timestamp || 0).getTime()) / 60000);
      const ageStr = ageMin < 60 ? ageMin + ' min' : Math.round(ageMin / 60) + ' hr';
      return `Location: ${loc.name || 'Unknown'} (${loc.lat}, ${loc.lng}) — saved ${ageStr} ago`;
    }
    case 'search_deals':    return searchDeals(args && args.query, args && args.location, args && args.budget);
    case 'search_listings': return searchListings(args && args.type, args && args.location, args && args.budget, args && args.config);
    case 'search_cars':     return searchCars(args && args.query, args && args.condition, args && args.budget, args && args.location);
    case 'search_travel':   return searchTravel(args && args.type, args && args.from, args && args.to, args && args.date, args && args.budget);
    // C58: Vision + clipboard
    case 'analyze_screenshot': {
      const question = String((args && args.question) || 'What do you see in this screenshot? Describe it clearly.');
      const os = require('os');
      const tmpFile = require('path').join(os.tmpdir(), 'chintu_screen_' + Date.now() + '.png');
      // Take screenshot via PowerShell (Windows only). Temp file deleted in finally -- never committed.
      const escaped = tmpFile.replace(/\\/g, '\\\\');
      const psCmd = 'Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing; '
        + '$s=[System.Windows.Forms.Screen]::PrimaryScreen; '
        + '$b=New-Object System.Drawing.Bitmap($s.Bounds.Width,$s.Bounds.Height); '
        + '$g=[System.Drawing.Graphics]::FromImage($b); '
        + '$g.CopyFromScreen($s.Bounds.Location,[System.Drawing.Point]::Empty,$s.Bounds.Size); '
        + "$b.Save('" + escaped + "'); "
        + '$g.Dispose(); $b.Dispose()';
      const psResult = spawnSync('powershell', ['-NoProfile', '-Command', psCmd], { timeout: 15000 });
      if (psResult.status !== 0 || !fs.existsSync(tmpFile)) {
        return 'Screenshot failed: ' + (psResult.stderr ? psResult.stderr.toString().slice(0, 100) : 'unknown error');
      }
      let imgBase64;
      try { imgBase64 = fs.readFileSync(tmpFile).toString('base64'); } finally {
        try { fs.unlinkSync(tmpFile); } catch (_) {}
      }
      const visionKey = process.env.CHINTU_GROQ_API_KEY;
      if (!visionKey) return 'CHINTU_GROQ_API_KEY not set';
      const visionResp = await new Promise((resolve) => {
        const body = JSON.stringify({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          messages: [{ role: 'user', content: [
            { type: 'text', text: question },
            { type: 'image_url', image_url: { url: 'data:image/png;base64,' + imgBase64 } }
          ]}],
          max_tokens: 600
        });
        const opts = {
          hostname: 'api.groq.com',
          path: '/openai/v1/chat/completions',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + visionKey,
            'Content-Length': Buffer.byteLength(body)
          }
        };
        const req = https.request(opts, (res) => {
          let data = '';
          res.on('data', c => { data += c; });
          res.on('end', () => {
            try { const j = JSON.parse(data); resolve(j.choices[0].message.content || '(no response)'); }
            catch (_) { resolve('Vision parse error: ' + data.slice(0, 100)); }
          });
        });
        req.on('error', (e) => resolve('Vision request error: ' + e.message.slice(0, 80)));
        req.setTimeout(20000, () => { req.destroy(); resolve('Vision timeout'); });
        req.write(body);
        req.end();
      });
      return visionResp;
    }
    case 'read_clipboard': {
      const cb = spawnSync('powershell', ['-NoProfile', '-Command', 'Get-Clipboard'], { timeout: 5000, encoding: 'utf8' });
      if (cb.status !== 0) return 'Could not read clipboard: ' + (cb.stderr || '').slice(0, 80);
      const text = (cb.stdout || '').trim().slice(0, 1000);
      return text ? 'Clipboard: ' + text : '(clipboard is empty)';
    }
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
  'You run locally on his laptop and respond via Telegram (text + voice notes via NeerjaNeural).',
  '',
  'Be warm, direct, conversational. 2-5 sentences for simple queries; be thorough for agent tasks.',
  'You have tools — use them proactively. Do NOT guess what you can look up.',
  '',
  '== AGENTIC RULES (C60) — follow exactly ==',
  '• Budget questions: ALWAYS call recall_preferences() FIRST. Only ask Dileep if not saved.',
  '• Location requests: call get_my_location() first.',
  '• When Dileep states a budget or preference: call remember_preference() immediately to save it.',
  '• Shopping/deals    → search_deals (chain 2-3 calls for different platforms).',
  '• Housing/rentals   → search_listings (use saved location if available).',
  '• Cars              → search_cars (check car_budget preference first).',
  '• Travel/flights    → search_travel.',
  '• After searching: summarise what you found AND tell Dileep what query you used.',
  '',
  '== PROJECT TOOLS ==',
  'git_status | git_log | git_log_today | bala_health | read_resume | list_scripts | read_file | get_git_diff | search_web | get_time | get_weather',
  '',
  'BALA is health-awareness only — never diagnose, treat, predict, or replace doctors.',
  'Chintu OS is local-first — no secrets in replies, no unnecessary network calls.',
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
