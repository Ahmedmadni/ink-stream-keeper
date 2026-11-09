# Native application updates

- [x] Polish the home page, cards, branding, connection indicators and shared page metadata without duplicated sections.
- [x] Verify authenticated navigation and layouts at desktop, 547px and 393px widths; all 126 regression tests passed.
- [x] Complete the deep security review and sanitize unsafe note previews.
- [x] Add a standalone current-source release workflow for Android, Windows and both Mac architectures.
- [x] Sync the current local UI into the Android and Electron bundles so neither relies on the published website.
- [x] Deliver current-source downloads: Android test APK, Windows x64 ZIP and macOS Apple Silicon / Intel ZIPs. Android lint, unit tests and APK v2 signature verification passed; archive integrity and the full packaged desktop smoke flow passed on Linux.
- [ ] Device acceptance and trusted public distribution — requires physical Android/Windows/macOS devices and production signing/notarization credentials; the delivered Android APK uses a debug certificate and desktop archives are unsigned.
