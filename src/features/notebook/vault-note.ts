import { z } from "zod";
import { MAX_NOTEBOOK_BYTES, parseNotebook, type Notebook } from "./model";

const PREFIX = "MF_ENCRYPTED_NOTE_COPY_V1:";
// The notebook wrapper contains base64 plus an escaped search preview. A valid
// notebook must not fail vault copying at the old, smaller 1.5 MB string limit.
export const MAX_VAULT_NOTE_CONTENT_LENGTH = Math.ceil(MAX_NOTEBOOK_BYTES / 3) * 4 + 100_000;
const schema = z.object({
  version: z.literal(1),
  title: z.string().min(1).max(500),
  content: z.string().max(MAX_VAULT_NOTE_CONTENT_LENGTH),
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
  const copy = schema.parse(JSON.parse(value.slice(PREFIX.length)));
  parseNotebook(copy.content);
  return copy;
}
export function vaultNotePages(content: string): Notebook | null {
  return parseNotebook(content);
}
