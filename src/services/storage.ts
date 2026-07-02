/**
 * Storage service — thin wrapper over localStorage with JSON helpers.
 * Capacitor Preferences drop-in replacement possible.
 */
export interface StorageService {
  get<T>(key: string, fallback: T): T;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
}

function safe<T>(fn: () => T, fallback: T): T {
  try { return fn(); } catch { return fallback; }
}

export const storage: StorageService = {
  get<T>(key: string, fallback: T): T {
    if (typeof localStorage === "undefined") return fallback;
    return safe(() => {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : (JSON.parse(raw) as T);
    }, fallback);
  },
  set<T>(key: string, value: T) {
    if (typeof localStorage === "undefined") return;
    safe(() => localStorage.setItem(key, JSON.stringify(value)), undefined);
  },
  remove(key) {
    if (typeof localStorage === "undefined") return;
    safe(() => localStorage.removeItem(key), undefined);
  },
};