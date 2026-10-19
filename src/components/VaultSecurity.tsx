import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { purgeSensitiveVaultQueries } from "@/features/vault/cache";
import { vaultSession } from "@/features/vault/session";
import { retireLegacyBiometric } from "@/lib/vault-biometric";
import { VAULT_PIN_CHANNEL } from "@/features/vault/pin-events";

export function VaultSecurity() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let idle: ReturnType<typeof setTimeout> | undefined;
    const purgeUnlockedVaultData = () => {
      if (!vaultSession.isLocked()) return;
      purgeSensitiveVaultQueries(queryClient);
    };
    const resetIdle = () => {
      clearTimeout(idle);
      if (!vaultSession.isLocked()) idle = setTimeout(vaultSession.lock, 5 * 60_000);
    };
    const visibility = () => {
      if (document.hidden) vaultSession.lock();
    };
    const unsubscribe = vaultSession.subscribe(() => {
      purgeUnlockedVaultData();
      resetIdle();
    });
    let channel: BroadcastChannel | undefined;
    if (typeof BroadcastChannel !== "undefined") {
      try {
        channel = new BroadcastChannel(VAULT_PIN_CHANNEL);
        channel.onmessage = (event) => {
          if (
            event.data?.type === "pin-changed" &&
            typeof event.data.userId === "string" &&
            vaultSession.lockForUser(event.data.userId)
          )
            void queryClient.invalidateQueries({ queryKey: ["vault", "settings"] });
        };
      } catch {
        /* The current tab still locks independently. */
      }
    }
    window.addEventListener("pointerdown", resetIdle, { passive: true });
    window.addEventListener("keydown", resetIdle);
    window.addEventListener("pagehide", vaultSession.lock);
    document.addEventListener("visibilitychange", visibility);
    // Remove only the obsolete device unlock shortcut, never vault entries.
    void retireLegacyBiometric();
    resetIdle();
    return () => {
      clearTimeout(idle);
      vaultSession.lock();
      unsubscribe();
      channel?.close();
      window.removeEventListener("pointerdown", resetIdle);
      window.removeEventListener("keydown", resetIdle);
      window.removeEventListener("pagehide", vaultSession.lock);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [queryClient]);
  return null;
}
