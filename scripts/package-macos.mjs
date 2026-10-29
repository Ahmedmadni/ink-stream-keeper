import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { readFile } from "node:fs/promises";

const toolsRoot = process.env.MEMOFLOW_DESKTOP_TOOLS;
if (!toolsRoot) throw new Error("MEMOFLOW_DESKTOP_TOOLS must point to the pinned build tools");
const arch = process.env.MEMOFLOW_MAC_ARCH;
if (arch !== "arm64" && arch !== "x64") throw new Error("MEMOFLOW_MAC_ARCH must be arm64 or x64");
const require = createRequire(resolve(toolsRoot, "package.json"));
const { packager } = await import(pathToFileURL(require.resolve("@electron/packager")).href);
const pkg = JSON.parse(await readFile(resolve("electron/package.json"), "utf8"));

await packager({
  dir: resolve("electron"),
  name: "MemoFlow",
  platform: "darwin",
  arch,
  electronVersion: "44.9.0",
  out: resolve("desktop-dist"),
  asar: true,
  extraResource: [resolve("public/IBM-Plex-OFL.txt")],
  overwrite: true,
  appVersion: pkg.version,
  appBundleId: "com.ahmedmadni.memoflow",
  extendInfo: resolve("electron/Info.plist"),
  protocols: [
    { name: "MemoFlow authentication", schemes: ["lovable"] },
    {
      name: "MemoFlow recovery",
      schemes: ["app.lovable.c357f296dbad4d33991e76d86c92e6d0"],
    },
  ],
});
console.log(`Packaged MemoFlow ${pkg.version} for macOS ${arch} (unsigned)`);