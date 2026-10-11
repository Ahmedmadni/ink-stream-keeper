import { useEffect } from "react";
import { vaultSession } from "@/features/vault/session";
import { retireLegacyBiometric } from "@/lib/vault-biometric";

export function VaultSecurity() {
  useEffect(() => {
    let idle: ReturnType<typeof setTimeout> | undefined;
    const resetIdle = () => {
      clearTimeout(idle);
      if (!vaultSession.isLocked()) idle = setTimeout(vaultSession.lock, 5 * 60_000);
    };
    const visibility = () => {
      if (document.hidden) vaultSession.lock();
    };
    const unsubscribe = vaultSession.subscribe(resetIdle);
    window.addEventListener("pointerdown", resetIdle, { passive: true });
    window.addEventListener("keydown", resetIdle);
    window.addEventListener("pagehide", vaultSession.lock);
    document.addEventListener("visibilitychange", visibility);
    // Remove only the obsolete device unlock shortcut, never vault entries.
    void retireLegacyBiometric();
    resetIdle();
    return () => {
      clearTimeout(idle);
      unsubscribe();
      vaultSession.lock();
      window.removeEventListener("pointerdown", resetIdle);
      window.removeEventListener("keydown", resetIdle);
      window.removeEventListener("pagehide", vaultSession.lock);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  return null;
}
