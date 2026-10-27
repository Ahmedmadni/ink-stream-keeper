import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const assetsDir = resolve("dist/client/assets");
const assetNames = await readdir(assetsDir);
const javascriptAssets = assetNames.filter((name) => name.endsWith(".js"));

let rendererBundle = "";
let rendererBundleName = "";
for (const name of javascriptAssets) {
  const contents = await readFile(resolve(assetsDir, name), "utf8");
  if (contents.includes("لا يوجد Renderer مسجّل لهذا النوع.")) {
    rendererBundle = contents;
    rendererBundleName = name;
    break;
  }
}

if (!rendererBundle) {
  throw new Error("Could not locate the production BlockRenderer bundle");
}

const requiredRegistryTokens = [
  "statistics",
  "sub_items",
  "rich_text",
  "properties",
  "custom",
  "الإحصائيات",
  "التقسيم الفرعي",
  "المسار الزمني",
  "عناصر مرتبطة",
];
const missingTokens = requiredRegistryTokens.filter((token) => !rendererBundle.includes(token));

if (missingTokens.length > 0) {
  throw new Error(
    `Production block registry was tree-shaken from ${rendererBundleName}; missing: ${missingTokens.join(
      ", ",
    )}`,
  );
}

console.log(`Verified production block registry in ${rendererBundleName}`);
