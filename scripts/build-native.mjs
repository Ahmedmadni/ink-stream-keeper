// The Cloudflare preview runtime can retain handles after the awaited Vite
// build finishes. Native packages consume only the generated local SPA, so
// finish this isolated process after the full build and bundle checks succeed.
process.env.MEMOFLOW_NATIVE_BUILD = "1";

try {
  await import("./clean-native-web.mjs");
  const { createBuilder } = await import("vite");
  const builder = await createBuilder({}, null);
  await builder.buildApp();
  await import("./prepare-native-web.mjs");
  await import("./verify-block-registry-bundle.mjs");
  await new Promise((resolve) => process.stdout.write("", resolve));
  await new Promise((resolve) => process.stderr.write("", resolve));
  process.exit(0);
} catch (error) {
  console.error(error);
  process.exit(1);
}
