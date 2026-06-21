'use strict';
// =============================================================================
// BALA-B51 Sparkline Engine
// Pure logic. No DOM. No network. No external dependencies.
// Produces inline SVG sparkline strings from arrays of numeric values.
//
// Safety rules:
//   - Never crashes on empty, sparse, or non-numeric input
//   - No medical claims — sparklines are visual trend helpers only
//   - Input is never sent anywhere
// =============================================================================

// ---------------------------------------------------------------------------
// SIGNAL POLARITY
// Determines whether an upward trend is displayed as "good" or "watch".
//   'up'   = higher values are better (hrv, sleep, spo2, steps)
//   'down' = lower values are better (rhr)
// ---------------------------------------------------------------------------
var SIGNAL_POLARITY = {
  hrv:   'up',
  sleep: 'up',
  spo2:  'up',
  steps: 'up',
  rhr:   'down',
};

// ---------------------------------------------------------------------------
// COLOURS (hex — safe for inline SVG)
// ---------------------------------------------------------------------------
var COLOR_GOOD  = '#2e7d5b';  // green — trend is heading the right way
var COLOR_WATCH = '#b85c00';  // amber — trend is heading the wrong way
var COLOR_FLAT  = '#8a8a8a';  // grey  — no clear trend

// ---------------------------------------------------------------------------
// normalise
// Takes an array of numbers and maps them to the range [0, 1].
// Returns an array of 0.5 values when input has fewer than 2 finite points
// or all values are identical (no range to normalise).
//
// Non-finite values (NaN, Infinity, null, undefined) are treated as gaps and
// replaced with null in the output (the SVG builder skips null points).
// ---------------------------------------------------------------------------
function normalise(values) {
  if (!Array.isArray(values) || values.length === 0) return [];

  var finite = values.filter(function(v) { return typeof v === 'number' && isFinite(v); });
  if (finite.length < 2) {
    // Not enough data — return flat 0.5 placeholders for every slot
    return values.map(function(v) {
      return (typeof v === 'number' && isFinite(v)) ? 0.5 : null;
    });
  }

  var min = finite.reduce(function(a, b) { return Math.min(a, b); }, Infinity);
  var max = finite.reduce(function(a, b) { return Math.max(a, b); }, -Infinity);

  if (max === min) {
    // All same value — flat line at 0.5
    return values.map(function(v) {
      return (typeof v === 'number' && isFinite(v)) ? 0.5 : null;
    });
  }

  return values.map(function(v) {
    if (typeof v !== 'number' || !isFinite(v)) return null;
    return (v - min) / (max - min);
  });
}

// ---------------------------------------------------------------------------
// trendDirection
// Compares the average of the first half of values to the second half.
// Returns 'up', 'down', or 'flat'.
// Threshold: change of >= 5% of range to count as a trend.
// ---------------------------------------------------------------------------
function trendDirection(values) {
  if (!Array.isArray(values)) return 'flat';
  var finite = values.filter(function(v) { return typeof v === 'number' && isFinite(v); });
  if (finite.length < 2) return 'flat';

  var half = Math.floor(finite.length / 2);
  var firstHalf  = finite.slice(0, half || 1);
  var secondHalf = finite.slice(half);

  var avgFirst  = firstHalf.reduce(function(a, b) { return a + b; }, 0) / firstHalf.length;
  var avgSecond = secondHalf.reduce(function(a, b) { return a + b; }, 0) / secondHalf.length;

  var min = Math.min.apply(null, finite);
  var max = Math.max.apply(null, finite);
  var range = max - min;

  // Need at least 5% range to call a trend; otherwise flat
  if (range === 0) return 'flat';
  var change = (avgSecond - avgFirst) / range;
  if (change > 0.05)  return 'up';
  if (change < -0.05) return 'down';
  return 'flat';
}

// ---------------------------------------------------------------------------
// resolveColor
// Given a signal key and the raw trend direction, returns the stroke colour.
// Polarity is applied: for 'down'-polarity signals, an upward trend is amber.
// ---------------------------------------------------------------------------
function resolveColor(signalKey, direction) {
  if (direction === 'flat') return COLOR_FLAT;
  var polarity = SIGNAL_POLARITY[signalKey] || 'up';
  var positive = (polarity === 'up') ? (direction === 'up') : (direction === 'down');
  return positive ? COLOR_GOOD : COLOR_WATCH;
}

// ---------------------------------------------------------------------------
// buildPolylinePoints
// Converts normalised values (0–1) into a SVG polyline "points" attribute string.
// Null values create a gap — they are skipped (the polyline is not split; use
// multiple <polyline> elements for true gap support, but for 7-point data the
// single-segment approach is fine).
//
// width  — total SVG width  (default 80)
// height — total SVG height (default 28)
// padding — vertical padding in px to avoid clipping the stroke (default 3)
// ---------------------------------------------------------------------------
function buildPolylinePoints(normValues, width, height, padding) {
  if (!Array.isArray(normValues) || normValues.length === 0) return '';
  width   = (typeof width   === 'number' && isFinite(width))   ? width   : 80;
  height  = (typeof height  === 'number' && isFinite(height))  ? height  : 28;
  padding = (typeof padding === 'number' && isFinite(padding)) ? padding : 3;

  var usableH = height - padding * 2;
  var pairs = [];

  normValues.forEach(function(v, i) {
    if (v === null || v === undefined) return; // gap — skip
    var x = normValues.length === 1
      ? width / 2
      : (i / (normValues.length - 1)) * width;
    // y=0 is top; normalised 1 should be near top, so invert
    var y = padding + (1 - v) * usableH;
    pairs.push(round2(x) + ',' + round2(y));
  });

  return pairs.join(' ');
}

// ---------------------------------------------------------------------------
// buildSparklineSVG
// Returns a complete inline SVG string.
//
// values    — array of raw numbers (e.g. last 7 hrv readings)
// signalKey — key in SIGNAL_POLARITY (default 'hrv')
// opts      — { width, height, strokeWidth }
// ---------------------------------------------------------------------------
function buildSparklineSVG(values, signalKey, opts) {
  opts = opts || {};
  var width       = (typeof opts.width       === 'number') ? opts.width       : 80;
  var height      = (typeof opts.height      === 'number') ? opts.height      : 28;
  var strokeWidth = (typeof opts.strokeWidth === 'number') ? opts.strokeWidth : 2;
  var padding     = strokeWidth;

  if (!Array.isArray(values) || values.length === 0) {
    return buildFlatSVG(width, height, strokeWidth);
  }

  var norm      = normalise(values);
  var direction = trendDirection(values);
  var color     = resolveColor(signalKey || 'hrv', direction);
  var points    = buildPolylinePoints(norm, width, height, padding);

  if (!points) return buildFlatSVG(width, height, strokeWidth);

  return (
    '<svg xmlns="http://www.w3.org/2000/svg"' +
    ' viewBox="0 0 ' + width + ' ' + height + '"' +
    ' width="' + width + '" height="' + height + '"' +
    ' aria-hidden="true" class="sp-svg">' +
    '<polyline points="' + points + '"' +
    ' fill="none"' +
    ' stroke="' + color + '"' +
    ' stroke-width="' + strokeWidth + '"' +
    ' stroke-linecap="round"' +
    ' stroke-linejoin="round"/>' +
    '</svg>'
  );
}

// ---------------------------------------------------------------------------
// buildFlatSVG — fallback when there is nothing to draw
// ---------------------------------------------------------------------------
function buildFlatSVG(width, height, strokeWidth) {
  width       = width       || 80;
  height      = height      || 28;
  strokeWidth = strokeWidth || 2;
  var y = round2(height / 2);
  var x2 = round2(width);
  return (
    '<svg xmlns="http://www.w3.org/2000/svg"' +
    ' viewBox="0 0 ' + width + ' ' + height + '"' +
    ' width="' + width + '" height="' + height + '"' +
    ' aria-hidden="true" class="sp-svg">' +
    '<line x1="0" y1="' + y + '" x2="' + x2 + '" y2="' + y + '"' +
    ' stroke="' + COLOR_FLAT + '"' +
    ' stroke-width="' + strokeWidth + '"' +
    ' stroke-linecap="round"/>' +
    '</svg>'
  );
}

// ---------------------------------------------------------------------------
// extractHistory
// Given metrics.history (array of check-in objects) and a signal key,
// returns an array of the last `n` numeric values (most recent last).
// Non-finite entries are kept as null to preserve time gaps.
// ---------------------------------------------------------------------------
function extractHistory(history, signalKey, n) {
  n = (typeof n === 'number' && n > 0) ? n : 7;
  if (!Array.isArray(history) || history.length === 0) return [];
  return history
    .slice(-n)
    .map(function(entry) {
      var v = entry && entry[signalKey];
      return (typeof v === 'number' && isFinite(v)) ? v : null;
    });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function round2(n) {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
module.exports = {
  normalise,
  trendDirection,
  resolveColor,
  buildPolylinePoints,
  buildSparklineSVG,
  buildFlatSVG,
  extractHistory,
  SIGNAL_POLARITY,
  COLOR_GOOD,
  COLOR_WATCH,
  COLOR_FLAT,
};
