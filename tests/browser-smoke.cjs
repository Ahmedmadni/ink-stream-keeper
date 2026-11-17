const { chromium } = require("playwright");
const { readFileSync, mkdirSync, writeFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { spawn } = require("node:child_process");
const assert = require("node:assert/strict");
const root = resolve(__dirname, "..");
const artifacts = resolve(root, ".qa-results");
mkdirSync(artifacts, { recursive: true });
const nativeBundle = process.env.MEMOFLOW_BROWSER_NATIVE_BUNDLE === "1";
const baseUrl = "http://127.0.0.1:" + (nativeBundle ? 4174 : 4173);
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
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
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
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
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
    parent_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
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
    parent_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
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
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
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
let allowNoteCopy = false;
let failVaultPinWrite = false;
const vaultPinWrites = [];

(async () => {
  const serverToken = require("node:crypto").randomUUID();
  const server = spawn(
    process.execPath,
    process.env.MEMOFLOW_BROWSER_NATIVE_BUNDLE === "1" ? [resolve(root, "tests/serve-native-bundle.cjs")] : [
      resolve(root, "node_modules/vite/bin/vite.js"),
      "dev",
      "--host",
      "127.0.0.1",
      "--port",
      "4173",
      "--strictPort",
    ],
    { cwd: root, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, MEMOFLOW_BROWSER_SERVER_TOKEN: serverToken } },
  );
  let logs = "";
  server.stdout.on("data", (chunk) => (logs += chunk));
  server.stderr.on("data", (chunk) => (logs += chunk));
  let browser, page;
  try {
    const deadline = Date.now() + 30000;
    while (true) {
      if (server.exitCode !== null) throw Error("Acceptance server exited: " + logs);
      try {
        const response = await fetch(baseUrl);
        if (response.ok && (!nativeBundle || response.headers.get("X-MemoFlow-Test-Server") === serverToken)) break;
      } catch {}
      if (Date.now() > deadline) throw Error("Dev server did not start");
      await new Promise((r) => setTimeout(r, 250));
    }
    if (nativeBundle) console.log("Verified generated native SPA server identity on port 4174.");
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
      acceptDownloads: true,
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
      if (u.origin === baseUrl) return route.continue();
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
        if (table === "notes") {
          if (req.method() === "PATCH") {
            const patch = req.postDataJSON();
            if (u.searchParams.get("updated_at") !== "eq." + notes[0].updated_at)
              return route.fulfill({ json: null });
            Object.assign(notes[0], patch, {
              updated_at: new Date(Date.parse(notes[0].updated_at) + 1000).toISOString(),
            });
            result = { title: notes[0].title, content: notes[0].content, updated_at: notes[0].updated_at };
          } else result = u.searchParams.has("id") ? notes[0] : notes;
        }
        if (table === "categories") result = categories;
        if (table === "tasks") {
          if (req.method() === "PATCH") {
            const p = req.postDataJSON();
            const id = u.searchParams.get("id")?.replace("eq.", "");
            const index = tasks.findIndex((task) => task.id === id);
            assert.notEqual(index, -1);
            tasks[index] = { ...tasks[index], ...p };
            if (id === "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa") {
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
        if (table === "vault_settings") {
          if (req.method() === "PATCH") {
            const patch = req.postDataJSON();
            assert.deepEqual(Object.keys(patch).sort(), ["kdf_salt", "verifier_ct", "verifier_iv"]);
            assert.equal(u.searchParams.get("user_id"), "eq." + user.id);
            assert.equal(u.searchParams.get("kdf_salt"), "eq." + vaultSettings.kdf_salt);
            assert.equal(u.searchParams.get("verifier_iv"), "eq." + vaultSettings.verifier_iv);
            assert.equal(u.searchParams.get("verifier_ct"), "eq." + vaultSettings.verifier_ct);
            if (failVaultPinWrite) {
              failVaultPinWrite = false;
              return route.fulfill({ status: 500, json: { message: "Fixture PIN write failure" } });
            }
            Object.assign(vaultSettings, patch);
            vaultPinWrites.push(patch);
            result = { user_id: user.id };
          } else result = vaultSettings;
        }
        if (table === "vault_entries") {
          if (req.method() === "POST") {
            if (!allowNoteCopy)
              return route.fulfill({ status: 500, json: { message: "Fixture write failure" } });
            allowNoteCopy = false;
            const row = req.postDataJSON();
            assert.equal(row.user_id, user.id);
            assert.ok(!row.notes.includes("data-mf-notebook-v1"));
            assert.ok(!row.notes.includes("أفكار الأسبوع"));
            vaultEntries.push({
              ...row, id: row.id || "77777777-7777-4777-8777-777777777777",
              created_at: "2026-11-15T04:00:00.000Z",
              updated_at: "2026-11-15T04:00:00.000Z",
            });
            return route.fulfill({ status: 201, json: [] });
          }
          result = vaultEntries;
        }
        return route.fulfill({ json: result });
      }
      return route.abort();
    });
    page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${baseUrl}/notes`);
    await page.getByText("أفكار الأسبوع", { exact: true }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    assert.equal(
      await page.getByRole("navigation", { name: "التنقل الرئيسي" }).getByRole("link").count(),
      5,
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
    // A previously verified tab can navigate among cached lists while offline.
    await page
      .getByRole("navigation", { name: "التنقل الرئيسي" })
      .getByRole("link", { name: "المذكرات" })
      .click();
    await page.getByText("أفكار الأسبوع", { exact: true }).waitFor();
    await context.setOffline(true);
    assert.equal(await page.evaluate(() => navigator.onLine), false);
    await page
      .getByRole("navigation", { name: "التنقل الرئيسي" })
      .getByRole("link", { name: "المهام" })
      .click();
    await page.getByText("مراجعة الحسابات", { exact: true }).waitFor();
    await page.getByText("وضع دون اتصال:", { exact: false }).waitFor();
    await context.setOffline(false);
    await page.getByText("وضع دون اتصال:", { exact: false }).waitFor({ state: "hidden" });
    assert.equal(await page.getByRole("button", { name: "المكتملة", exact: true }).count(), 0);
    const filterButton = page.getByRole("button", { name: "خيارات البحث والتصفية", exact: true });
    await filterButton.click();
    await page.getByRole("combobox", { name: "أولوية المهام" }).selectOption("high");
    assert.equal(await page.getByText("شراء المستلزمات", { exact: true }).count(), 0);
    await page.getByRole("dialog", { name: "تصفية المهام", exact: true }).evaluate(async (node) => {
      await Promise.all(
        node.getAnimations().map((animation) => animation.finished.catch(() => {})),
      );
    });
    await page.screenshot({ path: artifacts + "/task-search-filters-mobile.png", fullPage: true });
    await page.getByRole("button", { name: "إعادة ضبط", exact: true }).click();
    await page.keyboard.press("Escape");
    await page
      .getByRole("dialog", { name: "تصفية المهام", exact: true })
      .waitFor({ state: "hidden" });
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
    await page
      .getByRole("dialog", { name: "تصفية المهام", exact: true })
      .waitFor({ state: "hidden" });
    await page.getByRole("checkbox", { name: "إلغاء إنجاز مراجعة الحسابات" }).waitFor();
    assert.ok(patchSeen);
    await filterButton.click();
    await page.getByRole("button", { name: "غير المكتملة", exact: true }).click();
    await page.keyboard.press("Escape");
    await page
      .getByRole("dialog", { name: "تصفية المهام", exact: true })
      .waitFor({ state: "hidden" });
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
    // Encrypted offline archive: actual IndexedDB ciphertext, wrong password,
    // reload persistence, account-bound content, and read-only access offline.
    const archivePassword = "safe encrypted offline phrase 2026!";
    await page.getByRole("heading", { name: "أرشيف محلي اختياري" }).waitFor();
    await page.getByLabel("كلمة مرور النسخة (12 حرفًا على الأقل)").fill(archivePassword);
    await page.getByLabel("تأكيد كلمة المرور").fill(archivePassword);
    await page.getByRole("button", { name: "حفظ نسخة مشفّرة للقراءة دون إنترنت" }).click();
    await page.getByText("حُفظت نسخة مشفّرة تضم", { exact: false }).waitFor({ timeout: 25000 });
    const locallyStored = await page.evaluate(() => new Promise((resolve, reject) => {
      const request = indexedDB.open("memoflow-encrypted-offline-archive");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction("snapshots", "readonly");
        const get = transaction.objectStore("snapshots").get("11111111-1111-4111-8111-111111111111");
        get.onsuccess = () => resolve(get.result?.encrypted ?? "");
        get.onerror = () => reject(get.error);
        transaction.oncomplete = () => db.close();
      };
    }));
    assert.ok(locallyStored.includes("memoflow-offline-snapshot"));
    assert.ok(!locallyStored.includes("أفكار الأسبوع"));
    assert.ok(!locallyStored.includes("مراجعة الحسابات"));
    await page.getByRole("link", { name: "فتح الأرشيف المشفّر" }).click();
    await page.getByRole("heading", { name: "الأرشيف المحلي المشفّر" }).waitFor();
    await page.reload();
    const passwordField = page.getByLabel("كلمة مرور النسخة المحلية");
    await passwordField.fill("wrong offline password 2026");
    await page.getByRole("button", { name: "فتح النسخة المشفّرة" }).click();
    await page.getByText("كلمة مرور النسخة غير صحيحة أو محتواها تالف.").waitFor({ timeout: 20000 });
    await context.setOffline(true);
    await passwordField.fill(archivePassword);
    await page.getByRole("button", { name: "فتح النسخة المشفّرة" }).click();
    await page.getByRole("button", { name: /أفكار الأسبوع/ }).click();
    await page.locator("article").getByText("مساحة هادئة لأفكاري الجديدة", { exact: true }).waitFor({ timeout: 20000 });
    await page.getByRole("button", { name: "المهام (2)" }).click();
    await page.getByRole("button", { name: /مراجعة الحسابات/ }).click();
    await page.getByRole("heading", { name: "مراجعة الحسابات" }).waitFor();
    assert.equal(await page.getByRole("button", { name: "حفظ التعديل" }).count(), 0);
    await context.setOffline(false);
    await page.goto(baseUrl + "/settings");
    await page.getByRole("switch", { name: "الوضع الداكن" }).waitFor();

    // Legacy draft rescue: inspect ciphertext, protect only unchanged revisions,
    // reject wrong passwords and restore exact bytes after a full reload.
    const rescuePassword = "Safe legacy notes rescue 2026!";
    const rescueKey = "memoflow.note-draft.v1:" + user.id +
      ":33333333-3333-4333-8333-333333333333:synthetic-tab:44444444-4444-4444-8444-444444444444";
    const rescueRaw = JSON.stringify({
      version: 1, userId: user.id, noteId: "33333333-3333-4333-8333-333333333333",
      revision: "44444444-4444-4444-8444-444444444444",
      savedAt: Date.now(),
      draft: { title: "مسودة إنقاذ", content: "<p>محتوى سري لم يُرفع للخادم</p>" },
      base: { title: "مسودة", content: "<p>قديم</p>", updated_at: "2026-11-12T10:00:00.000Z" },
    });
    await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), {
      key: rescueKey, raw: rescueRaw,
    });
    await page.reload();
    await page.getByText("المسودات القديمة على الجهاز: 1", { exact: false }).waitFor();
    await page.getByLabel("كلمة مرور إنقاذ المسودات").fill(rescuePassword);
    await page.getByLabel("تأكيد كلمة مرور المسودات").fill(rescuePassword);
    await page.getByRole("button", { name: "تشفير المسودات القديمة" }).click();
    await page.getByText("تم تأمين 1 مسودة قديمة", { exact: false }).waitFor({ timeout: 25000 });
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), rescueKey), null);
    const archivedDraft = await page.evaluate((accountId) => new Promise((resolve, reject) => {
      const request = indexedDB.open("memoflow-encrypted-draft-rescue");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("rescue", "readonly");
        const get = tx.objectStore("rescue").get(accountId);
        get.onsuccess = () => resolve(get.result?.encrypted ?? "");
        get.onerror = () => reject(get.error);
        tx.oncomplete = () => db.close();
      };
    }), user.id);
    assert.ok(archivedDraft.includes("memoflow-draft-rescue"));
    assert.ok(!archivedDraft.includes("محتوى سري"));
    assert.ok(!archivedDraft.includes("مسودة إنقاذ"));
    await page.reload();
    await page.getByRole("button", { name: "استعادة المسودات المشفّرة" }).waitFor();
    await page.getByLabel("كلمة مرور إنقاذ المسودات").fill("Wrong rescue password 2026");
    await page.getByRole("button", { name: "استعادة المسودات المشفّرة" }).click();
    await page.getByText("كلمة المرور خاطئة أو بيانات المسودات تالفة.").waitFor({ timeout: 25000 });
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), rescueKey), null);
    // A distinct local edit must not be silently overwritten by a rescue restore.
    const conflictingDraft = rescueRaw.replace("محتوى سري لم يُرفع للخادم", "تعديل أحدث محفوظ على الجهاز");
    await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), {
      key: rescueKey, raw: conflictingDraft,
    });
    await page.getByLabel("كلمة مرور إنقاذ المسودات").fill(rescuePassword);
    await page.getByRole("button", { name: "استعادة المسودات المشفّرة" }).click();
    await page.getByText("توجد مسودة أحدث بالمفتاح نفسه؛ لم نستبدل أي بيانات.").waitFor({ timeout: 25000 });
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), rescueKey), conflictingDraft);
    await page.evaluate((key) => localStorage.removeItem(key), rescueKey);
    await page.getByLabel("كلمة مرور إنقاذ المسودات").fill(rescuePassword);
    await page.getByRole("button", { name: "استعادة المسودات المشفّرة" }).click();
    await page.getByText("استُعيدت 1 مسودة", { exact: false }).waitFor({ timeout: 25000 });
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), rescueKey), rescueRaw);
    // This is synthetic fixture data, not a real user draft.
    await page.evaluate((key) => localStorage.removeItem(key), rescueKey);

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
    await page.goto(`${baseUrl}/notes`);
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
    // Notebook Studio: paper, pen, licensed accounting stickers, PDF and reload.
    await page.getByRole("button", { name: "إنشاء دفتر بالصفحات" }).click();
    await page.getByRole("tab", { name: "ورق", exact: true }).click();
    for (const [label, value] of [["سادة", "plain"], ["مسطرة", "lined"], ["منقّطة", "dots"], ["كورنيل", "cornell"], ["جدول محاسبي", "ledger"]]) {
      await page.getByRole("button", { name: label, exact: true }).click();
      assert.equal(await page.locator("[data-notebook-paper]").getAttribute("data-notebook-paper"), value);
    }
    await page.getByRole("button", { name: "مربعات", exact: true }).click();
    await page.getByRole("tab", { name: "ملصقات", exact: true }).click();
    await page.getByRole("button", { name: "محاسبة وأعمال", exact: true }).click();
    await page.getByRole("button", { name: "إضافة ملصق آلة حاسبة" }).click();
    await page.getByRole("tab", { name: "أقلام", exact: true }).click();
    const drawing = page.getByRole("img", { name: "مساحة الرسم بالقلم" });
    await drawing.waitFor();
    await drawing.scrollIntoViewIfNeeded();
    const bounds = await drawing.boundingBox();
    assert.ok(bounds);
    await page.mouse.move(bounds.x + bounds.width * .42, bounds.y + bounds.height * .57);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width * .47, bounds.y + bounds.height * .61, { steps: 8 });
    await page.mouse.up();
    await require("./notebook-browser-checks.cjs").checkInk(page);
    const partialInk = await require("./notebook-browser-checks.cjs").checkSegmentEraser(page, artifacts);
    const editedInk = await require("./notebook-browser-checks.cjs").checkInkEditing(page, artifacts, partialInk);
    await require("./notebook-browser-checks.cjs").checkStudy(page, artifacts);
    await page.getByRole("button", { name: "إضافة صفحة", exact: true }).click();
    await page.getByRole("tab", { name: "صفحة 2", exact: true }).waitFor();
    const secondPageEditor = page.locator("[data-notebook-paper] .ProseMirror");
    await secondPageEditor.fill("نص زائد ".repeat(2000));
    await page.getByRole("status").filter({ hasText: "النص يتجاوز مساحة هذه الورقة" }).waitFor();
    await secondPageEditor.fill("");
    await page.getByRole("status").filter({ hasText: "النص يتجاوز مساحة هذه الورقة" }).waitFor({ state: "hidden" });
    assert.equal(await page.getByRole("tab", { name: /^صفحة [12]$/ }).count(), 2);
    await page.getByRole("button", { name: "تكرار الصفحة", exact: true }).click();
    await page.getByRole("tab", { name: "صفحة 3", exact: true }).waitFor();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "حذف الصفحة", exact: true }).click();
    assert.equal(await page.getByRole("tab", { name: /^صفحة [123]$/ }).count(), 2);
    await page.getByRole("tab", { name: "صفحة 1", exact: true }).click();
    const downloadPending = page.waitForEvent("download", { timeout: 25000 });
    await page.getByRole("button", { name: "تصدير صفحات الدفتر PDF" }).click();
    const pdf = await downloadPending;
    const pdfBytes = readFileSync(await pdf.path());
    assert.equal(pdfBytes.subarray(0, 8).toString("utf8"), "%PDF-1.4");
    assert.ok(pdfBytes.includes(Buffer.from("/Count 2")));
    if (process.env.MEMOFLOW_BROWSER_NATIVE_BUNDLE !== "1")
      await require("./notebook-browser-checks.cjs").checkPdf(page, artifacts);
    const notebookDeadline = Date.now() + 20000;
    while (!notes[0].content.includes("data-mf-notebook-v1")) {
      if (Date.now() > notebookDeadline) throw Error("Notebook was not saved remotely");
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    await page.reload();
    await page.getByRole("tab", { name: "صفحة 2", exact: true }).waitFor();
    await page.getByRole("tab", { name: "صفحة 1", exact: true }).click();
    await page.getByRole("tab", { name: "ملصقات", exact: true }).click();
    assert.equal(await page.locator(`[data-notebook-paper] [data-stroke-id="${editedInk.id}"]`).getAttribute("d"), editedInk.path,
      "split, moved and edited fragments survive autosave and reload");
    assert.equal(await page.locator(`[data-notebook-paper] [data-stroke-id="${editedInk.sibling.id}"]`).getAttribute("d"), editedInk.sibling.d);
    assert.equal(await page.locator(`[data-notebook-paper] [data-stroke-id="${editedInk.sourceId}"]`).count(), 0);
    const retainedBook = JSON.parse(Buffer.from(notes[0].content.match(/data-json="([^"]+)"/)[1], "base64").toString("utf8"));
    const retained = retainedBook.pages[0].strokes.find((s) => s.id === editedInk.id);
    const sibling = retainedBook.pages[0].strokes.find((s) => s.id === editedInk.sibling.id);
    assert.equal(retained.controlPoints.length, editedInk.pointCount);
    assert.equal(retained.controlKnots.length, editedInk.pointCount);
    assert.deepEqual(retained.points, sibling.points, "topology changes preserve the original captured points");
    assert.deepEqual(retained.pressures, sibling.pressures);
    assert.deepEqual(retained.times, sibling.times);
    assert.equal(retained.controlPoints.length, retained.points.length + 1);
    assert.equal(await page.getByRole("button", { name: "ملصق calculator" }).count(), 1);
    const paperInk = await page.locator("[data-notebook-paper] .prose-mf").evaluate((element) => getComputedStyle(element).color);
    assert.equal(paperInk, "rgb(23, 38, 59)", "paper must have dark legible ink even in dark app theme");
    await page.screenshot({ path: artifacts + "/notebook-studio-tablet.png", fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page
      .getByRole("navigation", { name: "التنقل الرئيسي" })
      .getByRole("link", { name: "الخزنة" })
      .click();
    await page.getByRole("heading", { name: "فتح الخزنة", exact: true }).waitFor();
    const keyboardPin = page.getByLabel("رمز الخزنة", { exact: true });
    assert.equal(await keyboardPin.getAttribute("type"), "password");
    assert.equal(await keyboardPin.getAttribute("inputmode"), "numeric");
    await keyboardPin.pressSequentially("12a3");
    assert.equal(await keyboardPin.inputValue(), "123");
    await keyboardPin.press("Backspace");
    assert.equal(await keyboardPin.inputValue(), "12");
    await keyboardPin.fill("111111");
    await page
      .getByText("رمز الخزنة غير صحيح أو بيانات التشفير غير صالحة", { exact: true })
      .waitFor();
    await keyboardPin.fill("١٢٣٤٥٦");
    await page.getByText("حساب تجريبي", { exact: true }).waitFor();
    await page.getByRole("button", { name: "عرض", exact: true }).click();
    await page.getByText("Fixture-Password-Only", { exact: true }).waitFor();
    await page.getByRole("button", { name: "قفل", exact: true }).click();
    await page.getByRole("heading", { name: "فتح الخزنة", exact: true }).waitFor();
    assert.equal(await page.getByText("Fixture-Password-Only", { exact: true }).count(), 0);
    for (const digit of "123456")
      await page.getByRole("button", { name: digit, exact: true }).click();
    await page.getByText("حساب تجريبي", { exact: true }).waitFor();
    // Copy the paged note to the encrypted vault; the normal note is preserved.
    // Use in-app navigation: a full browser reload intentionally locks the
    // ephemeral vault key, which must never be persisted to storage.
    await page.getByRole("navigation", { name: "التنقل الرئيسي" })
      .getByRole("link", { name: "المذكرات" }).click();
    await page.getByRole("link", { name: /أفكار الأسبوع/ }).click();
    await page.getByRole("button", { name: "نسخ المذكرة إلى الخزنة" }).waitFor();
    allowNoteCopy = true;
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "نسخ المذكرة إلى الخزنة" }).click();
    await page.getByText("حُفظت نسخة مشفّرة في الخزنة.", { exact: false }).waitFor();
    assert.ok(notes[0].content.includes("data-mf-notebook-v1"));
    await page.getByRole("navigation", { name: "التنقل الرئيسي" })
      .getByRole("link", { name: "الخزنة" }).click();
    await page.getByRole("button", { name: "عرض المذكرة المحمية" }).click();
    await page.getByRole("tab", { name: "صفحة 2", exact: true }).waitFor();
    await page.getByRole("tab", { name: "صفحة 1", exact: true }).click();
    await page.getByText("مساحة هادئة لأفكاري الجديدة", { exact: false }).waitFor();
    assert.equal(await page.locator(`[data-notebook-paper] [data-stroke-id="${editedInk.id}"]`).getAttribute("d"), editedInk.path,
      "authenticated vault copy renders the same edited topology after encryption and decryption");
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
    await page.goto(`${baseUrl}/settings`);
    await page.getByRole("heading", { name: "الأمان والرموز السرية", exact: true }).waitFor();
    await page.getByRole("button", { name: "تغيير رمز الخزنة", exact: true }).click();
    const pinForm = page.getByRole("form", { name: "تغيير رمز الخزنة", exact: true });
    const fillVaultPin = async (current, next, repeat = next) => {
      await pinForm.getByLabel("رمز الخزنة الحالي", { exact: true }).fill(current);
      await pinForm.getByLabel("رمز الخزنة الجديد", { exact: true }).fill(next);
      await pinForm.getByLabel("تأكيد رمز الخزنة الجديد", { exact: true }).fill(repeat);
    };
    const originalVaultSettings = { ...vaultSettings };
    const originalVaultEntries = JSON.stringify(vaultEntries);
    await fillVaultPin("123456", "654321", "654322");
    assert.equal(
      await pinForm
        .getByRole("button", { name: "حفظ رمز الخزنة الجديد", exact: true })
        .isDisabled(),
      true,
    );
    await fillVaultPin("111111", "654321");
    await pinForm.getByRole("button", { name: "حفظ رمز الخزنة الجديد", exact: true }).click();
    await pinForm.getByRole("alert").waitFor();
    assert.equal(vaultPinWrites.length, 0);
    await fillVaultPin("123456", "654321");
    failVaultPinWrite = true;
    await pinForm.getByRole("button", { name: "حفظ رمز الخزنة الجديد", exact: true }).click();
    await pinForm.getByRole("alert").waitFor();
    assert.deepEqual(vaultSettings, originalVaultSettings);
    await fillVaultPin("123456", "654321");
    await pinForm.getByRole("button", { name: "حفظ رمز الخزنة الجديد", exact: true }).click();
    await pinForm.getByText("تم تغيير رمز الخزنة بنجاح.", { exact: true }).waitFor();
    assert.equal(vaultPinWrites.length, 1);
    assert.equal(JSON.stringify(vaultEntries), originalVaultEntries);
    for (const input of await pinForm.locator("input").all())
      assert.equal(await input.inputValue(), "");
    await page.screenshot({ path: artifacts + "/vault-pin-settings-mobile.png", fullPage: true });
    await page.goto(`${baseUrl}/vault`);
    await page.getByRole("heading", { name: "فتح الخزنة", exact: true }).waitFor();
    for (const digit of "123456")
      await page.getByRole("button", { name: digit, exact: true }).click();
    await page
      .getByText("رمز الخزنة غير صحيح أو بيانات التشفير غير صالحة", { exact: true })
      .waitFor();
    await page.getByLabel("رمز الخزنة", { exact: true }).fill("۶۵۴۳۲۱");
    await page.getByText("حساب تجريبي", { exact: true }).waitFor();
    await page.getByRole("button", { name: "عرض", exact: true }).click();
    await page.getByText("Fixture-Password-Only", { exact: true }).waitFor();
    await page.reload();
    await page.getByRole("heading", { name: "فتح الخزنة", exact: true }).waitFor();
    for (const digit of "654321")
      await page.getByRole("button", { name: digit, exact: true }).click();
    await page.getByText("حساب تجريبي", { exact: true }).waitFor();
    assert.deepEqual(errors, []);
    // Exercise the installed-Android UI using a deterministic Capacitor bridge.
    // System permission screens themselves still require a real-device check.
    await context.addInitScript(() => {
      window.androidBridge = {};
      window.__nativeCalls = [];
      window.__nativeState = { display: "prompt", exact: false, overlay: false, floating: false };
      const plugins = {
        MemoFlowAppLock: ["getStatus", "lock", "unlock", "configure", "changePin"],
        MemoFlowAuth: ["getLaunchUrl", "addListener", "removeListener"],
        MemoFlowBackup: ["getStatus"],
        MemoFlowHandwriting: ["getStatus", "downloadModel", "deleteModel", "recognize", "cancel"],
        Filesystem: ["rmdir", "writeFile"],
        Share: ["canShare", "share"],
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
          if (plugin === "MemoFlowHandwriting") {
            if (method === "getStatus") return { supported: true, ready: state.inkReady || false, experimental: true, language: "ar" };
            if (method === "downloadModel") { state.inkReady = true; return {}; }
            if (method === "deleteModel") { state.inkReady = false; return {}; }
            if (method === "recognize") {
              if (state.holdInk) return new Promise((resolve) => { state.finishInk = resolve; });
              return { candidates: ["قيد محاسبي ١٥٠٠ ريال", "قيد محاسبي 1500 ريال"], language: "ar" };
            }
            if (method === "cancel" && state.finishInk) { state.finishInk({ candidates: ["نتيجة متأخرة"], language: "ar" }); state.finishInk = null; }
            return {};
          }
          if (plugin === "Share" && method === "canShare") return { value: true };
          if (plugin === "Filesystem" && method === "writeFile") return { uri: "content://fixture/notebook.pdf" };
          if (plugin === "MemoFlowAppLock" && method === "changePin") {
            if (options.currentPin !== (state.appPin ?? "123456"))
              throw new Error("رمز التطبيق الحالي غير صحيح");
            state.appPin = options.newPin;
            return {};
          }
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
    await page.getByRole("button", { name: "تغيير رمز التطبيق", exact: true }).click();
    const appPinForm = page.getByRole("form", { name: "تغيير رمز التطبيق", exact: true });
    await appPinForm.getByLabel("رمز التطبيق الحالي", { exact: true }).fill("123456");
    await appPinForm.getByLabel("رمز التطبيق الجديد", { exact: true }).fill("246810");
    await appPinForm.getByLabel("تأكيد رمز التطبيق الجديد", { exact: true }).fill("246810");
    await appPinForm.getByRole("button", { name: "حفظ رمز التطبيق الجديد", exact: true }).click();
    await appPinForm.getByText("تم تغيير رمز التطبيق بنجاح.", { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.__nativeState.appPin), "246810");
    assert.equal(
      await appPinForm.getByLabel("رمز التطبيق الحالي", { exact: true }).inputValue(),
      "",
    );
    await page.getByRole("button", { name: "تغيير رمز التطبيق", exact: true }).click();
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
    await page
      .getByRole("dialog", { name: "تصفية المهام", exact: true })
      .waitFor({ state: "hidden" });
    await page.screenshot({ path: artifacts + "/tasks-android-mobile.png", fullPage: true });
    await page.goto(`${baseUrl}/vault`);
    await page.getByLabel("رمز الخزنة", { exact: true }).fill("654321");
    await page.getByText("حساب تجريبي", { exact: true }).waitFor();
    await page.goto(`${baseUrl}/notes/` + notes[0].id);
    await page.getByRole("button", { name: "تصدير صفحات الدفتر PDF", exact: true }).click();
    await page.waitForFunction(() => window.__nativeCalls.some((c) => c.plugin === "Share" && c.method === "share"));
    const pdfDelivery = await page.evaluate(() => ({
      file: window.__nativeCalls.find((c) => c.plugin === "Filesystem" && c.method === "writeFile").options,
      share: window.__nativeCalls.find((c) => c.plugin === "Share" && c.method === "share").options,
    }));
    assert.equal(Buffer.from(pdfDelivery.file.data, "base64").subarray(0, 8).toString(), "%PDF-1.4");
    assert.equal(pdfDelivery.file.encoding, undefined, "binary PDF must not be written as UTF-8 text");
    assert.deepEqual(pdfDelivery.share.files, ["content://fixture/notebook.pdf"]);
    assert.ok(!pdfDelivery.share.text.includes("مشفّرة"), "an ordinary exported PDF must not be described as encrypted");
    await page.getByRole("tab", { name: "أقلام", exact: true }).click();
    const originalStrokes = await page.locator("[data-notebook-paper] [data-stroke-id]").count();
    await page.getByRole("button", { name: "تحسين الخط والتعرف العربي", exact: true }).click();
    const handwritingDialog = page.getByRole("dialog");
    await handwritingDialog.getByRole("button", { name: "تنزيل نموذج العربية", exact: true }).click();
    await handwritingDialog.getByRole("button", { name: "اقتراح نص من الحبر", exact: true }).click();
    await handwritingDialog.getByLabel("النص المقترح للكتابة", { exact: true }).fill("قيد محاسبي ١٥٠٠ ريال بعد المراجعة");
    await handwritingDialog.getByRole("button", { name: "حفظ صفحة بالنص المنسق", exact: true }).click();
    await page.getByRole("tab", { name: "صفحة 3", exact: true }).waitFor();
    await page.locator("[data-notebook-paper] .ProseMirror").getByText("قيد محاسبي ١٥٠٠ ريال بعد المراجعة", { exact: true }).waitFor();
    assert.ok(await page.locator("[data-notebook-paper] .ProseMirror span").evaluate((e) => getComputedStyle(e).fontFamily.includes("Aref Ruqaa")));
    await page.screenshot({ path: artifacts + "/handwriting-reviewed-native.png", fullPage: true });
    await page.getByRole("tab", { name: "صفحة 1", exact: true }).click();
    assert.equal(await page.locator("[data-notebook-paper] [data-stroke-id]").count(), originalStrokes, "reviewed text must preserve original ink");
    await page.getByRole("tab", { name: "أقلام", exact: true }).click();
    await page.getByRole("button", { name: "تحسين الخط والتعرف العربي", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "إزالة نموذج العربية من الجهاز", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "تنزيل نموذج العربية", exact: true }).click();
    await page.evaluate(() => { window.__nativeState.holdInk = true; });
    await page.getByRole("dialog").getByRole("button", { name: "اقتراح نص من الحبر", exact: true }).click();
    await page.getByRole("button", { name: "إغلاق التعرف على الخط", exact: true }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.equal(await page.getByRole("tab", { name: /^صفحة [123]$/ }).count(), 3, "late recognition output cannot add a page after cancellation");
    await page.screenshot({ path: artifacts + "/handwriting-ink-preserved-native.png", fullPage: true });

    // This fixture changes a web SSR page into Android on the client. React's
    // expected SSR mismatch is absent from the real Android build (local SPA).
    assert.deepEqual(
      errors.filter(
        (message) => !message.startsWith("Hydration failed because the server rendered HTML"),
      ),
      [],
    );
    console.log(
      "PASS: mocked browser flows — navigation, readable sizes, bundled font, RTL dates, task order, settings, vault PIN change/wrong PIN/write failure/reload/data preservation, native app PIN change and vault security; no page errors.",
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
