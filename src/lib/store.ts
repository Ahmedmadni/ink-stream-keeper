import { useSyncExternalStore } from "react";

export type Category = {
  id: string;
  name: string;
  icon: string; // lucide icon name
  color: string; // tailwind/oklch hue token e.g. "primary" | "warning" | hex
  locked?: boolean;
};

export type Note = {
  id: string;
  title: string;
  content: string; // HTML (TipTap)
  categoryId: string;
  pinned?: boolean;
  favorite?: boolean;
  archived?: boolean;
  updatedAt: number;
  hasAttachment?: boolean;
  emoji?: string;
  attachments?: Attachment[];
};

export type Attachment = {
  id: string;
  name: string;
  type: string; // mime
  size: number;
  dataUrl: string; // base64
};

export type Task = {
  id: string;
  title: string;
  description?: string;
  done: boolean;
  due?: number; // timestamp
  priority?: "low" | "med" | "high";
  categoryId?: string;
};

type State = {
  categories: Category[];
  notes: Note[];
  tasks: Task[];
  user: { name: string; avatar?: string };
};

const STORAGE_KEY = "memoflow:v1";

const now = Date.now();
const day = 86_400_000;

const defaultState: State = {
  user: { name: "أحمد" },
  categories: [
    { id: "all", name: "كل الملاحظات", icon: "Notebook", color: "primary" },
    { id: "ideas", name: "أفكار", icon: "Lightbulb", color: "warning" },
    { id: "tasks", name: "مهام", icon: "CheckSquare", color: "primary" },
    { id: "shopping", name: "مشتريات", icon: "ShoppingCart", color: "success" },
    { id: "private", name: "كتابات خاصة", icon: "Lock", color: "destructive", locked: true },
    { id: "work", name: "العمل", icon: "Briefcase", color: "primary" },
    { id: "study", name: "الدراسة", icon: "GraduationCap", color: "warning" },
  ],
  notes: [
    {
      id: "n1",
      title: "خطة مشروع ERP",
      content: "هذا المشروع مهم جداً ويحتاج إلى متابعة يومية وتخصيص فريق عمل دائم.",
      categoryId: "work",
      pinned: true,
      favorite: true,
      updatedAt: now - 3 * 3600_000,
      emoji: "📊",
    },
    {
      id: "n2",
      title: "قائمة مشتريات الأسبوع",
      content: "حليب، خبز، بيض، فواكه، خضروات، زيت زيتون، أرز.",
      categoryId: "shopping",
      updatedAt: now - day,
      emoji: "🛒",
    },
    {
      id: "n3",
      title: "أفكار لمشروع جديد",
      content: "تطبيق يساعد في تنظيم المهام والملاحظات بواجهة عربية رائعة.",
      categoryId: "ideas",
      updatedAt: now - 2 * day,
      emoji: "💡",
    },
    {
      id: "n4",
      title: "رحلة إلى جبال السعودية",
      content: "الطقس كان رائع ومناسب للمشي. المناظر الطبيعية خلابة جداً. يجب العودة مرة أخرى في الشتاء.",
      categoryId: "ideas",
      updatedAt: now - 5 * day,
      hasAttachment: true,
      emoji: "⛰️",
    },
    {
      id: "n5",
      title: "اجتماع فريق العمل",
      content: "مراجعة تقارير الربع الأخير، تحديد أولويات الربع القادم، توزيع المهام على الفريق.",
      categoryId: "work",
      updatedAt: now - 6 * day,
      hasAttachment: true,
      emoji: "💼",
    },
  ],
  tasks: [
    { id: "t1", title: "مراجعة تقرير المشروع", done: false, due: now + 3 * 3600_000, priority: "high", categoryId: "work" },
    { id: "t2", title: "الاجتماع مع فريق العمل", done: false, due: now + 6 * 3600_000, priority: "med", categoryId: "work" },
    { id: "t3", title: "شراء مستلزمات المكتب", done: false, due: now + 9 * 3600_000, priority: "low", categoryId: "shopping" },
    { id: "t4", title: "إرسال العرض التقديمي", done: false, due: now + day + 9 * 3600_000, priority: "high", categoryId: "work" },
    { id: "t5", title: "متابعة العملاء", done: false, due: now + day + 11 * 3600_000, priority: "med", categoryId: "work" },
    { id: "t6", title: "تسليم المشروع النهائي", done: false, due: now + 7 * day, priority: "high", categoryId: "work" },
    { id: "t7", title: "كتابة ملخص الاجتماع", done: true, due: now - day, priority: "low", categoryId: "work" },
    { id: "t8", title: "ترتيب مكتب العمل", done: true, due: now - 2 * day, priority: "low" },
  ],
};

let state: State = load();
const listeners = new Set<() => void>();

function load(): State {
  if (typeof window === "undefined") return defaultState;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw);
    return { ...defaultState, ...parsed };
  } catch {
    return defaultState;
  }
}

function save() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

function setState(updater: (s: State) => State) {
  state = updater(state);
  save();
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(defaultState),
  );
}

export const actions = {
  addNote(input: Omit<Note, "id" | "updatedAt"> & { id?: string }) {
    const note: Note = {
      id: input.id ?? `n_${Date.now()}`,
      updatedAt: Date.now(),
      ...input,
    };
    setState((s) => ({ ...s, notes: [note, ...s.notes] }));
    return note.id;
  },
  updateNote(id: string, patch: Partial<Note>) {
    setState((s) => ({
      ...s,
      notes: s.notes.map((n) =>
        n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n,
      ),
    }));
  },
  deleteNote(id: string) {
    setState((s) => ({ ...s, notes: s.notes.filter((n) => n.id !== id) }));
  },
  togglePin(id: string) {
    setState((s) => ({
      ...s,
      notes: s.notes.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n)),
    }));
  },
  toggleFavorite(id: string) {
    setState((s) => ({
      ...s,
      notes: s.notes.map((n) => (n.id === id ? { ...n, favorite: !n.favorite } : n)),
    }));
  },
  addTask(input: Omit<Task, "id" | "done"> & { done?: boolean }) {
    const task: Task = { id: `t_${Date.now()}`, done: false, ...input };
    setState((s) => ({ ...s, tasks: [task, ...s.tasks] }));
    return task.id;
  },
  toggleTask(id: string) {
    setState((s) => ({
      ...s,
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    }));
  },
  deleteTask(id: string) {
    setState((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }));
  },
  addCategory(c: Omit<Category, "id">) {
    setState((s) => ({ ...s, categories: [...s.categories, { id: `c_${Date.now()}`, ...c }] }));
  },
};

// helpers
export function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "الآن";
  if (diff < 3600_000) return `قبل ${Math.floor(diff / 60_000)} د`;
  if (diff < day) return `اليوم، ${formatTime(ts)}`;
  if (diff < 2 * day) return `أمس، ${formatTime(ts)}`;
  if (diff < 7 * day) return `قبل ${Math.floor(diff / day)} أيام`;
  return new Date(ts).toLocaleDateString("ar-EG", { day: "numeric", month: "short" });
}

export function formatTime(ts: number): string {
  const d = new Date(ts);
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const period = h >= 12 ? "م" : "ص";
  h = h % 12 || 12;
  return `${h}:${m} ${period}`;
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "صباح الخير";
  if (h < 18) return "مساء الخير";
  return "مساء الخير";
}