const { chromium } = require("playwright");
const { readFileSync, mkdirSync, writeFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { spawn } = require("node:child_process");
const assert = require("node:assert/strict");
const root = resolve(__dirname, "..");
const artifacts = resolve(root, ".qa-results");
mkdirSync(artifacts, { recursive: true });
const baseUrl = "http://127.0.0.1:4174";
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
let serverNote = {
  id: "note-a",
  user_id: user.id,
  title: "عنوان المذكرة",
  content: "<p>النص الأصلي</p>",
  pinned: false,
  favorite: false,
  category_id: null,
  emoji: null,
  archived: false,
  created_at: "2026-10-11T00:00:00Z",
  updated_at: "2026-10-11T00:00:00Z",
};
let revision = 0;
const nextTime = () => new Date(Date.UTC(2026, 9, 11, 0, 0, ++revision)).toISOString();
const patchCalls = [];
let mode = "hold",
  activeUser = user,
  releaseFirst;
const firstResponse = new Promise((resolve) => {
  releaseFirst = resolve;
});
const until = async (predicate) => {
  const deadline = Date.now() + 15000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error("Condition timed out");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
};

(async () => {
  const app = spawn(
    process.execPath,
    [
      resolve(root, "node_modules/vite/bin/vite.js"),
      "dev",
      "--host",
      "127.0.0.1",
      "--port",
      "4174",
      "--strictPort",
    ],
    { cwd: root, stdio: ["ignore", "pipe", "pipe"] },
  );
  let logs = "",
    browser, page;
  app.stdout.on("data", (data) => (logs += data));
  app.stderr.on("data", (data) => (logs += data));
  try {
    const deadline = Date.now() + 30000;
    while (true) {
      try {
        if ((await fetch(baseUrl)).ok) break;
      } catch {}
      if (Date.now() > deadline) throw Error("Dev server did not start");
      await new Promise((resolve) => setTimeout(resolve, 250));
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
      if (parsed.pathname.startsWith("/rest/v1/")) {
        const table = parsed.pathname.split("/").pop();
        if (table === "profiles")
          return route.fulfill({ json: { id: user.id, display_name: "أحمد", theme: "light" } });
        if (table === "notes") {
          if (request.method() === "PATCH") {
            const patch = request.postDataJSON();
            patchCalls.push({ patch, expected: parsed.searchParams.get("updated_at") });
            assert.equal(parsed.searchParams.get("user_id"), `eq.${user.id}`);
            if (mode === "hold" && patchCalls.length === 1) await firstResponse;
            if (mode === "fail") return route.abort("failed");
            if (parsed.searchParams.get("updated_at") !== `eq.${serverNote.updated_at}`)
              return route.fulfill({ json: null });
            serverNote = { ...serverNote, ...patch, updated_at: nextTime() };
            return route.fulfill({
              json: {
                title: serverNote.title,
                content: serverNote.content,
                updated_at: serverNote.updated_at,
              },
            });
          }
          return route.fulfill({ json: parsed.searchParams.has("id") ? serverNote : [serverNote] });
        }
        return route.fulfill({ json: [] });
      }
      return route.abort();
    });
    page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(baseUrl + "/notes/note-a");
    const editor = page.locator('.tiptap[contenteditable="true"]');
    await editor.waitFor();
    await editor.fill("التعديل الأول");
    await until(() => patchCalls.length === 1);
    await editor.fill("التعديل الأحدث أثناء الحفظ");
    await page.getByRole("textbox", { name: "عنوان الملاحظة" }).fill("عنوان أحدث");
    await page.waitForTimeout(900); // More than debounce: there must still be only one in-flight write.
    assert.equal(patchCalls.length, 1);
    mode = "ok";
    releaseFirst();
    await page.getByText("تم الحفظ في الخادم", { exact: true }).waitFor();
    assert.equal(patchCalls.length, 2);
    assert.ok(serverNote.content.includes("التعديل الأحدث أثناء الحفظ"));
    assert.equal(serverNote.title, "عنوان أحدث");
    assert.equal(await editor.innerText(), "التعديل الأحدث أثناء الحفظ");

    mode = "fail";
    await editor.fill("مسودة تستعاد بعد انقطاع الاتصال");
    await page.getByRole("button", { name: "إعادة محاولة الحفظ" }).waitFor();
    await page.reload();
    await editor.waitFor();
    assert.equal(await editor.innerText(), "مسودة تستعاد بعد انقطاع الاتصال");
    await page.getByRole("button", { name: "إعادة محاولة الحفظ" }).waitFor();
    await page.screenshot({ path: resolve(artifacts, "note-local-draft.png"), fullPage: true });
    mode = "ok";
    await page.getByRole("button", { name: "إعادة محاولة الحفظ" }).click();
    await page.getByText("تم الحفظ في الخادم", { exact: true }).waitFor();
    assert.ok(serverNote.content.includes("مسودة تستعاد بعد انقطاع الاتصال"));
    assert.equal(
      await page.evaluate(
        () =>
          Object.keys(localStorage).filter((key) => key.startsWith("memoflow.note-draft.v1:"))
            .length,
      ),
      0,
    );

    serverNote = {
      ...serverNote,
      title: "عنوان من جهاز آخر",
      content: "<p>نسخة جهاز آخر</p>",
      updated_at: nextTime(),
    };
    await editor.fill("نسختي التي لا أريد فقدانها");
    await page.getByRole("heading", { name: "تغيّرت نسخة المذكرة على الخادم" }).waitFor();
    assert.equal(serverNote.content, "<p>نسخة جهاز آخر</p>");
    await page.reload();
    await editor.waitFor();
    await page.getByRole("heading", { name: "تغيّرت نسخة المذكرة على الخادم" }).waitFor();
    assert.equal(await editor.innerText(), "نسختي التي لا أريد فقدانها");
    await page.getByText("عرض نسخة الخادم", { exact: true }).click();
    assert.ok(await page.getByText("نسخة جهاز آخر", { exact: true }).isVisible());
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: resolve(artifacts, "note-conflict.png"), fullPage: true });
    await page.getByRole("button", { name: "استبدال نسخة الخادم بمسودتي" }).click();
    await page.getByText("تم الحفظ في الخادم", { exact: true }).waitFor();
    assert.ok(serverNote.content.includes("نسختي التي لا أريد فقدانها"));

    serverNote = { ...serverNote, pinned: true, updated_at: nextTime() };
    const beforeMetadata = patchCalls.length;
    await page.getByRole("textbox", { name: "عنوان الملاحظة" }).fill("عنوان بعد تحديث التثبيت");
    await page.getByText("تم الحفظ في الخادم", { exact: true }).waitFor();
    assert.equal(patchCalls.length, beforeMetadata + 2);
    assert.equal(serverNote.pinned, true);

    await editor.fill("نص آخر محفوظ");
    await page.getByText("تم الحفظ في الخادم", { exact: true }).waitFor();
    serverNote = { ...serverNote, content: "<p>نسختي التي لا أريد فقدانها</p>", updated_at: nextTime() };
    await editor.fill("تعديل محلي سأختار تجاهله");
    await page.getByRole("heading", { name: "تغيّرت نسخة المذكرة على الخادم" }).waitFor();
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: "استخدام نسخة الخادم" }).click();
    await page.getByText("محفوظة في الخادم", { exact: true }).waitFor();
    assert.equal(await editor.innerText(), "نسختي التي لا أريد فقدانها");
    assert.equal(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith("memoflow.note-draft.v1:")).length), 0);

    // An identity change during the debounce must not write using another account.
    activeUser = { ...user, id: "22222222-2222-4222-8222-222222222222" };
    const beforeIdentity = patchCalls.length;
    await editor.fill("مسودة الحساب الأول فقط");
    await page.getByRole("button", { name: "إعادة محاولة الحفظ" }).waitFor();
    assert.equal(patchCalls.length, beforeIdentity);
    assert.equal(await editor.innerText(), "مسودة الحساب الأول فقط");
    activeUser = user;
    mode = "fail";
    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key.startsWith("memoflow.note-draft.v1:"))
          throw new DOMException("quota", "QuotaExceededError");
        return original.call(this, key, value);
      };
    });
    await editor.fill("نص يبقى ظاهرًا عند امتلاء التخزين");
    await page.getByText(/تعذر حفظ المسودة على هذا الجهاز/).waitFor();
    assert.equal(await editor.innerText(), "نص يبقى ظاهرًا عند امتلاء التخزين");
    page.once("dialog", dialog => dialog.dismiss());
    await page.getByRole("link", { name: "العودة للمذكرات", exact: true }).click();
    assert.equal(new URL(page.url()).pathname, "/notes/note-a");
    assert.equal(await editor.innerText(), "نص يبقى ظاهرًا عند امتلاء التخزين");
    assert.deepEqual(errors, []);
    console.log(
      "PASS: note editor — serialized delayed writes, newer input retained, failed write/reload/retry, conflict/reload/explicit resolution, metadata CAS retry, identity guard, quota warning.",
    );
  } catch (error) {
    if (page) { await page.screenshot({ path: resolve(artifacts, "note-failure.png"), fullPage: true }).catch(() => {}); writeFileSync(resolve(artifacts, "note-failure.html"), await page.content().catch(() => "")); }
    throw error;
  } finally {
    await browser?.close();
    app.kill("SIGTERM");
    writeFileSync(resolve(artifacts, "note-server.log"), logs);
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
