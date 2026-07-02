/**
 * Notifications service — Web Notification API wrapper.
 */
export interface NotifyOptions {
  body?: string;
  icon?: string;
  tag?: string;
  data?: unknown;
}

export type NotifyPermission = "granted" | "denied" | "default" | "unsupported";

export interface NotificationsService {
  isSupported(): boolean;
  permission(): NotifyPermission;
  request(): Promise<NotifyPermission>;
  show(title: string, options?: NotifyOptions): void;
}

export const notifications: NotificationsService = {
  isSupported() { return typeof window !== "undefined" && "Notification" in window; },
  permission() {
    if (!this.isSupported()) return "unsupported";
    return Notification.permission as NotifyPermission;
  },
  async request() {
    if (!this.isSupported()) return "unsupported";
    try { return (await Notification.requestPermission()) as NotifyPermission; }
    catch { return "denied"; }
  },
  show(title, options) {
    if (this.permission() !== "granted") return;
    try { new Notification(title, options); } catch { /* noop */ }
  },
};