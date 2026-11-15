import { z } from "zod";
import { parseNotebook, type Notebook } from "./model";

const PREFIX = "MF_ENCRYPTED_NOTE_COPY_V1:";
const schema = z.object({
  version: z.literal(1),
  title: z.string().min(1).max(500),
  content: z.string().max(1_500_000),
  copiedAt: z.string().datetime({ offset: true }),
}).strict();

export type VaultNoteCopy = z.infer<typeof schema>;

/** Stored ONLY inside the vault entry's encrypted 'notes' field.
 * The original note stays outside the vault until separately deleted by user. */
export function serializeVaultNoteCopy(title: string, content: string, now = new Date().toISOString()): string {
  const copy = schema.parse({ version: 1, title, content, copiedAt: now });
  // Fail closed for damaged paged-note data before sending it into the vault.
  parseNotebook(content);
  return PREFIX + JSON.stringify(copy);
}
export function isVaultNoteCopy(value: string): boolean {
  return value.startsWith(PREFIX);
}
export function parseVaultNoteCopy(value: string): VaultNoteCopy | null {
  if (!isVaultNoteCopy(value)) return null;
  return schema.parse(JSON.parse(value.slice(PREFIX.length)));
}
export function vaultNotePages(content: string): Notebook | null {
  return parseNotebook(content);
}
