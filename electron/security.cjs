const { resolve, relative, isAbsolute, extname } = require("node:path");

const APP_URL = "memoflow://app";
const RECOVERY_SCHEME = "app.lovable.c357f296dbad4d33991e76d86c92e6d0:";

function isAppUrl(raw) {
  try {
    const url = new URL(raw);
    return url.protocol === "memoflow:" && url.host === "app" && !url.username && !url.password;
  } catch {
    return false;
  }
}

function isAuthCallback(raw) {
  try {
    const url = new URL(raw);
    return (
      !url.username &&
      !url.password &&
      ((url.protocol === "lovable:" &&
        url.host === "oauth-callback" &&
        (url.pathname === "" || url.pathname === "/")) ||
        (url.protocol === RECOVERY_SCHEME &&
          url.host === "auth" &&
          ["/recovery", "/callback"].includes(url.pathname)))
    );
  } catch {
    return false;
  }
}

function isOAuthUrl(raw) {
  try {
    const url = new URL(raw);
    return (
      url.origin === "https://ink-stream-keeper.lovable.app" &&
      !url.username &&
      !url.password &&
      url.pathname === "/~oauth/initiate" &&
      ["google", "apple"].includes(url.searchParams.get("provider")) &&
      url.searchParams.get("redirect_uri") === "lovable://oauth-callback" &&
      /^[a-f0-9]{32}$/.test(url.searchParams.get("state") || "")
    );
  } catch {
    return false;
  }
}

function externalUrl(raw) {
  try {
    const url = new URL(raw);
    return ["https:", "mailto:"].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function bundledPath(root, raw) {
  if (!isAppUrl(raw)) return null;
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(raw).pathname);
  } catch {
    return null;
  }
  if (pathname.includes("\\") || pathname.includes("\0")) return null;
  const target = resolve(root, `.${pathname}`);
  const rel = relative(root, target);
  if (rel === ".." || rel.startsWith("../") || rel.startsWith("..\\") || isAbsolute(rel))
    return null;
  if (pathname.startsWith("/api/") || pathname.startsWith("/~oauth/")) return null;
  return extname(pathname) ? target : resolve(root, "index.html");
}

module.exports = {
  APP_URL,
  RECOVERY_SCHEME,
  isAppUrl,
  isAuthCallback,
  isOAuthUrl,
  externalUrl,
  bundledPath,
};
