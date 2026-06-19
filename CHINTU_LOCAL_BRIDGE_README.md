# Chintu Local Bridge Runtime

Stage 24 - the live **brain runtime bridge** between the Chintu Allegro UI and your
local scripts. It is a tiny Node server that runs only on your own machine and only
runs a fixed, allowlisted set of safe commands.

## What it is

A browser page cannot (and should not) run shell commands directly. The bridge is the
safe middle layer:

```
CHINTU_ALLEGRO.html
   -> fetch http://127.0.0.1:18791/api/chat or /api/action
      -> scripts/chintu-local-bridge.js
         -> allowlisted local commands / named sequences
            -> JSON result back to the UI
               -> CHINTU_OUTBOX/local_bridge_audit.jsonl
```

The browser **never sends a raw command string**. It sends either a chat message,
an action name like `git_status`, or a named sequence like `check_everything`.
The bridge maps that to a hard-coded allowlist. There is no caller-controlled
shell command path.

## Start it

```
powershell -ExecutionPolicy Bypass -File scripts\chintu-allegro-start.ps1
```

That starts the bridge and opens the Allegro UI. To start the bridge on its own:

```
node scripts\chintu-local-bridge.js
```

It binds to `127.0.0.1:18791` (falls back to the next free port up to 18796 if busy).
Stop it with `Ctrl+C`.

## Endpoints

- `GET  /api/health` - liveness probe used by the UI on load.
- `GET  /api/status` - service info and the list of allowlisted actions.
- `GET  /api/providers/status` - local provider detection status (deterministic / Ollama / OpenClaw).
- `POST /api/action` - body `{ "action": "<name>" }`. Runs one allowlisted action.
- `POST /api/chat` - body `{ "message": "<founder text>" }`. Routes through the deterministic brain.
- `POST /api/sequence` - body `{ "sequence": "<allowlisted name>" }`. Runs one named safe sequence.

`/api/action` response shape:

```
{ ok, action, label, command, exitCode, stdout, stderr, durationMs, nextSuggestedAction }
```

## Allowlisted actions and sequences

Read / status: `status`, `git_status`, `git_log`, `connector_readiness`,
`connector_status`.

Guards: `release_guard`, `validate_app`, `run_validator_dry_run`.

Generate (prompts / packets): `prompt_xml_bala`, `prompt_xml_chintu`,
`prompt_costar_both`, `prompt_acr_both`, `action_packet_bala_sprint`,
`action_packet_connector_check`.

Open (local file or known BALA link): `open_allegro`, `open_bala_local`,
`open_bala_public`.

Named sequences: `check_everything`, `bala_health_check`, `chintu_health_check`,
`next_sprint`.

Anything else returns `400` and is logged as rejected.

## Safety properties

- Loopback only - bound to `127.0.0.1`, never reachable off-box.
- Cross-site browsers are rejected by an Origin gate; only the local UI may call it.
- Commands run with `shell:false` and a fixed argv - no shell, no interpolation.
- No `git push`. No real connector send. External sends stay gated elsewhere.
- Token-shaped strings and known secret env names are redacted from output and the log.
- Every request is appended to `CHINTU_OUTBOX/local_bridge_audit.jsonl` (gitignored)
  with timestamp, action, allowed flag, label, exit code, duration, and output summary.

## Tests

```
node scripts\chintu-local-bridge.test.js
```

Proves: health works, unknown action rejected, injection string rejected, raw command
string rejected, status action runs, server bound to loopback, secrets redacted, and the
action map uses only allowlisted binaries with no push.

## What stays parked

Real Telegram send, GitHub CLI push from the UI, filesystem/GitHub MCP servers, and
browser automation are **not** wired into the bridge. They remain behind founder-
controlled env vars, allowlists, and approval phrases. See
`CHINTU_REAL_CONNECTOR_MCP_SCAN.md`.
