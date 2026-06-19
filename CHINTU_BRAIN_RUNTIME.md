# Chintu Brain Runtime — Stage 24

The brain runtime is what makes Chintu Allegro feel alive instead of a packet
generator. It turns a casual founder message into a structured decision and,
where safe, runs real allowlisted local actions through the bridge.

## Pieces

- `scripts/chintu-brain-router.js` — the deterministic brain. Pure logic, no
  network, no shell, no fs. Same input always gives the same output.
- `scripts/chintu-local-bridge.js` — the only thing that executes actions. It
  exposes `/api/chat`, `/api/sequence`, `/api/providers/status` on 127.0.0.1.
- `scripts/chintu-local-ai-provider.js` — detects optional local providers
  (Ollama, OpenClaw) for status only. Reasoning stays deterministic.
- `CHINTU_ALLEGRO.html` — the operator UI. Its chat input now calls `/api/chat`
  when the bridge is live, and falls back to copy-paste packets when offline.

## What the router decides

For every message it returns: a natural founder-tone `reply`, the `intent`,
the `track` (chintu / bala / both), the `risk`
(safe_read / safe_local_action / code_change / external_send / health_sensitive),
a `responseType` (conversational_reply / single_bridge_action /
multi_bridge_sequence / prompt_generation / action_packet / parked_with_reason),
the `actions` to run, the `safetyGates`, the files likely involved, and the
`nextSuggestedAction`.

## How "hi" works now

`hi` is detected as a greeting. The router returns a conversational reply
("Hey bro, Chintu is live...") and runs NO actions. It no longer falls through
to a generic planning packet.

## How "check everything" works now

`check everything` maps to the named `check_everything` sequence:
`git_status -> validate_app -> connector_readiness -> release_guard`. The bridge
runs each allowlisted step in order and returns every result. Nothing is pushed
or sent.

## Intent map (high level)

- greeting, capabilities, whats_next -> conversational / git read
- check_everything, validate_bala -> named safe sequences
- run_validator, release_guard, check_connectors, git_check -> single actions
- next_sprint, improve_score -> action packet + XML prompt (no code change)
- prompt_claude, prompt_codex -> prompt generation
- explain_report_plan -> parked, with the safe non-diagnostic boundary
- health_emergency -> overrides everything, routes to urgent care
- unknown -> a friendly guiding reply, never a fake "I ran it" claim

## Safety properties

- The bridge is the trust boundary: it re-validates every action name and only
  runs fixed, allowlisted commands with `shell:false`.
- The router only ever names actions that exist. Unknown names are dropped.
- Emergency phrasing (chest pain, trouble breathing, fainting, stroke-like
  symptoms) always routes to urgent care and is never gated behind a score.
- No external send, no secrets printed, no health data leaves the machine.
- BALA stays a calm check-in guide — not a diagnosis or emergency monitor.

## Tests

`node scripts/chintu-brain-router.test.js`, `node scripts/chintu-local-bridge.test.js`,
`node scripts/chintu-local-ai-provider.test.js`.
