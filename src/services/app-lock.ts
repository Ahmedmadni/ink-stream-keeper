import { registerPlugin } from "@capacitor/core";
import { isNative } from "./platform";

export type AppLockStatus = {
  configured: boolean;
  unlocked: boolean;
  blockedUntil: number;
};

type AppLockPlugin = {
  getStatus(): Promise<AppLockStatus>;
  configure(options: { pin: string }): Promise<void>;
  unlock(options: { pin: string }): Promise<void>;
  lock(): Promise<void>;
  changePin(options: { currentPin: string; newPin: string }): Promise<void>;
  resetAfterSignOut(): Promise<void>;
};

const nativePlugin = registerPlugin<AppLockPlugin>("MemoFlowAppLock");

export function validAppPin(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}

export const appLock = {
  supported: isNative,
  async status(): Promise<AppLockStatus> {
    if (!isNative()) return { configured: false, unlocked: true, blockedUntil: 0 };
    return nativePlugin.getStatus();
  },
  async configure(pin: string) {
    if (!validAppPin(pin)) throw new Error("يجب أن يتكون رمز التطبيق من 6 أرقام");
    await nativePlugin.configure({ pin });
  },
  async unlock(pin: string) {
    if (!validAppPin(pin)) throw new Error("أدخل رمز التطبيق المكوّن من 6 أرقام");
    await nativePlugin.unlock({ pin });
  },
  async lock() {
    if (isNative()) await nativePlugin.lock();
  },
  async changePin(currentPin: string, newPin: string) {
    if (!validAppPin(currentPin)) throw new Error("أدخل رمز التطبيق الحالي المكوّن من 6 أرقام");
    if (!validAppPin(newPin)) throw new Error("يجب أن يتكون الرمز الجديد من 6 أرقام");
    if (currentPin === newPin) throw new Error("اختر رمزًا جديدًا مختلفًا عن الرمز الحالي");
    await nativePlugin.changePin({ currentPin, newPin });
  },
  async resetAfterSignOut() {
    if (isNative()) await nativePlugin.resetAfterSignOut();
  },
};
