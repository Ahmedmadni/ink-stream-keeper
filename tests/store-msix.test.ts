import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createMsixManifest, msixVersion, publisherId } from "../scripts/msix-manifest.mjs";
const identity = JSON.parse(
  readFileSync(new URL("../electron/store-identity.json", import.meta.url), "utf8"),
);

describe("Microsoft Store submission identity", () => {
  test("matches the supplied Partner Center publisher and package family", () => {
    expect(identity.name).toBe("Ahmedelmadni.MemoFlowbyAhmedElmadni");
    expect(identity.publisher).toBe("CN=BDBFC817-0E03-457D-B554-E645E8FC64C2");
    expect(identity.publisherDisplayName).toBe("Ahmed_elmadni");
    expect(publisherId(identity.publisher)).toBe("ssgcq2z9crnfr");
    expect(() =>
      createMsixManifest(
        { ...identity, publisher: identity.publisher.replace("BDBF", "ADBF") },
        "1.2.11",
      ),
    ).toThrow();
  });
  test("preserves OAuth and password-recovery URI activation in the manifest", () => {
    const manifest = createMsixManifest(identity, "1.2.11");
    expect(manifest).toContain('Version="1.2.11.0"');
    expect(manifest).toContain('Executable="app\\MemoFlow.exe"');
    expect(manifest).toContain('EntryPoint="Windows.FullTrustApplication"');
    expect(manifest).toContain('Name="lovable" Parameters="&quot;%1&quot;"');
    expect(manifest).toContain(
      'Name="app.lovable.c357f296dbad4d33991e76d86c92e6d0" Parameters="&quot;%1&quot;"',
    );
    expect(manifest).toContain('Capability Name="runFullTrust"');
    expect(manifest).not.toContain("allowElevation");
    const escaped = createMsixManifest(
      { ...identity, publisherDisplayName: 'Ahmed & "MemoFlow"' },
      "1.2.11",
    );
    expect(escaped).toContain("Ahmed &amp; &quot;MemoFlow&quot;");
  });
  test("uses a Store revision of zero and rejects invalid versions and identities", () => {
    expect(msixVersion("1.2.11")).toBe("1.2.11.0");
    for (const value of ["1.2", "1.2.11.1", "1.2.65536", "1.2.-1", "1.2.beta"])
      expect(() => msixVersion(value)).toThrow();
    expect(() => createMsixManifest({ ...identity, name: "../other" }, "1.2.11")).toThrow();
    expect(() =>
      createMsixManifest({ ...identity, packageFamilyName: "other" }, "1.2.11"),
    ).toThrow();
  });
});
