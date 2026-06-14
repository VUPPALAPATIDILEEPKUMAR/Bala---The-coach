# BALA

A responsive personal health guide that translates Apple Health and Fitbit-style wearable metrics into one understandable daily score, trend view, and coaching action.

## Run it

```powershell
python server.py
```

Open `http://127.0.0.1:4173`.

## Deploy free

### GitHub Pages

1. Create a GitHub repository and push this project to the `main` branch.
2. In repository Settings, choose Pages and set the source to GitHub Actions.
3. The included `.github/workflows/pages.yml` publishes the installable PWA.

GitHub Pages hosts the private on-device coach with no account, API key, or AI provider.

### Cloudflare Pages with optional AI

1. Connect the GitHub repository to Cloudflare Pages.
2. Use the repository root as the output directory with no build command.
3. The included `wrangler.toml` binds Workers AI as `AI`.
4. Deploy. The `functions/api/coach.js` endpoint uses Cloudflare's daily free Workers AI allocation while available.

Cloud AI is explicit opt-in. Only a derived numeric summary and the user's question are sent.

### Embedded coach on GitHub Pages

BALA interprets supported health and activity questions locally using imported metrics and a built-in wellness knowledge base. This avoids third-party login screens, exposed API keys, unstable anonymous endpoints, and transmission of personal metric summaries.

## Free local mode

- Manual capture for sleep, resting heart rate, HRV, SpO2, steps, and exercise minutes
- Local Apple Health ZIP or `export.xml` import
- Explainable recommendations generated in the browser
- Voice questions and Indian-English spoken replies using browser speech features
- Browser-local persistence with a clear-data control
- Installable PWA shell with offline loading
- No paid model API or cloud health database required

## Cross-platform architecture

The web app is the shared BALA experience for iPhone, Android, tablet, and desktop. It can be installed from Safari or Chrome for free.

The browser cannot directly read Apple Health or Android Health Connect. Automatic wearable syncing requires:

- A native iPhone companion using HealthKit with fine-grained user permission
- A native Android companion using Health Connect with fine-grained user permission
- A secure handoff into the same BALA interface, preferably processed on-device

## Wearable source model

BALA connects to health ecosystems instead of individual watch models:

- Apple Watch and compatible iPhone apps through Apple Health / HealthKit
- Android wearables through Health Connect
- Galaxy Watch and Galaxy Ring through Samsung Health Data SDK
- Fitbit and Oura through user-authorized OAuth APIs
- Garmin through its approved Health API program

Every imported record should keep its original app/device provenance. BALA selects a preferred source per metric and time window, detects overlapping workouts and step records, and does not add duplicate copies together.

Publishing in the Apple App Store and Google Play is not free for the developer. Installing the PWA directly from the browser is free for users.

BALA provides wellness guidance, not medical advice.

See [`docs/PRODUCTION-PLAN.md`](docs/PRODUCTION-PLAN.md) for the native sync, secured optional AI, safety, and release path.
