/**
 * A short-lived, tab-scoped receipt of a successful server-side auth check.
 *
 * Never store JWTs, note bodies or tasks here. This does not replace Supabase
 * authentication: it only permits read-only navigation through data already
 * present in memory when the network drops after a verified login.
 */
const KEY = "memoflow.offline-verified-user.v1";
const MAX_AGE_MS = 8 * 60 * 60 * 1000;
const EXPIRY_MARGIN_MS = 30_000;

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function rememberVerifiedUser(
  storage: Store,
  userId: string,
  now = Date.now(),
): void {
  if (!userId || !Number.isFinite(now)) return;
  try {
    storage.setItem(KEY, JSON.stringify({ version: 1, userId, verifiedAt: now }));
  } catch {
    // An unavailable sessionStorage means offline navigation stays disabled.
  }
}

export function forgetVerifiedUser(storage: Store): void {
  try {
    storage.removeItem(KEY);
  } catch {
    // A failed removal must never grant offline access.
  }
}

export function mayUseOfflineSession(
  storage: Store,
  userId: string | null | undefined,
  sessionExpiresAt: number | null | undefined,
  now = Date.now(),
): boolean {
  if (!userId || !Number.isFinite(now) ||
      !Number.isFinite(sessionExpiresAt) ||
      (sessionExpiresAt ?? 0) * 1000 <= now + EXPIRY_MARGIN_MS) return false;
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return false;
    const receipt: unknown = JSON.parse(raw);
    if (!receipt || typeof receipt !== "object") return false;
    const value = receipt as { version?: unknown; userId?: unknown; verifiedAt?: unknown };
    return (
      value.version === 1 &&
      value.userId === userId &&
      typeof value.verifiedAt === "number" &&
      value.verifiedAt <= now &&
      now - value.verifiedAt < MAX_AGE_MS
    );
  } catch {
    return false;
  }
}
