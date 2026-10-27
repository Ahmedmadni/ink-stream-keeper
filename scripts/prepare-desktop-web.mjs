import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = resolve("dist/client");
const target = resolve("electron/web");
const shell = await readFile(resolve(source, "index.html"), "utf8");
if (!shell.includes('<script type="module"') || !shell.includes("/assets/")) {
  throw new Error("Run build:native before preparing the desktop bundle");
}
await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true });
await rm(resolve(target, "sw.js"), { force: true });
// ICO wraps the existing brand PNG without changing its pixels.
const png = await readFile(resolve("android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png"));
const width = png.readUInt32BE(16),
  height = png.readUInt32BE(20);
if (width > 256 || height > 256) throw new Error("Desktop icon must fit the ICO dimensions");
const header = Buffer.alloc(22);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header[6] = width === 256 ? 0 : width;
header[7] = height === 256 ? 0 : height;
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(png.length, 14);
header.writeUInt32LE(22, 18);
await writeFile(resolve("electron/app.ico"), Buffer.concat([header, png]));
await writeFile(resolve("electron/app.png"), png);
const fonts = resolve("electron/floating/fonts");
await mkdir(fonts, { recursive: true });
for (const subset of ["arabic", "latin"]) {
  for (const weight of [400, 600]) {
    const file = `ibm-plex-sans-arabic-${subset}-${weight}-normal.woff2`;
    await cp(resolve("src/assets/fonts", file), resolve(fonts, file));
  }
}
console.log("Prepared the same local UI for the desktop release");
