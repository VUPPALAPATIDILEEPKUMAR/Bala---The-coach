#!/usr/bin/env node
'use strict';
/**
 * chintu-github-watch.js -- C62
 *
 * Polls GitHub notifications API and sends a Telegram digest of new activity.
 *
 * Security rules:
 *   - GITHUB_TOKEN never printed, logged, or stored.
 *   - Read-only GitHub API calls only (GET /notifications).
 *   - State file stored at os.homedir() -- outside repo, never committed.
 *   - Exits 0 gracefully on any missing env var.
 */

const https = require('https');
const fs    = require('fs');
const os    = require('os');
const path  = require('path');

const STATE_FILE = path.join(os.homedir(), 'chintu-github-watch-state.json');
const MAX_ITEMS  = 10;

// ── Env guards ────────────────────────────────────────────────────────────────

const githubToken = String(process.env.GITHUB_TOKEN || '').trim();
if (!githubToken) {
  console.log('[github-watch] SKIP: GITHUB_TOKEN not set. ' +
    'Set it in your environment (e.g. in .env or Task Scheduler) to enable GitHub notifications.');
  process.exit(0);
}

const telegramToken   = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
const sendEnabled     = String(process.env.CHINTU_TELEGRAM_SEND_ENABLED || '').trim() === '1';
const allowedChatIds  = String(process.env.CHINTU_TELEGRAM_ALLOWED_CHAT_IDS || '').trim();

if (!telegramToken || !sendEnabled || !allowedChatIds) {
  console.log('[github-watch] SKIP: Telegram env vars not configured ' +
    '(need TELEGRAM_BOT_TOKEN, CHINTU_TELEGRAM_SEND_ENABLED=1, CHINTU_TELEGRAM_ALLOWED_CHAT_IDS).');
  process.exit(0);
}

// ── State file ────────────────────────────────────────────────────────────────

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf8');
      const obj = JSON.parse(raw);
      if (obj && typeof obj.lastChecked === 'string') return obj;
    }
  } catch (_e) { /* ignore parse errors */ }
  // Default: 1 hour ago
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  return { lastChecked: oneHourAgo };
}

function saveState(isoTimestamp) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({ lastChecked: isoTimestamp }, null, 2), 'utf8');
  } catch (e) {
    console.log('[github-watch] WARN: could not save state file: ' + e.message);
  }
}

// ── URL helper ────────────────────────────────────────────────────────────────

function toHtmlUrl(apiUrl, htmlUrl) {
  if (htmlUrl) return htmlUrl;
  return String(apiUrl || '')
    .replace('https://api.github.com/repos/', 'https://github.com/')
    .replace(/\/(commits|pulls|issues)\//, '/issues/');
}

// ── GitHub HTTP GET ───────────────────────────────────────────────────────────

function githubGet(token, urlPath) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      port: 443,
      path: urlPath,
      method: 'GET',
      headers: {
        'Authorization': 'token ' + token,
        'User-Agent': 'Chintu-OS/1.0',
        'Accept': 'application/vnd.github.v3+json',
      },
    };
    const req = https.request(options, (res) => {
      if (res.statusCode === 304) {
        resolve({ status: 304, data: [] });
        return;
      }
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(raw);
          resolve({ status: res.statusCode, data: parsed });
        } catch (_e) {
          reject(new Error('GitHub API parse error (status ' + res.statusCode + ')'));
        }
      });
    });
    req.on('error', (e) => reject(new Error('GitHub API request error: ' + e.message)));
    req.setTimeout(20000, () => { req.destroy(new Error('GitHub API timeout')); });
    req.end();
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const state = loadState();
  const nowIso = new Date().toISOString();

  console.log('[github-watch] Checking notifications since ' + state.lastChecked);

  const urlPath = '/notifications?all=false&since=' + encodeURIComponent(state.lastChecked);
  let result;
  try {
    result = await githubGet(githubToken, urlPath);
  } catch (e) {
    console.log('[github-watch] ERROR: ' + e.message);
    process.exit(0);
  }

  if (result.status === 304 || !Array.isArray(result.data) || result.data.length === 0) {
    console.log('[github-watch] No new notifications.');
    saveState(nowIso);
    process.exit(0);
  }

  const notifications = result.data.slice(0, MAX_ITEMS);
  console.log('[github-watch] ' + result.data.length + ' new notification(s), reporting up to ' + MAX_ITEMS);

  const lines = notifications.map((n) => {
    const reason  = String(n.reason || 'unknown');
    const repo    = String((n.repository && n.repository.full_name) || 'unknown/repo');
    const title   = String((n.subject && n.subject.title) || '(no title)');
    const apiUrl  = String((n.subject && n.subject.url) || '');
    const webUrl  = toHtmlUrl(apiUrl, null);
    return '• [' + reason + '] ' + repo + ' — ' + title + '\n  ' + webUrl;
  });

  const suffix = result.data.length > MAX_ITEMS
    ? '\n(+ ' + (result.data.length - MAX_ITEMS) + ' more)' : '';
  const message = 'GitHub updates (' + result.data.length + ' new):\n' + lines.join('\n') + suffix;

  const { sendTelegramMessage } = require('./chintu-send-telegram');
  const sent = await sendTelegramMessage(message);
  console.log('[github-watch] Telegram send: ' + (sent ? 'OK' : 'SKIP/ERROR'));

  saveState(nowIso);
  process.exit(0);
}

main().catch((e) => {
  console.log('[github-watch] Unhandled error: ' + e.message);
  process.exit(0);
});
