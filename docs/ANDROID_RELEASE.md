# MemoFlow Android

MemoFlow is packaged as a Capacitor 8 Android application. Production builds
ship a client-only TanStack Start bundle inside the APK. `server.url` must stay
unset so an installed version cannot silently render an older published UI.
Supabase remains remote, while server-only features use explicit HTTPS backend
URLs through Capacitor's native HTTP transport.

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
`MemoFlow-Android-Debug` workflow artifact, together with its SHA-256 file,
after all web, browser, Android lint, and native unit tests pass.

## Android Autofill

MemoFlow declares a native `AutofillService` on Android 8 (API 26) and newer.
After installing the app:

1. Open and unlock the vault.
2. Select **تفعيل الآن** in the Android Autofill card.
3. Confirm MemoFlow as the device autofill provider.
4. Return to the vault so its entries are mirrored into device-only encrypted storage.

The local mirror uses AES-256-GCM with a non-exportable Android Keystore key. Autofill requires
the device screen lock before releasing a password. Android's system UI asks for confirmation
before a newly entered login is saved. Newly saved logins stay encrypted on the device until the
user opens the unlocked MemoFlow vault and imports them.

The native mirror is excluded from Android backup (`allowBackup=false`) and does not replace
MemoFlow's encrypted export file.

## App lock and password recovery

- Google and Apple sign-in return through the OAuth broker's supported Android callback
  `lovable://oauth-callback`. MemoFlow validates the original random `state` before accepting the
  returned tokens. The callback coordinator stays mounted above the app-lock screen so opening the
  browser cannot detach it.
- After the first successful sign-in, Android requires a six-digit MemoFlow PIN before rendering
  account content. The PIN verifier is salted and stretched locally; the raw PIN is never stored.
- Leaving the app locks the session, and `FLAG_SECURE` prevents screenshots and recent-app
  previews. The PIN can be changed from Settings.
- If the PIN is forgotten, the recovery action signs out locally and removes device-only lock,
  web storage (including unsynced local drafts), and automatic-backup secrets. It does not delete
  server data or existing `.memoflow` files.
- Email password recovery uses the hosted auth landing page only to hand the recovery session back
  to the exact `/auth/recovery` Android deep link. The new password is then chosen inside MemoFlow.

## Automatic encrypted backups

After applying `20261011060000_memoflow_backups.sql`, Settings can store a dedicated backup
password encrypted by Android Keystore. MemoFlow then creates a backup when the unlocked app opens
or resumes and the last successful copy is at least 24 hours old.

- A rolling set of seven files is written to `Documents/MemoFlow` through MediaStore.
- The user can grant a persistent Storage Access Framework folder permission. Selecting a Google
  Drive folder makes the same rolling files sync through the installed Drive document provider.
- A manual **إنشاء نسخة الآن** action is available. Restore continues to use Android's file picker,
  which can read from the phone or Drive.
- This is a foreground/resume schedule, not a claim that a killed WebView can export in the
  background. The app never stores the backup password as plaintext preferences.

## Floating reminder card

Settings can show a draggable reminder card above other Android apps. The first action opens the
system's per-app overlay permission screen and resumes the same request when the user returns; a
second tap is not required. Drag the card by its title, tap the title to reopen MemoFlow, or use the
close action to stop the overlay. This is an optional visibility feature and does not replace task
notifications.

Version 1.2.7 keeps the overlay permission request and its pending card inside the native plugin,
so the action continues after returning from system Settings even if the app lock remounts the UI.
It also rechecks notification permissions and reschedules task reminders on resume, opens MemoFlow's
notification settings when permission was previously denied, and provides an explicit test-notification
button. Exact alarm access is requested only by the user; without it reminders use inexact scheduling.
Both permission adapters now use synchronous getters for Capacitor proxies. Returning a proxy from
an async function made Promise resolution call its synthetic `then` method and left permission
requests hanging before any Android API was reached.

## Simple settings and manual backups (1.2.7)

- The Android navigation has four tabs: notes, tasks, vault and settings. Legacy sections and the
  browser-install action are hidden from the Android settings screen.
- The UI uses a 16px baseline on phones, readable 15px body labels, 24px navigation icons and
  44–48px primary touch controls; narrow layouts wrap instead of scaling the entire interface down.
- **نسخ احتياطي** first asks for **حفظ على الهاتف** or **Google Drive**. Both export the same encrypted
  backup. Phone saving uses Android's document-save picker; Drive uses the system share sheet, where
  the user selects Drive and finishes saving. No automatic Drive upload is implied by sharing.
- Restore has its own dialog with the existing password, account, preview and merge safeguards.
  Daily local backups remain optional in a collapsed setting.
- Task dates show a written Arabic month and day–month–year order while retaining the system picker.
  Incomplete checklist items appear before completed items; each group is ordered high, medium, low,
  with original position retained for ties. Priority changes use the existing sub_items column.

## Prepare a Play Store release

1. Run `bun run android:sync`. This cleans stale assets, builds the native SPA,
   promotes `_shell.html` to `index.html`, and copies that exact bundle into the
   Android project. Do not add a production `server.url`.
2. Create and protect one permanent upload/release keystore outside Git. Never
   commit the keystore or its passwords, and never regenerate it for later
   updates:

   ```bash
   keytool -genkeypair -v -keystore memoflow-release.jks -alias memoflow \
     -keyalg RSA -keysize 4096 -validity 10000
   ```

3. For a local signed build, expose the four values only to the current shell,
   then run `bun run android:bundle`:

   ```bash
   export MEMOFLOW_KEYSTORE_PATH=/absolute/private/path/memoflow-release.jks
   export MEMOFLOW_KEYSTORE_PASSWORD='...'
   export MEMOFLOW_KEY_ALIAS='memoflow'
   export MEMOFLOW_KEY_PASSWORD='...'
   bun run android:bundle
   ```

   Gradle now refuses every Release task when any signing value is missing;
   it can no longer produce an accidentally unsigned "final" package.

4. Alternatively, configure the protected GitHub environment
   `android-release` with these secrets:
   - `MEMOFLOW_RELEASE_KEYSTORE_BASE64`
   - `MEMOFLOW_KEYSTORE_PASSWORD`
   - `MEMOFLOW_KEY_ALIAS`
   - `MEMOFLOW_KEY_PASSWORD`

   Then run **Build signed MemoFlow release** manually. It runs TypeScript,
   database/unit tests, native-bundle verification, Android lint and unit tests,
   creates signed APK and AAB files, verifies their signatures, and publishes
   both files with SHA-256 checksums for 30 days.

5. Enroll the AAB in Google Play App Signing and retain the upload key in at
   least two secure offline locations.
6. Test OAuth and password-recovery callbacks, app-PIN cold start and resume,
   notes, task checklist rollups, responsive layout on a small screen, vault
   lock/unlock, encrypted backup export/import, and the selected Drive folder
   on a physical Android device.
7. Apply every Supabase migration through
   `20261017070000_task_parent_completion_guard.sql` before relying on task
   checklist rollups or encrypted account backups in production.

The generated package uses API 24 as its minimum and API 36 as its target. OS
backup is disabled because the app handles sensitive vault data. Cleartext
traffic and mixed content are disabled. Version `1.2.5` also purges cached vault
entry/category queries whenever the vault locks, so unlocked labels and account
metadata are not retained in React Query's 24-hour cache. Version `1.2.6` fixes the Android OAuth
redirect and email-confirmation behavior.
