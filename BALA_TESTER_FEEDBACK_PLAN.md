# BALA Tester Feedback Plan (planning only, parked)

**Status:** planning. Founder-approved testers only. No live recruiting.
**Scope:** how to collect tester feedback on BALA without breaking
local-first / non-medical rules.

---

## 1. What we are NOT doing

- No public beta. No social media recruiting.
- No telemetry, no analytics, no error reporting, no usage pings.
- No cloud-stored feedback form. No Typeform, no Google Forms unless
  the founder explicitly opts in for one specific tester cycle.
- No screen recordings. No audio capture. No location capture.
- No health-data transfer from a tester's device to anywhere.

If any of those is needed for a specific cycle, that cycle is parked
until the founder explicitly approves it in writing.

---

## 2. The smallest safe feedback loop

A round of tester feedback is one or more 1:1 conversations the founder
already has with a known tester (friend, family member, willing
collaborator). The feedback artifact is a markdown file in this repo:

```
CHINTU_MEMORY_VAULT/TESTER_NOTES/<yyyy-mm-dd>-<tester-tag>.md
```

Where `<tester-tag>` is a short opaque label the founder picks (e.g.
`t1`, `t2`). No real name. No phone number. No address. No condition.

Each file has four sections:

1. **Context** — what BALA version (commit hash), what device, what the
   tester was asked to try.
2. **Observed** — neutral description of what the tester did and said.
3. **Asks** — what the tester wished BALA could do.
4. **Follow-ups** — what the founder will or will not do, with reason.

---

## 3. What testers can be asked about

Safe questions:

- "Does the home screen make sense in the first ten seconds?"
- "Where would you tap if you wanted to log how you're feeling today?"
- "Is anything confusing or noisy?"
- "What word would you change?"

Not safe:

- Anything that asks them to enter or share real medical history.
- Anything that frames BALA as a diagnostic or treatment tool.
- Anything that pressures continued use.

---

## 4. Storage and retention

Tester notes live in `CHINTU_MEMORY_VAULT/TESTER_NOTES/` (folder may not
yet exist; create it only on first real entry). They are:

- Plain markdown, no PII beyond the opaque tag.
- Indexed in `CHINTU_MEMORY_VAULT/README.md` like any other vault file.
- Subject to the memory-vault integrity test
  (`scripts/chintu-memory-vault.test.js`).

A note can be deleted at any time on tester request; the founder owns
that decision. There is no "tester database".

---

## 5. When to do a cycle

A tester cycle is appropriate when:

- A BALA-facing slice is on the verge of shipping, and the founder
  wants real-world reaction before service-worker bump.
- A copy / framing change might land differently than expected.

A tester cycle is not appropriate when:

- Only internal Chintu OS infra changed.
- The change is purely in `CHINTU_*.md` / `BALA_*.md` planning docs.
- The founder is fatigued; deferring is always allowed.

---

## 6. Out of scope for this plan

- Recruitment campaigns.
- Paid testing services.
- Any tooling that automatically aggregates tester input across
  sessions.
- App-store review programs.

---

## 7. BALA safety footer

BALA is a health-awareness companion. It does not diagnose, treat,
predict, prevent, replace doctors, or provide emergency monitoring.
