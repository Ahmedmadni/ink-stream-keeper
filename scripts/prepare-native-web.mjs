import { copyFile, cp, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

// Nitro may move Vite client files into .output/public after the build.
// Capacitor/Electron require one complete, local SPA directory.
const targetDir = resolve("dist/client");
const candidates = [resolve(".output/public"), targetDir];

async function findShell(directory) {
  const names = await readdir(directory).catch(() => []);
  for (const name of ["_shell.html", "index.html"]) {
    if (names.includes(name)) return { source: resolve(directory, name), directory };
  }
  return null;
}

let source = null;
for (const candidate of candidates) {
  source = await findShell(candidate);
  if (source) break;
}
if (!source) {
  throw new Error("TanStack Start did not emit _shell.html or index.html in .output/public or dist/client");
}

const shell = await readFile(source.source, "utf8");
if (!/<script\b[^>]*type=["']module["']/i.test(shell) || !/(?:\.\/|\/)assets\//.test(shell)) {
  throw new Error(`Invalid native SPA shell at ${source.source}`);
}

// Copy the WHOLE output: copying just HTML would omit compiled modules and fonts.
if (source.directory !== targetDir) {
  await cp(source.directory, targetDir, { recursive: true, force: true });
}
const indexPath = resolve(targetDir, "index.html");
if (source.source.endsWith("_shell.html")) {
  await copyFile(resolve(targetDir, "_shell.html"), indexPath);
}
const assets = await readdir(resolve(targetDir, "assets")).catch(() => []);
if (!assets.some((name) => name.endsWith(".js"))) {
  throw new Error("Native SPA was created without its JavaScript assets");
}
console.log(`Prepared complete native SPA at ${indexPath} (${assets.length} assets)`);
