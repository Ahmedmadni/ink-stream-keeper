import type { CapacitorConfig } from "@capacitor/cli";

// Production Android builds load the web bundle copied from webDir. Keeping
// server.url unset is intentional: a hosted URL can silently serve an older
// published UI even when the APK itself contains newer code.
const config: CapacitorConfig = {
  appId: "com.ahmedmadni.memoflow",
  appName: "MemoFlow",
  webDir: ".output/public",
  // Plugin calls carry PINs and encrypted backup payloads; never mirror their
  // arguments into Android logcat, including in test/debug APKs.
  loggingBehavior: "none",
  android: { allowMixedContent: false },
  ios: { contentInset: "always" },
  plugins: {
    // Native transport is required for explicit backend calls from the local
    // https://localhost app origin (for example multipart transcription).
    CapacitorHttp: { enabled: true },
    LocalNotifications: { smallIcon: "ic_stat_icon", iconColor: "#2D6CDF" },
  },
};

export default config;
