# BALA Security, Privacy, and Code of Conduct Rules

Use this checklist before any BALA implementation.

## Security and privacy

- Do not expose API keys, tokens, secrets, webhook URLs, or private user data in code.
- Do not add hardcoded credentials.
- Do not auto-send health data anywhere.
- Keep health data local by default.
- Any export, import, webhook, or sharing action must be user-triggered.
- Any external sharing must show a clear confirmation warning first.
- Validate imported JSON/CSV before saving it.
- Reject invalid, suspicious, or extremely large files with a friendly error.
- Sanitize user-entered text before rendering it in the UI.
- Do not use innerHTML with unsanitized user input.
- Avoid unnecessary third-party scripts or dependencies.
- Do not add tracking, analytics, ads, cookies, or fingerprinting.
- Do not add backend calls unless explicitly requested.
- Do not add paid APIs.

## Health safety

Do not add claims that BALA can:
- diagnose disease
- detect disease
- predict illness
- prevent medical events
- treat conditions
- replace doctors
- monitor emergencies
- identify early warning signs of disease

Use safe language:
- personal awareness
- daily signals
- patterns
- baseline
- check-in
- recent trend
- recovery
- balance
- listen to your body
- talk to a healthcare professional if concerned

## Code of conduct for UX

- Use calm, respectful, non-scary language.
- Do not shame users for low sleep, low activity, high stress, symptoms, or recovery changes.
- Do not create fear-based health messaging.
- Keep privacy choices clear and easy.
- Make data clearing/exporting understandable for normal users.
- Never present BALA as a doctor, diagnosis tool, or emergency service.

## Code quality

- Keep functions small and readable.
- Reuse existing app state/localStorage helpers where possible.
- Avoid duplicate logic.
- Preserve existing working features.
- Keep mobile-first layout.
- Run JavaScript syntax checks.
- Run git diff --check.
- Summarize changed files, security notes, testing steps, and limitations.
