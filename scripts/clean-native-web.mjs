import { rm } from "node:fs/promises";
import { resolve } from "node:path";

const generatedDirectories = [
  resolve(".output/public"),
  resolve("android/app/src/main/assets/public"),
];

await Promise.all(
  generatedDirectories.map((directory) => rm(directory, { recursive: true, force: true })),
);
console.log("Removed previous native and Android web build output");
