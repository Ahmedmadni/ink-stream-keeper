const { _electron: electron } = require("playwright");
const { readFileSync, mkdirSync } = require("node:fs");
const { resolve } = require("node:path");
const assert = require("node:assert/strict");

const root = resolve(__dirname, "..");
const artifacts = resolve(root, ".qa-results");
mkdirSync(artifacts, { recursive: true });
const env = readFileSync(resolve(root, ".env"), "utf8");
const backend = new URL(env.match(/^VITE_SUPABASE_URL=["']?([^"'\n]+)/m)[1]).origin;
const user = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "desktop@example.test",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: { provider: "google" },
  user_metadata: {},
  created_at: "2026-10-19T00:00:00Z",
};
const exp = Math.floor(Date.now() / 1000) + 3600;
const jwt = [
  { alg: "HS256", typ: "JWT" },
  { sub: user.id, exp, aud: "authenticated", role: "authenticated" },
  "fixture",
]
  .map((value) =>
    Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url"),
  )
  .join(".");
const task = {
  id: "task-desktop",
  user_id: user.id,
  title: "تطوير الموقع",
  done: false,
  status: "todo",
  due_at: null,
  reminder_at: null,
  priority: "high",
  recurrence: "none",
  category_id: "category-work",
  progress: 25,
  created_at: "2026-10-19T00:00:00Z",
  updated_at: "2026-10-19T00:00:00Z",
};
const items = [
  { id: "done", title: "إقفال البرنامج", done: true, priority: "high", position: 0 },
  { id: "low", title: "إرسال الملفات", done: false, priority: "low", position: 1 },
  { id: "high", title: "تطوير الواجهة", done: false, priority: "high", position: 2 },
  { id: "med", title: "إعادة التصميم", done: false, priority: "med", position: 3 },
].map((item) => ({
  ...item,
  parent_id: task.id,
  parent_type: "task",
  created_at: task.created_at,
}));
const note = {
  id: "note-desktop",
  user_id: user.id,
  title: "مذكرة العمل",
  content: "<p>أرشفة الملفات</p><p>إرسال البريد</p><p>&lt;img src=x onerror=alert(1)&gt;</p>",
  category_id: "category-work",
  emoji: null,
  pinned: false,
  favorite: false,
  archived: false,
  created_at: "2026-10-19T00:00:00Z",
  updated_at: "2026-10-19T00:00:00Z",
};
let notes = [
  note,
  { ...note, id: "note-second", title: "مذكرة المتابعة", content: "<p>متابعة الأعمال</p>" },
];
const { pbkdf2Sync, randomBytes, createCipheriv } = require("node:crypto");
const vaultSalt = randomBytes(16);
const vaultKey = pbkdf2Sync("123456", vaultSalt, 150000, 32, "sha256");
function encryptVaultFixture(plain) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", vaultKey, iv);
  return {
    iv: iv.toString("base64"),
    ct: Buffer.concat([cipher.update(plain, "utf8"), cipher.final(), cipher.getAuthTag()]).toString(
      "base64",
    ),
  };
}
const vaultVerifier = encryptVaultFixture("MEMOFLOW_VAULT_OK_v1");
const vaultSecret = encryptVaultFixture("Desktop-Fixture-Secret");
const vaultSettings = {
  user_id: user.id,
  kdf_salt: vaultSalt.toString("base64"),
  verifier_iv: vaultVerifier.iv,
  verifier_ct: vaultVerifier.ct,
};
const vaultEntries = [
  {
    id: "desktop-vault-entry",
    user_id: user.id,
    label: "حساب ويندوز",
    username: "desktop@example.test",
    url: "",
    notes: "",
    category_id: null,
    password_iv: vaultSecret.iv,
    password_ct: vaultSecret.ct,
  },
];

(async () => {
  let desktop, page;
  const errors = [];
  try {
    desktop = await electron.launch({
      executablePath: process.env.MEMOFLOW_ELECTRON_PATH,
      args: process.env.MEMOFLOW_DESKTOP_PACKAGED === "1" ? [] : [resolve(root, "electron")],
      timeout: 60000,
    });
    page = await desktop.firstWindow();
    page.on("pageerror", (error) => errors.push(error.message));
    const context = desktop.context();
    await context.route(backend + "/**", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/auth/v1/user")) return route.fulfill({ json: user });
      if (url.pathname.includes("/auth/v1/token"))
        return route.fulfill({
          json: {
            access_token: jwt,
            refresh_token: "fixture-refresh",
            expires_in: 3600,
            expires_at: exp,
            token_type: "bearer",
            user,
          },
        });
      const table = url.pathname.split("/").pop();
      if (table === "vault_settings") {
        if (route.request().method() === "PATCH") {
          const patch = route.request().postDataJSON();
          assert.equal(url.searchParams.get("user_id"), "eq." + user.id);
          for (const field of ["kdf_salt", "verifier_iv", "verifier_ct"])
            assert.equal(url.searchParams.get(field), "eq." + vaultSettings[field]);
          assert.deepEqual(Object.keys(patch).sort(), ["kdf_salt", "verifier_ct", "verifier_iv"]);
          Object.assign(vaultSettings, patch);
          return route.fulfill({ json: { user_id: user.id } });
        }
        return route.fulfill({ json: vaultSettings });
      }
      if (table === "vault_entries") return route.fulfill({ json: vaultEntries });
      if (table === "notes") {
        const id = url.searchParams.get("id");
        return route.fulfill({
          json: id?.startsWith("eq.") ? (notes.find((n) => n.id === id.slice(3)) ?? null) : notes,
        });
      }
      const rows = {
        tasks: [task],
        categories: [
          {
            id: "category-work",
            user_id: user.id,
            name: "العمل",
            icon: "ListChecks",
            color: "primary",
            sort_order: 0,
          },
        ],
        sub_items: items,
        profiles: { id: user.id, display_name: "حساب تجريبي", theme: "light" },
      };
      return route.fulfill({ json: rows[table] ?? [] });
    });
    await page.getByRole("button", { name: "المتابعة عبر Google", exact: true }).waitFor();
    assert.equal(await page.evaluate(() => location.protocol), "memoflow:");
    assert.equal(await page.evaluate(() => typeof window.require), "undefined");
    assert.equal(await page.evaluate(() => window.memoFlowDesktop.version), "1.2.10");
    await desktop.evaluate(({ shell }) => {
      global.__openedOAuth = null;
      shell.openExternal = async (url) => {
        global.__openedOAuth = url;
      };
    });
    await page.getByRole("button", { name: "المتابعة عبر Google", exact: true }).click();
    let opened;
    for (let attempt = 0; attempt < 30; attempt++) {
      opened = await desktop.evaluate(() => global.__openedOAuth);
      if (opened) break;
      await page.waitForTimeout(100);
    }
    assert.ok(opened, "OAuth must launch in the external browser");
    const broker = new URL(opened);
    assert.equal(broker.origin, "https://ink-stream-keeper.lovable.app");
    const state = broker.searchParams.get("state");
    assert.match(state, /^[a-f0-9]{32}$/);
    const callback =
      "lovable://oauth-callback#" +
      new URLSearchParams({ state, access_token: jwt, refresh_token: "fixture-refresh" });
    await desktop.evaluate(
      ({ app }, raw) => app.emit("open-url", { preventDefault() {} }, raw),
      callback,
    );
    await page.getByRole("navigation", { name: "التنقل الجانبي" }).waitFor();
    await page.goto("memoflow://app/tasks");
    await page.getByText(task.title, { exact: true }).waitFor();
    const preview = page.getByRole("list", { name: `بنود ${task.title}`, exact: true });
    assert.deepEqual(await preview.getByRole("listitem").allTextContents(), [
      "تطوير الواجهة",
      "إعادة التصميم",
      "إرسال الملفات",
      "+ 1 بنود أخرى",
    ]);
    assert.equal(
      await page.getByRole("checkbox", { name: /تكتمل تطوير الموقع/ }).isDisabled(),
      true,
    );
    await page.getByRole("button", { name: "خيارات البحث والتصفية", exact: true }).click();
    await page.getByRole("button", { name: "المكتملة", exact: true }).click();
    assert.equal(await page.getByText(task.title, { exact: true }).count(), 0);
    await page.getByRole("button", { name: "إعادة ضبط", exact: true }).click();
    await page.keyboard.press("Escape");
    await page
      .getByRole("dialog", { name: "تصفية المهام", exact: true })
      .waitFor({ state: "hidden" });
    await page.getByText(task.title, { exact: true }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: resolve(artifacts, "tasks-windows.png"), fullPage: true });
    await page.reload();
    await page.getByText(task.title, { exact: true }).waitFor();
    await page.goto("memoflow://app/notes");
    await page.getByRole("link", { name: /مذكرة العمل/ }).waitFor();
    const firstWindow = desktop.waitForEvent("window");
    await page.getByRole("button", { name: "عرض مذكرة العمل فوق النوافذ", exact: true }).click();
    const detached = await firstWindow;
    detached.on("pageerror", (error) => errors.push(error.message));
    await detached.getByRole("heading", { name: note.title, exact: true }).waitFor();
    assert.equal(await detached.evaluate(() => typeof window.memoFlowDesktop), "undefined");
    assert.equal(await detached.evaluate(() => typeof window.require), "undefined");
    assert.equal(await detached.locator("img").count(), 0);
    assert.match(await detached.locator("#content").textContent(), /أرشفة الملفات\nإرسال البريد/);
    assert.equal(
      await detached
        .locator("header")
        .evaluate((el) => getComputedStyle(el).getPropertyValue("-webkit-app-region")),
      "drag",
    );
    assert.equal(
      await desktop.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((w) => w.webContents.getURL().startsWith("memoflow://floating/"))
          .isAlwaysOnTop(),
      ),
      true,
    );
    await desktop.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.webContents.getURL().startsWith("memoflow://app/"))
        .minimize(),
    );
    assert.equal(
      await desktop.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((w) => w.webContents.getURL().startsWith("memoflow://floating/"))
          .isVisible(),
      ),
      true,
    );
    const pin = detached.getByRole("button", { name: "تثبيت فوق النوافذ", exact: true });
    await pin.click();
    await detached.locator('#pin[aria-pressed="false"]').waitFor();
    await pin.click();
    await detached.locator('#pin[aria-pressed="true"]').waitFor();
    await desktop.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.webContents.getURL().startsWith("memoflow://app/"))
        .restore(),
    );
    await page.getByRole("button", { name: "عرض مذكرة العمل فوق النوافذ", exact: true }).click();
    assert.equal(
      await page.evaluate(
        async () => (await window.memoFlowDesktop.getFloatingStatus()).ids.length,
      ),
      1,
    );
    note.content = "<p>تم تحديث محتوى المذكرة</p>";
    note.updated_at = "2026-10-19T01:00:00Z";
    await page.reload();
    await detached.getByText("تم تحديث محتوى المذكرة", { exact: true }).waitFor();
    await detached.evaluate(() => document.fonts.ready);
    await detached.screenshot({ path: resolve(artifacts, "floating-note-windows.png") });
    await detached.getByRole("button", { name: "إعادة المذكرة إلى التطبيق", exact: true }).click();
    await page.getByRole("textbox", { name: "عنوان الملاحظة", exact: true }).waitFor();
    await page.goto("memoflow://app/notes");
    const source = page.locator('[data-note-card="note-second"]');
    await source.waitFor();
    await source.evaluate((el) =>
      el.addEventListener(
        "pointerdown",
        (event) => {
          window.__dragPointer = event.pointerId;
        },
        { once: true },
      ),
    );
    const rect = await source.boundingBox();
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
    await page.mouse.down();
    await page.mouse.move(rect.x + rect.width / 2 + 25, rect.y + rect.height / 2 + 25);
    const bounds = await desktop.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.webContents.getURL().startsWith("memoflow://app/"))
        .getBounds(),
    );
    const secondWindow = desktop.waitForEvent("window");
    await source.dispatchEvent("pointerup", {
      pointerId: await page.evaluate(() => window.__dragPointer),
      pointerType: "mouse",
      button: 0,
      buttons: 0,
      screenX: bounds.x + bounds.width + 50,
      screenY: bounds.y + 150,
    });
    await page.mouse.up();
    const second = await secondWindow;
    second.on("pageerror", (error) => errors.push(error.message));
    await second.getByRole("heading", { name: "مذكرة المتابعة", exact: true }).waitFor();
    const reopenedWindow = desktop.waitForEvent("window");
    await page.getByRole("button", { name: "عرض مذكرة العمل فوق النوافذ", exact: true }).click();
    const reopened = await reopenedWindow;
    await reopened.getByRole("heading", { name: note.title, exact: true }).waitFor();
    const deletedClose = reopened.waitForEvent("close");
    notes = notes.filter((n) => n.id !== note.id);
    await page.reload();
    await deletedClose;
    assert.equal(
      await page.evaluate(
        async () => (await window.memoFlowDesktop.getFloatingStatus()).ids.length,
      ),
      1,
    );
    await page.goto("memoflow://app/settings");
    await page.getByText("أحمد محمد المدني", { exact: true }).waitFor();
    assert.equal(
      await page.getByRole("button", { name: "إضافة إلى الشاشة الرئيسية", exact: true }).count(),
      0,
    );
    const secondClose = second.waitForEvent("close");
    await page.getByRole("button", { name: "إغلاق البطاقات العائمة", exact: true }).click();
    await secondClose;
    await page.getByText("لا توجد بطاقات عائمة مفتوحة", { exact: true }).waitFor();
    await page.getByRole("button", { name: "تغيير رمز الخزنة", exact: true }).click();
    const pinForm = page.getByRole("form", { name: "تغيير رمز الخزنة", exact: true });
    await pinForm.getByLabel("رمز الخزنة الحالي", { exact: true }).fill("123456");
    await pinForm.getByLabel("رمز الخزنة الجديد", { exact: true }).fill("654321");
    await pinForm.getByLabel("تأكيد رمز الخزنة الجديد", { exact: true }).fill("654321");
    await pinForm.getByRole("button", { name: "حفظ رمز الخزنة الجديد", exact: true }).click();
    await pinForm.getByText("تم تغيير رمز الخزنة بنجاح.", { exact: true }).waitFor();
    await page.screenshot({
      path: resolve(artifacts, "vault-pin-settings-windows.png"),
      fullPage: true,
    });
    assert.equal(vaultEntries[0].password_ct, vaultSecret.ct);
    await page.goto("memoflow://app/vault");
    await page.getByRole("heading", { name: "فتح الخزنة", exact: true }).waitFor();
    for (const digit of "654321")
      await page.getByRole("button", { name: digit, exact: true }).click();
    await page.getByText("حساب ويندوز", { exact: true }).waitFor();
    await page.getByRole("button", { name: "عرض", exact: true }).click();
    await page.getByText("Desktop-Fixture-Secret", { exact: true }).waitFor();
    await page.goto("memoflow://app/notes");
    const logoutWindow = desktop.waitForEvent("window");
    await page.getByRole("button", { name: "عرض مذكرة المتابعة فوق النوافذ", exact: true }).click();
    const logoutCard = await logoutWindow;
    await logoutCard.getByRole("heading", { name: "مذكرة المتابعة", exact: true }).waitFor();
    await page.goto("memoflow://app/settings");
    const logoutClose = logoutCard.waitForEvent("close");
    await page.getByRole("button", { name: "تسجيل الخروج", exact: true }).click();
    await logoutClose;
    await page.getByRole("button", { name: "المتابعة عبر Google", exact: true }).waitFor();
    assert.equal(
      await page.evaluate(
        async () => (await window.memoFlowDesktop.getFloatingStatus()).ids.length,
      ),
      0,
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: packaged Windows desktop — OAuth/session, task previews, floating notes, pointer drop, always-on-top, pin toggle, deduplication, live updates, cleanup, developer identity, vault PIN change and retained password decryption.",
    );
  } catch (error) {
    if (page) {
      await page
        .screenshot({ path: resolve(artifacts, "desktop-failure.png"), fullPage: true })
        .catch(() => {});
      console.error(
        "Desktop state",
        await page
          .evaluate(() => ({ url: location.href, text: document.body.innerText.slice(0, 2000) }))
          .catch(() => null),
      );
    }
    console.error(error);
    process.exitCode = 1;
  } finally {
    if (desktop) await desktop.close();
  }
})();
