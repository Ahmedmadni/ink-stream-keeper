import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CheckSquare, Home, LayoutGrid, NotebookText, Plus, Settings, ShieldCheck, ShoppingBag, Target,
} from "lucide-react";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import { useNotes, useTasks } from "@/lib/data";
import { plainTextFromHtml } from "@/lib/format";

const NAV = [
  { to: "/", label: "الرئيسية", icon: Home },
  { to: "/notes", label: "المذكرات", icon: NotebookText },
  { to: "/tasks", label: "المهام", icon: CheckSquare },
  { to: "/plans", label: "الخطط", icon: Target },
  { to: "/purchases", label: "المشتريات", icon: ShoppingBag },
  { to: "/workspaces", label: "مساحات العمل", icon: LayoutGrid },
  { to: "/vault", label: "الخزنة", icon: ShieldCheck },
  { to: "/settings", label: "الإعدادات", icon: Settings },
] as const;

/** لوحة الأوامر السريعة — Ctrl/Cmd + K */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data: notes = [] } = useNotes();
  const { data: tasks = [] } = useTasks();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    const onOpen = () => setOpen(true);
    window.addEventListener("memoflow:open-command-palette", onOpen);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("memoflow:open-command-palette", onOpen);
    };
  }, []);

  const go = (to: string, params?: Record<string, string>) => {
    setOpen(false);
    navigate({ to: to as never, params: params as never });
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="ابحث أو نفّذ أمراً… (Ctrl + K)" />
      <CommandList>
        <CommandEmpty>لا توجد نتائج.</CommandEmpty>
        <CommandGroup heading="إجراءات سريعة">
          <CommandItem onSelect={() => go("/create")}>
            <Plus /> <span>إنشاء عنصر جديد</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="التنقل">
          {NAV.map((n) => (
            <CommandItem key={n.to} onSelect={() => go(n.to)}>
              <n.icon /> <span>{n.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        {tasks.length > 0 && (
          <CommandGroup heading="المهام">
            {tasks.slice(0, 20).map((t) => (
              <CommandItem key={t.id} value={`مهمة ${t.title}`} onSelect={() => go("/tasks/$id", { id: t.id })}>
                <CheckSquare /> <span className="truncate">{t.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {notes.length > 0 && (
          <CommandGroup heading="المذكرات">
            {notes.slice(0, 20).map((n) => (
              <CommandItem
                key={n.id}
                value={`ملاحظة ${n.title} ${plainTextFromHtml(n.content ?? "").slice(0, 60)}`}
                onSelect={() => go("/notes/$id", { id: n.id })}
              >
                <NotebookText /> <span className="truncate">{n.title || "بدون عنوان"}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}