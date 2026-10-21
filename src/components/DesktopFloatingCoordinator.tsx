import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { notesQuery, tasksQuery, taskSubItemSummariesQuery } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import { desktopBridge, isDesktop } from "@/services/desktop";
import { desktopNoteSnapshot } from "@/features/notes/desktop-floating";
import { desktopTaskSnapshot } from "@/features/tasks/desktop-floating";

export function DesktopFloatingCoordinator() {
  const [owner, setOwner] = useState<string | null>(null);
  const [themeRevision, setThemeRevision] = useState(0);
  const navigate = useNavigate();
  const query = useQuery({ ...notesQuery, enabled: isDesktop() && !!owner });
  const tasks = useQuery({ ...tasksQuery, enabled: isDesktop() && !!owner });
  const summaries = useQuery({ ...taskSubItemSummariesQuery, enabled: isDesktop() && !!owner });
  useEffect(() => {
    const bridge = desktopBridge();
    if (!bridge) return;
    let active = true,
      generation = 0;
    const receive = (id: string | null) => {
      if (!active) return;
      setOwner(id);
      void bridge.setFloatingOwner(id).catch(() => undefined);
    };
    const { data: auth } = supabase.auth.onAuthStateChange((_event, session) => {
      generation++;
      receive(session?.user.id ?? null);
    });
    const initialGeneration = generation;
    void supabase.auth.getSession().then(({ data }) => {
      if (generation === initialGeneration) receive(data.session?.user.id ?? null);
    });
    const remove = bridge.onOpenCard(
      ({ id, kind }) =>
        void navigate({ to: kind === "task" ? "/tasks/$id" : "/notes/$id", params: { id } }),
    );
    const theme = new MutationObserver(() => setThemeRevision((value) => value + 1));
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => {
      active = false;
      auth.subscription.unsubscribe();
      remove();
      theme.disconnect();
    };
  }, [navigate]);
  useEffect(() => {
    const bridge = desktopBridge();
    if (
      !bridge ||
      !owner ||
      !query.isSuccess ||
      !query.data.every((note) => note.user_id === owner)
    )
      return;
    void bridge
      .syncFloatingCards({
        userId: owner,
        kind: "note",
        cards: query.data.map(desktopNoteSnapshot),
      })
      .catch(() => undefined);
  }, [owner, query.isSuccess, query.data, themeRevision]);
  useEffect(() => {
    const bridge = desktopBridge();
    if (
      !bridge ||
      !owner ||
      !tasks.isSuccess ||
      !summaries.isSuccess ||
      !tasks.data.every((task) => task.user_id === owner)
    )
      return;
    void bridge
      .syncFloatingCards({
        userId: owner,
        kind: "task",
        cards: tasks.data.map((task) => desktopTaskSnapshot(task, summaries.data[task.id])),
      })
      .catch(() => undefined);
  }, [owner, tasks.isSuccess, tasks.data, summaries.isSuccess, summaries.data, themeRevision]);
  return null;
}
