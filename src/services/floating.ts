import { isNative } from "./platform";

export type FloatingItem = { kind: "note" | "task"; title: string };

type FloatingPlugin = {
  checkPermission(): Promise<{ granted: boolean }>;
  requestPermission(): Promise<{ granted: boolean }>;
  show(o: { items: FloatingItem[] }): Promise<void>;
  hide(): Promise<void>;
};

let plugin: FloatingPlugin | null = null;
async function get(): Promise<FloatingPlugin | null> {
  if (!isNative()) return null;
  if (!plugin) {
    const { registerPlugin } = await import("@capacitor/core");
    plugin = registerPlugin<FloatingPlugin>("MemoFlowFloating");
  }
  return plugin;
}

export function floatingSupported() {
  return isNative();
}
export async function floatingPermission() {
  return (await (await get())?.checkPermission())?.granted ?? false;
}
export async function requestFloatingPermission() {
  return (await (await get())?.requestPermission())?.granted ?? false;
}
export async function showFloating(items: FloatingItem[]) {
  await (await get())?.show({ items });
}
export async function hideFloating() {
  await (await get())?.hide();
}
