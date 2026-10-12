const { chromium } = require("playwright");
const { readFileSync, mkdirSync, writeFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { spawn } = require("node:child_process");
const assert = require("node:assert/strict");
const root = resolve(__dirname, "..");
const artifacts = resolve(root, ".qa-results");
mkdirSync(artifacts, { recursive: true });
const baseUrl = "http://127.0.0.1:4175";
const url = readFileSync(resolve(root, ".env"), "utf8").match(
  /^VITE_SUPABASE_URL=["']?([^"'\n]+)/m,
)[1];
const origin = new URL(url).origin;
const user = {
  id: "11111111-1111-4111-8111-111111111111",
  aud: "authenticated",
  role: "authenticated",
  email: "fixture@example.test",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
};
const exp = Math.floor(Date.now() / 1000) + 3600;
const jwt = [
  { alg: "HS256", typ: "JWT" },
  { sub: user.id, exp, aud: "authenticated", role: "authenticated" },
  "test-signature",
]
  .map((value) =>
    Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url"),
  )
  .join(".");
const session = {
  access_token: jwt,
  refresh_token: "fixture-refresh",
  token_type: "bearer",
  expires_at: exp,
  expires_in: 3600,
  user,
};
const tables = Object.fromEntries(
  [
    ...readFileSync(resolve(root, "src/features/backup/rows.ts"), "utf8").matchAll(/^  (\w+): z/gm),
  ].map((m) => [m[1], []]),
);
const note = {
  id: "33333333-3333-4333-8333-333333333333",
  user_id: user.id,
  title: "مذكرة النسخة",
  content: "<p>نص مهم</p>",
  pinned: false,
  favorite: true,
  archived: false,
  emoji: null,
  category_id: null,
  created_at: "2026-10-11T00:00:00Z",
  updated_at: "2026-10-11T00:00:00Z",
};
tables.notes = [note];
const filePath = `${user.id}/${note.id}/file.txt`,
  bytes = Buffer.from("مرفق محفوظ");
tables.attachments = [
  {
    id: "44444444-4444-4444-8444-444444444444",
    user_id: user.id,
    note_id: note.id,
    name: "مرفق.txt",
    mime_type: "text/plain",
    size_bytes: bytes.length,
    storage_path: filePath,
    created_at: note.created_at,
  },
];
let backendReady = false,
  failRestore = false,
  calls = [],
  activeUser = user,
  slowExport = false,
  releaseExport;
const snapshot = { version: 1, accountId: user.id, createdAt: note.created_at, tables };
(async () => {
  const app = spawn(
    process.execPath,
    [
      resolve(root, "node_modules/vite/bin/vite.js"),
      "dev",
      "--host",
      "127.0.0.1",
      "--port",
      "4175",
      "--strictPort",
    ],
    { cwd: root, stdio: ["ignore", "pipe", "pipe"] },
  );
  let logs = "",
    browser,
    page;
  app.stdout.on("data", (d) => (logs += d));
  app.stderr.on("data", (d) => (logs += d));
  try {
    const deadline = Date.now() + 30000;
    while (true) {
      try {
        if ((await fetch(baseUrl)).ok) break;
      } catch {}
      if (Date.now() > deadline) throw Error("Dev server did not start");
      await new Promise((r) => setTimeout(r, 250));
    }
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
      args: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
        ? [
            "--no-sandbox",
            "--disable-gpu",
            "--disable-dev-shm-usage",
            "--no-zygote",
            "--single-process",
          ]
        : [],
    });
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      timezoneId: "Asia/Riyadh",
    });
    await context.addInitScript(
      ({ key, session }) => localStorage.setItem(key, JSON.stringify(session)),
      { key: `sb-${new URL(url).hostname.split(".")[0]}-auth-token`, session },
    );
    await context.route("**/*", async (route) => {
      const request = route.request(),
        parsed = new URL(request.url());
      if (parsed.origin === baseUrl) return route.continue();
      if (parsed.origin !== origin) return route.abort();
      if (parsed.pathname.startsWith("/auth/v1/"))
        return route.fulfill({ json: parsed.pathname.endsWith("/user") ? activeUser : session });
      if (parsed.pathname.includes("/rpc/")) {
        const rpc = parsed.pathname.split("/").pop();
        if (rpc === "memoflow_backup_tables_v1")
          return route.fulfill(
            backendReady
              ? { json: Object.keys(tables) }
              : { status: 404, json: { code: "PGRST202", message: "Could not find the function" } },
          );
        if (rpc === "memoflow_export_v1") {
          calls.push("export");
          if (slowExport) await new Promise((r) => (releaseExport = r));
          return route.fulfill({ json: snapshot });
        }
        if (rpc === "memoflow_restore_v1") {
          calls.push("restore");
          const args = request.postDataJSON();
          assert.equal(args.expected_account, user.id);
          assert.deepEqual(args.payload.tables, tables);
          return route.fulfill(
            failRestore
              ? { status: 400, json: { message: "MF_VAULT_KEY_CONFLICT", code: "P0001" } }
              : { json: { inserted: 2, skipped: 0 } },
          );
        }
        throw Error(`Unexpected RPC: ${rpc}`);
      }
      if (parsed.pathname.startsWith("/storage/v1/object/"))
        return route.fulfill({ body: bytes, contentType: "text/plain" });
      if (parsed.pathname.startsWith("/rest/v1/")) {
        const table = parsed.pathname.split("/").pop();
        if (table === "profiles")
          return route.fulfill({ json: { id: user.id, display_name: "أحمد", theme: "light" } });
        return route.fulfill({ json: [] });
      }
      return route.abort();
    });
    page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${baseUrl}/settings`);
    await page.getByText("النسخ الاحتياطي غير متاح حاليًا.", { exact: false }).waitFor();
    assert.equal(await page.getByRole("button", { name: "تجهيز النسخة المشفّرة" }).count(), 0);
    backendReady = true;
    await page.reload();
    // Password fields have no implicit textbox role.
    const pass = page.getByLabel("كلمة مرور النسخة", { exact: true });
    await pass.waitFor();
    await page.getByText("إنشاء نسخة جديدة", { exact: true }).click();
    await pass.fill("strong backup phrase 2026");
    await page.getByLabel("تأكيد كلمة مرور النسخة", { exact: true }).fill("different password");
    assert.equal(
      await page.getByRole("button", { name: "تجهيز النسخة المشفّرة" }).isDisabled(),
      true,
    );
    await page
      .getByLabel("تأكيد كلمة مرور النسخة", { exact: true })
      .fill("strong backup phrase 2026");
    await page.evaluate(
      (id) => localStorage.setItem(`memoflow.note-draft.v1:${id}:unsaved`, "{}"),
      user.id,
    );
    await page.getByRole("button", { name: "تجهيز النسخة المشفّرة" }).click();
    await page.getByRole("alert").filter({ hasText: "توجد مسودات" }).waitFor();
    assert.equal(calls.length, 0);
    await page.evaluate(
      (id) => localStorage.removeItem(`memoflow.note-draft.v1:${id}:unsaved`),
      user.id,
    );
    await page.getByRole("button", { name: "تجهيز النسخة المشفّرة" }).click();
    const dlButton = page.getByRole("button", { name: "حفظ على الجهاز", exact: true });
    await dlButton.waitFor();
    await page.getByText("اختيار Google Drive من نافذة", { exact: false }).waitFor();
    await dlButton.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: resolve(artifacts, "backup-delivery-mobile.png"),
      fullPage: true,
    });
    assert.equal(await pass.inputValue(), "");
    const [download] = await Promise.all([page.waitForEvent("download"), dlButton.click()]);
    const encrypted = readFileSync(await download.path(), "utf8");
    assert.equal(JSON.parse(encrypted).format, "memoflow-encrypted-backup");
    assert(!encrypted.includes("مذكرة"));
    const upload = page.getByLabel("ملف النسخة الاحتياطية");
    await upload.setInputFiles({
      name: "test.memoflow",
      mimeType: "application/octet-stream",
      buffer: Buffer.from(encrypted),
    });
    await pass.fill("incorrect long password");
    await page.getByRole("button", { name: "فحص الملف ومعاينته" }).click();
    await page.getByRole("alert").filter({ hasText: "غير صحيحة" }).waitFor();
    assert.equal(calls.filter((c) => c === "restore").length, 0);
    await pass.fill("strong backup phrase 2026");
    await page.getByRole("button", { name: "فحص الملف ومعاينته" }).click();
    await page.getByLabel("معاينة النسخة", { exact: true }).waitFor();
    const restore = page.getByRole("button", { name: "استعادة العناصر المفقودة", exact: true });
    assert.equal(await restore.isDisabled(), true);
    assert.equal(await pass.inputValue(), "");
    await page.getByLabel("أوافق على إضافة العناصر المفقودة إلى حسابي الحالي").check();
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    await page.getByLabel("معاينة النسخة", { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({
      path: resolve(artifacts, "backup-preview-mobile.png"),
      fullPage: true,
    });
    failRestore = true;
    await restore.click();
    await page.getByRole("alert").filter({ hasText: "تشفير الخزنة الحالية مختلف" }).waitFor();
    assert.equal(await page.getByLabel("معاينة النسخة", { exact: true }).count(), 1);
    failRestore = false;
    await restore.click();
    await page.getByRole("status").filter({ hasText: "اكتملت الاستعادة" }).waitFor();
    assert.equal(calls.filter((c) => c === "restore").length, 2);
    // File tampering produces no preview and no database request.
    const bad = JSON.parse(encrypted);
    bad.ciphertext = (bad.ciphertext[0] === "A" ? "B" : "A") + bad.ciphertext.slice(1);
    await upload.setInputFiles({
      name: "bad.memoflow",
      mimeType: "application/octet-stream",
      buffer: Buffer.from(JSON.stringify(bad)),
    });
    await pass.fill("strong backup phrase 2026");
    await page.getByRole("button", { name: "فحص الملف ومعاينته" }).click();
    await page.getByRole("alert").filter({ hasText: "الملف تالف" }).waitFor();
    assert.equal(calls.filter((c) => c === "restore").length, 2);
    // A delayed export must not reveal a downloadable file after account identity changes.
    await page
      .getByLabel("تأكيد كلمة مرور النسخة", { exact: true })
      .fill("strong backup phrase 2026");
    slowExport = true;
    await page.getByRole("button", { name: "تجهيز النسخة المشفّرة" }).click();
    while (!releaseExport) await page.waitForTimeout(20);
    activeUser = { ...user, id: "22222222-2222-4222-8222-222222222222" };
    releaseExport();
    await page.getByRole("alert").filter({ hasText: "تغير الحساب" }).waitFor();
    assert.equal(await dlButton.count(), 0);
    assert.deepEqual(errors, []);
    console.log(
      "PASS encrypted backup browser: capability gate, drafts, device save, password/tamper failures, preview, restore retry, account switch, RTL",
    );
  } catch (error) {
    if (page)
      await page
        .screenshot({ path: resolve(artifacts, "backup-failure.png"), fullPage: true })
        .catch(() => {});
    throw error;
  } finally {
    await browser?.close();
    app.kill("SIGTERM");
    writeFileSync(resolve(artifacts, "backup-browser-vite.log"), logs);
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
