# BALA Your Coach — Live Product State
_Last updated: 2026-06-23 — Sprint B63_
**Status:** planning reference only

---

## Identity

- **Product:** BALA Your Coach — mobile-first health-awareness PWA
- **Named for:** Balaji (founder's father). BALA is an attempt to help people listen to their body signals earlier.
- **Tagline:** "Your daily health guide from your own body signals."
- **Safety class:** Health-awareness only. Never diagnoses, treats, predicts, prevents cardiac arrest, replaces doctors, or monitors emergencies.

---

## Score Engine (Canonical Weights)

| Signal   | Weight | Label    |
|----------|--------|----------|
| sleep    | 32     | Sleep    |
| hrv      | 23     | HRV      |
| rhr      | 20     | RHR      |
| steps    | 20     | Activity |
| spo2     |  5     | SpO₂     |

**Score range:** 0–100. No medical interpretation. No trend labels with fewer than 3 days of data.

---

## PWA Files

| File | Purpose |
|------|---------|
| `index.html` | App shell, score screen, import modal, B63 trust panel |
| `app.js` | All logic: score, importers B59–B63, tour, coach |
| `styles.css` | Mobile-first styles, B63 chip classes |
| `sw.js` | Service worker, offline cache |
| `manifest.webmanifest` | PWA manifest |
| `privacy.html` | Privacy policy |

---

## Shipped Stages

| Stage | Feature | Commit |
|-------|---------|--------|
| B58 | 7-step demo tour (founder journey) | `aa6a527` |
| B59 | Apple Health + Google Fit + Fitbit + Universal CSV importers | (in B59–B62 chain) |
| B60 | Score completeness feedback — source-specific gap cards after import | `d33fd00` |
| B61 | Garmin Connect CSV + Samsung Health ZIP importers | `954bc31` |
| B62 | JSON export (`downloadHealthJSON()`) | `52067f1` |
| **B63** | **Import Trust + Data Review — signal chip panel on score screen** | this sprint |

**6 free import paths (all local, zero cloud):**
Apple Health · Google Fit · Fitbit · Samsung Health · Garmin Connect · BALA Universal CSV

---

## B63 Import Trust (This Sprint)

**What was built:**
- `<div id="b63-import-trust">` container replaces the single score-data-source `<p>`
- Signal chips (green = detected, gray = missing) rendered from `detectedFields[]`
- Trust meta line: records count · latest date · "trends shown after 3+ days" guard
- `b63RenderImportTrust(opts)` called from `showImportResult()` on every import
- `b63InitDemoTrust()` initialises panel to Demo Mode state on page load (chips hidden)
- CSS: `.b63-chip-ok` (green), `.b63-chip-gap` (gray), `.b63-trust-meta`

**Safety invariants:**
- No trend label if `recordsImported < 3`
- No invented confidence scores
- Panel hidden in Demo Mode (chips hidden, meta hidden)

---

## Next Planned Stage

| Stage | Feature | Status |
|-------|---------|--------|
| B64 | Oura Ring CSV parser | ⬜ Backlog |

---

## Medical Safety (Always Active)

BALA must never claim to:
- Predict heart attacks or cardiac arrest
- Diagnose or treat any condition
- Replace a doctor
- Monitor emergencies
- Guarantee health outcomes

For urgent symptoms (chest pain, trouble breathing, fainting, stroke-like): direct to emergency services immediately. No BALA score.

**Test guard:** `node scripts/chintu-medical-claims.test.js` — scans 179 files, 9 patterns. Must pass on every commit.

BALA is a health-awareness companion. It does not diagnose, treat, predict, prevent, replace doctors, or provide emergency monitoring.
