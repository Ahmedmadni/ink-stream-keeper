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
    assert.equal(await page.evaluate(() => window.memoFlowDesktop.version), "1.2.8");
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
    assert.deepEqual(errors, []);
    console.log(
      "PASS: packaged Windows desktop — local UI, isolated renderer, external OAuth callback and persisted session, compact filters, category row and sorted checklist previews.",
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
