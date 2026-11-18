import { decryptString, decryptVaultField } from "../../lib/vault-crypto";
import { parseVaultNoteCopy } from "./vault-note";

export type EncryptedNoteCopyRow = {
  id: string; user_id: string; label: string; username: string; url: string; notes: string;
  password_iv: string; password_ct: string;
};
/** Read-after-write verification: test persisted ciphertext, authenticated
 * decryption and the complete original payload. A failed verification never
 * removes either source note or the possibly saved encrypted copy. */
export async function verifyStoredVaultNoteCopy(
  stored: EncryptedNoteCopyRow | undefined,
  expected: { id: string; userId: string; label: string; notes: string },
  key: CryptoKey,
): Promise<void> {
  if (!stored || stored.id !== expected.id || stored.user_id !== expected.userId)
    throw new Error("لم نتمكن من التحقق من النسخة المحفوظة. الأصل ما زال محفوظًا؛ راجع الخزنة قبل إعادة النسخ.");
  const fields = ["label", "username", "url", "notes"] as const;
  const values = await Promise.all(fields.map((field) => decryptVaultField(stored[field], field, key)));
  if (values.some((v) => !v.encrypted) || values[0].value !== expected.label || values[1].value !== "" || values[2].value !== "" || values[3].value !== expected.notes)
    throw new Error("لم تتطابق النسخة المشفرة مع المذكرة الأصلية. لم يتم حذف الأصل.");
  if (!parseVaultNoteCopy(values[3].value) || await decryptString(stored.password_iv, stored.password_ct, key) !== "")
    throw new Error("تعذر التحقق من محتوى المذكرة المشفرة. لم يتم حذف الأصل.");
}
