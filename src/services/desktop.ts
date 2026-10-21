export type DesktopFloatingNote = {
  kind: "note";
  id: string;
  userId: string;
  title: string;
  text: string;
  updatedAt: string;
  dark: boolean;
};
export type DesktopFloatingTask = Omit<DesktopFloatingNote, "kind"> & {
  kind: "task";
  done: boolean;
  items: { id: string; title: string; done: boolean }[];
};
export type DesktopFloatingCard = DesktopFloatingNote | DesktopFloatingTask;
export type DesktopFloatingStatus = { ids: string[] };

type DesktopBridge = {
  isDesktop: true;
  version: string;
  setFloatingOwner(userId: string | null): Promise<DesktopFloatingStatus>;
  openFloatingCard(card: DesktopFloatingCard): Promise<DesktopFloatingStatus>;
  dropFloatingCard(input: {
    card: DesktopFloatingCard;
    point: { x: number; y: number };
  }): Promise<{ opened: boolean }>;
  syncFloatingCards(input: {
    userId: string;
    kind: DesktopFloatingCard["kind"];
    cards: DesktopFloatingCard[];
  }): Promise<DesktopFloatingStatus>;
  getFloatingStatus(): Promise<DesktopFloatingStatus>;
  closeFloatingNotes(): Promise<DesktopFloatingStatus>;
  onFloatingStatus(listener: (status: DesktopFloatingStatus) => void): () => void;
  onOpenCard(
    listener: (card: { id: string; kind: DesktopFloatingCard["kind"] }) => void,
  ): () => void;
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
