'use strict';

/**
 * chintu-prefs.js — C60
 *
 * Local-first preference memory for Chintu.
 * Stored at os.homedir()/chintu-prefs.json — outside the repo, NEVER committed.
 *
 * Saves:
 *   monthly_budget, rental_budget, car_budget, car_type, home_city, home_config,
 *   _location (lat/lng/name/timestamp), and any key Groq decides to remember.
 *
 * Security:
 *   - No network calls. Pure file I/O only.
 *   - File lives at C:\Users\Chintu\chintu-prefs.json (home dir, outside repo)
 *   - Values capped at 200 chars. Keys capped at 50 chars.
 *   - No health data, no tokens, no secrets stored here.
 */

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const PREFS_FILE = path.join(os.homedir(), 'chintu-prefs.json');

// ── Read all preferences ─────────────────────────────────────────────────────
function getPreferences() {
  try {
    return JSON.parse(fs.readFileSync(PREFS_FILE, 'utf8'));
  } catch (_) {
    return {};
  }
}

// ── Save a single preference ──────────────────────────────────────────────────
function savePreference(key, value) {
  if (!key) return getPreferences();
  const k = String(key).slice(0, 50);
  const v = String(value).slice(0, 200);
  const prefs = getPreferences();
  prefs[k] = v;
  prefs._updated = new Date().toISOString();
  try {
    fs.writeFileSync(PREFS_FILE, JSON.stringify(prefs, null, 2));
  } catch (e) {
    // non-fatal: could be permission issue
    console.warn('[prefs] write error: ' + e.message.slice(0, 60));
  }
  return prefs;
}

// ── Save a location share ─────────────────────────────────────────────────────
function saveLocation(lat, lng, name) {
  const prefs = getPreferences();
  prefs._location = {
    lat:       Number(lat),
    lng:       Number(lng),
    name:      String(name || 'Unknown').slice(0, 100),
    timestamp: new Date().toISOString(),
  };
  prefs._updated = new Date().toISOString();
  try {
    fs.writeFileSync(PREFS_FILE, JSON.stringify(prefs, null, 2));
  } catch (_) {}
  return prefs._location;
}

// ── Get saved location ────────────────────────────────────────────────────────
function getLocation() {
  const prefs = getPreferences();
  return prefs._location || null;
}

module.exports = { getPreferences, savePreference, saveLocation, getLocation };
