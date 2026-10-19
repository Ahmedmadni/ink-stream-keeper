import { spawn } from "node:child_process";
import { resolve } from "node:path";

const base = "http://127.0.0.1:4174";
const child = spawn(process.execPath, [resolve(".output/server/index.mjs")], {
  env: { ...process.env, PORT: "4174", HOST: "127.0.0.1" },
  stdio: ["ignore", "pipe", "pipe"],
});
let logs = "";
child.stdout.on("data", (part) => {
  logs += part;
});
child.stderr.on("data", (part) => {
  logs += part;
});
try {
  const deadline = Date.now() + 30000;
  let response;
  while (Date.now() < deadline) {
    try {
      response = await fetch(`${base}/auth`);
      if (response.ok) break;
    } catch {
      /* starting */
    }
    await new Promise((done) => setTimeout(done, 200));
  }
  if (!response?.ok) throw new Error(`Web release did not start: ${logs.slice(-2000)}`);
  const html = await response.text();
  const css = html.match(/href="(\/assets\/[^"<>]+\.css)"/);
  if (!html.includes("MemoFlow") || !css)
    throw new Error("Web release rendered no application assets");
  const asset = await fetch(new URL(css[1], base));
  if (!asset.ok || !(await asset.text()).includes("IBM Plex Sans Arabic"))
    throw new Error("Bundled web stylesheet or font is missing");
  console.log("Verified runnable Node web release and bundled Arabic stylesheet");
} finally {
  child.kill("SIGTERM");
}
