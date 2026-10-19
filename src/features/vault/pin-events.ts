export const VAULT_PIN_CHANNEL = "memoflow-vault-pin-v1";

export function announceVaultPinChange(userId: string): void {
  if (typeof BroadcastChannel === "undefined") return;
  try {
    const channel = new BroadcastChannel(VAULT_PIN_CHANNEL);
    channel.postMessage({ type: "pin-changed", userId });
    channel.close();
  } catch {
    /* Local session is already locked; a missing channel does not undo a saved PIN. */
  }
}
