import { decryptOfflineSnapshot, encryptOfflineSnapshot, type OfflineSnapshot } from "./crypto";

const DATABASE = "memoflow-encrypted-offline-archive";
const STORE = "snapshots";
const DB_VERSION = 1;

export type OfflineSnapshotMetadata = {
  accountId: string;
  createdAt: string;
};
type PersistedSnapshot = OfflineSnapshotMetadata & {
  formatVersion: 1;
  encrypted: string;
};

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined")
    return Promise.reject(new Error("التخزين المحلي المشفّر غير مدعوم على هذا الجهاز."));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "accountId" });
    };
    request.onerror = () => reject(request.error ?? new Error("تعذر فتح قاعدة البيانات المحلية."));
    request.onblocked = () => reject(new Error("أغلق أي نافذة أخرى من MemoFlow ثم أعد المحاولة."));
    request.onsuccess = () => resolve(request.result);
  });
}

async function transaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore, finish: (result: T) => void) => void,
): Promise<T> {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let outcome: T;
    try {
      const tx = db.transaction(STORE, mode);
      const finish = (result: T) => { outcome = result; };
      tx.oncomplete = () => {
        settled = true;
        db.close();
        resolve(outcome);
      };
      tx.onerror = () => {
        settled = true;
        db.close();
        reject(tx.error ?? new Error("تعذر حفظ أو قراءة النسخة المشفّرة."));
      };
      tx.onabort = () => {
        settled = true;
        db.close();
        reject(tx.error ?? new Error("فشل حفظ النسخة. النسخة القديمة لم تُستبدل."));
      };
      operation(tx.objectStore(STORE), finish);
    } catch (error) {
      if (!settled) db.close();
      reject(error);
    }
  });
}

/** Store only encrypted bytes. The ID and date are non-secret metadata. */
export async function saveOfflineArchive(snapshot: OfflineSnapshot, password: string): Promise<void> {
  const encrypted = await encryptOfflineSnapshot(snapshot, password);
  await transaction<void>("readwrite", (store) => {
    store.put({
      accountId: snapshot.accountId,
      createdAt: snapshot.createdAt,
      formatVersion: 1,
      encrypted,
    } satisfies PersistedSnapshot);
  });
}

export async function listOfflineArchives(): Promise<OfflineSnapshotMetadata[]> {
  const records = await transaction<PersistedSnapshot[]>("readonly", (store, finish) => {
    const request = store.getAll();
    request.onsuccess = () => finish(request.result as PersistedSnapshot[]);
  });
  return records
    .filter((record) => record.formatVersion === 1 && typeof record.accountId === "string" &&
      typeof record.createdAt === "string" && typeof record.encrypted === "string")
    .map(({ accountId, createdAt }) => ({ accountId, createdAt }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function openOfflineArchive(accountId: string, password: string): Promise<OfflineSnapshot> {
  const record = await transaction<PersistedSnapshot | undefined>("readonly", (store, finish) => {
    const request = store.get(accountId);
    request.onsuccess = () => finish(request.result as PersistedSnapshot | undefined);
  });
  if (!record || record.formatVersion !== 1 || record.accountId !== accountId ||
      typeof record.encrypted !== "string")
    throw new Error("لا توجد نسخة مشفّرة لهذا الحساب على الجهاز.");
  return decryptOfflineSnapshot(record.encrypted, password, accountId);
}

export async function deleteOfflineArchive(accountId: string): Promise<void> {
  await transaction<void>("readwrite", (store) => { store.delete(accountId); });
}
