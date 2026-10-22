import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { APP_BACKEND_ORIGIN } from "@/lib/native-url";
import { desktopBridge, isDesktop } from "./desktop";

export type NativeOAuthProvider = "google" | "apple";

type NativeAuthCallback = { url: string };
type NativeAuthPlugin = {
  openOAuth(options: { url: string }): Promise<void>;
  getLaunchUrl(): Promise<{ url?: string }>;
  addListener(
    eventName: "authCallback",
    listener: (event: NativeAuthCallback) => void,
  ): Promise<PluginListenerHandle>;
};

type OAuthCallback =
  | { accessToken: string; refreshToken: string; error: null }
  | { accessToken: null; refreshToken: null; error: string };

const nativePlugin = registerPlugin<NativeAuthPlugin>("MemoFlowAuth");
// Lovable Cloud OAuth only allows its mobile callback URI. A project-specific
// custom scheme is rejected by the broker before the provider login begins.
export const OAUTH_CALLBACK_URI = "lovable://oauth-callback";
export const RECOVERY_CALLBACK_URI = "app.lovable.c357f296dbad4d33991e76d86c92e6d0://auth/recovery";
const OAUTH_INITIATE_URL = "https://ink-stream-keeper.lovable.app/~oauth/initiate";
const STATE_STORAGE_KEY = "memoflow:native-oauth-state";
const ERROR_STORAGE_KEY = "memoflow:native-auth-error";
const STATE_MAX_AGE_MS = 15 * 60 * 1000;

export function isNativeOAuthAvailable(): boolean {
  try {
    return isDesktop() || (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android");
  } catch {
    return false;
  }
}

export const isNativeAuthAvailable = isNativeOAuthAvailable;

export function rememberNativeAuthError(reason: unknown): void {
  const message = reason instanceof Error ? reason.message : "تعذّر إكمال تسجيل الدخول";
  sessionStorage.setItem(ERROR_STORAGE_KEY, message);
}

export function consumeNativeAuthError(): string | null {
  const message = sessionStorage.getItem(ERROR_STORAGE_KEY);
  if (message) sessionStorage.removeItem(ERROR_STORAGE_KEY);
  return message;
}

function newState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function callbackParams(url: URL): URLSearchParams {
  const params = new URLSearchParams(url.search);
  const fragment = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);
  fragment.forEach((value, key) => {
    if (!params.has(key)) params.set(key, value);
  });
  return params;
}

export function parseNativeOAuthCallback(rawUrl: string, expectedState: string): OAuthCallback {
  const url = new URL(rawUrl);
  const supportedMobileCallback =
    url.protocol === "lovable:" &&
    url.hostname === "oauth-callback" &&
    (url.pathname === "" || url.pathname === "/");
  const legacyCallback =
    url.protocol === "app.lovable.c357f296dbad4d33991e76d86c92e6d0:" &&
    url.hostname === "auth" &&
    url.pathname === "/callback";
  if (!supportedMobileCallback && !legacyCallback) {
    throw new Error("رابط الرجوع إلى MemoFlow غير صالح");
  }

  const params = callbackParams(url);
  if (!expectedState || params.get("state") !== expectedState) {
    throw new Error("تعذّر التحقق من أمان جلسة تسجيل الدخول");
  }

  const providerError = params.get("error_description") || params.get("error");
  if (providerError) {
    return { accessToken: null, refreshToken: null, error: providerError };
  }

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) {
    throw new Error("لم تصل بيانات الجلسة من المتصفح");
  }
  return { accessToken, refreshToken, error: null };
}

export function parseNativeRecoveryCallback(rawUrl: string): OAuthCallback {
  const url = new URL(rawUrl);
  if (
    url.protocol !== "app.lovable.c357f296dbad4d33991e76d86c92e6d0:" ||
    url.hostname !== "auth" ||
    url.pathname !== "/recovery"
  ) {
    throw new Error("رابط استعادة كلمة المرور غير صالح");
  }
  const params = callbackParams(url);
  const providerError = params.get("error_description") || params.get("error");
  if (providerError) return { accessToken: null, refreshToken: null, error: providerError };
  if (params.get("type") !== "recovery") throw new Error("نوع رابط الاستعادة غير صالح");
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) throw new Error("رابط الاستعادة ناقص أو منتهي");
  return { accessToken, refreshToken, error: null };
}

export function nativeRecoveryRedirectUrl(
  inBrowser = desktopBridge()?.isWindowsStore === true,
): string {
  // The Store cannot register the long mobile scheme (Windows maximum: 39).
  // Its existing HTTPS reset form works without new auth redirect settings.
  return `${APP_BACKEND_ORIGIN}/auth?${inBrowser ? "recovery" : "native_recovery"}=1`;
}

export function nativeEmailConfirmationRedirectUrl(): string {
  return `${APP_BACKEND_ORIGIN}/auth`;
}

export function nativeRecoveryHandoffUrl(accessToken: string, refreshToken: string): string {
  const params = new URLSearchParams({
    access_token: accessToken,
    refresh_token: refreshToken,
    type: "recovery",
  });
  return `${RECOVERY_CALLBACK_URI}#${params}`;
}

export async function beginNativeOAuth(provider: NativeOAuthProvider): Promise<void> {
  const state = newState();
  localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify({ state, createdAt: Date.now() }));

  const url = new URL(OAUTH_INITIATE_URL);
  url.searchParams.set("provider", provider);
  url.searchParams.set("redirect_uri", OAUTH_CALLBACK_URI);
  url.searchParams.set("state", state);

  try {
    const desktop = desktopBridge();
    if (desktop) await desktop.openOAuth(url.toString());
    else await nativePlugin.openOAuth({ url: url.toString() });
  } catch (error) {
    localStorage.removeItem(STATE_STORAGE_KEY);
    throw error;
  }
}

function storedState(): string {
  const raw = localStorage.getItem(STATE_STORAGE_KEY);
  if (!raw) throw new Error("انتهت محاولة تسجيل الدخول؛ حاول مرة أخرى");
  try {
    const value = JSON.parse(raw) as { state?: unknown; createdAt?: unknown };
    if (
      typeof value.state !== "string" ||
      typeof value.createdAt !== "number" ||
      Date.now() - value.createdAt > STATE_MAX_AGE_MS
    ) {
      localStorage.removeItem(STATE_STORAGE_KEY);
      throw new Error("انتهت محاولة تسجيل الدخول؛ حاول مرة أخرى");
    }
    return value.state;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("انتهت")) throw error;
    localStorage.removeItem(STATE_STORAGE_KEY);
    throw new Error("تعذّر استعادة محاولة تسجيل الدخول");
  }
}

export async function completeNativeOAuth(rawUrl: string): Promise<void> {
  const callback = parseNativeOAuthCallback(rawUrl, storedState());
  localStorage.removeItem(STATE_STORAGE_KEY);
  if (callback.error !== null) throw new Error(callback.error);

  const { error } = await supabase.auth.setSession({
    access_token: callback.accessToken,
    refresh_token: callback.refreshToken,
  });
  if (error) throw error;
}

export async function completeNativeRecovery(rawUrl: string): Promise<void> {
  const callback = parseNativeRecoveryCallback(rawUrl);
  if (callback.error !== null) throw new Error(callback.error);
  const { error } = await supabase.auth.setSession({
    access_token: callback.accessToken,
    refresh_token: callback.refreshToken,
  });
  if (error) throw error;
}

export async function listenForNativeOAuthCallback(
  listener: (url: string) => void,
): Promise<() => Promise<void>> {
  if (!isNativeOAuthAvailable()) return async () => {};

  const desktop = desktopBridge();
  if (desktop) {
    const remove = desktop.onAuthCallback(listener);
    const launch = await desktop.getLaunchUrl();
    if (launch.url) listener(launch.url);
    return async () => remove();
  }

  const handle = await nativePlugin.addListener("authCallback", ({ url }) => listener(url));
  const launch = await nativePlugin.getLaunchUrl();
  if (launch.url) listener(launch.url);
  return () => handle.remove();
}

export const listenForNativeAuthCallback = listenForNativeOAuthCallback;
