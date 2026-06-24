import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, NotebookPen, CheckSquare, ShoppingCart, Pencil, Image as ImageIcon, Mic } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { actions, useStore, type Attachment } from "@/lib/store";
import { RichEditor } from "@/components/RichEditor";

export const Route = createFileRoute("/create")({
  head: () => ({
    meta: [
      { title: "MemoFlow — إنشاء" },
      { name: "description", content: "أنشئ ملاحظة، مهمة، قائمة مشتريات أو رسم حر." },
    ],
  }),
  component: CreatePage,
});

type Mode = "menu" | "note" | "task";

function CreatePage() {
  const [mode, setMode] = useState<Mode>("menu");
  const router = useRouter();
  const categories = useStore((s) => s.categories);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [categoryId, setCategoryId] = useState("ideas");

  if (mode === "menu") {
    const items = [
      { icon: NotebookPen, label: "ملاحظة جديدة", desc: "نص حر مع تنسيق", onClick: () => setMode("note") },
      { icon: CheckSquare, label: "مهمة جديدة", desc: "مع وقت وأولوية", onClick: () => setMode("task") },
      { icon: ShoppingCart, label: "قائمة مشتريات", desc: "تجميع سريع", onClick: () => { setCategoryId("shopping"); setMode("note"); } },
      { icon: Pencil, label: "رسم حر", desc: "قريباً", onClick: () => {}, disabled: true },
      { icon: ImageIcon, label: "إدراج صورة", desc: "قريباً", onClick: () => {}, disabled: true },
      { icon: Mic, label: "تسجيل صوتي", desc: "قريباً", onClick: () => {}, disabled: true },
    ];
    return (
      <AppShell>
        <header className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-5 pb-2 pt-6">
          <button onClick={() => router.history.back()} className="grid size-10 place-items-center rounded-full bg-card shadow-card" aria-label="رجوع">
            <ArrowRight className="size-5" />
          </button>
          <h1 className="text-2xl font-extrabold">إنشاء جديد</h1>
        </header>
        <p className="px-5 pt-1 text-sm text-muted-foreground">اختر نوع العنصر الذي تريد إنشاءه.</p>

        <div className="mt-6 grid grid-cols-2 gap-3 px-5">
          {items.map((it) => (
            <button
              key={it.label}
              onClick={it.onClick}
              disabled={it.disabled}
              className="flex flex-col items-start gap-3 rounded-2xl bg-card p-4 text-right shadow-card transition-transform active:scale-[0.98] disabled:opacity-50"
            >
              <div className="grid size-12 place-items-center rounded-xl gradient-primary text-primary-foreground">
                <it.icon className="size-6" />
              </div>
              <div>
                <p className="text-sm font-bold">{it.label}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{it.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </AppShell>
    );
  }

  if (mode === "note") {
    return (
      <AppShell>
        <FormHeader title="ملاحظة جديدة" onBack={() => setMode("menu")} />
        <div className="space-y-3 px-5 pt-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="العنوان..."
            className="w-full rounded-2xl bg-card px-4 py-3 text-lg font-bold outline-none shadow-card placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary"
          />
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full rounded-2xl bg-card px-4 py-3 text-sm font-semibold outline-none shadow-card"
          >
            {categories.filter((c) => c.id !== "all").map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <RichEditor
            value={content}
            onChange={setContent}
            placeholder="ابدأ الكتابة... استخدم الشريط لتنسيق النص وإضافة قوائم وصور."
            onAddAttachment={(file) => {
              const reader = new FileReader();
              reader.onload = () => {
                setAttachments((prev) => [
                  ...prev,
                  { id: `a_${Date.now()}`, name: file.name, type: file.type, size: file.size, dataUrl: reader.result as string },
                ]);
              };
              reader.readAsDataURL(file);
            }}
          />
          {attachments.length > 0 && (
            <p className="text-xs text-muted-foreground">📎 {attachments.length} مرفق سيتم حفظه مع الملاحظة</p>
          )}
          <button
            onClick={() => {
              if (!title.trim()) return;
              const id = actions.addNote({
                title: title.trim(),
                content: content.trim(),
                categoryId,
                emoji: "📝",
                attachments: attachments.length ? attachments : undefined,
                hasAttachment: attachments.length > 0,
              });
              router.navigate({ to: "/notes/$id", params: { id } });
            }}
            className="w-full rounded-2xl gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-fab"
          >
            حفظ الملاحظة
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <FormHeader title="مهمة جديدة" onBack={() => setMode("menu")} />
      <TaskForm onDone={() => router.navigate({ to: "/tasks" })} />
    </AppShell>
  );
}

function FormHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-5 pb-2 pt-6">
      <button onClick={onBack} className="grid size-10 place-items-center rounded-full bg-card shadow-card" aria-label="رجوع">
        <ArrowRight className="size-5" />
      </button>
      <h1 className="truncate text-2xl font-extrabold">{title}</h1>
    </header>
  );
}

function TaskForm({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [priority, setPriority] = useState<"low" | "med" | "high">("med");

  return (
    <div className="space-y-3 px-5 pt-4">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="عنوان المهمة..."
        className="w-full rounded-2xl bg-card px-4 py-3 text-lg font-bold outline-none shadow-card placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary"
      />
      <div className="grid grid-cols-2 gap-3">
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="rounded-2xl bg-card px-4 py-3 text-sm outline-none shadow-card"
        />
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as "low" | "med" | "high")}
          className="rounded-2xl bg-card px-4 py-3 text-sm font-semibold outline-none shadow-card"
        >
          <option value="low">أولوية منخفضة</option>
          <option value="med">أولوية متوسطة</option>
          <option value="high">أولوية عالية</option>
        </select>
      </div>
      <button
        onClick={() => {
          if (!title.trim()) return;
          let due: number | undefined;
          if (time) {
            const [h, m] = time.split(":").map(Number);
            const d = new Date();
            d.setHours(h, m, 0, 0);
            due = d.getTime();
          }
          actions.addTask({ title: title.trim(), due, priority });
          onDone();
        }}
        className="w-full rounded-2xl gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-fab"
      >
        حفظ المهمة
      </button>
    </div>
  );
}