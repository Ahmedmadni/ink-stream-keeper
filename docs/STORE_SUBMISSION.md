# MemoFlow Microsoft Store submission

The first Store submission uses version `1.2.11.0` (x64). The Store name and
identity below were supplied by the owner's Partner Center reservation on
22 October 2026. These are public package identifiers, not signing secrets.

| Field                                   | Value                                             |
| --------------------------------------- | ------------------------------------------------- |
| Display name                            | MemoFlow by Ahmed Elmadni                         |
| Package/Identity/Name                   | Ahmedelmadni.MemoFlowbyAhmedElmadni               |
| Package/Identity/Publisher              | CN=BDBFC817-0E03-457D-B554-E645E8FC64C2           |
| Package/Properties/PublisherDisplayName | Ahmed_elmadni                                     |
| Package family                          | Ahmedelmadni.MemoFlowbyAhmedElmadni_ssgcq2z9crnfr |
| Store ID                                | 9PLLTZQS5VT5                                      |

The reservation URL is https://apps.microsoft.com/detail/9PLLTZQS5VT5. This is
not evidence that the app is published. Store approval and publication remain
separate steps in Partner Center.

## Build and verification

The Windows workflow builds the local native SPA, packages the Electron x64
application, and runs its desktop feature tests. `scripts/package-msix.ps1`
then uses the Windows SDK's MakeAppx without bypassing semantic validation.
It creates branded PNG assets from the existing app icon, generates the
manifest, packages the application, unpacks the result, verifies all three
Store identity values and the version, and compares the embedded ASAR hash.

`scripts/test-msix.ps1` temporarily registers the loose package on the disposable
CI Windows runner, checks the assigned package family, and exercises the
application with MSIX identity and a real OS OAuth protocol activation. The
harness uses `Invoke-CommandInDesktopPackage -PreventBreakaway` so Electron
inherits the registered identity instead of starting as a loose executable. It
removes the test registration and restores the runner's previous developer
registration policy afterward. No test certificate or modified trust store is
included in the download. The Store upload package remains unsigned so the
Store can sign it after submission.

Rebuild locally on Windows after the existing desktop packaging steps:

```powershell
pwsh -File scripts/package-msix.ps1
```

The output is `desktop-dist/store/MemoFlow-Store-1.2.11-x64.msix` plus its SHA-256,
manifest and identity metadata. Upload the `.msix` file in Partner Center's
Packages section. Do not sign it with the Android key. It is a Store submission
artifact, not a publicly trusted sideload package before Store signing.

## Desktop integration

The manifest registers `lovable` for OAuth, passing a quoted URI as an argument
to the desktop executable. Existing URI allowlists and OAuth random-state
verification still apply. Windows restricts protocol names to 39 characters, so
the longer mobile password-recovery scheme cannot be declared in the MSIX.
Store password reset instead uses the existing HTTPS `/auth?recovery=1` browser
form, then asks the user to sign in with the new password. This works with the
existing hosted recovery page and needs no new Supabase redirect configuration.
Android and portable desktop retain their existing recovery handoff. A Store process does not attempt to rewrite ordinary protocol registry
entries. Its application user model ID matches the Store package family.

The desktop capability is `runFullTrust`, with no administrator/elevation
capability. The app retains Electron's sandboxed renderers, isolated preloads,
local SPA and bundled fonts. Its floating task/note windows and native backup
save dialogs require the desktop execution model. Store and portable versions
can have separate Windows storage contexts; a user can transfer content through
the existing backup export/import flow when needed.

## Partner Center checklist

After the package is downloaded:

1. Open the reserved product and select **Start submission**.
2. Upload the `.msix` in **Packages** and wait for identity validation.
3. Complete pricing/availability, properties/category, age ratings and listings.
4. Provide a publicly reachable privacy policy URL describing the actual
   Supabase authentication, account data, encrypted vault and backup behavior.
   The developer website is https://ahmedelmadni.com; no policy URL has been
   assumed or published automatically.
5. Provide an email/password test account for reviewers in the private
   certification notes if requested. Use a dedicated test account with synthetic
   sample data, not the developer's personal vault.
6. Review all required fields and submit for certification. Microsoft's decision
   is separate from the automated build and runtime checks.

Suggested category: **Productivity**.

Suggested Arabic short description:

> مذكراتك ومهامك وكلمات مرورك في تطبيق عربي بسيط ومنظّم.

Suggested Arabic description:

> اجمع مذكراتك ومهامك اليومية وخزنة كلمات المرور في MemoFlow. نظّم المهام
> حسب التصنيف والأولوية، وأضف بنودًا فرعية تكتمل المهمة باكتمالها. افتح
> المهام والمذكرات كبطاقات عائمة فوق النوافذ للمتابعة أثناء العمل. احفظ
> كلمات المرور داخل خزنة مشفّرة، وصدّر نسخًا احتياطية لاستعادتها لاحقًا.
> واجهة عربية من اليمين إلى اليسار، مع خط IBM Plex Sans Arabic مدمج.

Suggested private certification note for `runFullTrust`:

> MemoFlow is an Electron desktop application for notes, task checklists and
> an encrypted password vault. The runFullTrust capability is required for the
> desktop Chromium host, independent draggable always-on-top task/note windows,
> system file-save dialogs for backup export, and external-browser OAuth URI
> activation. It runs at normal user integrity and does not request administrator
> privileges or install services/drivers. Authentication is required; dedicated
> test account details should be supplied separately in these private notes.

References:

- https://learn.microsoft.com/windows/msix/desktop/desktop-to-uwp-manual-conversion
- https://learn.microsoft.com/windows/msix/desktop/desktop-to-uwp-debug
- https://learn.microsoft.com/windows/apps/desktop/modernize/desktop-to-uwp-extensions
- https://www.electronjs.org/docs/latest/api/app#appsetasdefaultprotocolclientprotocol-path-args
