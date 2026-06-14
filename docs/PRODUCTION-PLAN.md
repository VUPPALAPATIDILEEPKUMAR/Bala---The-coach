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

## Release gates

- Clinical-safety review of escalation language
- Privacy policy and consent review
- Accessibility and Indian-language review by native speakers
- Real-device HealthKit and Health Connect tests
- App Store and Play policy checks
- Incident, deletion, and support process
