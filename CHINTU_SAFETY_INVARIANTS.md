# Chintu Safety Invariants

**Status:** canonical. The single list of rules that every Chintu OS
script, doc, commit, and builder session must respect. If a rule
appears anywhere else in the repo, it must agree with this list. The
`chintu-safety-boundary.test.js` and sibling tests enforce parts of
this list mechanically.

---

## 1. Protected BALA app files (never edited in builder mode)

| File | Reason |
|---|---|
| `app.js` | BALA runtime |
| `index.html` | BALA shell |
| `styles.css` | BALA presentation |
| `sw.js` | service worker (cache + offline behavior) |
| `coach.js` | BALA coach text |
| `manifest.webmanifest` | PWA install metadata |
| `privacy.html` | privacy / safety copy |
| `functions/api/coach.js` | server-side coach handler |

Only the founder edits these. The `chintu-safety-boundary.test.js`
test verifies the canonical list stays consistent.

---

## 2. Parked surfaces (never activated in builder mode)

- Telegram, Discord, webhooks
- Cloud sync, external backend, paid APIs
- Phone notifications, voice calling, voice cloning, SMS
- External automation, scheduled cloud agents
- Health-data transfer
- Network egress from any Chintu script
- Memory-wiki

Activation of any of these requires an explicit, named, founder
approval and a fresh spec doc. Nothing here ships by default.

---

## 3. Hard "never"s (regardless of mode)

- Never bump the service worker `CACHE_NAME` unless the founder asked
  for a BALA release.
- Never commit secrets, `.env`, API keys, tokens, or credentials.
- Never push. Push is founder-only.
- Never force-push, never rewrite published history.
- Never claim BALA diagnoses, treats, predicts, prevents, or replaces
  a doctor. Never describe BALA as emergency monitoring.
- Never edit `CHINTU_MEMORY_VAULT/PARKED_SYSTEMS.md` activation
  status without founder approval.

---

## 4. Allowed builder actions (the safe slice surface)

- Edit `CHINTU_*.md` and `BALA_*.md` planning docs.
- Add or edit `scripts/chintu-*.ps1` and `scripts/chintu-*.test.js`.
- Regenerate tracked control-room artifacts
  (`CHINTU_AGENT_DASHBOARD.html`, `CHINTU_CONTROL_ROOM_INDEX.html`,
  `CHINTU_OS_HEALTH_CHECK.md`, `CHINTU_ALIVE_BRIEFING.md`).
- Add new vault files (and update `CHINTU_MEMORY_VAULT/README.md`).
- Commit a safe slice per concept, with `chore:` or `docs:` prefix.

Every other action is parked or founder-only.

---

## 5. The single validation gate

```powershell
powershell -ExecutionPolicy Bypass -File scripts\chintu-master-launcher.ps1
```

It runs all integrity tests, the validator, the release guard, and
regenerates the control room. The "health check RED because of N
unpushed commits" condition is **expected** during builder cycles —
that is the human push reminder, not a safety failure.

A real safety failure is any of:

- `chintu-no-network-egress.test.js` red.
- `chintu-medical-claims.test.js` red.
- `chintu-safety-boundary.test.js` red.
- `chintu-doc-link-integrity.test.js` red.
- `chintu-bala-safe-docs.test.js` red.
- `chintu-parked-systems.test.js` red.
- `chintu-continuation-prompts.test.js` red.
- `chintu-generated-files-map.test.js` red.

If any of those go red, stop. Fix the failing test before any other
work.

---

## 6. The BALA safety footer (mandatory)

Whenever BALA is mentioned in a doc, commit body, or generated
artifact, include verbatim:

> BALA is a health-awareness companion. It does not diagnose, treat,
> predict, prevent, replace doctors, or provide emergency monitoring.

---

## 7. Stop conditions for any builder session

Stop when any one is true:

1. Usage budget is low.
2. A real safety test (§5) is red and cannot be fixed safely.
3. The next step requires founder-only approval (§3).
4. A hard "never" (§3) was inadvertently triggered — stop, write up
   what happened, and hand back.

---

## 8. BALA safety footer

BALA is a health-awareness companion. It does not diagnose, treat,
predict, prevent, replace doctors, or provide emergency monitoring.
