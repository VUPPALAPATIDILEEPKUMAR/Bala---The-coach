#!/usr/bin/env node
'use strict';

// =============================================================================
// Chintu Action Trace Builder — Stage 34
// -----------------------------------------------------------------------------
// Wraps every brain-router result in the canonical trace shape v1 defined in
// CHINTU_ACTION_TRACE_CONTRACT.md.
//
// This module is the bridge between intent classification and audit logging.
// It sits BETWEEN the router and the bridge — it annotates decisions, never
// executes them.
//
// Guarantees:
//   * secretsPresent is ALWAYS false in any trace this module emits.
//   * healthDataPresent is ALWAYS false in any trace this module emits.
//   * health_sensitive risk ALWAYS produces allowed=false, sendStatus='blocked'.
//   * blocked / requires_approval capabilities ALWAYS produce allowed=false.
//   * blockedReason is ALWAYS non-empty when allowed=false.
//   * No network calls. No shell. No randomness. Pure local logic.
// =============================================================================

const { checkExecutionAllowed } = require('./chintu-capability-registry.js');

// ---------------------------------------------------------------------------
// Map brain-router risk values → trace contract risk values
// (Trace contract uses 5 values; router uses 5 different labels.)
// ---------------------------------------------------------------------------
const ROUTER_RISK_TO_TRACE_RISK = {
  'safe_read': 'safe_read',
  'safe_local_action': 'dry_run',
  'code_change': 'requires_approval',
  'external_send': 'requires_approval',
  'health_sensitive': 'health_sensitive',
};

// ---------------------------------------------------------------------------
// Map intent slug → capability registry ID.
// Intents that don't directly map to a registered capability get null —
// the trace is still valid; capabilityId will be null and allowed defaults
// to true for safe_read / dry_run if no capability gate applies.
// ---------------------------------------------------------------------------
const INTENT_TO_CAPABILITY = {
  'greeting':                'chintu.status',
  'capabilities':            'chintu.status',
  'whats_next':              'chintu.status',
  'git_check':               'chintu.repoSummary',
  'check_everything':        'chintu.checkEverything',
  'run_validator':           'chintu.checkEverything',
  'release_guard':           'chintu.checkEverything',
  'check_connectors':        'connector.runtimeMap',
  'connector_status':        'connector.runtimeMap',
  'connector_setup_check':   'connector.runtimeMap',
  'telegram_dry_run_guide':  'telegram.discoverIds',
  'github_status':           'chintu.githubStatusDryRun',
  'github_repo_summary':     'chintu.githubStatusDryRun',
  'validate_bala':           'bala.localHealthSummaryReadOnly',
  'next_sprint':             'bala.localHealthSummaryReadOnly',
  'improve_score':           'bala.localHealthSummaryReadOnly',
  'explain_report_plan':     'bala.localHealthSummaryReadOnly',
  'prompt_claude':           'chintu.checkEverything',
  'prompt_codex':            'chintu.checkEverything',
  'agent_board':             'chintu.checkEverything',
  'open_bala_public':        'bala.localHealthSummaryReadOnly',
  'open_bala_local':         'bala.localHealthSummaryReadOnly',
  'health_emergency':        'chintu.healthEmergencyAction',
  'bala_ask':                'bala.askSkill',
  'git_push':                'chintu.gitPush',
  'unknown':                 'chintu.status',
};

// ---------------------------------------------------------------------------
// Build a deterministic action ID from the intent + ISO timestamp.
// Safe: no crypto dependency, no randomness.
// ---------------------------------------------------------------------------
function makeActionId(intent, nowIso) {
  return String(intent || 'unknown') + '_' + nowIso.replace(/[:.]/g, '');
}

// ---------------------------------------------------------------------------
// Derive the sequence array from the router result.
// The router stores sequence as a string name on some results; we expand it
// here to match the contract (array of strings or null).
// ---------------------------------------------------------------------------
const KNOWN_SEQUENCES = {
  check_everything: ['git_status', 'validate_app', 'connector_readiness', 'release_guard'],
  bala_health_check: ['validate_app', 'release_guard'],
  chintu_health_check: ['git_status', 'connector_status', 'connector_readiness'],
  next_sprint: ['action_packet_bala_sprint', 'prompt_xml_bala'],
};

function resolveSequence(routeResult) {
  if (Array.isArray(routeResult.sequence)) return routeResult.sequence;
  if (typeof routeResult.sequence === 'string') {
    return KNOWN_SEQUENCES[routeResult.sequence] || null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Core builder. Takes a router result + options; returns canonical trace v1.
//
// opts:
//   source        — 'telegram' | 'bridge' | 'cli' | 'fixture'  (default 'cli')
//   dryRun        — boolean (default true)
//   executed      — boolean (default false; bridge sets to true after execution)
//   endpoint      — string or null (default null; bridge fills this)
//   bridgeResult  — object or null (default null)
//   sendFlag      — boolean (was --send passed? default false)
//   sendEnabled   — boolean (is CHINTU_TELEGRAM_SEND_ENABLED=1? default false)
//   auditPath     — string (default 'CHINTU_OUTBOX/telegram_connector_audit.jsonl')
//   nowIso        — string (ISO timestamp; default new Date().toISOString())
// ---------------------------------------------------------------------------
function buildTrace(routeResult, opts) {
  opts = opts || {};

  const source     = opts.source     || 'cli';
  const dryRun     = opts.dryRun     !== false;   // default true
  const executed   = opts.executed   === true;    // default false
  const endpoint   = opts.endpoint   || null;
  const bridgeResult = opts.bridgeResult || null;
  const sendFlag   = opts.sendFlag   === true;
  const sendEnabled = opts.sendEnabled === true;
  const auditPath  = opts.auditPath  || 'CHINTU_OUTBOX/telegram_connector_audit.jsonl';
  const nowIso     = opts.nowIso     || new Date().toISOString();

  // -- Intent and risk mapping ------------------------------------------------
  const intent     = String(routeResult.intent || 'unknown');
  const routerRisk = String(routeResult.risk   || 'safe_read');
  const traceRisk  = ROUTER_RISK_TO_TRACE_RISK[routerRisk] || 'safe_read';

  // -- Capability gate --------------------------------------------------------
  const capabilityId = INTENT_TO_CAPABILITY[intent] || null;
  let allowed        = true;
  let blockedReason  = null;
  let allowedReason  = null;

  if (capabilityId) {
    const gate = checkExecutionAllowed(capabilityId);
    allowed = gate.allowed;
    if (!allowed) {
      blockedReason = gate.reason;
    } else {
      allowedReason = traceRisk + ' capability';
    }
  } else {
    // No capability registered — safe_read / dry_run pass through
    if (traceRisk === 'safe_read' || traceRisk === 'dry_run') {
      allowedReason = traceRisk + ' (no capability gate)';
    } else {
      // Anything else without a registered capability is blocked to be safe
      allowed = false;
      blockedReason = 'No registered capability for intent: ' + intent;
    }
  }

  // -- Health-sensitive override: always block, never allow -------------------
  const healthSensitive = traceRisk === 'health_sensitive';
  if (healthSensitive) {
    allowed = false;
    allowedReason = null;
    blockedReason = 'Health-sensitive commands never trigger local automation.';
  }

  // -- Send status ------------------------------------------------------------
  let sendStatus = 'not_requested';
  let sendBlockedReason = null;

  if (healthSensitive) {
    sendStatus = 'blocked';
    sendBlockedReason = 'health-sensitive commands never send replies via Chintu automation';
  } else if (sendFlag) {
    if (!sendEnabled) {
      sendStatus = 'blocked';
      sendBlockedReason = 'CHINTU_TELEGRAM_SEND_ENABLED is not set to 1';
    } else {
      sendStatus = dryRun ? 'dry_run' : 'sent';
    }
  }

  // -- Safety notes -----------------------------------------------------------
  const safetyNotes = Array.isArray(routeResult.safetyGates) ? routeResult.safetyGates.slice() : [];
  if (healthSensitive) {
    safetyNotes.unshift('health_sensitive risk detected', 'bridge execution blocked', 'send blocked');
  }
  if (dryRun) {
    safetyNotes.push('dry_run flag active — no bridge execution');
  }

  // -- Result summary ---------------------------------------------------------
  let resultSummary;
  if (!allowed) {
    resultSummary = 'Blocked: ' + (blockedReason || 'not allowed');
  } else if (executed) {
    resultSummary = 'Bridge executed ' + intent + ': result attached';
  } else {
    resultSummary = 'Dry-run: sequence planned, bridge not reached';
  }

  // -- Assemble trace ---------------------------------------------------------
  const trace = {
    traceVersion:       '1',
    actionId:           makeActionId(intent, nowIso),
    timestamp:          nowIso,
    source:             source,
    userText:           String(routeResult.message || ''),
    intent:             intent,
    risk:               traceRisk,
    allowed:            allowed,
    allowedReason:      allowed ? allowedReason : null,
    blockedReason:      allowed ? null : (blockedReason || 'not allowed'),
    dryRun:             dryRun,
    executed:           executed,
    capabilityId:       capabilityId,
    endpoint:           endpoint,
    sequence:           resolveSequence(routeResult),
    resultSummary:      resultSummary,
    bridgeResult:       bridgeResult,
    healthSensitive:    healthSensitive,
    sendStatus:         sendStatus,
    sendBlockedReason:  sendBlockedReason,
    safetyNotes:        safetyNotes,
    auditPath:          auditPath,
    secretsPresent:     false,
    healthDataPresent:  false,
  };

  return trace;
}

// ---------------------------------------------------------------------------
// Validate that a trace object satisfies all contract invariants.
// Returns { ok: true } or { ok: false, violations: string[] }.
// Used in tests and optionally before audit-log write.
// ---------------------------------------------------------------------------
function validateTrace(trace) {
  const violations = [];
  const REQUIRED = [
    'traceVersion', 'actionId', 'timestamp', 'source', 'userText', 'intent',
    'risk', 'allowed', 'dryRun', 'executed', 'resultSummary',
    'healthSensitive', 'sendStatus', 'safetyNotes', 'auditPath',
    'secretsPresent', 'healthDataPresent',
  ];

  for (const f of REQUIRED) {
    if (!Object.prototype.hasOwnProperty.call(trace, f)) {
      violations.push('missing required field: ' + f);
    }
  }

  if (trace.secretsPresent !== false)     violations.push('secretsPresent must be false');
  if (trace.healthDataPresent !== false)  violations.push('healthDataPresent must be false');
  if (trace.traceVersion !== '1')        violations.push('traceVersion must be "1"');

  const VALID_RISKS = ['safe_read', 'dry_run', 'health_sensitive', 'requires_approval', 'blocked'];
  if (!VALID_RISKS.includes(trace.risk))  violations.push('invalid risk: ' + trace.risk);

  const VALID_SEND = ['not_requested', 'blocked', 'dry_run', 'sent'];
  if (!VALID_SEND.includes(trace.sendStatus)) violations.push('invalid sendStatus: ' + trace.sendStatus);

  const VALID_SOURCES = ['telegram', 'bridge', 'cli', 'fixture'];
  if (!VALID_SOURCES.includes(trace.source)) violations.push('invalid source: ' + trace.source);

  if (!trace.allowed && !trace.blockedReason) {
    violations.push('allowed=false requires non-empty blockedReason');
  }
  if (trace.allowed && trace.blockedReason) {
    violations.push('allowed=true must have blockedReason=null');
  }

  if (trace.healthSensitive && trace.allowed) {
    violations.push('health_sensitive trace cannot have allowed=true');
  }
  if (trace.healthSensitive && trace.sendStatus !== 'blocked') {
    violations.push('health_sensitive trace must have sendStatus="blocked"');
  }

  if (!Array.isArray(trace.safetyNotes)) {
    violations.push('safetyNotes must be an array');
  }

  return violations.length === 0
    ? { ok: true }
    : { ok: false, violations };
}

// ---------------------------------------------------------------------------
// Write trace to audit log (append-only JSONL).
// Safe: never writes if secretsPresent or healthDataPresent is true (belt+suspenders).
// ---------------------------------------------------------------------------
function writeTraceToAuditLog(trace, auditPath) {
  if (trace.secretsPresent || trace.healthDataPresent) {
    throw new Error('SAFETY: Refused to write trace with secrets or health data to audit log.');
  }
  const fs = require('fs');
  const path = require('path');
  const resolvedPath = path.resolve(auditPath);
  fs.appendFileSync(resolvedPath, JSON.stringify(trace) + '\n', 'utf8');
}

module.exports = { buildTrace, validateTrace, writeTraceToAuditLog, makeActionId, INTENT_TO_CAPABILITY, ROUTER_RISK_TO_TRACE_RISK };
