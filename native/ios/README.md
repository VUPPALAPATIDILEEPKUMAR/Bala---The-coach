# BALA iPhone and Apple Watch bridge

Apple Watch writes its health and workout samples into Apple Health. BALA normally needs an iPhone HealthKit companion to read those samples; a watchOS app is only needed for BALA-specific live workout capture or watch UI.

## Required Apple setup

1. Open this folder on macOS with Xcode 26 or later.
2. Create an iOS app target named `BALA`.
3. Add `BALAHealthStore.swift` and call `requestAuthorization()` from an explicit user action.
4. Enable the HealthKit capability.
5. Add the usage strings from `Info.plist.fragment.xml`.
6. Add only the data types required by enabled BALA features.
7. Test on a physical iPhone paired with Apple Watch. HealthKit background delivery does not work in Simulator.
8. Join the Apple Developer Program to sign for distribution through TestFlight or the App Store.

There is no legitimate one-click public Apple Watch download until the app is signed and distributed by Apple. Free browser installation does not grant HealthKit access.

## Data handoff

Keep raw HealthKit records on-device. Send a normalized daily summary to the shared BALA web interface through a local app container or tightly scoped native-to-web bridge. Preserve source revision and device metadata for deduplication.
