/** A user-bound session. Epochs invalidate async crypto after lock/account changes. */
export class VaultSession {
  private userId: string | null = null;
  private key: CryptoKey | null = null;
  private epoch = 0;
  private listeners = new Set<() => void>();
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private notify() {
    this.listeners.forEach((listener) => listener());
  }
  setUser(userId: string | null) {
    if (this.userId === userId) return;
    this.userId = userId;
    this.lock();
  }
  lock = () => {
    this.key = null;
    this.epoch += 1;
    this.notify();
  };
  isLocked = () => this.key === null;
  isCurrentUser = (userId: string) => this.userId === userId;
  lockForUser(userId: string): boolean {
    if (userId !== this.userId) return false;
    this.lock();
    return true;
  }
  beginUnlock(userId = this.userId) {
    if (!userId || this.userId !== userId) throw new Error("تغير الحساب. افتح الخزنة مجددًا.");
    this.lock();
    return { userId, epoch: this.epoch };
  }
  completeUnlock(ticket: { userId: string; epoch: number }, key: CryptoKey) {
    if (ticket.userId !== this.userId || ticket.epoch !== this.epoch) return false;
    this.key = key;
    this.notify();
    return true;
  }
  assertUnlockCurrent(ticket: { userId: string; epoch: number }) {
    if (ticket.userId !== this.userId || ticket.epoch !== this.epoch)
      throw new Error("أُغلقت الخزنة. افتحها مجددًا.");
  }
  access() {
    if (!this.userId) throw new Error("غير مسجل الدخول");
    return { userId: this.userId, key: this.requireKey(this.userId) };
  }
  requireKey(userId: string) {
    if (!this.key || this.userId !== userId) throw new Error("الخزنة مقفلة. افتحها مجددًا.");
    return this.key;
  }
  assertCurrent(userId: string, key: CryptoKey) {
    if (this.requireKey(userId) !== key) throw new Error("تغيرت جلسة الخزنة. حاول مجددًا.");
  }
}

export const vaultSession = new VaultSession();
