# MemoFlow desktop

The Windows x64 package includes the same local SPA as Android. It does not load
an older published website. Unzip the entire Windows download and run
`MemoFlow.exe`; keep the other files beside it.

## Build

1. `bun install --frozen-lockfile`
2. `bun run build:native`
3. `bun run desktop:prepare`
4. Package `electron/` with `@electron/packager@19.1.1`, Electron `44.9.0`,
   Windows x64, ASAR enabled and `electron/app.ico`.

The Windows workflow builds and launches the actual packaged executable. It
checks the local protocol, renderer isolation, external OAuth handoff, session
restoration, task filters and checklist previews using a test account fixture.
The download is a portable folder; it is not an installer.

## Authentication and local files

- `memoflow://app` serves only files inside the bundled `web/` directory.
- The sandboxed preload exposes only the desktop authentication bridge.
- Google and Apple open in the default browser, using the existing allowed
  `lovable://oauth-callback` route. The installed executable registers the callback
  and recovery schemes. The renderer validates the saved random state before
  accepting OAuth tokens, using the same validator as Android.
- Single-instance forwarding delivers callbacks to the existing window.
- Hosted server endpoints use an explicit HTTPS URL; Supabase calls retain the
  current account and row-level access rules.
- Downloaded backups use the system save dialog. Native Android permission
  controls remain Android-only, and installation prompts are hidden on desktop.

The executable has no Windows publisher certificate configured. The Android
distribution key is separate and is never used as a Windows code-signing key.
