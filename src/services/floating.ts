import { isNative } from "./platform";
import { registerPlugin } from "@capacitor/core";

export type FloatingItem = { kind: "note" | "task"; title: string };

type FloatingPlugin = {
  checkPermission(): Promise<{ granted: boolean; running: boolean }>;
  requestPermission(): Promise<{ granted: boolean }>;
  show(o: { items: FloatingItem[] }): Promise<void>;
  hide(): Promise<void>;
};

let plugin: FloatingPlugin | null = null;
function get(): FloatingPlugin | null {
  if (!isNative()) return null;
  if (!plugin) {
    plugin = registerPlugin<FloatingPlugin>("MemoFlowFloating");
  }
  return plugin;
}

export function floatingSupported() {
  return isNative();
}
export async function floatingPermission() {
  return (await get()?.checkPermission())?.granted ?? false;
}
export async function floatingStatus() {
  return (await get()?.checkPermission()) ?? { granted: false, running: false };
}
export async function requestFloatingPermission() {
  return (await get()?.requestPermission())?.granted ?? false;
}
export async function showFloating(items: FloatingItem[]) {
  await get()?.show({ items });
}
export async function hideFloating() {
  await get()?.hide();
}
