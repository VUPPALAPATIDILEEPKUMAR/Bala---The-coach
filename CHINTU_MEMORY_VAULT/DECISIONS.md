# Decisions

Durable Chintu OS and BALA decisions live here. Add new entries instead of
rewriting history when possible.

## 2026-06-18 - Stage 10 Chintu Agent Control Shell

- Chintu Agent is a local static operator shell over approved Chintu OS reports, not a daemon, backend, health-data processor, or external automation system.
- `scripts/chintu-agent-dashboard.ps1` HTML-escapes dynamic local report content and writes a self-contained dashboard with no remote assets or network calls.
- `scripts/chintu-claude-overnight-package.ps1` writes a reviewable local prompt; it never dispatches Claude or activates work automatically.
- BALA Safe Touchpoints permit factual status, validation, and future planning only. BALA app files and behavior remain outside Stage 10.
- Free/local power lanes are documented but not installed or activated.
- Chintu Agent voice/personality and speech input/output remain parked research. Voice cloning and real-person imitation are prohibited.
- External automation and cloud sync remain parked. Cloud sync can only become active through a separate explicit founder decision.

## 2026-06-18 - Stage 9A Alive Daily Operator Layer

- Chintu OS daily operator layer stays local-first, file-based, validation-first, and founder-approved before any external automation.
- Stage 9A remains scripts/docs only and does not touch BALA app files.
- External automation stays parked: Telegram, Discord, webhooks, memory-wiki, cloud sync, phone notifications, and voice calling remain inactive.
- Chintu Agent voice/personality work is a parked future direction only. It is not active in Stage 9A.
- BALA remains a local-first, non-medical health-awareness companion.
