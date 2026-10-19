import { prepareVaultPinChange, type VaultKeySettings } from "../../lib/vault-crypto";
import type { VaultSession } from "./session";

export type VaultPinStore = {
  userId(): Promise<string>;
  read(userId: string): Promise<VaultKeySettings | null>;
  compareAndSwap(previous: VaultKeySettings, next: VaultKeySettings): Promise<boolean>;
};

export async function changeVaultPinWithStore(
  currentPin: string,
  newPin: string,
  store: VaultPinStore,
  session: VaultSession,
): Promise<VaultKeySettings> {
  const userId = await store.userId();
  const ticket = session.beginUnlock(userId);
  const previous = await store.read(userId);
  session.assertUnlockCurrent(ticket);
  if (!previous) throw new Error("أنشئ رمز الخزنة أولًا");
  if (previous.user_id !== userId) throw new Error("تغير الحساب. أعد المحاولة.");
  const next = await prepareVaultPinChange(currentPin, newPin, previous);
  session.assertUnlockCurrent(ticket);
  if ((await store.userId()) !== userId) throw new Error("تغير الحساب. أعد المحاولة.");
  session.assertUnlockCurrent(ticket);
  if (!(await store.compareAndSwap(previous, next)))
    throw new Error("تغير رمز الخزنة من نافذة أخرى. أعد تحميل الإعدادات وحاول مجددًا.");
  session.lockForUser(userId);
  return next;
}
