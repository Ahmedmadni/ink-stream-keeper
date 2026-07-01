/**
 * Guarded service-worker registration.
 * Refuses in dev, iframes, Lovable preview / editor / beta hosts, and ?sw=off.
 * In any refused context also unregisters any stale /sw.js registration.
 */
const APP_SW_PATH = "/sw.js";

function isRefusedContext(): boolean {
  if (typeof window === "undefined") return true;
  if (!("serviceWorker" in navigator)) return true;
  if (!import.meta.env.PROD) return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const h = window.location.hostname;
  if (
    h.startsWith("id-preview--") ||
    h.startsWith("preview--") ||
    h === "lovableproject.com" ||
    h.endsWith(".lovableproject.com") ||
    h === "lovableproject-dev.com" ||
    h.endsWith(".lovableproject-dev.com") ||
    h === "beta.lovable.dev" ||
    h.endsWith(".beta.lovable.dev")
  ) {
    return true;
  }
  if (new URL(window.location.href).searchParams.get("sw") === "off") return true;
  return false;
}

async function unregisterAppSw(): Promise<void> {
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const r of regs) {
      const url = r.active?.scriptURL ?? r.installing?.scriptURL ?? r.waiting?.scriptURL ?? "";
      if (url.endsWith(APP_SW_PATH)) await r.unregister();
    }
  } catch {
    /* noop */
  }
}

export async function registerAppSw(): Promise<void> {
  if (isRefusedContext()) {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      await unregisterAppSw();
    }
    return;
  }
  try {
    const { registerSW } = await import("virtual:pwa-register");
    registerSW({
      immediate: true,
      onRegisteredSW(_url: string, reg?: ServiceWorkerRegistration) {
        if (reg) setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
      },
    });
  } catch {
    /* noop */
  }
}