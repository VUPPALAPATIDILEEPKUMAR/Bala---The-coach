# BALA production path

## Free public beta

- GitHub Pages PWA with local Apple Health ZIP parsing
- Up to 90 days of local history and a rolling 14-day personal baseline
- Symptom context, safety escalation, and downloadable clinician summary
- Device speech recognition and speech synthesis where supported
- No account, subscription, or cloud health database

## Native data access

The browser cannot continuously read Apple Health or Health Connect.

- iOS companion: HealthKit, fine-grained read permission, anchored queries, and background delivery
- Android companion: Health Connect, declared data permissions, history/background permission only when needed
- Keep raw samples on-device; pass normalized summaries into the shared BALA interface

## Optional AI

Use a Cloudflare Worker as the only public endpoint and store a Gemini API key as a secret. Send only a consented, derived summary and question. Apply rate limits, abuse controls, short retention, and a deterministic local fallback. The current Gemini Developer API offers free-tier models, but quotas and data-use terms can change and must be reviewed before launch.

### Recommended conversational stack

1. Deploy the repository as Cloudflare Pages project `bala-health-guide`.
2. Add `GEMINI_API_KEY` as a Pages secret. Gemini 3.5 Flash is primary because its current developer free tier and multilingual coverage are the strongest default.
3. Optionally add `SARVAM_API_KEY` as an India-focused fallback for native, romanized, and code-mixed languages.
4. The GitHub Pages app calls `https://bala-health-guide.pages.dev/api/coach`.
5. Only the current question, eight recent chat messages, and derived numeric metrics are sent. The Apple Health file and raw history are never sent.

The GitHub workflow requires repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, plus repository variable `ENABLE_CLOUDFLARE_DEPLOY=true`. Add the Sarvam secret in Cloudflare:

```powershell
npx wrangler pages secret put GEMINI_API_KEY --project-name bala-health-guide
```

## Free iPhone daily bridge

Until the native HealthKit companion is signed and distributed, an Apple Shortcut can query selected daily Health samples and open BALA with a URL fragment:

```text
https://vuppalapatidileepkumar.github.io/Bala---The-coach/#sync=1&sleep=7.5&rhr=62&hrv=45&spo2=97&steps=8000&exercise=30
```

Shortcut variables replace the example values. URL fragments are processed by BALA locally and are not included in the HTTP request to GitHub Pages. A personal automation can run the Shortcut daily, subject to iOS automation rules.

## Release gates

- Clinical-safety review of escalation language
- Privacy policy and consent review
- Accessibility and Indian-language review by native speakers
- Real-device HealthKit and Health Connect tests
- App Store and Play policy checks
- Incident, deletion, and support process
