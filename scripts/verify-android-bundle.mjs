import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const androidRoot = resolve(root, "android/app/src/main");
const publicAssets = resolve(androidRoot, "assets/public");

async function text(path) {
  return readFile(resolve(root, path), "utf8");
}

function requireMatch(value, pattern, message) {
  if (!pattern.test(value)) throw new Error(message);
}

const capacitorConfig = JSON.parse(
  await readFile(resolve(androidRoot, "assets/capacitor.config.json"), "utf8"),
);
if (capacitorConfig.server?.url) {
  throw new Error("Android bundle must not use server.url");
}
if (capacitorConfig.appName !== "MemoFlow") {
  throw new Error("Unexpected Android app name");
}
if (capacitorConfig.appId !== "com.ahmedmadni.memoflow") {
  throw new Error("Unexpected Android package identity");
}

await readFile(resolve(publicAssets, "index.html"));
const assetNames = await readdir(resolve(publicAssets, "assets"));
const fontNames = assetNames.filter((name) =>
  /^ibm-plex-sans-arabic-(arabic|latin)-(400|500|600|700)-normal-.*\.woff2$/.test(name),
);
if (fontNames.length !== 8) {
  throw new Error(`Expected 8 bundled IBM Plex Sans Arabic fonts, found ${fontNames.length}`);
}

const javascript = (
  await Promise.all(
    assetNames
      .filter((name) => name.endsWith(".js"))
      .map((name) => readFile(resolve(publicAssets, "assets", name), "utf8")),
  )
).join("\n");
for (const marker of [
  "memoflow_backup_tables_v1",
  "memoflow_task_completion_guard_v1",
  "MemoFlowAppLock",
  "MemoFlowBackup",
  "MemoFlowAutofill",
]) {
  if (!javascript.includes(marker)) throw new Error(`Native bundle is missing ${marker}`);
}

const manifest = await text("android/app/src/main/AndroidManifest.xml");
requireMatch(manifest, /android:allowBackup="false"/, "Android OS backup must stay disabled");
requireMatch(
  manifest,
  /android:dataExtractionRules="@xml\/data_extraction_rules"/,
  "Android data extraction rules are missing",
);
requireMatch(
  manifest,
  /android:usesCleartextTraffic="false"/,
  "Cleartext Android traffic must stay disabled",
);
requireMatch(
  manifest,
  /android\.permission\.BIND_AUTOFILL_SERVICE/,
  "Android AutofillService declaration is missing",
);
requireMatch(
  manifest,
  /android:enabled="@bool\/autofill_service_enabled"/,
  "Android Autofill must be API-gated",
);
requireMatch(manifest, /android:path="\/callback"/, "OAuth callback intent is missing");
requireMatch(manifest, /android:path="\/recovery"/, "Recovery callback intent is missing");

const autofillDefault = await text("android/app/src/main/res/values/bools.xml");
const autofillV26 = await text("android/app/src/main/res/values-v26/bools.xml");
const extractionRules = await text("android/app/src/main/res/xml/data_extraction_rules.xml");
requireMatch(
  autofillDefault,
  /<bool name="autofill_service_enabled">false<\/bool>/,
  "Autofill must stay disabled below API 26",
);
requireMatch(
  autofillV26,
  /<bool name="autofill_service_enabled">true<\/bool>/,
  "Autofill must be enabled on API 26+",
);
requireMatch(extractionRules, /<cloud-backup/, "Cloud-backup exclusions are missing");
requireMatch(extractionRules, /<device-transfer>/, "Device-transfer exclusions are missing");

const activity = await text("android/app/src/main/java/com/ahmedmadni/memoflow/MainActivity.java");
if (!activity.includes("package com.ahmedmadni.memoflow;")) {
  throw new Error("MainActivity does not use the permanent MemoFlow package identity");
}
for (const marker of [
  "WebView.setWebContentsDebuggingEnabled(false)",
  "WindowManager.LayoutParams.FLAG_SECURE",
  "setTextZoom(100)",
]) {
  if (!activity.includes(marker)) throw new Error(`MainActivity is missing ${marker}`);
}

console.log(
  `Verified Android bundle: local SPA, ${fontNames.length} fonts, auth callbacks, vault security, backups, and Autofill.`,
);
