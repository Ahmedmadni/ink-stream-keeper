# Changing MemoFlow PINs

Settings → الأمان والرموز السرية contains separate, clearly labelled controls:

- **تغيير رمز الخزنة** on web, Android and Windows. The current PIN, a different
  new six-digit PIN and confirmation are required. Existing passwords and
  encrypted category/entry metadata remain readable. The current vault locks
  after a successful change; the user opens it with the new PIN.
- **تغيير رمز التطبيق** on Android, where the device-local application gate is
  supported. This changes the current phone's PIN independently of the vault.
  Wrong attempts share the native backoff; background locking invalidates
  pending native unlocks.

The vault PIN change wraps the existing AES-GCM data key using a new
PBKDF2-derived AES-GCM key, fresh salt/IV and account-bound additional data.
Legacy PIN-derived vaults are read and converted on the first change. Later
changes rewrap the same data key. Normal unlocked sessions receive only
non-extractable keys. PINs and clear data keys never enter Supabase requests,
query caches, storage or inter-tab messages. Changing the PIN protects the
current key envelope; it does not revoke data keys or old backups previously
obtained by a reader.

Only one `vault_settings` row is conditionally updated against all three
previous cryptographic fields. Existing RLS isolates the account, and the
single PostgreSQL update rejects stale concurrent changes. No migration is
required and entry/category rows are not rewritten. Lock/account generation
checks cancel work that becomes stale before the write. Account changes after
the request cannot repopulate another user's query cache or unlock a session.
Unlock reads the current settings from the server instead of trusting an old
cached verifier. Same-origin tabs receive only an account-scoped lock notice.

Create a fresh backup after changing a vault PIN. The existing restore guard
rejects merging an older, different vault settings record into the active
vault. Old encrypted backup files are not rewritten, and older app versions
do not understand the new wrapped-key format; update each installed app.

Validation includes legacy and repeated PIN changes, unchanged ciphertext,
wrong PINs, malformed/tampered/account-swapped envelopes, non-extractable
session keys, read/write/stale-update failures, locks and account switches,
real PostgreSQL RLS/CAS checks, browser PIN changes/reload/data preservation,
and the native Android settings bridge.
