# Chintu Allegro — Install Guide

**Stage:** 22
**Status:** active — reference for installing Chintu Allegro as a local app

---

## What Is Chintu Allegro?

Chintu Allegro (CHINTU_ALLEGRO.html) is a local-first operator shell for BALA and Chintu OS.
It runs entirely in your browser from a local file — no server, no sign-in, no cloud.

You can "install" it as a PWA-like experience using browser features.

---

## Option 1 — Chrome / Edge (Desktop) — Recommended

1. Open `CHINTU_ALLEGRO.html` in Chrome or Edge from your local folder.
2. Look for the **install icon (⊕)** in the address bar (right side).
3. Click it → click **Install**.
4. Chintu Allegro opens as a standalone window — no browser chrome.
5. Access it from your taskbar or desktop shortcut.

**If no install icon appears:**
- Go to Chrome menu (⋮) → **Cast, save, and share** → **Install page as app**.
- Or Edge menu (⋯) → **Apps** → **Install this site as an app**.

---

## Option 2 — iPhone / iPad (Safari)

1. Open `CHINTU_ALLEGRO.html` in Safari (you may need to serve it via a local server or use a file-sharing app).
2. Tap the **Share button (□↑)** at the bottom of the screen.
3. Scroll down in the share sheet → tap **Add to Home Screen**.
4. Give it a name → tap **Add**.
5. Opens as a full-screen app from your home screen.

**Note:** Safari on iOS requires an http:// or https:// URL for some PWA features. If opening a local file, some install features may be limited.

---

## Option 3 — Android (Chrome)

1. Open `CHINTU_ALLEGRO.html` in Chrome on Android.
2. Tap the **three-dot menu (⋮)** → tap **Add to Home screen** or **Install app**.
3. Confirm → appears as a standalone icon on your home screen.

---

## Option 4 — Serve Locally (All Platforms)

If you want full PWA install support from any browser:

```powershell
# From your project folder — using Python (usually pre-installed)
python -m http.server 8080

# Then open in browser:
# http://localhost:8080/CHINTU_ALLEGRO.html
```

Or using Node:
```powershell
npx serve . -p 8080
# Then open: http://localhost:8080/CHINTU_ALLEGRO.html
```

From `http://localhost:8080`, Chrome and Edge will offer the install icon.

---

## Voice Input Notes

| Browser | Voice Support |
|---|---|
| Chrome (desktop) | ✅ Full support (Web Speech API) |
| Edge (desktop) | ✅ Full support |
| Firefox (desktop) | ❌ Not supported |
| Safari (macOS) | ✅ Partial (may require user permission) |
| Chrome (Android) | ✅ Supported |
| Safari (iOS) | ⚠️ Limited — may require interaction first |

Chintu Allegro gracefully degrades: if voice is not available, the text input still works fully.

---

## Shell Command Execution — Important

Chintu Allegro shows copy-paste shell commands in the **Command Center** tab.

**The browser never executes these commands.** You must:
1. Copy the command from Chintu Allegro
2. Open your local PowerShell or terminal
3. Paste and run

This is intentional — browser-executed shell commands would be a security risk.

---

## PWA / manifest.webmanifest Note

The existing `manifest.webmanifest` is for **BALA Your Coach** (the health app).
Chintu Allegro is a separate local operator shell — it does not use the BALA manifest.

To avoid breaking the BALA PWA:
- Do NOT add Chintu Allegro to the BALA manifest.
- Chintu Allegro's install experience is through browser's "Install page as app" feature only.
- If a full standalone Chintu manifest is needed, create `chintu-manifest.webmanifest` separately in Stage 23+.

---

## CHINTU_VOICE_OPERATOR.html

The previous Stage 21 file `CHINTU_VOICE_OPERATOR.html` remains available as a reference.
Chintu Allegro (Stage 22) supersedes it as the primary operator interface.

A redirect note has been added to CHINTU_VOICE_OPERATOR.html pointing to CHINTU_ALLEGRO.html.

---

## Quick Start Checklist

- [ ] Open `CHINTU_ALLEGRO.html` in Chrome or Edge
- [ ] Allow microphone access if prompted (for voice input)
- [ ] Try the "Install as app" button in the top bar
- [ ] Try a quick action: "Build next BALA sprint"
- [ ] Review the response in the Operator tab
- [ ] Check the Action Packet tab for the generated packet
- [ ] Copy a command from the Command Center tab
- [ ] Run the copied command in your local terminal
