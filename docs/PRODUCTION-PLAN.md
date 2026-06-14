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
2. Add `SARVAM_API_KEY` as a Pages secret. Sarvam-30B is the primary model because it supports native, romanized, and code-mixed Indian languages.
3. Optionally add `GEMINI_API_KEY` as fallback.
4. The GitHub Pages app calls `https://bala-health-guide.pages.dev/api/coach`.
5. Only the current question, eight recent chat messages, and derived numeric metrics are sent. The Apple Health file and raw history are never sent.

The GitHub workflow requires repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, plus repository variable `ENABLE_CLOUDFLARE_DEPLOY=true`. Add the Sarvam secret in Cloudflare:

```powershell
npx wrangler pages secret put SARVAM_API_KEY --project-name bala-health-guide
```

## Release gates

- Clinical-safety review of escalation language
- Privacy policy and consent review
- Accessibility and Indian-language review by native speakers
- Real-device HealthKit and Health Connect tests
- App Store and Play policy checks
- Incident, deletion, and support process
