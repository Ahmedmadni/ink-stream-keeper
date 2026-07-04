import { useEffect } from "react";

/**
 * Lightweight event bus for cross-block communication.
 * Blocks never talk to each other directly — they emit events and
 * whoever cares (page, toolbar, inspector) subscribes.
 */
export type BlockEventMap = {
  "item:update": { kind: string; id: string; patch: Record<string, unknown> };
  "item:delete": { kind: string; id: string };
  "item:favorite": { kind: string; id: string; value: boolean };
  "item:archive": { kind: string; id: string; value: boolean };
  "item:duplicate": { kind: string; id: string };
  "item:share": { kind: string; id: string };
  "item:export": { kind: string; id: string; format?: string };
  "checklist:toggle": { itemId: string; done: boolean };
  "checklist:add": { text: string };
  "checklist:edit": { itemId: string; text: string };
  "checklist:delete": { itemId: string };
  "tag:add": { tag: string };
  "tag:remove": { tag: string };
  "link:add": { url: string };
  "link:remove": { url: string };
  "field:save": { name: string; value: unknown };
  "history:undo": Record<string, never>;
  "history:redo": Record<string, never>;
};

type Handler<K extends keyof BlockEventMap> = (payload: BlockEventMap[K]) => void;

const listeners = new Map<keyof BlockEventMap, Set<Handler<any>>>();

export function emit<K extends keyof BlockEventMap>(event: K, payload: BlockEventMap[K]): void {
  const set = listeners.get(event);
  if (!set) return;
  set.forEach((cb) => { try { cb(payload); } catch (e) { console.error("[block-events]", event, e); } });
}

export function on<K extends keyof BlockEventMap>(event: K, cb: Handler<K>): () => void {
  let set = listeners.get(event);
  if (!set) { set = new Set(); listeners.set(event, set); }
  set.add(cb);
  return () => { set!.delete(cb); };
}

export function useBlockEvent<K extends keyof BlockEventMap>(event: K, cb: Handler<K>): void {
  useEffect(() => on(event, cb), [event, cb]);
}