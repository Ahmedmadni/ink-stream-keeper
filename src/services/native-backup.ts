import { registerPlugin } from "@capacitor/core";
import { isNative } from "./platform";

export type NativeBackupStatus = {
  configured: boolean;
  enabled: boolean;
  driveFolderSelected: boolean;
  driveFolderName: string;
  lastBackupAt: number;
  lastDriveAt: number;
};

export type NativeBackupSaveResult = {
  localUri: string;
  driveSaved: boolean;
  driveUri: string;
  driveError: string;
  savedAt: number;
};

type NativeBackupPlugin = {
  getStatus(options: { accountId: string }): Promise<NativeBackupStatus>;
  configure(options: { accountId: string; password: string }): Promise<void>;
  setEnabled(options: { accountId: string; enabled: boolean }): Promise<void>;
  getPassword(options: { accountId: string }): Promise<{ password: string }>;
  chooseDriveFolder(options: { accountId: string }): Promise<{ name: string }>;
  saveBackup(options: {
    accountId: string;
    contents: string;
    filename: string;
  }): Promise<NativeBackupSaveResult>;
  clearConfiguration(): Promise<void>;
};

const nativePlugin = registerPlugin<NativeBackupPlugin>("MemoFlowBackup");

export const AUTO_BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

export function autoBackupDue(lastBackupAt: number, now = Date.now()): boolean {
  return (
    !Number.isFinite(lastBackupAt) ||
    lastBackupAt <= 0 ||
    now - lastBackupAt >= AUTO_BACKUP_INTERVAL_MS
  );
}

export function automaticBackupName(date = new Date()): string {
  const stamp = date.toISOString().slice(0, 10);
  return `MemoFlow-auto-${stamp}.memoflow`;
}

export const nativeBackup = {
  supported: isNative,
  async status(accountId: string): Promise<NativeBackupStatus> {
    if (!isNative()) {
      return {
        configured: false,
        enabled: false,
        driveFolderSelected: false,
        driveFolderName: "",
        lastBackupAt: 0,
        lastDriveAt: 0,
      };
    }
    return nativePlugin.getStatus({ accountId });
  },
  async configure(accountId: string, password: string) {
    if (password.length < 12 || password.length > 256)
      throw new Error("كلمة مرور النسخة يجب أن تكون بين 12 و256 حرفًا");
    await nativePlugin.configure({ accountId, password });
  },
  async setEnabled(accountId: string, enabled: boolean) {
    await nativePlugin.setEnabled({ accountId, enabled });
  },
  async password(accountId: string): Promise<string> {
    return (await nativePlugin.getPassword({ accountId })).password;
  },
  async chooseDriveFolder(accountId: string) {
    return nativePlugin.chooseDriveFolder({ accountId });
  },
  async save(accountId: string, contents: string, filename = automaticBackupName()) {
    return nativePlugin.saveBackup({ accountId, contents, filename });
  },
  async clearConfiguration() {
    if (isNative()) await nativePlugin.clearConfiguration();
  },
};
