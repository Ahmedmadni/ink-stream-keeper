export type DesktopFloatingNote = {
  id: string;
  userId: string;
  title: string;
  text: string;
  updatedAt: string;
  dark: boolean;
};
export type DesktopFloatingStatus = { ids: string[] };

type DesktopBridge = {
  isDesktop: true;
  version: string;
  setFloatingOwner(userId: string | null): Promise<DesktopFloatingStatus>;
  openFloatingNote(note: DesktopFloatingNote): Promise<DesktopFloatingStatus>;
  dropFloatingNote(input: {
    note: DesktopFloatingNote;
    point: { x: number; y: number };
  }): Promise<{ opened: boolean }>;
  syncFloatingNotes(input: {
    userId: string;
    notes: DesktopFloatingNote[];
  }): Promise<DesktopFloatingStatus>;
  getFloatingStatus(): Promise<DesktopFloatingStatus>;
  closeFloatingNotes(): Promise<DesktopFloatingStatus>;
  onFloatingStatus(listener: (status: DesktopFloatingStatus) => void): () => void;
  onOpenNote(listener: (id: string) => void): () => void;
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
