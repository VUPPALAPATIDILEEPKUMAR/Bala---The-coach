# Chintu Future Agent Architecture (parked)

**Status:** PARKED. Architecture sketch only. Nothing here is activated.
**Audience:** founder + future Claude/Codex sessions.

If Chintu OS ever grows into a multi-agent system, this is the shape
under which it could be done safely. Until the founder approves a
specific lane below, the current single-thread Claude-on-this-repo
arrangement is the only sanctioned execution model.

---

## 1. Today's reality (baseline)

- One Claude/Codex thread acts on the repo at a time.
- All execution is local-first. No external orchestrator.
- The master launcher (`scripts/chintu-master-launcher.ps1`) is the
  one validation gate.
- The founder is the only authorized "push" actor.

This is enough for Stage 11 work. Most of the value below would be
overkill until the founder explicitly says otherwise.

---

## 2. Layered model (read top-down)

```
+-------------------------------------------------------+
| Founder layer (always on, irreplaceable)              |
|   - reviews, approves push, owns BALA, owns secrets   |
+-------------------------------------------------------+
| Operator layer (Claude/Codex session, this repo)      |
|   - safe slices, docs, tests, control room            |
|   - validated by master launcher                      |
+-------------------------------------------------------+
| Reviewer layer (separate session, read-only)          |  <- parked
|   - reads commits, posts review notes to a vault file |
+-------------------------------------------------------+
| Planner layer (separate session, read-only)           |  <- parked
|   - produces next-sprint queue from vault + reports   |
+-------------------------------------------------------+
| Watcher layer (background, read-only)                 |  <- parked
|   - re-runs master launcher on a cadence              |
+-------------------------------------------------------+
```

Each parked layer must be activated independently and only after the
founder approves it.

---

## 3. Hard rules for any future agent

1. **Read-only by default.** Any new agent ships read-only first. Write
   access is added only after a tester cycle proves it is safe.
2. **One repo per agent.** No agent operates across repositories.
3. **No cross-talk activation.** Agents communicate by writing files to
   the memory vault, not by message buses, webhooks, or APIs.
4. **No network egress.** Same rule as the operator layer.
5. **No BALA app file writes from any agent except the founder.**
6. **One validation gate.** Every agent's output flows through the
   master launcher before commit.
7. **Single push actor.** The founder is the only entity that can
   push. No agent ever calls `git push`.

If any future agent design cannot satisfy all seven, it does not ship.

---

## 4. What this document is NOT

- Not an authorization to spin up another Claude session.
- Not an authorization to add an orchestrator script.
- Not a roadmap to multi-agent BALA work.
- Not a plan to remove the founder from the loop. The founder layer is
  permanent.

---

## 5. Trigger to revisit

Revisit this architecture when:

- A single Claude session is no longer enough to keep the operator
  layer green (validation drift, sprint queue stagnation).
- The founder wants an *independent* reviewer voice on a specific
  slice and explicitly opens that lane.
- A safe scheduled-task runner appears that does not require network
  egress or external automation activation.

Until then, parked.

---

## 6. BALA safety footer

BALA is a health-awareness companion. It does not diagnose, treat,
predict, prevent, replace doctors, or provide emergency monitoring.
