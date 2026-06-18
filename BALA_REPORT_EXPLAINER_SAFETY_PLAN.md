# BALA Report Explainer Safety Plan

**Status:** planning — future module, not yet implemented
**Stage:** 20 — roadmap doc only. No BALA app code changes in this file.
**Date:** 2026-06-18

---

## What This Is

A future optional module called **BALA Report Explainer** that helps users understand
their own health reports — blood panels, lipid profiles, HbA1c, thyroid, basic metabolic
panel — in plain language. It prepares doctor-ready questions, not diagnoses.

---

## What It Will Do (When Built)

- Accept a user-uploaded PDF or typed values from their own report.
- Explain what flagged values commonly mean in plain, safe language.
- Identify which values are outside the reference range shown on the report.
- Generate a list of doctor-ready questions the user can bring to their next appointment.
- Keep all data local — no cloud upload, no server processing.

---

## What It Will Never Do

- Diagnose any condition.
- Read or interpret X-rays, MRIs, CT scans, or ultrasounds as a radiologist would.
- Recommend medication.
- Tell a user they are safe to ignore a flagged value.
- Replace a clinician review of the report.
- Process reports without the user's explicit, per-session consent.
- Send report data through any connector or external service.

---

## Name Policy

The feature must always be called **BALA Report Explainer** — never:
- "AI Doctor"
- "AI Radiologist"
- "Smart Diagnosis"
- "AI Lab Analysis"

---

## Safe Language Requirements

- "This value appears outside the reference range on your report."
- "You might want to ask your doctor: what does this mean for me?"
- "This is for awareness only. Your clinician can interpret this in context."
- "BALA cannot diagnose. This is not a medical opinion."

---

## Privacy Architecture

- PDF processing must be in-browser only (no server upload).
- User must confirm: "I understand this stays on my device."
- No report data stored beyond the session unless user explicitly saves it.
- No connector payloads include report data under any condition.

---

## Implementation Conditions Before Building

1. Founder explicitly approves scope.
2. In-browser PDF parser approach validated (fflate + pdfjs or equivalent).
3. Medical safety copy reviewed by founder.
4. BALA UX Agent packet written.
5. Release guard passes before any commit.

---

## What Remains Parked

Everything. This is a planning doc only.

---

*BALA is a health-awareness companion. It does not diagnose, treat, predict, prevent, replace doctors, or provide emergency monitoring.*
