import { copyFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const publicDir = resolve("dist/client");
const shellPath = resolve(publicDir, "_shell.html");
const indexPath = resolve(publicDir, "index.html");

let shell;
let sourcePath = shellPath;
try {
  shell = await readFile(shellPath, "utf8");
} catch (error) {
  if (error?.code !== "ENOENT") throw error;

  // Current TanStack Start builds may prerender the SPA document directly
  // as index.html instead of emitting the older _shell.html filename.
  sourcePath = indexPath;
  shell = await readFile(indexPath, "utf8");
}

const hasModuleEntry = /<script\\b[^>]*type=["']module["']/i.test(shell);
const hasAssetReferences = /(?:\\.\\/)?assets\\//.test(shell);
if (!hasModuleEntry || !hasAssetReferences) {
  throw new Error(
    `TanStack Start did not emit a runnable native SPA document at ${sourcePath}`,
  );
}

if (sourcePath !== indexPath) {
  await copyFile(sourcePath, indexPath);
}
console.log(`Prepared bundled Android UI at ${indexPath}`);
