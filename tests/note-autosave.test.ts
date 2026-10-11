import { describe, expect, test } from "bun:test";
import {
  NoteAutosave,
  NoteConflict,
  type NoteDraftStore,
  type NoteVersion,
  type StoredNoteDraft,
} from "../src/features/notes/autosave";
import { createNoteDraftStore } from "../src/features/notes/draft-store";

const base: NoteVersion = {
  title: "العنوان",
  content: "النص الأصلي",
  updated_at: "2026-10-11T00:00:00Z",
};
const version = (content: string, n: number): NoteVersion => ({
  ...base,
  content,
  updated_at: `2026-10-11T00:00:0${n}Z`,
});
class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  clear() {
    this.values.clear();
  }
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}
function setup(initial = base) {
  const storage = new MemoryStorage();
  const store = createNoteDraftStore(storage, "user-a", "note-a", "tab-a");
  const calls: {
    draft: { title: string; content: string };
    expected: NoteVersion;
    response: ReturnType<typeof deferred<NoteVersion>>;
  }[] = [];
  const controller = new NoteAutosave(
    initial,
    store,
    (draft, expected) => {
      const response = deferred<NoteVersion>();
      calls.push({ draft, expected, response });
      return response.promise;
    },
    60_000,
  );
  controller.start();
  return { controller, store, storage, calls };
}

describe("note autosave integrity", () => {
  test("edits during a save are serialized and an old response cannot replace newer input", async () => {
    const { controller, store, calls } = setup();
    controller.edit({ content: "أول تعديل" });
    const pending = controller.flush();
    controller.edit({ content: "آخر تعديل" });
    expect(calls).toHaveLength(1);
    calls[0].response.resolve(version("أول تعديل", 1));
    await Promise.resolve();
    expect(calls).toHaveLength(2);
    expect(calls[1].expected.updated_at).toBe(version("أول تعديل", 1).updated_at);
    expect(controller.getSnapshot().draft.content).toBe("آخر تعديل");
    expect(store.read()?.draft.content).toBe("آخر تعديل");
    calls[1].response.resolve(version("آخر تعديل", 2));
    await pending;
    expect(controller.getSnapshot().state).toBe("saved");
    expect(store.read()).toBeNull();
    controller.stop();
  });
  test("reverting text while a different write is pending still saves the final intention", async () => {
    const { controller, calls } = setup();
    controller.edit({ content: "تعديل مؤقت" });
    const pending = controller.flush();
    controller.edit({ content: base.content });
    calls[0].response.resolve(version("تعديل مؤقت", 1));
    await Promise.resolve();
    expect(calls[1].draft.content).toBe(base.content);
    calls[1].response.resolve(version(base.content, 2));
    await pending;
    controller.stop();
  });
  test("failed saves survive closing and a subsequent editor restores the draft", async () => {
    const { controller, storage, calls } = setup();
    controller.edit({ title: "عنوان محلي", content: "مسودة بلا شبكة" });
    const pending = controller.flush();
    calls[0].response.reject(new Error("offline"));
    await pending;
    controller.stop();
    const restored = new NoteAutosave(
      base,
      createNoteDraftStore(storage, "user-a", "note-a", "tab-new"),
      async () => base,
    );
    expect(restored.getSnapshot().draft).toEqual({
      title: "عنوان محلي",
      content: "مسودة بلا شبكة",
    });
    expect(restored.getSnapshot().recovered).toBe(true);
    expect(restored.getSnapshot().state).toBe("dirty");
  });
  test("a detached save acknowledgement cannot delete a newer reopened draft", async () => {
    const { controller, calls, storage } = setup();
    controller.edit({ content: "مسودة أولى" });
    const pending = controller.flush();
    controller.stop();
    const newer = createNoteDraftStore(storage, "user-a", "note-a", "tab-new");
    newer.write({ base, draft: { ...base, content: "مسودة أحدث" } });
    calls[0].response.resolve(version("مسودة أولى", 1));
    await pending;
    expect(newer.read()?.draft.content).toBe("مسودة أحدث");
  });
  test("conflicts retain the original base through another local edit and reload", async () => {
    const { controller, calls, store, storage } = setup();
    controller.edit({ content: "نسختي" });
    const pending = controller.flush();
    const remote = version("نسخة جهاز آخر", 1);
    calls[0].response.reject(new NoteConflict(remote));
    await pending;
    controller.edit({ content: "نسختي بعد التنبيه" });
    await controller.flush();
    expect(calls).toHaveLength(1);
    expect(store.read()?.base.content).toBe(base.content);
    controller.stop();
    const restored = new NoteAutosave(
      remote,
      createNoteDraftStore(storage, "user-a", "note-a", "next"),
      async () => remote,
    );
    expect(restored.getSnapshot().state).toBe("conflict");
    expect(restored.getSnapshot().draft.content).toBe("نسختي بعد التنبيه");
  });
  test("explicit conflict resolution writes against the latest server revision", async () => {
    const { controller, calls } = setup();
    controller.edit({ content: "نسختي" });
    const pending = controller.flush();
    const remote = version("نسخة أخرى", 1);
    calls[0].response.reject(new NoteConflict(remote));
    await pending;
    controller.keepDraft();
    expect(calls[1].expected).toEqual(remote);
    calls[1].response.resolve(version("نسختي", 2));
    await controller.flush();
    controller.stop();
  });
  test("refetches update metadata revisions without erasing dirty input", () => {
    const { controller } = setup();
    controller.edit({ content: "مسودتي" });
    controller.receiveRemote({ ...base, updated_at: version("", 1).updated_at });
    expect(controller.getSnapshot().draft.content).toBe("مسودتي");
    expect(controller.getSnapshot().state).toBe("dirty");
    controller.receiveRemote(version("نص جهاز آخر", 2));
    expect(controller.getSnapshot().state).toBe("conflict");
    controller.stop();
  });
  test("storage quota errors never report successful local persistence", () => {
    const unavailable = () => {
      throw new Error("quota");
    };
    const store: NoteDraftStore = {
      read: () => null,
      write: unavailable,
      clearSaved: () => {},
      discard: () => {},
    };
    const controller = new NoteAutosave(base, store, async () => base);
    controller.start();
    controller.edit({ content: "غير محفوظ محليًا" });
    expect(controller.getSnapshot().localError).toBe(true);
    expect(controller.getSnapshot().draft.content).toBe("غير محفوظ محليًا");
    controller.stop();
  });
});

describe("local note draft isolation", () => {
  test("saving a modified recovered draft also clears its superseded source", () => {
    const storage = new MemoryStorage();
    createNoteDraftStore(storage, "a", "n", "closed-tab").write({
      base,
      draft: { ...base, content: "مسودة مستعادة" },
    });
    const next = createNoteDraftStore(storage, "a", "n", "new-tab");
    next.read();
    const saved = { ...base, content: "تعديل المسودة المستعادة" };
    next.write({ base, draft: saved });
    next.clearSaved(saved);
    expect(createNoteDraftStore(storage, "a", "n", "again").read()).toBeNull();
  });
  test("accounts and notes cannot load each other's draft", () => {
    const storage = new MemoryStorage();
    createNoteDraftStore(storage, "a", "n", "tab").write({
      base,
      draft: { ...base, content: "خاص" },
    });
    expect(createNoteDraftStore(storage, "b", "n", "tab").read()).toBeNull();
    expect(createNoteDraftStore(storage, "a", "other", "tab").read()).toBeNull();
  });
  test("recovering one revision never removes another tab's newer edit", () => {
    const storage = new MemoryStorage();
    const first = createNoteDraftStore(storage, "a", "n", "one");
    first.write({ base, draft: { ...base, content: "أول" } });
    const second = createNoteDraftStore(storage, "a", "n", "two");
    expect(second.read()?.draft.content).toBe("أول");
    second.write({ base, draft: { ...base, content: "أول" } });
    first.write({ base, draft: { ...base, content: "أحدث" } });
    second.clearSaved({ ...base, content: "أول" });
    expect(createNoteDraftStore(storage, "a", "n", "three").read()?.draft.content).toBe("أحدث");
  });
  test("a failed local write keeps the previous persisted revision", () => {
    const storage = new MemoryStorage();
    const store = createNoteDraftStore(storage, "a", "n", "one");
    store.write({ base, draft: { ...base, content: "آخر حفظ ناجح" } });
    storage.setItem = () => {
      throw new Error("quota");
    };
    expect(() => store.write({ base, draft: { ...base, content: "لم يحفظ" } })).toThrow();
    expect(store.read()?.draft.content).toBe("آخر حفظ ناجح");
  });
});
