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

export const haptics: HapticsService = {
  impact(style = "light") { vibrate(patterns[style]); },
  selection() { vibrate(patterns.selection); },
  notify(style) { vibrate(patterns[style]); },
};