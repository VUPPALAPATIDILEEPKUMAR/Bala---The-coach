#!/usr/bin/env node
// Chintu no-network-egress test.
//
// Scans every shipped Chintu OS script under scripts/chintu-*.ps1 and
// scripts/chintu-*.js (excluding *.test.js) for executable network-egress
// patterns. Markdown is not scanned because docs legitimately discuss
// what is parked. This is a regression guard: Chintu OS scripts must
// stay local-first.
//
// Read-only. No network. No edits.

'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const scriptsDir = path.join(repoRoot, 'scripts');

const forbidden = [
  { re: /\bInvoke-WebRequest\b/, label: 'Invoke-WebRequest' },
  { re: /\bInvoke-RestMethod\b/, label: 'Invoke-RestMethod' },
  { re: /\bNet\.WebClient\b/, label: 'Net.WebClient' },
  { re: /\bSystem\.Net\.Http\.HttpClient\b/, label: 'System.Net.Http.HttpClient' },
  { re: /\bStart-BitsTransfer\b/, label: 'Start-BitsTransfer' },
  { re: /\bcurl\.exe\b/, label: 'curl.exe' },
  { re: /\bwget\.exe\b/, label: 'wget.exe' },
  { re: /\bfetch\s*\(/, label: 'fetch(' },
  { re: /\bXMLHttpRequest\b/, label: 'XMLHttpRequest' },
  { re: /\brequire\(['"]https?['"]\)/, label: "require('http(s)')" },
  { re: /\brequire\(['"]node:https?['"]\)/, label: "require('node:http(s)')" },
  { re: /\brequire\(['"]axios['"]\)/, label: "require('axios')" },
  { re: /\bnew\s+WebSocket\b/, label: 'new WebSocket' },
];

let fails = 0;
function fail(msg) {
  fails++;
  console.error('FAIL: ' + msg);
}

if (!fs.existsSync(scriptsDir)) {
  fail('scripts/ directory missing');
  process.exit(1);
}

// chintu-validate.ps1 is the BALA-side scanner: it legitimately holds
// these tokens as regex strings to detect them in app code. Exempt it
// here so the integrity guard does not flag the guard's own patterns.
// chintu-local-bridge.js requires the `http` module to bind a LOCAL loopback
// server (127.0.0.1 only). chintu-telegram-runner.js is the single Stage 30
// script allowed to call Telegram getUpdates/sendMessage and the local bridge,
// but only with explicit env gates and localhost-only comments/markers.
const scannerAllowlist = new Set([
  'chintu-validate.ps1',
  'chintu-connector-send.js',
  'chintu-local-bridge.js',
  'chintu-telegram-runner.js',
  // C44: morning digest sends to ntfy.sh ONLY when CHINTU_CONNECTOR_APPROVAL_PHRASE
  // is set and CHINTU_NTFY_TOPIC is configured. Dry-run by default (no env vars needed).
  'chintu-bala-morning-digest.js',
  // C47: ntfy.sh Level 3 push -- sends to ntfy.sh ONLY when CHINTU_CONNECTOR_APPROVAL_PHRASE=go
  // AND CHINTU_NTFY_TOPIC is set. Dry-run by default. No health values in payload.
  'chintu-ntfy-push.js',
  // C48: Autonomous Brain -- calls Groq API ONLY when CHINTU_GROQ_API_KEY set AND
  // CHINTU_AUTONOMOUS_APPROVAL_PHRASE=go. Dry-run by default. Uses only SAFE_COMMANDS allowlist.
  // No health data, no secrets, no file deletes, no force-push.
  'chintu-autonomous-brain.js',
  // C51: Telegram send helper -- calls api.telegram.org ONLY when TELEGRAM_BOT_TOKEN set AND
  // CHINTU_TELEGRAM_SEND_ENABLED=1. Used by autonomous brain (morning push) and poll script.
  // Token never printed. Replies only to allowlisted chat IDs. No health data in payload.
  'chintu-send-telegram.js',
  // C52: Groq conversational chat -- calls api.groq.com ONLY when CHINTU_GROQ_API_KEY set.
  // Used by chintu-telegram-poll.js to answer natural-language Telegram messages.
  // No health data. Token never printed. Falls back gracefully (returns null) on any error.
  'chintu-groq-chat.js',
  // C55+C56: Groq tool-use agent -- api.groq.com + api.duckduckgo.com + wttr.in (all free, no key).
  // C56 adds: read_file (local only), get_git_diff (local only), get_weather (wttr.in plain text).
  // C58: adds vision API call (api.groq.com, same endpoint) + PowerShell screenshot (local only) + clipboard (local only).
  'chintu-groq-tools.js',
  // C62: GitHub watch -- polls api.github.com ONLY when CHINTU_GITHUB_WATCH_REPO is set.
  // No auth token required (public repos). Sends ntfy alert when new commit detected.
  // Dry-run by default.
  'chintu-github-watch.js',
  // C63: Health watchdog -- calls ntfy.sh ONLY when CHINTU_CONNECTOR_APPROVAL_PHRASE=go
  // AND CHINTU_NTFY_TOPIC is set. Dry-run by default. No health values in payload.
  // Uses direct https call (same ntfy.sh endpoint as chintu-ntfy-push.js).
  'chintu-health-watchdog.js',
  // C51: Telegram poll -- calls api.telegram.org getUpdates ONLY when TELEGRAM_BOT_TOKEN set.
  // One-shot (no infinite loop). All commands gated by SAFE_COMMANDS allowlist.
  // CHINTU_TELEGRAM_SEND_ENABLED=1 required to send replies. Token never printed.
  'chintu-telegram-poll.js',
  // C57: Voice STT -- downloads OGG from api.telegram.org, transcribes via api.groq.com Whisper.
  // Both endpoints already used by poll + brain scripts. Temp audio in os.tmpdir(), deleted immediately.
  // No transcript stored to disk. No health data. Token never printed.
  'chintu-voice-in.js',
  // C57: Voice TTS -- edge-tts generates MP3 via Python subprocess (speech.platform.bing.com,
  // not scanned here). Sends MP3 to api.telegram.org/sendVoice. Temp file deleted in finally.
  // CHINTU_TELEGRAM_SEND_ENABLED=1 required (enforced by caller in chintu-telegram-poll.js).
  'chintu-voice-out.js',
  // C59: QA agent -- calls api.groq.com for diagnosis + ntfy/Telegram alerts
  'chintu-qa-agent.js',
]);

const files = fs.readdirSync(scriptsDir).filter((f) => {
  if (!/^chintu-/i.test(f)) return false;
  if (/\.test\.js$/i.test(f)) return false;
  if (scannerAllowlist.has(f.toLowerCase())) return false;
  return /\.(ps1|js)$/i.test(f);
});

if (files.length === 0) {
  fail('no Chintu scripts found to scan');
}

const connectorSender = path.join(scriptsDir, 'chintu-connector-send.js');
if (!fs.existsSync(connectorSender)) {
  fail('scripts/chintu-connector-send.js missing');
} else {
  const senderText = fs.readFileSync(connectorSender, 'utf8');
  for (const required of [
    'CHINTU_CONNECTOR_MODE',
    'CHINTU_CONNECTOR_APPROVAL_PHRASE',
    'latest_connector_preview.json',
    'connector_sent.log.jsonl',
  ]) {
    if (!senderText.includes(required)) {
      fail(`connector sender missing required gate marker: ${required}`);
    }
  }
}

const telegramRunner = path.join(scriptsDir, 'chintu-telegram-runner.js');
if (!fs.existsSync(telegramRunner)) {
  fail('scripts/chintu-telegram-runner.js missing');
} else {
  const runnerText = fs.readFileSync(telegramRunner, 'utf8');
  for (const required of [
    'TELEGRAM_BOT_TOKEN',
    'CHINTU_TELEGRAM_ALLOWED_CHAT_IDS',
    'CHINTU_TELEGRAM_ALLOWED_SENDER_IDS',
    'CHINTU_TELEGRAM_SEND_ENABLED',
    '--poll-once',
    '--send',
    '--execute-local',
    '127.0.0.1',
    'api.telegram.org',
  ]) {
    if (!runnerText.includes(required)) {
      fail(`telegram runner missing required gate marker: ${required}`);
    }
  }
}

let scanned = 0;
for (const f of files) {
  const full = path.join(scriptsDir, f);
  const text = fs.readFileSync(full, 'utf8');
  scanned++;
  for (const { re, label } of forbidden) {
    if (re.test(text)) {
      fail(`network-egress pattern in scripts/${f}: ${label}`);
    }
  }
}

if (fails === 0) {
  console.log(
    `No network egress: PASS (${scanned} script(s) scanned, ${forbidden.length} pattern(s) checked)`
  );
  process.exit(0);
}

console.error(`No network egress: FAIL (${fails} issue(s))`);
process.exit(1);
