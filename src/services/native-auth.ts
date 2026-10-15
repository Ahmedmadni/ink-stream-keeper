import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

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
const CALLBACK_URI = "app.lovable.c357f296dbad4d33991e76d86c92e6d0://auth/callback";
const OAUTH_INITIATE_URL = "https://ink-stream-keeper.lovable.app/~oauth/initiate";
const STATE_STORAGE_KEY = "memoflow:native-oauth-state";
const STATE_MAX_AGE_MS = 15 * 60 * 1000;

export function isNativeOAuthAvailable(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
  } catch {
    return false;
  }
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
  if (
    url.protocol !== "app.lovable.c357f296dbad4d33991e76d86c92e6d0:" ||
    url.hostname !== "auth" ||
    url.pathname !== "/callback"
  ) {
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

export async function beginNativeOAuth(provider: NativeOAuthProvider): Promise<void> {
  const state = newState();
  localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify({ state, createdAt: Date.now() }));

  const url = new URL(OAUTH_INITIATE_URL);
  url.searchParams.set("provider", provider);
  url.searchParams.set("redirect_uri", CALLBACK_URI);
  url.searchParams.set("state", state);

  try {
    await nativePlugin.openOAuth({ url: url.toString() });
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

export async function listenForNativeOAuthCallback(
  listener: (url: string) => void,
): Promise<() => Promise<void>> {
  if (!isNativeOAuthAvailable()) return async () => {};

  const handle = await nativePlugin.addListener("authCallback", ({ url }) => listener(url));
  const launch = await nativePlugin.getLaunchUrl();
  if (launch.url) listener(launch.url);
  return () => handle.remove();
}
