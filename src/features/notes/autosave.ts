export type NoteText = { title: string; content: string };
export type NoteVersion = NoteText & { updated_at: string };
export type StoredNoteDraft = { draft: NoteText; base: NoteVersion };
export interface NoteDraftStore {
  read(): StoredNoteDraft | null;
  write(value: StoredNoteDraft): void;
  clearSaved(value: NoteText): void;
  discard(): void;
}
export type SaveState = "clean" | "dirty" | "saving" | "saved" | "error" | "conflict";
export type NoteSaveSnapshot = {
  draft: NoteText;
  state: SaveState;
  localError: boolean;
  recovered: boolean;
  remote: NoteVersion | null;
};
export class NoteConflict extends Error {
  constructor(public remote: NoteVersion | null) {
    super("Note changed on the server");
  }
}
export const sameText = (a: NoteText, b: NoteText) =>
  a.title === b.title && a.content === b.content;

/** Serializes writes, never replacing newer input with an older acknowledgement. */
export class NoteAutosave {
  private base: NoteVersion;
  private snapshot: NoteSaveSnapshot;
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private running: Promise<void> | null = null;
  private active = false;
  constructor(
    initial: NoteVersion,
    private store: NoteDraftStore,
    private save: (draft: NoteText, expected: NoteVersion) => Promise<NoteVersion>,
    private delay = 700,
  ) {
    this.base = { ...initial };
    let local: StoredNoteDraft | null = null;
    let localError = false;
    try {
      local = store.read();
    } catch {
      localError = true;
    }
    const recovered = !!local && !sameText(local.draft, initial);
    const conflict = recovered && !sameText(local!.base, initial);
    if (conflict) this.base = { ...local!.base };
    this.snapshot = {
      draft: recovered ? { ...local!.draft } : { title: initial.title, content: initial.content },
      state: conflict ? "conflict" : recovered ? "dirty" : "clean",
      localError,
      recovered,
      remote: conflict ? initial : null,
    };
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = () => this.snapshot;
  private update(patch: Partial<NoteSaveSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  start() {
    this.active = true;
    if (this.snapshot.state === "dirty") {
      this.persist();
      this.schedule();
    }
    if (this.snapshot.state === "clean") this.clearSaved(this.base);
  }
  stop() {
    this.active = false;
    clearTimeout(this.timer);
  }
  discardLocal() {
    this.store.discard();
  }
  private persist() {
    try {
      this.store.write({ draft: this.snapshot.draft, base: this.base });
      this.update({ localError: false });
    } catch {
      this.update({ localError: true });
    }
  }
  private clearSaved(value: NoteText) {
    try {
      this.store.clearSaved(value);
      this.update({ localError: false });
    } catch {
      this.update({ localError: true });
    }
  }
  private schedule() {
    clearTimeout(this.timer);
    if (this.active && this.snapshot.state !== "conflict")
      this.timer = setTimeout(() => {
        void this.flush();
      }, this.delay);
  }
  edit(patch: Partial<NoteText>) {
    if (!this.active) return;
    const draft = { ...this.snapshot.draft, ...patch };
    this.update({ draft, state: this.snapshot.state === "conflict" ? "conflict" : "dirty" });
    // Synchronous persistence means a page close during the debounce keeps input.
    this.persist();
    this.schedule();
  }
  flush = (): Promise<void> => {
    clearTimeout(this.timer);
    if (this.running) return this.running;
    if (!this.active || this.snapshot.state === "conflict") return Promise.resolve();
    this.running = this.drain().finally(() => {
      this.running = null;
    });
    return this.running;
  };
  private async drain() {
    while (this.active && this.snapshot.state !== "conflict") {
      if (sameText(this.snapshot.draft, this.base)) {
        this.clearSaved(this.base);
        this.update({ state: "saved", recovered: false });
        return;
      }
      const candidate = { ...this.snapshot.draft };
      const expected = { ...this.base };
      this.update({ state: "saving" });
      try {
        const saved = await this.save(candidate, expected);
        this.base = saved;
        // A detached editor must not modify a newly reopened editor's draft.
        if (!this.active) return;
        if (sameText(this.snapshot.draft, saved)) {
          this.clearSaved(candidate);
          this.update({ state: "saved", recovered: false });
          return;
        }
        this.persist(); // Rebase the newer pending draft on this acknowledgement.
      } catch (error) {
        if (!this.active) return;
        if (error instanceof NoteConflict) this.update({ state: "conflict", remote: error.remote });
        else this.update({ state: "error" });
        return;
      }
    }
  }
  receiveRemote(remote: NoteVersion) {
    if (
      this.running ||
      remote.updated_at === this.base.updated_at ||
      Date.parse(remote.updated_at) < Date.parse(this.base.updated_at)
    )
      return;
    if (this.snapshot.state === "conflict") {
      this.update({ remote });
      return;
    }
    if (sameText(this.snapshot.draft, this.base) || sameText(this.snapshot.draft, remote)) {
      this.base = remote;
      this.update({
        draft: { title: remote.title, content: remote.content },
        state: "clean",
        recovered: false,
      });
      this.clearSaved(remote);
    } else if (sameText(remote, this.base)) {
      this.base = remote;
      this.persist();
    } else {
      this.update({ state: "conflict", remote });
      clearTimeout(this.timer);
    }
  }
  keepDraft() {
    if (!this.snapshot.remote) return;
    this.base = this.snapshot.remote;
    this.update({ state: "dirty", remote: null });
    this.persist();
    void this.flush();
  }
  useRemote() {
    if (!this.snapshot.remote) return;
    this.base = this.snapshot.remote;
    this.update({
      draft: { title: this.base.title, content: this.base.content },
      state: "clean",
      remote: null,
      recovered: false,
    });
    try {
      this.store.discard();
      this.update({ localError: false });
    } catch {
      this.update({ localError: true });
    }
  }
}
