# BALA architecture

## Available now

- Installable PWA for iPhone, Android, tablets, and desktop
- Offline application shell
- Manual metric capture
- Local Apple Health XML import
- Local explainable wellness rules
- Optional Cloudflare Workers AI endpoint with explicit consent

## Native bridges required for automatic sync

- iOS: HealthKit companion built and signed with Xcode on macOS
- Android: Health Connect companion
- Samsung: Samsung Health Data SDK integration
- Fitbit and Oura: registered OAuth applications
- Garmin: approved Garmin Health API access

## Source normalization

Each normalized sample should include:

- metric type and normalized unit
- start and end timestamps
- value
- provider
- source application
- source device and product type when available
- provider record identifier
- sync timestamp

Deduplication should prefer original sensor records, exact provider identifiers, and overlapping workout detection. Never sum mirrored records from multiple hubs.

## AI boundary

Raw health files, record histories, metric summaries, and coach questions stay local. The embedded coach uses deterministic wellness rules and a built-in knowledge base.
