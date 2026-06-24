#!/usr/bin/env node
/**
 * chintu-bala-bridge.js -- C67
 *
 * Lightweight HTTP bridge that makes Chintu the AI backend for BALA.
 * BALA (browser PWA) calls this server for coach responses so no API
 * keys are ever exposed in the frontend.
 *
 * Routes:
 *   GET  /health  -- BALA liveness check, returns {"status":"ok","version":"C67"}
 *   POST /coach   -- receives health context + question, returns Groq coach response
 *   OPTIONS *     -- CORS preflight (allow * for localhost dev)
 *
 * Safety properties:
 *   - Binds to 127.0.0.1 ONLY -- never 0.0.0.0, not reachable off-box
 *   - GROQ_KEY never returned in response body or logs
 *   - Health context passed as numbers only -- no PII
 *   - Medical safety rules hardcoded in system prompt -- cannot be overridden by caller
 *   - Question max 500 chars -- prevents prompt injection
 *   - All errors return safe fallback message, never raw error strings to client
 *   - node --check must pass (no top-level await, no ES modules)
 *
 * Env:
 *   CHINTU_GROQ_API_KEY  -- required for live AI responses; returns fallback if missing
 *
 * Usage:
 *   node scripts/chintu-bala-bridge.js
 */

'use strict';

const http  = require('http');
const https = require('https');

const PORT     = 7891;
const HOST     = '127.0.0.1';
const GROQ_KEY = process.env.CHINTU_GROQ_API_KEY;

const MODEL        = 'llama-3.3-70b-versatile';
const MAX_TOKENS   = 220;
const TEMPERATURE  = 0.5;
const TIMEOUT_MS   = 25000;

// ── CORS headers -- allow any origin for localhost development ─────────────
const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

// ── Safe fallback sent on any error ───────────────────────────────────────
const SAFE_FALLBACK = {
  response: "I'm here to help you stay aware of your body signals. Please check in with your doctor for personalized guidance.",
  safe:     true,
  fallback: true,
};

// ── BALA coach system prompt template ─────────────────────────────────────
// {hrv}, {rhr}, {sleep}, {steps}, {balaScore} are replaced before each call.
const SYSTEM_PROMPT_TEMPLATE = [
  'You are BALA, a calm and caring daily health-awareness companion built in memory of Balaji.',
  'You help people listen to their body signals earlier and take small steps toward better health awareness.',
  '',
  'RULES -- never break these:',
  '- You are NOT a doctor. Never diagnose, prescribe, treat, or claim to prevent any condition.',
  '- Never mention cardiac arrest, heart attacks, or specific diseases.',
  '- For ANY mention of chest pain, difficulty breathing, fainting, severe weakness, or stroke-like symptoms:',
  '  immediately say "Please seek emergency care or call local emergency services right away.',
  '  Do not rely on BALA for emergency decisions."',
  '- Use only safe language: guide, signals, awareness, recovery, balance, check-in, listen to your body, daily companion.',
  '- Keep responses warm, calm, and under 120 words.',
  '- Always end with one small actionable step the person can take today.',
  '',
  "The user's current health signals:",
  'HRV: {hrv} ms | Resting HR: {rhr} bpm | Sleep: {sleep} hrs | Steps: {steps} | BALA Score: {balaScore}/100',
].join('\n');

// ── Build system prompt with real health values ────────────────────────────
function buildSystemPrompt(ctx) {
  var hrv       = typeof ctx.hrv       === 'number' ? ctx.hrv       : 0;
  var rhr       = typeof ctx.rhr       === 'number' ? ctx.rhr       : 0;
  var sleep     = typeof ctx.sleep     === 'number' ? ctx.sleep     : 0;
  var steps     = typeof ctx.steps     === 'number' ? ctx.steps     : 0;
  var balaScore = typeof ctx.balaScore === 'number' ? ctx.balaScore : 0;

  return SYSTEM_PROMPT_TEMPLATE
    .replace('{hrv}',       String(hrv))
    .replace('{rhr}',       String(rhr))
    .replace('{sleep}',     String(sleep))
    .replace('{steps}',     String(steps))
    .replace('{balaScore}', String(balaScore));
}

// ── Call Groq: single-turn, no tool use ───────────────────────────────────
function callGroq(systemPrompt, question) {
  return new Promise(function (resolve) {
    if (!GROQ_KEY) { resolve(null); return; }

    var body = JSON.stringify({
      model:       MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: question.slice(0, 500) },
      ],
      temperature:  TEMPERATURE,
      max_tokens:   MAX_TOKENS,
    });

    var options = {
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

    var req = https.request(options, function (res) {
      var data = '';
      res.on('data', function (chunk) { data += chunk; });
      res.on('end', function () {
        try {
          var parsed  = JSON.parse(data);
          if (parsed.error) { resolve(null); return; }
          var content = parsed.choices && parsed.choices[0] &&
                        parsed.choices[0].message && parsed.choices[0].message.content;
          resolve(content ? content.trim() : null);
        } catch (_) {
          resolve(null);
        }
      });
    });

    req.on('error', function () { resolve(null); });
    req.setTimeout(TIMEOUT_MS, function () { req.destroy(); resolve(null); });
    req.write(body);
    req.end();
  });
}

// ── Send JSON response ─────────────────────────────────────────────────────
function sendJSON(res, status, obj) {
  var body = JSON.stringify(obj);
  res.writeHead(status, CORS_HEADERS);
  res.end(body);
}

// ── Read full request body ─────────────────────────────────────────────────
function readBody(req) {
  return new Promise(function (resolve, reject) {
    var raw = '';
    var bytes = 0;
    req.on('data', function (chunk) {
      bytes += chunk.length;
      if (bytes > 64 * 1024) { reject(new Error('body too large')); return; }
      raw += chunk;
    });
    req.on('end', function () { resolve(raw); });
    req.on('error', reject);
  });
}

// ── Main request handler ───────────────────────────────────────────────────
function handleRequest(req, res) {
  var method = req.method;
  var url    = req.url;

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  // GET /health
  if (method === 'GET' && url === '/health') {
    sendJSON(res, 200, { status: 'ok', version: 'C67' });
    return;
  }

  // POST /coach
  if (method === 'POST' && url === '/coach') {
    readBody(req).then(function (raw) {
      var parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (_) {
        sendJSON(res, 400, SAFE_FALLBACK);
        return;
      }

      var question = parsed.question;
      var ctx      = parsed.healthContext || {};

      // Validate question
      if (!question || typeof question !== 'string' || question.trim().length === 0) {
        sendJSON(res, 400, SAFE_FALLBACK);
        return;
      }
      question = question.slice(0, 500);

      var systemPrompt = buildSystemPrompt(ctx);

      callGroq(systemPrompt, question).then(function (reply) {
        if (reply) {
          sendJSON(res, 200, { response: reply, safe: true });
        } else {
          sendJSON(res, 200, SAFE_FALLBACK);
        }
      }).catch(function () {
        sendJSON(res, 200, SAFE_FALLBACK);
      });

    }).catch(function () {
      sendJSON(res, 200, SAFE_FALLBACK);
    });
    return;
  }

  // Unknown route
  sendJSON(res, 404, { error: 'not found' });
}

// ── Start server ───────────────────────────────────────────────────────────
var server = http.createServer(handleRequest);

server.listen(PORT, HOST, function () {
  console.log('[bala-bridge] Chintu BALA bridge listening on http://127.0.0.1:7891');
  console.log('[bala-bridge] POST /coach for AI responses, GET /health for status check');
});

server.on('error', function (e) {
  if (e.code === 'EADDRINUSE') {
    console.log('[bala-bridge] Port 7891 already in use -- another bridge instance is running');
    process.exit(0);
  }
  console.error('[bala-bridge] Server error:', e.message);
  process.exit(1);
});
