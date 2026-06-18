# Open Questions

Decisions that need explicit founder input before implementation. No assistant
should resolve these alone.

| # | Question | Context | Default behavior until answered |
|---|---|---|---|
| 1 | Where exactly will the Windows-to-iMac bridge folder live on Windows? | `chintu-windows-reporter.ps1` defaults to `C:\Users\Chintu\Desktop\CHINTU_BRIDGE_OUTBOX`. iMac inbox is `~/Documents/CHINTU_CONTROL_ROOM/BRIDGE/FROM_WINDOWS/`. Founder may prefer a different Windows path (e.g. a cloud-sync folder, USB mount path). | Use `C:\Users\Chintu\Desktop\CHINTU_BRIDGE_OUTBOX` until told otherwise; allow `-OutDir` override. |
| 2 | How will files physically sync to the iMac? | Bridge contract says transport is founder's choice (USB drive, cloud sync folder, network share, or manual copy). No automated network transfer by Chintu. | Manual copy. No assistant initiates transport. |
| 3 | Whether memory-wiki plugin should be enabled later? | Plugin is available in OpenClaw but disabled. memory-vault is plain Markdown today. Enabling memory-wiki would change the storage substrate. | Stay parked. Design doc allowed; implementation blocked. |
| 4 | Whether Telegram or Discord is preferred later (for non-health status notifications only)? | Both parked. The phone is the eventual notification surface. Either Telegram or Discord could carry non-health status updates first. | Stay parked. Design doc allowed; implementation blocked. |
| 5 | Exact memory-wiki enable process | If memory-wiki is later approved, what is the safe enable sequence (snapshot vault, dry-run, rollback path)? | No enable. Design doc only when asked. |
| 6 | Phone notification timing | When should the phone receive summaries? After each push? Daily? On demand? | No phone implementation. |
| 7 | Tester feedback storage format | Local Markdown folder, a form, or a specific intake structure? | Default to a local `tester-feedback/YYYY-MM-DD/` Markdown folder when the sprint runs. |
| 8 | Future privacy policy for sharing / export | If BALA ever adds voluntary sharing, what privacy policy framework applies? | No sharing implementation. |

## How to mark an answer

When the founder answers a question, append a `## Decision N` block at the
bottom of this file with the date, the decision, and the brain that should act
on it next. Example:

```text
## Decision 1 — 2026-06-20
- Windows bridge outbox: keep default `C:\Users\Chintu\Desktop\CHINTU_BRIDGE_OUTBOX`.
- Sync mechanism: manual copy to USB.
- Next brain to act: Claude (no action needed; defaults already match).
```

Decisions are append-only. Never overwrite a prior decision; supersede it with a
new dated block.
