'use strict';
/**
 * chintu-qa-agent.js -- C59
 *
 * BALA Autonomous QA Agent.
 * 1. Runs health checks on all chintu-*.js scripts (syntax + egress test + medical scan).
 * 2. If all pass + ntfy configured: sends silent "all clear" ntfy push.
 * 3. If any fail: calls Groq to diagnose, sends result via Telegram + ntfy.
 *
 * Safety:
 *   - GROQ key never printed or logged.
 *   - Telegram token never printed.
 *   - No health data in output (code health only).
 *   - Always exits 0 (Task Scheduler safe).
 */

const https         = require('https');
const { spawnSync } = require('child_process');
const fs            = require('fs');
const path          = require('path');

const REPO_ROOT   = path.resolve(__dirname, '..');
const SCRIPTS_DIR = __dirname;
const GROQ_KEY    = process.env.CHINTU_GROQ_API_KEY;
const DRY_RUN     = process.argv.includes('--dry-run');

// Files excluded from medical safety scan (known-safe / safety-guard files).
const MEDICAL_SCAN_EXEMPT = new Set([
  'chintu-bala-skill.js',
  'chintu-skill-contracts.js',
  'chintu-connector-send.js',
  'chintu-message-dry-run.js',
  'chintu-brain-router.js',
  'chintu-prompt-engine.js',
  'chintu-capability-registry.js',
  'chintu-qa-agent.js',  // this file itself
]);

const MEDICAL_RE = /\bdiagnose\b|\btreat\b|\bcardiac arrest\b|\bheart attack\b|\bprescribe\b/i;

// -- ntfy helper -------------------------------------------------------------
function sendNtfy(topic, title, message) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ topic, title, message, priority: 3 });
    const options = {
      hostname: 'ntfy.sh',
      port: 443,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      res.resume();
      res.on('end', () => resolve(true));
    });
    req.on('error', () => resolve(false));
    req.setTimeout(10000, () => { req.destroy(); resolve(false); });
    req.write(body);
    req.end();
  });
}

// -- Groq diagnosis call -----------------------------------------------------
function callGroqDiagnose(errorContext) {
  return new Promise((resolve) => {
    if (!GROQ_KEY) { resolve('(no CHINTU_GROQ_API_KEY -- skipping diagnosis)'); return; }

    const prompt =
      'You are Chintu QA agent. This BALA health check failed:\n' +
      errorContext +
      '\n\nDiagnose the issue and provide a specific code fix. Be concise -- max 300 words.';

    const bodyObj = {
      model:       'llama-3.3-70b-versatile',
      messages:    [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens:  400,
    };
    const body = JSON.stringify(bodyObj);

    const options = {
      hostname: 'api.groq.com',
      port:     443,
      path:     '/openai/v1/chat/completions',
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Authorization':  'Bearer ' + GROQ_KEY,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const text = parsed.choices?.[0]?.message?.content || '(no content)';
          resolve(text);
        } catch (_) {
          resolve('(Groq parse error)');
        }
      });
    });

    req.on('error', (e) => resolve('(Groq request error: ' + e.message.slice(0, 80) + ')'));
    req.setTimeout(20000, () => { req.destroy(); resolve('(Groq timeout)'); });
    req.write(body);
    req.end();
  });
}

// -- Health checks -----------------------------------------------------------

/** 1. node --check on every chintu-*.js (skip *.test.js) */
function checkSyntax() {
  const files = fs.readdirSync(SCRIPTS_DIR).filter((f) =>
    /^chintu-/i.test(f) && /\.js$/.test(f) && !/\.test\.js$/.test(f)
  );

  for (const f of files) {
    const fullPath = path.join(SCRIPTS_DIR, f);
    const result = spawnSync(process.execPath, ['--check', fullPath], {
      timeout: 10000,
      encoding: 'utf8',
    });
    if (result.status !== 0) {
      const err = (result.stderr || result.stdout || '').slice(0, 500);
      return { pass: false, check: 'syntax:' + f, error: err };
    }
  }
  return { pass: true };
}

/** 2. node scripts/chintu-no-network-egress.test.js */
function checkEgress() {
  const testFile = path.join(SCRIPTS_DIR, 'chintu-no-network-egress.test.js');
  const result = spawnSync(process.execPath, [testFile], {
    cwd:      REPO_ROOT,
    timeout:  15000,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || '').slice(0, 500);
    return { pass: false, check: 'egress-test', error: err };
  }
  return { pass: true };
}

/** 3. Medical safety scan on non-exempt chintu-*.js files */
function checkMedicalScan() {
  const files = fs.readdirSync(SCRIPTS_DIR).filter((f) => {
    if (!/^chintu-/i.test(f)) return false;
    if (/\.test\.js$/i.test(f)) return false;
    if (!/\.js$/.test(f)) return false;
    if (MEDICAL_SCAN_EXEMPT.has(f)) return false;
    return true;
  });

  for (const f of files) {
    const fullPath = path.join(SCRIPTS_DIR, f);
    const lines = fs.readFileSync(fullPath, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (MEDICAL_RE.test(lines[i])) {
        const snippet = (f + ':' + (i + 1) + ': ' + lines[i].trim()).slice(0, 300);
        return {
          pass: false,
          check: 'medical-scan:' + f,
          error: 'Forbidden medical pattern found:\n' + snippet,
        };
      }
    }
  }
  return { pass: true };
}

// -- Main --------------------------------------------------------------------
async function main() {
  console.log('[qa-agent] Starting BALA QA checks' + (DRY_RUN ? ' (DRY RUN)' : '') + '...');

  const checks = [
    { name: 'syntax',       fn: checkSyntax },
    { name: 'egress-test',  fn: checkEgress },
    { name: 'medical-scan', fn: checkMedicalScan },
  ];

  let firstFail = null;
  for (const { name, fn } of checks) {
    const result = fn();
    if (!result.pass) {
      firstFail = result;
      console.error('[qa-agent] FAIL [' + name + ']: ' + result.error.slice(0, 200));
      break;
    }
    console.log('[qa-agent] PASS [' + name + ']');
  }

  const ntfyTopic    = process.env.CHINTU_NTFY_TOPIC || '';
  const ntfyApproved = String(process.env.CHINTU_CONNECTOR_APPROVAL_PHRASE || '').trim() === 'go';
  const ntfyEnabled  = ntfyTopic && ntfyApproved;

  if (!firstFail) {
    console.log('[qa-agent] All checks passed.');
    if (!DRY_RUN && ntfyEnabled) {
      await sendNtfy(ntfyTopic, 'BALA QA', 'BALA QA: all checks passed');
      console.log('[qa-agent] ntfy sent: all clear');
    }
    return;
  }

  // Build error context (first 500 chars)
  const errorContext = ('[' + firstFail.check + ']\n' + firstFail.error).slice(0, 500);

  // Groq diagnosis
  console.log('[qa-agent] Requesting Groq diagnosis...');
  const diagnosis = DRY_RUN
    ? '(dry-run: skipping Groq call)'
    : await callGroqDiagnose(errorContext);

  const alertText =
    'BALA QA FAIL [' + firstFail.check + ']\n\n' +
    'Error:\n' + firstFail.error.slice(0, 300) + '\n\n' +
    'Groq diagnosis:\n' + diagnosis.slice(0, 800);

  console.log('[qa-agent] Diagnosis:\n' + diagnosis.slice(0, 300));

  // Telegram alert
  if (!DRY_RUN) {
    try {
      const { sendTelegramMessage } = require('./chintu-send-telegram');
      await sendTelegramMessage(alertText);
    } catch (e) {
      console.log('[qa-agent] Telegram send error: ' + e.message.slice(0, 80));
    }

    // ntfy alert
    if (ntfyEnabled) {
      await sendNtfy(ntfyTopic, 'BALA QA FAIL', 'Check: ' + firstFail.check);
      console.log('[qa-agent] ntfy sent: fail alert');
    }
  }
}

main().catch((e) => {
  console.error('[qa-agent] fatal:', e.message);
  process.exit(0);
});
