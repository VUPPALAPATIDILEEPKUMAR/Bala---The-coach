/**
 * chintu-groq-chat.js -- C52
 *
 * Thin Groq conversational helper for Telegram.
 * Used by chintu-telegram-poll.js to answer natural-language messages
 * with the llama-3.3-70b-versatile model (free tier).
 *
 * Exports:
 *   chatWithGroq(userMessage, context) -> Promise<string|null>
 *     Returns AI reply string, or null if Groq unavailable / key missing.
 *     Never throws.
 *
 * Env gates (read-only, never printed):
 *   CHINTU_GROQ_API_KEY   -- required for live chat; returns null if missing
 *
 * Safety:
 *   - API key never printed or logged
 *   - No health data sent to Groq
 *   - Returns null gracefully on any error
 *   - Timeout: 20 seconds
 */

'use strict';

const https = require('https');

const MODEL         = 'llama-3.3-70b-versatile';
const MAX_TOKENS    = 300;
const TEMPERATURE   = 0.7;
const TIMEOUT_MS    = 20000;

/**
 * Call Groq with a conversational message and optional project context.
 *
 * @param {string}   userMessage   The message from the founder (via Telegram)
 * @param {string}   [context]     Current project state (git status, commits, etc.)
 * @param {object[]} [history]     Prior messages [{role,content}] for multi-turn context
 * @returns {Promise<string|null>}
 */
async function chatWithGroq(userMessage, context, history) {
  const apiKey = process.env.CHINTU_GROQ_API_KEY;
  if (!apiKey) return null;

  const systemPrompt = [
    'You are Chintu, the personal AI assistant for Dileep — founder of BALA (a mobile-first health-awareness app).',
    'You live in his laptop and respond via Telegram when he texts you.',
    'Be warm, direct, and concise. Reply in 1-3 sentences max unless more detail is clearly needed.',
    'You know the project well. BALA helps people listen to their body signals. Chintu OS is the local-first agent system.',
    'Never invent technical facts. If unsure, say so honestly.',
    '',
    'Current project state (for context):',
    context ? context.slice(0, 800) : '(no context gathered)',
  ].join('\n');

  const body = JSON.stringify({
    model:       MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      ...(Array.isArray(history) ? history : []),
      { role: 'user',   content: userMessage.slice(0, 500) },
    ],
    temperature:  TEMPERATURE,
    max_tokens:   MAX_TOKENS,
  });

  return new Promise((resolve) => {
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
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed  = JSON.parse(data);
          if (parsed.error) { resolve(null); return; }
          const content = parsed.choices?.[0]?.message?.content;
          resolve(content ? content.trim() : null);
        } catch (_) {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.setTimeout(TIMEOUT_MS, () => { req.destroy(); resolve(null); });
    req.write(body);
    req.end();
  });
}

module.exports = { chatWithGroq };
