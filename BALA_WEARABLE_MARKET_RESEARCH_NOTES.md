# BALA Wearable Market Research Notes

**Status:** planning — research reference, not yet implemented
**Stage:** 20 — roadmap doc only. No BALA app code changes in this file.
**Date:** 2026-06-18

---

## Purpose

Market awareness to guide future BALA wearable connector decisions.
BALA does not claim automatic live sync with any wearable today.
All current wearable data flows through manual file import only.

---

## Current BALA Wearable Support

| Platform | Status | Method |
|---|---|---|
| Apple Health / Apple Watch | Supported | Manual ZIP/XML export import |
| Android Health Connect | Supported | Manual CSV/JSON file import |
| Fitbit | Supported | Manual CSV/JSON file import |
| Garmin | Supported | Manual CSV/JSON file import |
| Samsung Health | Supported | Manual CSV/JSON file import |
| Oura Ring | Supported | Manual CSV/JSON file import |
| WHOOP | Supported | Manual CSV/JSON file import |
| Manual entry | Always supported | BALA capture form |

Live sync with any platform: **not implemented yet.**

---

## Wearable Market Landscape

### Consumer Health Wearables

| Product | Key signals | Notes |
|---|---|---|
| Apple Watch | HRV, RHR, SpO2, sleep stages, ECG, activity | Largest ecosystem in India + globally |
| Fitbit (Google) | HRV, RHR, SpO2, sleep, stress, skin temp | Wide user base, strong CSV export |
| Garmin | HRV, RHR, SpO2, sleep, stress, body battery | Strong in fitness community |
| WHOOP 4.0 | HRV, RHR, sleep stages, strain, recovery | No display, subscription model |
| Oura Ring | HRV, RHR, SpO2, sleep stages, readiness | Ring form factor, popular with biohackers |
| Samsung Galaxy Watch | HRV, RHR, SpO2, sleep, BIA, ECG | Strong Android integration |
| Polar H10 / Vantage | HRV, RHR, SpO2, sleep, training load | Popular with serious athletes |
| Amazfit / Zepp | HRV, RHR, SpO2, sleep | Budget-friendly, large India market |
| boAt, Noise | Steps, HR (basic) | Very large India market, budget segment |

### India-Specific Market Notes

- **boAt and Noise** dominate budget wearable sales in India. Basic HR only — HRV/SpO2 limited.
- **Samsung** has strong Android presence in India.
- **Apple Watch** growing in urban India but premium segment.
- **Fitbit** declining in India since Google acquisition but data export still works.
- **Amazfit / Zepp** growing in mid-range India market.

---

## BALA Live Sync Path (Future, No Timeline)

Live sync requires platform APIs. These are not free or simple:

| Platform | API availability | Notes |
|---|---|---|
| Apple HealthKit | iOS/iPadOS only | Requires native app, not available in PWA |
| Health Connect (Android) | Android only | Requires native app or Android companion |
| Fitbit Web API | OAuth, free tier limited | Rate limits, requires server |
| Garmin Health API | Developer program required | Approval needed |
| WHOOP API | Developer waitlist | Not broadly available |
| Oura API | v2 available | OAuth, requires backend |
| Samsung Health SDK | Android SDK | Native app required |

BALA as a PWA cannot access platform health APIs directly. Any future live sync
would require a companion native app or a user-approved local bridge.

---

## BALA Wearable Strategy (Recommended)

1. **Keep manual import as the primary path.** It works now, zero cost, zero server.
2. **Improve import UX.** Better field mapping, more wearable-specific guides.
3. **Watch Health Connect.** Google's Android health platform is maturing and may
   allow web-based read access in future.
4. **Plan a native companion app** only when the founder is ready to maintain it.
5. **Never claim live sync unless it is actually built and tested.**

---

## Safe Language for Wearable Mentions in BALA

- "Import your exported data" — not "BALA connects to your watch."
- "BALA supports file imports from Apple Health, Fitbit, and others" — accurate.
- "Live sync is not available yet" — always include this caveat.
- "Your wearable data is processed on this device" — always true for imports.

---

## What Remains Parked

Live sync, native app, Health Connect integration, HealthKit bridge. All future.

---

*BALA is a health-awareness companion. It does not diagnose, treat, predict, prevent, replace doctors, or provide emergency monitoring.*
