import { Capacitor } from "@capacitor/core";

export const APP_BACKEND_ORIGIN = "https://ink-stream-keeper.lovable.app";

/**
 * Resolve routes that are served by the hosted backend while keeping the web
 * app same-origin. Android runs from https://localhost and therefore needs an
 * explicit remote URL for server-only routes.
 */
export function resolveAppEndpoint(
  path: `/${string}`,
  native = Capacitor.isNativePlatform(),
): string {
  return native ? new URL(path, APP_BACKEND_ORIGIN).toString() : path;
}
