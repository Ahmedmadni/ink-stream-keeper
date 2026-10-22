import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const xml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[char],
  );

export function publisherId(publisher) {
  const bytes = createHash("sha256").update(publisher, "utf16le").digest().subarray(0, 8);
  const bits = [...bytes].map((byte) => byte.toString(2).padStart(8, "0")).join("") + "0";
  const alphabet = "0123456789abcdefghjkmnpqrstvwxyz";
  return Array.from(
    { length: 13 },
    (_, index) => alphabet[parseInt(bits.slice(index * 5, index * 5 + 5), 2)],
  ).join("");
}

export function msixVersion(version) {
  if (!/^\d+\.\d+\.\d+$/.test(version) || version.split(".").some((part) => Number(part) > 65535))
    throw new Error("Invalid desktop version for MSIX");
  return version + ".0";
}

export function createMsixManifest(identity, version) {
  if (
    !/^[a-z0-9.-]{3,50}$/i.test(identity.name) ||
    !/^CN=[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(identity.publisher) ||
    !/^[a-z][a-z0-9.]{0,63}$/i.test(identity.applicationId) ||
    !identity.displayName ||
    !identity.publisherDisplayName ||
    identity.packageFamilyName !== `${identity.name}_${publisherId(identity.publisher)}`
  )
    throw new Error("Invalid or mismatched Microsoft Store identity");
  // Windows limits protocol registrations to 39 characters. Store password
  // recovery uses the existing HTTPS form, rather than the longer mobile URI.
  const protocols = ["lovable"]
    .map(
      (scheme) => `
          <uap3:Extension Category="windows.protocol">
            <uap3:Protocol Name="${xml(scheme)}" Parameters="&quot;%1&quot;" />
          </uap3:Extension>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="utf-8"?>
<Package xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10"
  xmlns:uap="http://schemas.microsoft.com/appx/manifest/uap/windows10"
  xmlns:uap3="http://schemas.microsoft.com/appx/manifest/uap/windows10/3"
  xmlns:rescap="http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities"
  IgnorableNamespaces="uap uap3 rescap">
  <Identity Name="${xml(identity.name)}" Publisher="${xml(identity.publisher)}"
    Version="${msixVersion(version)}" ProcessorArchitecture="x64" />
  <Properties>
    <DisplayName>${xml(identity.displayName)}</DisplayName>
    <PublisherDisplayName>${xml(identity.publisherDisplayName)}</PublisherDisplayName>
    <Description>Notes, task checklists and an encrypted password vault.</Description>
    <Logo>Assets\\StoreLogo.png</Logo>
  </Properties>
  <Resources><Resource Language="ar-SA" /><Resource Language="en-US" /></Resources>
  <Dependencies>
    <TargetDeviceFamily Name="Windows.Desktop" MinVersion="10.0.19041.0" MaxVersionTested="10.0.26100.0" />
  </Dependencies>
  <Applications>
    <Application Id="${xml(identity.applicationId)}" Executable="app\\MemoFlow.exe" EntryPoint="Windows.FullTrustApplication">
      <uap:VisualElements DisplayName="${xml(identity.displayName)}"
        Description="Notes, task checklists and an encrypted password vault."
        Square150x150Logo="Assets\\Square150x150Logo.png" Square44x44Logo="Assets\\Square44x44Logo.png"
        BackgroundColor="transparent" />
      <Extensions>${protocols}
      </Extensions>
    </Application>
  </Applications>
  <Capabilities><rescap:Capability Name="runFullTrust" /></Capabilities>
</Package>
`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const identity = JSON.parse(await readFile(resolve("electron/store-identity.json"), "utf8"));
  const pkg = JSON.parse(await readFile(resolve("electron/package.json"), "utf8"));
  const destination = process.argv[2];
  if (!destination) throw new Error("Provide the output AppxManifest.xml path");
  await writeFile(destination, createMsixManifest(identity, pkg.version), "utf8");
  console.log(
    `Manifest verified for ${identity.packageFamilyName} version ${msixVersion(pkg.version)}`,
  );
}
