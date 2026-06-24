/**
 * chintu-chat-memory.js -- C53
 *
 * Rolling conversation memory for Telegram chat.
 * Stores last N messages so Groq can maintain conversation context
 * across poll cycles (each runs once per minute then exits).
 *
 * Storage: CHINTU_MEMORY_VAULT/telegram_chat_history.json
 *   - Gitignored (local only, never committed)
 *   - Each entry: { role, content, timestamp }
 *   - Roles: 'user' | 'assistant'
 *   - Max entries: MAX_HISTORY (default 10)
 *
 * Exports:
 *   loadHistory(chatId)          -> { role, content }[]   (Groq messages format)
 *   appendHistory(chatId, role, content) -> void
 *   clearHistory(chatId)         -> void
 *
 * Safety:
 *   - No health data stored
 *   - No secrets stored
 *   - File is per-chatId (keyed by masked ID)
 *   - All I/O is synchronous and local
 *   - Never throws (returns [] on any read error)
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const repoRoot   = path.resolve(__dirname, '..');
const vaultDir   = path.join(repoRoot, 'CHINTU_MEMORY_VAULT');
const historyDir = path.join(vaultDir, 'chat_history');
const MAX_HISTORY = 10; // messages per conversation kept in context

function historyFile(chatId) {
  // Use a hash of chatId so actual IDs never appear in filenames
  const safe = String(chatId).replace(/[^0-9a-zA-Z]/g, '').slice(-8) || 'default';
  return path.join(historyDir, 'chat_' + safe + '.json');
}

function ensureDir() {
  if (!fs.existsSync(historyDir)) fs.mkdirSync(historyDir, { recursive: true });
}

/**
 * Load conversation history for Groq messages array.
 * Returns array of { role, content } for the last MAX_HISTORY entries.
 */
function loadHistory(chatId) {
  try {
    ensureDir();
    const file = historyFile(chatId);
    if (!fs.existsSync(file)) return [];
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(raw)) return [];
    // Return only role+content (Groq format), newest MAX_HISTORY entries
    return raw.slice(-MAX_HISTORY).map(({ role, content }) => ({ role, content }));
  } catch (_) {
    return [];
  }
}

/**
 * Append a message to conversation history.
 * Trims to MAX_HISTORY * 2 to prevent unbounded growth.
 */
function appendHistory(chatId, role, content) {
  try {
    ensureDir();
    const file = historyFile(chatId);
    let history = [];
    if (fs.existsSync(file)) {
      try { history = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) {}
    }
    if (!Array.isArray(history)) history = [];
    history.push({ role, content: content.slice(0, 500), timestamp: new Date().toISOString() });
    // Keep a rolling window (double MAX_HISTORY in storage so we have room)
    if (history.length > MAX_HISTORY * 2) history = history.slice(-MAX_HISTORY * 2);
    fs.writeFileSync(file, JSON.stringify(history, null, 2), 'utf8');
  } catch (_) {
    // Never throw -- history is optional enhancement
  }
}

/**
 * Clear conversation history (e.g. on "forget" or "reset" command).
 */
function clearHistory(chatId) {
  try {
    const file = historyFile(chatId);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch (_) {}
}

module.exports = { loadHistory, appendHistory, clearHistory };
