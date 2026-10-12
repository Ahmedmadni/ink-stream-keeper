# MemoFlow Android

MemoFlow is packaged as a Capacitor 8 Android application. The shell currently
uses hosted mode so authentication, Supabase data, and server features continue
to use the published Lovable application.

## Requirements

- Node.js 22+
- Bun 1.3.9
- Android Studio 2025.2.1+
- Android SDK 36
- JDK 21 (the Android Studio bundled JDK is recommended)

## Build a test APK

```bash
bun install --frozen-lockfile
bun run android:debug
```

The installable test package is written to:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

GitHub Actions also builds the same APK and publishes it as the
`MemoFlow-Android-Debug` workflow artifact after all web tests pass.

## Prepare a Play Store release

1. Replace the hosted preview URL in `capacitor.config.ts` with the stable
   production Lovable URL, then run `bun run android:sync`.
2. Create and protect a release keystore outside Git. Never commit the keystore
   or its passwords.
3. Configure Android Studio's signed bundle flow and build an Android App Bundle
   (`.aab`).
4. Test login, notes, task checklist rollups, vault lock/unlock, encrypted backup
   export/import, and Google Drive sharing on a physical Android device.
5. Apply the deferred Supabase migrations before relying on task checklist
   rollups or encrypted account backups in production.

The generated package uses API 24 as its minimum and API 36 as its target. OS
backup is disabled because the app handles sensitive vault data. Cleartext
traffic and mixed content are disabled.
