import { TABLES, type BackupTables } from "../src/features/backup/rows";
import type { Backup } from "../src/features/backup/format";
export const ACCOUNT = "11111111-1111-4111-8111-111111111111";
export const OTHER = "22222222-2222-4222-8222-222222222222";
export const NOTE = "33333333-3333-4333-8333-333333333333";
export function fixture(): Backup {
  const tables = Object.fromEntries(TABLES.map((t) => [t, []])) as unknown as BackupTables;
  tables.notes.push({
    id: NOTE,
    user_id: ACCOUNT,
    category_id: null,
    title: "مذكرة خاصة",
    content: "<p>نص عربي محفوظ</p>",
    emoji: null,
    pinned: false,
    favorite: true,
    archived: false,
    created_at: "2026-10-11T00:00:00Z",
    updated_at: "2026-10-11T00:00:00Z",
  });
  return {
    format: "memoflow-backup",
    version: 1,
    accountId: ACCOUNT,
    createdAt: "2026-10-11T00:00:00Z",
    tables,
    files: [],
  };
}
