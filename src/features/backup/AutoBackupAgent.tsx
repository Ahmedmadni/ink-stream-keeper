import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { runAutomaticBackup } from "./automatic";

/** Runs at most one due backup when the unlocked Android app opens or returns online. */
export function AutoBackupAgent() {
  const { user } = useAuth();
  const running = useRef(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const run = async () => {
      if (!active || running.current || document.hidden || !navigator.onLine) return;
      running.current = true;
      try {
        await runAutomaticBackup(user.id);
      } catch (error) {
        // Automatic work stays quiet; the settings screen exposes status and a manual retry.
        console.warn("[MemoFlow backup] Automatic backup skipped", error);
      } finally {
        running.current = false;
      }
    };
    const resume = () => {
      if (!document.hidden) void run();
    };
    void run();
    window.addEventListener("online", run);
    document.addEventListener("visibilitychange", resume);
    return () => {
      active = false;
      window.removeEventListener("online", run);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [user]);

  return null;
}
