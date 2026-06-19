# Chintu Allegro - Start Here

One command brings Chintu Allegro alive on your machine.

## Run this

```
powershell -ExecutionPolicy Bypass -File scripts\chintu-allegro-start.ps1
```

That script:

1. Confirms the repo root.
2. Starts the local bridge on `127.0.0.1:18791` (a minimized Node window).
3. Waits for the bridge to answer `/api/health`.
4. Opens `CHINTU_ALLEGRO.html` in your browser.
5. Prints the bridge URL, the app path, sample commands, and how to stop.

When the app loads you should see the **Brain Runtime** card turn green and the
bridge card report connected. If the bridge is amber ("Bridge not running"), the
UI still works in copy-paste mode - start the script above and reload.

## Then try (type or speak)

- `run release guard`
- `check connectors`
- `run validator`
- `validate Bala`
- `git status`
- `build next Bala sprint`

Each one routes through the live brain and then calls only allowlisted bridge
actions. The UI shows the real command label, stdout, stderr, and a suggested
next action right inside the app.

## Stop the bridge

Close the minimized Node window, or run:

```
Get-Process node | Stop-Process
```

## Notes

- The browser never runs shell commands. It only asks the bridge to run one of a
  fixed, safe set of actions. See `CHINTU_LOCAL_BRIDGE_README.md`.
- Nothing is sent off your machine. No secrets are printed. No pushes happen from
  the UI.
- To run the bundled Stage 24 guarded release flow:
  `powershell -ExecutionPolicy Bypass -File scripts\chintu-stage24-release.ps1`
