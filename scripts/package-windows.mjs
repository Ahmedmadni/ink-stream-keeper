import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { readFile } from "node:fs/promises";

const toolsRoot = process.env.MEMOFLOW_DESKTOP_TOOLS;
if (!toolsRoot) throw new Error("MEMOFLOW_DESKTOP_TOOLS must point to the pinned build tools");
const require = createRequire(resolve(toolsRoot, "package.json"));
const { packager } = await import(pathToFileURL(require.resolve("@electron/packager")).href);
const pkg = JSON.parse(await readFile(resolve("electron/package.json"), "utf8"));
await packager({
  dir: resolve("electron"),
  name: "MemoFlow",
  platform: "win32",
  arch: "x64",
  electronVersion: "44.9.0",
  out: resolve("desktop-dist"),
  asar: true,
  extraResource: [resolve("public/IBM-Plex-OFL.txt")],
  overwrite: true,
  appVersion: pkg.version,
  icon: resolve("electron/app.ico"),
  win32metadata: {
    CompanyName: pkg.author.name,
    FileDescription: "MemoFlow",
    LegalCopyright: `Copyright © 2026 ${pkg.author.name}`,
  },
});
console.log(`Packaged MemoFlow ${pkg.version} with developer metadata`);
