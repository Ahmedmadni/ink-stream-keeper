import { sameText, type NoteDraftStore, type NoteText, type StoredNoteDraft } from "./autosave";

const PREFIX = "memoflow.note-draft.v1:";
type RecordV1 = StoredNoteDraft & {
  version: 1;
  userId: string;
  noteId: string;
  revision: string;
  savedAt: number;
};
const textValue = (value: unknown): value is NoteText =>
  !!value &&
  typeof value === "object" &&
  "title" in value &&
  typeof value.title === "string" &&
  "content" in value &&
  typeof value.content === "string";
function parse(raw: string | null, userId: string, noteId: string): RecordV1 | null {
  if (!raw) return null;
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<RecordV1>;
  return record.version === 1 &&
    record.userId === userId &&
    record.noteId === noteId &&
    typeof record.revision === "string" &&
    Number.isFinite(record.savedAt) &&
    textValue(record.draft) &&
    textValue(record.base) &&
    typeof record.base.updated_at === "string"
    ? (record as RecordV1)
    : null;
}

/** Account + note + tab isolation. No vault data or secrets belong in this store. */
export function createNoteDraftStore(
  storage: Storage,
  userId: string,
  noteId: string,
  tabId: string,
): NoteDraftStore {
  const prefix = `${PREFIX}${encodeURIComponent(userId)}:${encodeURIComponent(noteId)}:`;
  let ownKey: string | null = null;
  let recovered: { key: string; revision: string } | null = null;
  const removeRecovered = () => {
    if (!recovered) return;
    const record = parse(storage.getItem(recovered.key), userId, noteId);
    if (record?.revision === recovered.revision) storage.removeItem(recovered.key);
    recovered = null;
  };
  return {
    read() {
      let latest: RecordV1 | null = null;
      for (let i = 0; i < storage.length; i++) {
        const candidateKey = storage.key(i);
        if (!candidateKey?.startsWith(prefix)) continue;
        const candidate = parse(storage.getItem(candidateKey), userId, noteId);
        if (candidate && (!latest || candidate.savedAt >= latest.savedAt)) {
          latest = candidate;
          if (!ownKey) recovered = { key: candidateKey, revision: candidate.revision };
        }
      }
      return latest;
    },
    write(value) {
      const record: RecordV1 = {
        ...value,
        version: 1,
        userId,
        noteId,
        revision: crypto.randomUUID(),
        savedAt: performance.timeOrigin + performance.now(),
      };
      // Immutable revision keys make cleanup safe even across browser tabs.
      const nextKey = `${prefix}${tabId}:${record.revision}`;
      storage.setItem(nextKey, JSON.stringify(record));
      if (ownKey) storage.removeItem(ownKey);
      ownKey = nextKey;
    },
    clearSaved(value) {
      const record = ownKey ? parse(storage.getItem(ownKey), userId, noteId) : null;
      if (record && sameText(record.draft, value) && ownKey) {
        storage.removeItem(ownKey);
        ownKey = null;
        // The acknowledged edit supersedes the exact revision we recovered.
        removeRecovered();
      }
      if (recovered) {
        const source = parse(storage.getItem(recovered.key), userId, noteId);
        if (source && sameText(source.draft, value)) removeRecovered();
      }
    },
    discard() {
      if (ownKey) storage.removeItem(ownKey);
      ownKey = null;
      removeRecovered();
    },
  };
}

export function browserNoteDraftStore(userId: string, noteId: string): NoteDraftStore {
  try {
    return createNoteDraftStore(localStorage, userId, noteId, crypto.randomUUID());
  } catch {
    const unavailable = () => {
      throw new Error("Local draft storage unavailable");
    };
    return { read: unavailable, write: unavailable, clearSaved: unavailable, discard: unavailable };
  }
}
