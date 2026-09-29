import { Capacitor } from "@capacitor/core";

/** True when running inside the Capacitor native shell (Android/iOS). */
export function isNative(): boolean {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
}
