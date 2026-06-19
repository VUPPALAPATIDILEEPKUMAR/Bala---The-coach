# Chintu MCP Security Gate — Stage 24

Before any MCP server or connector tool is allowed to run, it must clear this
gate. The default answer is no.

## Gate checklist

1. Local-first. Does it run on this machine (loopback) or call out? Outbound
   tools start parked.
2. Pinned. Is the server/tool version pinned? No floating "latest".
3. Allowlisted. Is the specific tool name on an explicit allowlist? Unknown
   tools are rejected, not inferred.
4. Read-only first. New tools may read before they may write. Writes need a
   dry-run preview.
5. Scoped. Filesystem tools are scoped to the repo. GitHub tools are repo-scoped
   with a short-lived token.
6. No secret exposure. Tokens are never printed; token-shaped strings and known
   secret env names are redacted from output.
7. Approval phrase. Any external send (Telegram, GitHub write) requires an
   explicit approval phrase, not just a button.
8. Audited. Every attempt — allowed or blocked — is written to the audit log.
9. Metadata is not trust. Tool descriptions are advisory only; behaviour is
   constrained by the gate, not by what a tool claims about itself.

## What is NOT allowed in this stage

- Broad MCP activation or auto-connecting third-party MCP servers.
- yolo / unattended write mode.
- Reading secrets, printing tokens, or exposing pairing/token files.
- Exposing the bridge beyond 127.0.0.1.

## Trust boundary

The bridge re-validates every action and only runs fixed, allowlisted commands
with `shell:false`. The browser never sends a command string — only an action
name or a chat message that the deterministic brain maps to allowlisted actions.
