# MemoFlow desktop

The Windows x64 package includes the same local SPA as Android. It does not load
an older published website. Unzip the entire Windows download and run
`MemoFlow.exe`; keep the other files beside it.

## Build

1. `bun install --frozen-lockfile`
2. `bun run build:native`
3. `bun run desktop:prepare`
4. Install `@electron/packager@19.1.1` and Electron `44.9.0` into a separate build
   tools directory. Set `MEMOFLOW_DESKTOP_TOOLS` to that directory, then run
   `node scripts/package-windows.mjs` for Windows x64 with ASAR and the brand icon.

The Windows workflow builds and launches the actual packaged executable. It
checks the local protocol, renderer isolation, external OAuth handoff, session
restoration, task filters and checklist previews using a test account fixture.
The download is a portable folder; it is not an installer.

## Authentication and local files

- `memoflow://app` serves only files inside the bundled `web/` directory.
- The sandboxed main preload exposes narrowly scoped authentication and floating-note operations.
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

## Floating notes — 1.2.9

Drag a note card outside the main window, or use its floating-card button. Each
note opens once in its own resizable window, stays visible when the main window
is minimized and starts pinned above normal application windows. Drag the header
to move it; use the pin button to toggle that behavior. The return button opens
the editor. The detached card displays plain text; editing remains in the main app.
Saved updates and theme changes propagate to open cards. Archiving or deleting a
note closes its card. Signing out, changing accounts or closing the main window
closes all cards. Settings also provides an explicit close-all button.

Cards have a separate sandboxed preload and a strict asset allowlist. They
receive only title, plain text, timestamp and display state, with no access
tokens, Supabase session or generic IPC API. Fonts ship with the application.
Up to eight cards can be open at once, clamped to the active display work area.

Developer information appears in settings on all platforms and in the Windows
executable metadata. Metadata is not an Authenticode signature. No in-app
installation recommendation popup is enabled on desktop. Windows SmartScreen
reputation warnings require trusted publisher signing/reputation or Store
distribution; the app cannot remove the operating system warning itself.
