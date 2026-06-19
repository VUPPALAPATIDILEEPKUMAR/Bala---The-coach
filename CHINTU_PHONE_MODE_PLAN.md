# Chintu Phone Mode Plan — Stage 24

Founder wants Chintu on the phone. Here is the honest reality and the safe path.

## Why the phone cannot just call the bridge

Chintu Allegro talks to the local bridge at `http://127.0.0.1:18791`. That
address means "this same computer". A phone on the same Wi-Fi cannot reach the
computer's `127.0.0.1`. It would only work if one of these were true, and each
has to be chosen on purpose:

1. A LAN bridge is intentionally enabled (bind to the computer's LAN IP) — not
   done in this stage, and not by default.
2. The Telegram connector is activated (env-gated, allowlisted, approval phrase).
3. A secure tunnel is created deliberately by the founder.

## Safest phone path right now

- Install the BALA PWA on the phone for the health-awareness app itself. BALA is
  local-first in the browser and works great as an installed app. BALA stays a
  calm check-in guide — not a diagnosis or emergency monitor.
- Use the Telegram connector later for Chintu notifications and simple commands,
  once it is activated with its env vars, allowlist, and approval phrase.
- Do NOT expose the local bridge to the LAN by default.

## Future paired-phone mode (parked)

- Pair via QR code with a session token.
- Allowlist a specific LAN IP only.
- Read-only actions first; writes later, behind approval.
- Short-lived tokens, never committed, never printed.

## Hard rule for this stage

The bridge stays bound to `127.0.0.1` only. It is never bound to `0.0.0.0`.
