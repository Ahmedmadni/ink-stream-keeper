const { chromium } = require("playwright");
const { readFileSync, mkdirSync, writeFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { spawn } = require("node:child_process");
const assert = require("node:assert/strict");
const root = resolve(__dirname, "..");
const artifacts = resolve(root, ".qa-results");
mkdirSync(artifacts, { recursive: true });
const baseUrl = "http://127.0.0.1:4173";
const env = readFileSync(root + "/.env", "utf8");
const url = env.match(/^VITE_SUPABASE_URL=["']?([^"'\n]+)/m)[1];
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
  .map((x) => Buffer.from(typeof x === "string" ? x : JSON.stringify(x)).toString("base64url"))
  .join(".");
const session = {
  access_token: jwt,
  refresh_token: "fixture-refresh",
  token_type: "bearer",
  expires_at: exp,
  expires_in: 3600,
  user,
};
const tasks = [
  {
    id: "task-a",
    user_id: user.id,
    title: "مراجعة الحسابات",
    done: false,
    status: "todo",
    due_at: "2026-10-10T12:00:00Z",
    reminder_at: null,
    priority: "high",
    recurrence: "none",
    category_id: "category-work",
    progress: 0,
    created_at: "2026-10-10T00:00:00Z",
    updated_at: "2026-10-10T00:00:00Z",
  },
  {
    id: "task-b",
    user_id: user.id,
    title: "شراء المستلزمات",
    done: false,
    status: "todo",
    due_at: null,
    reminder_at: null,
    priority: "med",
    recurrence: "none",
    category_id: "category-work",
    progress: 50,
    created_at: "2026-10-10T00:00:00Z",
    updated_at: "2026-10-10T00:00:00Z",
  },
];
const categories = [
  {
    id: "category-work",
    user_id: user.id,
    name: "العمل",
    icon: "ListChecks",
    color: "primary",
    locked: false,
    sort_order: 0,
    created_at: "2026-10-10T00:00:00Z",
  },
];
const taskItems = [
  {
    id: "sub-a",
    user_id: user.id,
    parent_type: "task",
    parent_id: "task-b",
    parent_item_id: null,
    depth: 0,
    title: "أرشفة الملفات",
    description: null,
    notes: null,
    status: "done",
    priority: "med",
    progress: 100,
    done: true,
    done_at: "2026-10-10T00:00:00Z",
    start_at: null,
    end_at: null,
    reminder_at: null,
    position: 0,
    converted_task_id: null,
    meta: {},
    created_at: "2026-10-10T00:00:00Z",
    updated_at: "2026-10-10T00:00:00Z",
  },
  {
    id: "sub-b",
    user_id: user.id,
    parent_type: "task",
    parent_id: "task-b",
    parent_item_id: null,
    depth: 0,
    title: "إرسال الإيميلات",
    description: null,
    notes: null,
    status: "todo",
    priority: "med",
    progress: 0,
    done: false,
    done_at: null,
    start_at: null,
    end_at: null,
    reminder_at: null,
    position: 1,
    converted_task_id: null,
    meta: {},
    created_at: "2026-10-10T00:00:00Z",
    updated_at: "2026-10-10T00:00:00Z",
  },
];
const notes = [
  {
    id: "note-a",
    user_id: user.id,
    title: "أفكار الأسبوع",
    content: "<p>مساحة هادئة لأفكاري الجديدة</p>",
    pinned: true,
    favorite: false,
    category_id: null,
    created_at: "2026-10-10T00:00:00Z",
    updated_at: "2026-10-10T00:00:00Z",
  },
];
let profile = { id: user.id, display_name: "أحمد", theme: "light" };
let patchSeen = false;
const { pbkdf2Sync, randomBytes, createCipheriv } = require("node:crypto");
const salt = randomBytes(16),
  key = pbkdf2Sync("123456", salt, 150000, 32, "sha256");
function encrypt(plain) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final(), cipher.getAuthTag()]);
  return { iv: iv.toString("base64"), ct: ct.toString("base64") };
}
const verifier = encrypt("MEMOFLOW_VAULT_OK_v1"),
  secret = encrypt("Fixture-Password-Only");
const vaultSettings = {
  user_id: user.id,
  kdf_salt: salt.toString("base64"),
  verifier_iv: verifier.iv,
  verifier_ct: verifier.ct,
};
const vaultEntries = [
  {
    id: "entry-a",
    user_id: user.id,
    label: "حساب تجريبي",
    username: "fixture@example.test",
    url: "https://example.test",
    notes: "",
    category_id: null,
    password_iv: secret.iv,
    password_ct: secret.ct,
  },
];

(async () => {
  const server = spawn(
    process.execPath,
    [
      resolve(root, "node_modules/vite/bin/vite.js"),
      "dev",
      "--host",
      "127.0.0.1",
      "--port",
      "4173",
      "--strictPort",
    ],
    { cwd: root, stdio: ["ignore", "pipe", "pipe"] },
  );
  let logs = "";
  server.stdout.on("data", (chunk) => (logs += chunk));
  server.stderr.on("data", (chunk) => (logs += chunk));
  let browser, page;
  try {
    const deadline = Date.now() + 30000;
    while (true) {
      try {
        const response = await fetch(baseUrl);
        if (response.ok) break;
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
      deviceScaleFactor: 1,
      timezoneId: "Asia/Riyadh",
    });
    await context.addInitScript(
      ({ key, session }) => localStorage.setItem(key, JSON.stringify(session)),
      { key: "sb-" + new URL(url).hostname.split(".")[0] + "-auth-token", session },
    );
    await context.route("**/*", async (route) => {
      const req = route.request(),
        u = new URL(req.url());
      if (u.origin === "http://127.0.0.1:4173") return route.continue();
      if (u.origin !== origin) return route.abort();
      if (u.pathname.startsWith("/auth/v1/"))
        return route.fulfill({ json: u.pathname.endsWith("/user") ? user : session });
      if (u.pathname.startsWith("/rest/v1/")) {
        const table = u.pathname.split("/").pop();
        let result = [];
        if (table === "profiles") {
          if (req.method() === "PATCH") profile = { ...profile, ...req.postDataJSON() };
          result = profile;
        }
        if (table === "notes") result = u.searchParams.has("id") ? notes[0] : notes;
        if (table === "categories") result = categories;
        if (table === "tasks") {
          if (req.method() === "PATCH") {
            const p = req.postDataJSON();
            const id = u.searchParams.get("id")?.replace("eq.", "");
            const index = tasks.findIndex((task) => task.id === id);
            assert.notEqual(index, -1);
            tasks[index] = { ...tasks[index], ...p };
            if (id === "task-a") {
              assert.equal(p.done, true);
              assert.equal(p.status, "done");
              patchSeen = true;
            }
          }
          result = u.searchParams.has("id")
            ? tasks.find((t) => u.searchParams.get("id") === "eq." + t.id)
            : tasks;
        }
        if (table === "sub_items") {
          if (req.method() === "PATCH") {
            const id = u.searchParams.get("id")?.replace("eq.", "");
            const index = taskItems.findIndex((item) => item.id === id);
            assert.notEqual(index, -1);
            taskItems[index] = { ...taskItems[index], ...req.postDataJSON() };
          }
          const parent = u.searchParams.get("parent_id")?.replace("eq.", "");
          result = parent ? taskItems.filter((item) => item.parent_id === parent) : taskItems;
        }
        if (table === "vault_settings") result = vaultSettings;
        if (table === "vault_entries") {
          if (req.method() === "POST")
            return route.fulfill({ status: 500, json: { message: "Fixture write failure" } });
          result = vaultEntries;
        }
        return route.fulfill({ json: result });
      }
      return route.abort();
    });
    page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:4173/notes");
    await page.getByText("أفكار الأسبوع", { exact: true }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    assert.equal(
      await page.getByRole("navigation", { name: "التنقل الرئيسي" }).getByRole("link").count(),
      4,
    );
    await page.evaluate(() =>
      document.fonts.load('400 16px "IBM Plex Sans Arabic"', "مذكرات MemoFlow"),
    );
    assert.ok(
      await page.evaluate(() =>
        document.fonts.check('400 16px "IBM Plex Sans Arabic"', "مذكرات MemoFlow"),
      ),
    );
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    assert.equal(
      await page.evaluate(() => getComputedStyle(document.documentElement).fontSize),
      "16px",
    );
    await page.screenshot({ path: artifacts + "/notes-mobile.png", fullPage: true });
    await page
      .getByRole("navigation", { name: "التنقل الرئيسي" })
      .getByRole("link", { name: "المهام" })
      .click();
    await page.getByText("مراجعة الحسابات", { exact: true }).waitFor();
    await page.getByRole("heading", { name: "العمل", exact: true }).waitFor();
    await page.getByText("1 من 2", { exact: true }).waitFor();
    const preview = page.getByRole("list", { name: "بنود شراء المستلزمات", exact: true });
    assert.deepEqual(await preview.getByRole("listitem").allTextContents(), [
      "إرسال الإيميلات",
      "أرشفة الملفات",
    ]);
    assert.ok(
      await preview.evaluate(
        (node) =>
          parseFloat(getComputedStyle(node).fontSize) <
          parseFloat(getComputedStyle(node.previousElementSibling).fontSize),
      ),
    );
    assert.equal(await page.getByRole("button", { name: "المكتملة", exact: true }).count(), 0);
    const filterButton = page.getByRole("button", { name: "خيارات البحث والتصفية", exact: true });
    await filterButton.click();
    await page.getByRole("combobox", { name: "أولوية المهام" }).selectOption("high");
    assert.equal(await page.getByText("شراء المستلزمات", { exact: true }).count(), 0);
    await page.screenshot({ path: artifacts + "/task-search-filters-mobile.png", fullPage: true });
    await page.getByRole("button", { name: "إعادة ضبط", exact: true }).click();
    await page.keyboard.press("Escape");
    await page.getByText("شراء المستلزمات", { exact: true }).waitFor();
    for (const width of [320, 360, 390, 430, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      const bar = page.getByLabel("التصنيفات والإضافة", { exact: true });
      const add = page.getByRole("link", { name: "مهمة جديدة", exact: true });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      const [barRect, addRect] = await Promise.all([bar.boundingBox(), add.boundingBox()]);
      assert.ok(addRect.x >= 0 && addRect.x + addRect.width <= width);
      assert.ok(Math.abs(barRect.y + barRect.height / 2 - addRect.y - addRect.height / 2) <= 1);
      if (width === 1280)
        await page.screenshot({ path: artifacts + "/tasks-desktop.png", fullPage: true });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(
      await page
        .getByRole("checkbox", {
          name: "تكتمل شراء المستلزمات تلقائيًا بعد إنجاز جميع البنود",
        })
        .isDisabled(),
      true,
    );
    assert.equal(await page.getByText("التقسيم الهرمي", { exact: true }).count(), 0);
    await page.getByRole("searchbox", { name: "بحث في المهام" }).fill("الحسابات");
    assert.equal(await page.getByText("شراء المستلزمات", { exact: true }).count(), 0);
    await page.getByRole("searchbox", { name: "بحث في المهام" }).fill("");
    await page.getByRole("checkbox", { name: "إنجاز مراجعة الحسابات" }).click();
    await filterButton.click();
    await page.getByRole("button", { name: "المكتملة", exact: true }).click();
    await page.keyboard.press("Escape");
    await page.getByRole("checkbox", { name: "إلغاء إنجاز مراجعة الحسابات" }).waitFor();
    assert.ok(patchSeen);
    await filterButton.click();
    await page.getByRole("button", { name: "غير المكتملة", exact: true }).click();
    await page.keyboard.press("Escape");
    await page.screenshot({ path: artifacts + "/tasks-mobile.png", fullPage: true });
    await page.getByRole("link", { name: /شراء المستلزمات/ }).click();
    await page.getByRole("textbox", { name: "عنوان المهمة" }).waitFor();
    assert.equal(await page.getByRole("button", { name: "تكرار", exact: true }).count(), 0);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await page.getByText("المواعيد وتفاصيل إضافية", { exact: true }).click();
    assert.ok(await page.getByLabel("موعد التذكير", { exact: true }).isVisible());
    await page.getByLabel("موعد التذكير", { exact: true }).fill("2026-10-24T18:30");
    await page.getByText("24 أكتوبر 2026", { exact: false }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await page.getByText("بنود المهمة", { exact: true }).waitFor();
    assert.equal(await page.getByLabel("إنجاز المهمة").isDisabled(), true);
    const checklist = page.getByRole("list", { name: "قائمة بنود المهمة" });
    assert.deepEqual(
      await checklist
        .getByRole("checkbox")
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("aria-label"))),
      ["إنجاز إرسال الإيميلات", "إنجاز أرشفة الملفات"],
    );
    await page.getByRole("combobox", { name: "أولوية إرسال الإيميلات" }).selectOption("high");
    await page.getByRole("checkbox", { name: "إنجاز إرسال الإيميلات", exact: true }).click();
    await page
      .getByText("تم الحفظ", { exact: false })
      .count()
      .catch(() => 0);
    await page.waitForTimeout(300);
    assert.equal(tasks[1].done, true);
    assert.equal(tasks[1].progress, 100);
    await page.screenshot({ path: artifacts + "/task-detail-mobile.png", fullPage: true });
    await page.getByRole("link", { name: "العودة للمهام", exact: true }).click();
    await page.getByRole("link", { name: "مهمة جديدة", exact: true }).click();
    await page.getByRole("heading", { name: "مهمة جديدة" }).waitFor();
    assert.ok(await page.getByRole("button", { name: "إنشاء وفتح المهمة" }).isDisabled());
    await page.getByPlaceholder("اسم المهمة").fill("مهمة تجريبية");
    await page.getByLabel("تصنيف المهمة").selectOption("category-work");
    await page
      .getByLabel("بنود المهمة الفرعية")
      .fill("أرشفة الملفات\nإعداد المحاضر\nإرسال الإيميلات");
    assert.equal(await page.getByLabel("تصنيف المهمة").inputValue(), "category-work");
    assert.ok(await page.getByRole("button", { name: "إنشاء وفتح المهمة" }).isEnabled());
    await page.screenshot({ path: artifacts + "/task-create-mobile.png", fullPage: true });
    await page
      .getByRole("link", { name: "الإعدادات", exact: true })
      .filter({ visible: true })
      .first()
      .click();
    await page.getByRole("switch", { name: "الوضع الداكن" }).click();
    await page.waitForFunction(() => document.documentElement.classList.contains("dark"));
    await page.screenshot({ path: artifacts + "/settings-dark.png", fullPage: true });
    assert.equal(await page.getByRole("button", { name: "تصدير البيانات" }).count(), 0);
    assert.equal(await page.getByText("الأقسام السابقة", { exact: true }).count(), 0);
    assert.equal(await page.getByRole("link", { name: "مساحات العمل", exact: true }).count(), 0);
    for (const width of [320, 360, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.equal(
        await page.evaluate(() => getComputedStyle(document.documentElement).fontSize),
        "16px",
      );
    }
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto("http://127.0.0.1:4173/notes");
    await page.getByText("أفكار الأسبوع", { exact: true }).waitFor();
    assert.ok(await page.getByRole("navigation", { name: "التنقل الجانبي" }).isVisible());
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await page.screenshot({ path: artifacts + "/notes-tablet.png", fullPage: true });
    await page.getByRole("link", { name: /أفكار الأسبوع/ }).click();
    await page.getByRole("textbox", { name: "عنوان الملاحظة" }).waitFor();
    await page.reload();
    await page.getByRole("textbox", { name: "عنوان الملاحظة" }).waitFor();
    assert.equal(
      await page.getByRole("textbox", { name: "عنوان الملاحظة" }).inputValue(),
      "أفكار الأسبوع",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page
      .getByRole("navigation", { name: "التنقل الرئيسي" })
      .getByRole("link", { name: "الخزنة" })
      .click();
    await page.getByRole("heading", { name: "فتح الخزنة", exact: true }).waitFor();
    for (const digit of "111111")
      await page.getByRole("button", { name: digit, exact: true }).click();
    await page.getByText("رمز خاطئ", { exact: true }).waitFor();
    for (const digit of "123456")
      await page.getByRole("button", { name: digit, exact: true }).click();
    await page.getByText("حساب تجريبي", { exact: true }).waitFor();
    await page.getByRole("button", { name: "عرض", exact: true }).click();
    await page.getByText("Fixture-Password-Only", { exact: true }).waitFor();
    await page.getByRole("button", { name: "قفل", exact: true }).click();
    await page.getByRole("heading", { name: "فتح الخزنة", exact: true }).waitFor();
    assert.equal(await page.getByText("Fixture-Password-Only", { exact: true }).count(), 0);
    for (const digit of "123456")
      await page.getByRole("button", { name: digit, exact: true }).click();
    await page.getByText("حساب تجريبي", { exact: true }).waitFor();
    await page.getByRole("button", { name: "حساب جديد", exact: true }).click();
    await page.getByLabel("العنوان", { exact: true }).fill("حساب محفوظ في النموذج");
    await page.getByPlaceholder("••••••••", { exact: true }).fill("Fixture-New-Secret");
    await page.getByRole("button", { name: "حفظ", exact: true }).click();
    await page
      .getByText("تعذر حفظ الحساب. بياناتك ما زالت في النموذج؛ حاول مجددًا.", { exact: true })
      .waitFor();
    assert.equal(
      await page.getByLabel("العنوان", { exact: true }).inputValue(),
      "حساب محفوظ في النموذج",
    );
    assert.ok(await page.getByRole("dialog").isVisible());
    await page.getByRole("button", { name: "إغلاق", exact: true }).click();
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, value: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.getByRole("heading", { name: "فتح الخزنة", exact: true }).waitFor();
    await page
      .getByRole("button", { name: "Close toast", exact: true })
      .click()
      .catch(() => {});
    await page.waitForFunction(() =>
      [...document.querySelectorAll("main [style]")].every(
        (el) => getComputedStyle(el).opacity === "1",
      ),
    );
    await page.screenshot({ path: artifacts + "/vault-locked-mobile.png", fullPage: true });
    await page.evaluate(() => {
      delete document.hidden;
    });
    assert.deepEqual(errors, []);
    // Exercise the installed-Android UI using a deterministic Capacitor bridge.
    // System permission screens themselves still require a real-device check.
    await context.addInitScript(() => {
      window.androidBridge = {};
      window.__nativeCalls = [];
      window.__nativeState = { display: "prompt", exact: false, overlay: false, floating: false };
      const plugins = {
        MemoFlowAppLock: ["getStatus", "lock", "unlock", "configure"],
        MemoFlowAuth: ["getLaunchUrl", "addListener", "removeListener"],
        MemoFlowBackup: ["getStatus"],
        MemoFlowFloating: ["checkPermission", "show", "hide"],
        MemoFlowDeviceSettings: ["openNotifications"],
        LocalNotifications: [
          "checkPermissions",
          "areEnabled",
          "requestPermissions",
          "checkExactNotificationSetting",
          "changeExactNotificationSetting",
          "getPending",
          "cancel",
          "schedule",
        ],
      };
      window.Capacitor = {
        PluginHeaders: Object.entries(plugins).map(([name, methods]) => ({
          name,
          methods: methods.map((method) => ({ name: method, rtype: "promise" })),
        })),
        nativePromise: async (plugin, method, options) => {
          window.__nativeCalls.push({ plugin, method, options });
          const state = window.__nativeState;
          if (plugin === "MemoFlowAppLock" && method === "getStatus")
            return { configured: true, unlocked: true, blockedUntil: 0 };
          if (plugin === "MemoFlowBackup") return { configured: false, enabled: false };
          if (plugin === "MemoFlowFloating") {
            if (method === "show") {
              state.overlay = true;
              state.floating = true;
            }
            if (method === "hide") state.floating = false;
            return { granted: state.overlay, running: state.floating };
          }
          if (plugin === "LocalNotifications") {
            if (method === "requestPermissions") state.display = "granted";
            if (method === "changeExactNotificationSetting") state.exact = true;
            if (method === "checkPermissions" || method === "requestPermissions")
              return { display: state.display };
            if (method === "areEnabled") return { value: state.display === "granted" };
            if (
              method === "checkExactNotificationSetting" ||
              method === "changeExactNotificationSetting"
            )
              return { exact_alarm: state.exact ? "granted" : "denied" };
            if (method === "getPending") return { notifications: [] };
          }
          return {};
        },
      };
    });
    await page.goto(`${baseUrl}/settings`);
    await page.bringToFront();
    await page.getByRole("heading", { name: "رمز فتح MemoFlow", exact: true }).waitFor();
    await page.evaluate(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("focus"));
    });
    const notificationButton = page.getByRole("button", { name: /إشعارات التذكير/ });
    await notificationButton.click();
    await page.getByRole("button", { name: "تجربة إشعار", exact: true }).waitFor({ timeout: 5000 });
    await page.getByRole("button", { name: "تجربة إشعار", exact: true }).click();
    await page.waitForFunction(() =>
      window.__nativeCalls.some((call) => call.method === "schedule"),
    );
    assert.equal(
      await page.evaluate(
        () =>
          window.__nativeCalls.find((call) => call.method === "schedule").options.notifications[0]
            .isExactNotification,
      ),
      false,
    );
    await page
      .getByRole("button", { name: "السماح بالتذكير في موعده الدقيق", exact: true })
      .click();
    await page.waitForFunction(() => window.__nativeState.exact);
    await page.evaluate(() => {
      window.__nativeState.display = "denied";
      window.dispatchEvent(new Event("focus"));
    });
    await page.getByText("السماح بتنبيهات المهام على الهاتف", { exact: true }).waitFor();
    await notificationButton.click();
    await page.waitForFunction(() =>
      window.__nativeCalls.some(
        (call) => call.plugin === "MemoFlowDeviceSettings" && call.method === "openNotifications",
      ),
    );
    await page.getByRole("button", { name: "السماح وإظهار البطاقة", exact: true }).click();
    await page.getByRole("button", { name: "إخفاء البطاقة", exact: true }).waitFor();
    await page.getByRole("button", { name: "إخفاء البطاقة", exact: true }).click();
    await page.getByRole("button", { name: "إظهار البطاقة", exact: true }).waitFor();
    assert.equal(
      await page.getByRole("button", { name: "إضافة إلى الشاشة الرئيسية", exact: true }).count(),
      0,
    );
    await page.screenshot({ path: artifacts + "/settings-android-mobile.png", fullPage: true });
    await page
      .getByRole("navigation", { name: "التنقل الرئيسي" })
      .getByRole("link", { name: "المهام", exact: true })
      .click();
    await page.getByRole("button", { name: "خيارات البحث والتصفية", exact: true }).click();
    await page.getByRole("button", { name: "المكتملة", exact: true }).click();
    await page.keyboard.press("Escape");
    await page.getByRole("list", { name: "بنود شراء المستلزمات", exact: true }).waitFor();
    await page.screenshot({ path: artifacts + "/tasks-android-mobile.png", fullPage: true });
    // This fixture changes a web SSR page into Android on the client. React's
    // expected SSR mismatch is absent from the real Android build (local SPA).
    assert.deepEqual(
      errors.filter(
        (message) => !message.startsWith("Hydration failed because the server rendered HTML"),
      ),
      [],
    );
    console.log(
      "PASS: mocked browser flows — four-tab navigation, readable phone sizes at 320–430px, bundled font, RTL dates, task priority/completion order, creation, simplified settings, and vault security; no page errors.",
    );
  } catch (error) {
    if (page) {
      await page
        .screenshot({ path: artifacts + "/browser-failure.png", fullPage: true })
        .catch(() => {});
      console.error(
        "Browser state",
        await page
          .evaluate(() => ({
            platform: window.Capacitor?.getPlatform?.(),
            hidden: document.hidden,
            visibility: document.visibilityState,
            plugins: Object.keys(window.Capacitor?.Plugins || {}),
            state: window.__nativeState,
            calls: window.__nativeCalls
              ?.map(({ plugin, method }) => ({ plugin, method }))
              .slice(-20),
            messages: [...document.querySelectorAll("[data-sonner-toast]")].map(
              (node) => node.textContent,
            ),
          }))
          .catch(() => ({})),
      );
    }
    throw error;
  } finally {
    await browser?.close();
    server.kill("SIGTERM");
    writeFileSync(resolve(artifacts, "dev-server.log"), logs);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
