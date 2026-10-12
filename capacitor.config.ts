import type { CapacitorConfig } from "@capacitor/cli";

// Hosted mode: the native shell loads the live app so server features
// (transcription, auth, database) keep working unchanged.
const config: CapacitorConfig = {
  appId: "app.lovable.c357f296dbad4d33991e76d86c92e6d0",
  appName: "MemoFlow",
  webDir: ".output/public",
  server: {
    url: "https://id-preview--c357f296-dbad-4d33-991e-76d86c92e6d0.lovable.app?forceHideBadge=true",
    cleartext: false,
  },
  android: { allowMixedContent: false },
  ios: { contentInset: "always" },
  plugins: {
    LocalNotifications: { smallIcon: "ic_stat_icon", iconColor: "#2D6CDF" },
  },
};

export default config;
