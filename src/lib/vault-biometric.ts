/**
 * The legacy WebAuthn shortcut stored a usable AES key alongside the wrapped PIN.
 * Retired until a native, authentication-bound Keystore implementation is ready.
 * Existing server-side vault entries and PIN encryption remain unchanged.
 */
export async function retireLegacyBiometric(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase("mf-vault-bio");
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve(); // Retry on a subsequent page load.
  });
}
