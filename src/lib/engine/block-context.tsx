import { createContext, useContext, useMemo, type ReactNode } from "react";

export type BlockDeviceType = "mobile" | "tablet" | "desktop";
export type BlockPermission = "read" | "edit" | "admin";

export type BlockContextValue<Item = unknown, Mutations = unknown> = {
  kind: string;
  id: string;
  item: Item;
  mutations?: Mutations;
  workspace?: { id: string; name?: string } | null;
  permissions: BlockPermission[];
  readonly: boolean;
  deviceType: BlockDeviceType;
  selection?: unknown;
};

const Ctx = createContext<BlockContextValue | null>(null);

export function BlockProvider<I, M>({
  value, children,
}: { value: BlockContextValue<I, M>; children: ReactNode }) {
  const memo = useMemo(() => value, [
    value.kind, value.id, value.item, value.mutations,
    value.workspace, value.readonly, value.deviceType,
    value.permissions, value.selection,
  ]);
  return <Ctx.Provider value={memo as BlockContextValue}>{children}</Ctx.Provider>;
}

export function useBlockContext<I = unknown, M = unknown>(): BlockContextValue<I, M> {
  const v = useContext(Ctx);
  if (!v) throw new Error("useBlockContext must be used inside <BlockProvider>");
  return v as BlockContextValue<I, M>;
}

export function useMaybeBlockContext<I = unknown, M = unknown>(): BlockContextValue<I, M> | null {
  return (useContext(Ctx) as BlockContextValue<I, M> | null) ?? null;
}

export function useCanEdit(): boolean {
  const ctx = useMaybeBlockContext();
  if (!ctx) return true; // legacy usage: assume editable when explicit handlers passed
  if (ctx.readonly) return false;
  return ctx.permissions.includes("edit") || ctx.permissions.includes("admin");
}