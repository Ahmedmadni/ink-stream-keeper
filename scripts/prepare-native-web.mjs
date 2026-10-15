import { copyFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const publicDir = resolve(".output/public");
const shellPath = resolve(publicDir, "_shell.html");
const indexPath = resolve(publicDir, "index.html");

const shell = await readFile(shellPath, "utf8");

if (!shell.includes('<script type="module"') || !shell.includes("/assets/")) {
  throw new Error("TanStack Start did not emit a runnable native SPA shell");
}

await copyFile(shellPath, indexPath);
console.log("Prepared bundled Android UI at .output/public/index.html");
