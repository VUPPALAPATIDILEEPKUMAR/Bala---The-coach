'use strict';

// chintu-health-watchdog.js -- C63
// Silent 2-hour health check. Alerts via ntfy on failure. No Telegram.
// Exit 0 always. Task Scheduler captures console output.

const { spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');
const https = require('https');

const repoRoot   = path.resolve(__dirname, '..');
const scriptsDir = path.join(repoRoot, 'scripts');

// ── 1. Syntax-check all chintu-*.js (skip *.test.js) ─────────────────────
function syntaxCheckAll() {
  const fails = [];
  let files;
  try {
    files = fs.readdirSync(scriptsDir)
      .filter(f => /^chintu-.*\.js$/i.test(f) && !/\.test\.js$/i.test(f));
  } catch (e) {
    return [{ check: 'syntax-check', file: 'scripts/', error: e.message.slice(0, 200) }];
  }
  for (const f of files) {
    const full = path.join(scriptsDir, f);
    const r = spawnSync('node', ['--check', full], { timeout: 10000, encoding: 'utf8' });
    if (r.status !== 0) {
      const err = (r.stderr || r.stdout || '').trim().slice(0, 200);
      fails.push({ check: 'syntax', file: f, error: err });
    }
  }
  return fails;
}

// ── 2. Egress test ─────────────────────────────────────────────────────────
function egressTest() {
  const testFile = path.join(scriptsDir, 'chintu-no-network-egress.test.js');
  const r = spawnSync('node', [testFile], { timeout: 15000, encoding: 'utf8', cwd: repoRoot });
  if (r.status !== 0) {
    const err = (r.stderr || r.stdout || '').trim().slice(0, 200);
    return [{ check: 'egress-test', file: 'chintu-no-network-egress.test.js', error: err }];
  }
  return [];
}

// ── 3. Medical keyword scan ───────────────────────────────────────────────
const MEDICAL_PATTERNS = [/diagnos/i, /cardiac arrest/i, /heart attack/i, /prescribe/i];
const EXEMPT_PATTERNS  = [/never/i, /does not/i, /no diag/i, /health-awareness only/i];

function medicalScan() {
  const targets = ['scripts/chintu-groq-tools.js', 'scripts/chintu-telegram-poll.js'];
  const fails = [];
  for (const rel of targets) {
    const full = path.join(repoRoot, rel);
    if (!fs.existsSync(full)) continue;
    const lines = fs.readFileSync(full, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const matched = MEDICAL_PATTERNS.some(re => re.test(line));
      if (!matched) continue;
      const exempted = EXEMPT_PATTERNS.some(re => re.test(line));
      if (exempted) continue;
      fails.push({
        check: 'medical-scan',
        file:  rel,
        error: 'Line ' + (i + 1) + ': ' + line.trim().slice(0, 120),
      });
    }
  }
  return fails;
}

// ── 4. Notify via ntfy (direct https call) ────────────────────────────────
function sendNtfy(topic, summary) {
  return new Promise((resolve) => {
    const bodyStr = summary.slice(0, 1000);
    const opts = {
      hostname: 'ntfy.sh',
      path:     '/' + encodeURIComponent(topic),
      method:   'POST',
      headers:  {
        'Content-Type':   'text/plain',
        'Title':          'Chintu Health Watchdog ALERT',
        'Priority':       '4',
        'Content-Length': Buffer.byteLength(bodyStr),
      },
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: data.slice(0, 100) }));
    });
    req.on('error', e => resolve({ error: e.message }));
    req.setTimeout(8000, () => { req.destroy(); resolve({ error: 'timeout' }); });
    req.write(bodyStr);
    req.end();
  });
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  const allFails = [
    ...syntaxCheckAll(),
    ...egressTest(),
    ...medicalScan(),
  ];

  if (allFails.length === 0) {
    console.log('[health-watchdog] All checks passed. ' + new Date().toISOString());
    process.exit(0);
  }

  // Build summary (first 200 chars per fail)
  const lines = allFails.map((f, i) =>
    (i + 1) + '. [' + f.check + '] ' + f.file + ': ' + (f.error || '').slice(0, 200)
  );
  const summary = 'Chintu Health Watchdog FAIL (' + allFails.length + ' issue(s)):\n' + lines.join('\n');

  console.error(summary);

  // Alert via ntfy if approved
  const topic    = process.env.CHINTU_NTFY_TOPIC || '';
  const approved = (process.env.CHINTU_CONNECTOR_APPROVAL_PHRASE || '') === 'go';
  if (topic && approved) {
    const result = await sendNtfy(topic, summary);
    console.log('[health-watchdog] ntfy result:', JSON.stringify(result));
  } else {
    console.log('[health-watchdog] ntfy skipped (dry-run: CHINTU_NTFY_TOPIC or approval phrase not set).');
  }

  process.exit(0); // always exit 0
}

main().catch(e => { console.error('[health-watchdog] unexpected:', e.message); process.exit(0); });
