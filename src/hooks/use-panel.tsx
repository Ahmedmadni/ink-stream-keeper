import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * Global "selected item" panel state for the tablet Master/Detail layout.
 * Encoded in the URL as ?panel=<type>:<id> so it's shareable and survives
 * back/forward. Uses history.replaceState — no route reload.
 */
export type PanelKind = "notes" | "tasks" | "purchases" | "plans" | "workspaces";

export type PanelSelection = { kind: PanelKind; id: string } | null;

function parse(raw: string | null): PanelSelection {
  if (!raw) return null;
  const [kind, id] = raw.split(":");
  if (!id) return null;
  if (!["notes", "tasks", "purchases", "plans", "workspaces"].includes(kind)) return null;
  return { kind: kind as PanelKind, id };
}

function stringify(s: PanelSelection): string | null {
  return s ? `${s.kind}:${s.id}` : null;
}

function readUrl(): PanelSelection {
  if (typeof window === "undefined") return null;
  return parse(new URLSearchParams(window.location.search).get("panel"));
}

type Ctx = {
  selection: PanelSelection;
  select: (s: PanelSelection) => void;
  clear: () => void;
};

const PanelCtx = createContext<Ctx | null>(null);

export function PanelProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<PanelSelection>(() => readUrl());

  const sync = useCallback((s: PanelSelection) => {
    setSelection(s);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const value = stringify(s);
    if (value) url.searchParams.set("panel", value);
    else url.searchParams.delete("panel");
    window.history.replaceState(window.history.state, "", url.toString());
  }, []);

  useEffect(() => {
    const onPop = () => setSelection(readUrl());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return (
    <PanelCtx.Provider value={{ selection, select: sync, clear: () => sync(null) }}>
      {children}
    </PanelCtx.Provider>
  );
}

export function usePanel(): Ctx {
  const ctx = useContext(PanelCtx);
  if (!ctx) return { selection: null, select: () => {}, clear: () => {} };
  return ctx;
}

/** True when the viewport is tablet+ (matches Tailwind `md:` = 768px). */
export function useIsTablet(): boolean {
  const [is, setIs] = useState<boolean>(() =>
    typeof window === "undefined" ? false : window.matchMedia("(min-width: 768px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const on = () => setIs(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return is;
}