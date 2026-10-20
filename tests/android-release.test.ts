import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Android release safeguards", () => {
  test("requires protected release signing values and uses the next app version", () => {
    const gradle = read("android/app/build.gradle");
    for (const name of [
      "MEMOFLOW_KEYSTORE_PATH",
      "MEMOFLOW_KEYSTORE_PASSWORD",
      "MEMOFLOW_KEY_ALIAS",
      "MEMOFLOW_KEY_PASSWORD",
    ]) {
      expect(gradle).toContain(`System.getenv('${name}')`);
    }
    expect(gradle).toContain('namespace = "com.ahmedmadni.memoflow"');
    expect(gradle).toContain('applicationId "com.ahmedmadni.memoflow"');
    expect(gradle).toContain("versionCode 17");
    expect(gradle).toContain('versionName "1.2.11"');
    expect(gradle).toContain("throw new GradleException");
    expect(gradle).not.toMatch(/storePassword\s+['"][^$]/);
    expect(gradle).not.toMatch(/keyPassword\s+['"][^$]/);
  });

  test("keeps secrets out of Git and builds signed artifacts only from protected secrets", () => {
    const ignore = read(".gitignore");
    expect(ignore).toContain("*.jks");
    expect(ignore).toContain("*.keystore");

    const workflow = read(".github/workflows/android-release.yml");
    expect(workflow).toContain("environment: android-release");
    expect(workflow).toContain("secrets.MEMOFLOW_RELEASE_KEYSTORE_BASE64");
    expect(workflow).toContain("assembleRelease bundleRelease");
    expect(workflow).toContain("jarsigner -verify -strict");
  });

  test("uses the permanent branded package identity", () => {
    expect(read("capacitor.config.ts")).toContain('appId: "com.ahmedmadni.memoflow"');
    expect(read("android/app/src/main/res/values/strings.xml")).toContain(
      '<string name="package_name">com.ahmedmadni.memoflow</string>',
    );
    expect(read("android/app/src/main/res/xml/autofill_service.xml")).toContain(
      'android:settingsActivity="com.ahmedmadni.memoflow.MainActivity"',
    );
  });

  test("runs native-bundle verification and Android lint in CI", () => {
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    expect(pkg.scripts["android:sync"]).toContain("android:verify");
    expect(read(".github/workflows/verify.yml")).toContain("./gradlew lintDebug --no-daemon");
    expect(read("android/app/src/main/res/values/bools.xml")).toContain(
      '<bool name="autofill_service_enabled">false</bool>',
    );
    expect(read("android/app/src/main/res/values-v26/bools.xml")).toContain(
      '<bool name="autofill_service_enabled">true</bool>',
    );
    expect(read("android/app/src/main/AndroidManifest.xml")).toContain(
      'android:dataExtractionRules="@xml/data_extraction_rules"',
    );
  });
});
