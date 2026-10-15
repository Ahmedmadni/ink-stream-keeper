import type { CapacitorConfig } from "@capacitor/cli";

// Hosted mode: the native shell loads the live app so server features
// (transcription, auth, database) keep working unchanged.
const config: CapacitorConfig = {
  appId: "app.lovable.c357f296dbad4d33991e76d86c92e6d0",
  appName: "MemoFlow",
  webDir: ".output/public",
  server: {
    // Never point a distributable build at Lovable's private `id-preview--`
    // surface. It is protected by the Lovable editor login, whose browser
    // session cannot be handed back to this app's WebView.
    url: "https://ink-stream-keeper.lovable.app",
    cleartext: false,
  },
  android: { allowMixedContent: false },
  ios: { contentInset: "always" },
  plugins: {
    LocalNotifications: { smallIcon: "ic_stat_icon", iconColor: "#2D6CDF" },
  },
};

export default config;
