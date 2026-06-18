# Chintu Phone Layer Research (parked indefinitely)

**Status:** PARKED INDEFINITELY. Notes only.

A phone layer — SMS, phone notifications, call placement, or
phone-number-based identity — is one of the explicitly excluded
surfaces in Chintu OS. This file exists so that the reasons are
written down somewhere the next session can find.

---

## 1. What "phone layer" means

Any feature that:

- Sends an SMS or text message.
- Places, receives, or schedules a phone call.
- Sends a push notification to a mobile device by way of a phone-number
  channel (Twilio, etc.).
- Collects a phone number as a contact handle.
- Integrates with a phone OS notification API to surface BALA reminders
  on a phone.

---

## 2. Why parked indefinitely

- **Network egress required.** Every phone surface route is by
  definition a network egress. That violates the
  `chintu-no-network-egress.test.js` invariant.
- **Vendor lock-in.** Telephony providers (Twilio, Plivo, etc.) bring
  pricing, content policy, and account-recovery surfaces that the
  founder does not currently want to own.
- **Personal-data magnetism.** A phone number is a strong identifier.
  BALA does not collect identifiers today.
- **Emergency-monitoring framing risk.** If BALA can call or text, it
  starts to look like a monitoring service. That breaks the
  non-medical companion framing.
- **Operator overhead.** Carrier compliance (10DLC in the US, similar
  schemes elsewhere) is not a builder-mode task.

---

## 3. What stays available without a phone layer

- Local PWA notifications via the Web Notifications API. Still on
  device, still no network. (Currently not activated; would require a
  founder-approved BALA commit.)
- Browser push via VAPID + a self-hosted server. Not in scope.
- Manual reminders the founder sets in their OS calendar.

---

## 4. Trigger to revisit

Only the founder can lift this park. There is no algorithmic trigger.
If lifted, a fresh spec would be required, satisfying every Chintu OS
safety invariant before any code lands.

---

## 5. BALA safety footer

BALA is a health-awareness companion. It does not diagnose, treat,
predict, prevent, replace doctors, or provide emergency monitoring.
