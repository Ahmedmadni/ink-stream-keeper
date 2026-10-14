import { Capacitor, registerPlugin } from "@capacitor/core";

export type AutofillStatus = {
  supported: boolean;
  enabled: boolean;
  credentialCount: number;
  pendingCount: number;
};

export type AutofillCredential = {
  id: string;
  label: string;
  username: string;
  password: string;
  url: string;
  webDomain?: string;
  packageName?: string;
};

type AutofillPlugin = {
  getStatus(): Promise<AutofillStatus>;
  requestEnable(): Promise<void>;
  syncCredentials(options: {
    credentials: AutofillCredential[];
  }): Promise<Pick<AutofillStatus, "credentialCount" | "pendingCount">>;
  getPendingCredentials(): Promise<{ credentials: AutofillCredential[] }>;
  markImported(options: { ids: string[] }): Promise<void>;
};

const nativePlugin = registerPlugin<AutofillPlugin>("MemoFlowAutofill");

function isAndroidNative() {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
  } catch {
    return false;
  }
}

export const androidAutofill = {
  isAvailable: isAndroidNative,

  async status(): Promise<AutofillStatus> {
    if (!isAndroidNative()) {
      return { supported: false, enabled: false, credentialCount: 0, pendingCount: 0 };
    }
    return nativePlugin.getStatus();
  },

  async requestEnable() {
    if (!isAndroidNative()) return;
    await nativePlugin.requestEnable();
  },

  async sync(credentials: AutofillCredential[]) {
    if (!isAndroidNative()) return { credentialCount: 0, pendingCount: 0 };
    return nativePlugin.syncCredentials({ credentials });
  },

  async pending() {
    if (!isAndroidNative()) return [];
    return (await nativePlugin.getPendingCredentials()).credentials;
  },

  async markImported(ids: string[]) {
    if (!isAndroidNative() || ids.length === 0) return;
    await nativePlugin.markImported({ ids });
  },
};
