/**
 * Haptics service — Web Vibration API today, Capacitor Haptics ready.
 * All methods no-op silently if the platform doesn't support them.
 */
export type HapticStyle = "light" | "medium" | "heavy" | "success" | "warning" | "error" | "selection";

export interface HapticsService {
  impact(style?: HapticStyle): void;
  selection(): void;
  notify(style: "success" | "warning" | "error"): void;
}

const patterns: Record<HapticStyle, number | number[]> = {
  light: 8,
  medium: 15,
  heavy: 25,
  success: [10, 40, 10],
  warning: [20, 40, 20],
  error: [30, 60, 30, 60, 30],
  selection: 5,
};

function vibrate(pattern: number | number[]): void {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try { navigator.vibrate(pattern); } catch { /* noop */ }
}

import { isNative } from "./platform";

function native(fn: (h: typeof import("@capacitor/haptics")) => Promise<unknown>, fallback: () => void) {
  if (!isNative()) return fallback();
  import("@capacitor/haptics").then(fn).catch(fallback);
}

export const haptics: HapticsService = {
  impact(style = "light") {
    native(({ Haptics, ImpactStyle, NotificationType }) => {
      if (style === "success" || style === "warning" || style === "error") {
        const t = { success: NotificationType.Success, warning: NotificationType.Warning, error: NotificationType.Error }[style];
        return Haptics.notification({ type: t });
      }
      if (style === "selection") return Haptics.selectionChanged();
      const s = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy }[style];
      return Haptics.impact({ style: s });
    }, () => vibrate(patterns[style]));
  },
  selection() { native(({ Haptics }) => Haptics.selectionChanged(), () => vibrate(patterns.selection)); },
  notify(style) { this.impact(style); },
};