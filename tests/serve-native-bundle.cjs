// Serve exactly the generated local SPA for browser acceptance checks. There is
// no source-module server, SSR or remote hosted UI in this test mode.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../dist/client");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2",
  ".ttf": "font/ttf", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };
http.createServer((req, res) => {
  try {
    const requested = path.resolve(root, "." + decodeURIComponent(new URL(req.url, "http://local").pathname));
    if (requested !== root && !requested.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    let file = requested;
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      if (path.extname(file)) { res.writeHead(404); res.end(); return; }
      file = path.join(root, "index.html");
    }
    res.setHeader("Content-Type", types[path.extname(file)] || "application/octet-stream");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-MemoFlow-Test-Server", process.env.MEMOFLOW_BROWSER_SERVER_TOKEN || "standalone");
    fs.createReadStream(file).pipe(res);
  } catch { res.writeHead(500); res.end(); }
}).listen(4174, "127.0.0.1");
