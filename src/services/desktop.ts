type DesktopBridge = {
  isDesktop: true;
  version: string;
  openOAuth(url: string): Promise<void>;
  getLaunchUrl(): Promise<{ url?: string }>;
  onAuthCallback(listener: (url: string) => void): () => void;
};

declare global {
  interface Window {
    memoFlowDesktop?: DesktopBridge;
  }
}

export function desktopBridge(): DesktopBridge | undefined {
  return typeof window !== "undefined" ? window.memoFlowDesktop : undefined;
}

export function isDesktop(): boolean {
  return desktopBridge()?.isDesktop === true;
}
