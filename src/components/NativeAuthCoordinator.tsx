import { useEffect } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import {
  completeNativeOAuth,
  completeNativeRecovery,
  isNativeOAuthAvailable,
  listenForNativeAuthCallback,
  rememberNativeAuthError,
} from "@/services/native-auth";

/**
 * Own the Android auth callback above AppLockGate. Opening the browser can lock
 * the app and unmount the auth page, but this coordinator remains mounted and
 * always consumes the callback before routing the user.
 */
export function NativeAuthCoordinator() {
  const navigate = useNavigate();
  const router = useRouter();

  useEffect(() => {
    if (!isNativeOAuthAvailable()) return;
    let active = true;
    let removeListener: (() => Promise<void>) | undefined;

    const receive = async (rawUrl: string) => {
      if (!active) return;
      try {
        const url = new URL(rawUrl);
        if (url.pathname === "/recovery") {
          await completeNativeRecovery(rawUrl);
          window.location.replace("/auth?recovery=1");
          return;
        }

        await completeNativeOAuth(rawUrl);
        await router.invalidate();
        await navigate({ to: "/" });
      } catch (reason) {
        rememberNativeAuthError(reason);
        await navigate({ to: "/auth" });
      }
    };

    void listenForNativeAuthCallback((url) => void receive(url))
      .then((remove) => {
        if (active) removeListener = remove;
        else void remove();
      })
      .catch(async (reason) => {
        if (!active) return;
        rememberNativeAuthError(reason);
        await navigate({ to: "/auth" });
      });

    return () => {
      active = false;
      void removeListener?.();
    };
  }, [navigate, router]);

  return null;
}
