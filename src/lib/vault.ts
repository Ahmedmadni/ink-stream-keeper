import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { vaultSession } from "@/features/vault/session";
import { changeVaultPinWithStore } from "@/features/vault/change-pin";
import { announceVaultPinChange } from "@/features/vault/pin-events";
import { supabase } from "@/integrations/supabase/client";
import {
  decryptVaultField,
  decryptString,
  deriveKey,
  encryptString,
  encryptVaultField,
  makeVerifier,
  randomSaltB64,
  unlockVaultKey,
} from "./vault-crypto";

export type VaultSettings = {
  user_id: string;
  kdf_salt: string;
  verifier_iv: string;
  verifier_ct: string;
};

export type VaultCategory = {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  sort_order: number;
  created_at: string;
  metadata_encrypted: boolean;
};

export type VaultEntry = {
  id: string;
  user_id: string;
  category_id: string | null;
  label: string;
  username: string;
  url: string;
  notes: string;
  password_iv: string;
  password_ct: string;
  created_at: string;
  updated_at: string;
  metadata_encrypted: boolean;
};

type StoredVaultCategory = Omit<VaultCategory, "metadata_encrypted">;
type StoredVaultEntry = Omit<VaultEntry, "metadata_encrypted">;

export const lockVault = vaultSession.lock;
export function useVaultLocked(): boolean {
  return useSyncExternalStore(vaultSession.subscribe, vaultSession.isLocked, () => true);
}

// ------- queries
const vaultKeys = {
  settings: ["vault", "settings"] as const,
  categories: ["vault", "categories"] as const,
  entries: ["vault", "entries"] as const,
};

export const vaultSettingsQuery = queryOptions({
  queryKey: vaultKeys.settings,
  queryFn: async (): Promise<VaultSettings | null> => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return null;
    const { data, error } = await supabase
      .from("vault_settings")
      .select("*")
      .eq("user_id", u.user.id)
      .maybeSingle();
    if (error) throw error;
    return (data as VaultSettings | null) ?? null;
  },
});

export const vaultCategoriesQuery = queryOptions({
  queryKey: vaultKeys.categories,
  queryFn: async (): Promise<VaultCategory[]> => {
    const { userId, key } = vaultSession.access();
    const { data, error } = await supabase
      .from("vault_categories")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return Promise.all(
      ((data ?? []) as StoredVaultCategory[]).map(async (category) => {
        if (category.user_id !== userId) throw new Error("اختلطت بيانات حساب آخر بالخزنة");
        const name = await decryptVaultField(category.name, "category_name", key);
        vaultSession.assertCurrent(userId, key);
        return { ...category, name: name.value, metadata_encrypted: name.encrypted };
      }),
    );
  },
});

export const vaultEntriesQuery = queryOptions({
  queryKey: vaultKeys.entries,
  queryFn: async (): Promise<VaultEntry[]> => {
    const { userId, key } = vaultSession.access();
    const { data, error } = await supabase
      .from("vault_entries")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return Promise.all(
      ((data ?? []) as StoredVaultEntry[]).map(async (entry) => {
        if (entry.user_id !== userId) throw new Error("اختلطت بيانات حساب آخر بالخزنة");
        const [label, username, url, notes] = await Promise.all([
          decryptVaultField(entry.label, "label", key),
          decryptVaultField(entry.username, "username", key),
          decryptVaultField(entry.url, "url", key),
          decryptVaultField(entry.notes, "notes", key),
        ]);
        vaultSession.assertCurrent(userId, key);
        return {
          ...entry,
          label: label.value,
          username: username.value,
          url: url.value,
          notes: notes.value,
          metadata_encrypted:
            label.encrypted && username.encrypted && url.encrypted && notes.encrypted,
        };
      }),
    );
  },
});

export function useVaultSettings() {
  return useQuery(vaultSettingsQuery);
}
export function useVaultCategories() {
  return useQuery(vaultCategoriesQuery);
}
export function useVaultEntries() {
  return useQuery(vaultEntriesQuery);
}

async function uid() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("غير مسجل الدخول");
  return data.user.id;
}

const DEFAULT_CATEGORIES = [
  { name: "حسابات جوجل", icon: "Mail", color: "destructive" },
  { name: "ذكاء اصطناعي", icon: "Sparkles", color: "primary" },
  { name: "تواصل اجتماعي", icon: "Users", color: "accent" },
  { name: "بنوك ومدفوعات", icon: "CreditCard", color: "success" },
  { name: "عمل", icon: "Briefcase", color: "primary" },
  { name: "أخرى", icon: "KeyRound", color: "warning" },
];

async function encryptEntryMetadata(
  input: Pick<VaultEntry, "label" | "username" | "url" | "notes">,
  key: CryptoKey,
) {
  const [label, username, url, notes] = await Promise.all([
    encryptVaultField(input.label, "label", key),
    encryptVaultField(input.username, "username", key),
    encryptVaultField(input.url, "url", key),
    encryptVaultField(input.notes, "notes", key),
  ]);
  return { label, username, url, notes };
}

// ------- mutations
export function useSetupVaultPin() {
  const qc = useQueryClient();
  return useMutation({
    gcTime: 0, // Do not retain PIN variables after the screen unmounts.
    mutationFn: async ({ pin }: { pin: string }) => {
      const ticket = vaultSession.beginUnlock();
      const userId = await uid();
      if (ticket.userId !== userId) throw new Error("تغير الحساب. أعد المحاولة.");
      const salt = randomSaltB64();
      const key = await deriveKey(pin, salt);
      const verifier = await makeVerifier(key);
      vaultSession.assertUnlockCurrent(ticket);
      const { error } = await supabase.from("vault_settings").insert({
        user_id: userId,
        kdf_salt: salt,
        verifier_iv: verifier.iv,
        verifier_ct: verifier.ct,
      });
      if (error) throw error;
      // seed default categories
      const rows = await Promise.all(
        DEFAULT_CATEGORIES.map(async (c, i) => ({
          user_id: userId,
          name: await encryptVaultField(c.name, "category_name", key),
          icon: c.icon,
          color: c.color,
          sort_order: i,
        })),
      );
      vaultSession.assertUnlockCurrent(ticket);
      const { error: categoryError } = await supabase.from("vault_categories").insert(rows);
      if (categoryError) throw categoryError;
      if (!vaultSession.completeUnlock(ticket, key))
        throw new Error("أُغلقت الخزنة. افتحها مجددًا.");
    },
    // A background lock can happen after the settings insert succeeds. Reload
    // even then so the screen offers unlock, never a second setup attempt.
    onSettled: () => {
      qc.invalidateQueries({ queryKey: vaultKeys.settings });
      qc.invalidateQueries({ queryKey: vaultKeys.categories });
    },
  });
}

export function useUnlockVault() {
  return useMutation({
    gcTime: 0,
    mutationFn: async ({ pin, settings }: { pin: string; settings: VaultSettings }) => {
      const ticket = vaultSession.beginUnlock();
      const userId = await uid();
      if (settings.user_id !== userId || ticket.userId !== userId)
        throw new Error("تغير الحساب. أعد المحاولة.");
      // A PIN changed on another device must not be checked against an old
      // settings query still present in this screen's cache.
      const { data: current, error } = await supabase
        .from("vault_settings")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      vaultSession.assertUnlockCurrent(ticket);
      if (!current || current.user_id !== userId) throw new Error("تعذر تحميل إعداد الخزنة الحالي");
      const key = await unlockVaultKey(pin, current as VaultSettings);
      if (!vaultSession.completeUnlock(ticket, key))
        throw new Error("أُغلقت الخزنة. افتحها مجددًا.");
      return true;
    },
  });
}

export async function changeVaultPin(currentPin: string, newPin: string): Promise<VaultSettings> {
  const next = await changeVaultPinWithStore(
    currentPin,
    newPin,
    {
      userId: uid,
      read: async (userId) => {
        const { data, error } = await supabase
          .from("vault_settings")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();
        if (error) throw error;
        return data as VaultSettings | null;
      },
      compareAndSwap: async (previous, next) => {
        // One conditional row update is atomic. A stale request never replaces a
        // newer PIN, and all stored entry/category ciphertext stays unchanged.
        const { data, error } = await supabase
          .from("vault_settings")
          .update({
            kdf_salt: next.kdf_salt,
            verifier_iv: next.verifier_iv,
            verifier_ct: next.verifier_ct,
          })
          .eq("user_id", previous.user_id)
          .eq("kdf_salt", previous.kdf_salt)
          .eq("verifier_iv", previous.verifier_iv)
          .eq("verifier_ct", previous.verifier_ct)
          .select("user_id")
          .maybeSingle();
        if (error) throw error;
        return data?.user_id === previous.user_id;
      },
    },
    vaultSession,
  );
  announceVaultPinChange(next.user_id);
  return next;
}

export function useAddVaultEntry() {
  const qc = useQueryClient();
  return useMutation({
    gcTime: 0, // Mutation input includes plaintext from the active form.
    mutationFn: async (input: {
      categoryId: string | null;
      label: string;
      username: string;
      url: string;
      notes: string;
      password: string;
    }) => {
      const { userId, key } = vaultSession.access();
      if ((await uid()) !== userId) throw new Error("تغير الحساب. أعد المحاولة.");
      vaultSession.assertCurrent(userId, key);
      const [enc, metadata] = await Promise.all([
        encryptString(input.password, key),
        encryptEntryMetadata(input, key),
      ]);
      vaultSession.assertCurrent(userId, key);
      const { error } = await supabase.from("vault_entries").insert({
        user_id: userId,
        category_id: input.categoryId,
        ...metadata,
        password_iv: enc.iv,
        password_ct: enc.ct,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: vaultKeys.entries }),
  });
}

export function useUpdateVaultEntry() {
  const qc = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationFn: async (input: {
      id: string;
      categoryId: string | null;
      label: string;
      username: string;
      url: string;
      notes: string;
      password: string;
    }) => {
      const { userId, key } = vaultSession.access();
      if ((await uid()) !== userId) throw new Error("تغير الحساب. أعد المحاولة.");
      vaultSession.assertCurrent(userId, key);
      const [enc, metadata] = await Promise.all([
        encryptString(input.password, key),
        encryptEntryMetadata(input, key),
      ]);
      vaultSession.assertCurrent(userId, key);
      const { error } = await supabase
        .from("vault_entries")
        .update({
          category_id: input.categoryId,
          ...metadata,
          password_iv: enc.iv,
          password_ct: enc.ct,
        })
        .eq("id", input.id)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: vaultKeys.entries }),
  });
}

export function useDeleteVaultEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { userId, key } = vaultSession.access();
      if ((await uid()) !== userId) throw new Error("تغير الحساب. أعد المحاولة.");
      vaultSession.assertCurrent(userId, key);
      const { error } = await supabase
        .from("vault_entries")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: vaultKeys.entries }),
  });
}

export function useAddVaultCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; icon?: string; color?: string }) => {
      const { userId, key } = vaultSession.access();
      if ((await uid()) !== userId) throw new Error("تغير الحساب. أعد المحاولة.");
      vaultSession.assertCurrent(userId, key);
      const encryptedName = await encryptVaultField(input.name, "category_name", key);
      vaultSession.assertCurrent(userId, key);
      const { error } = await supabase.from("vault_categories").insert({
        user_id: userId,
        name: encryptedName,
        icon: input.icon ?? "KeyRound",
        color: input.color ?? "primary",
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: vaultKeys.categories }),
  });
}

export function useUpgradeVaultEncryption() {
  const qc = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationKey: ["vault", "upgrade-encryption-v2"],
    mutationFn: async ({
      entries,
      categories,
    }: {
      entries: VaultEntry[];
      categories: VaultCategory[];
    }) => {
      const { userId, key } = vaultSession.access();
      if ((await uid()) !== userId) throw new Error("تغير الحساب. أعد المحاولة.");
      let upgradedEntries = 0;
      let upgradedCategories = 0;

      for (const category of categories) {
        if (category.metadata_encrypted) continue;
        vaultSession.assertCurrent(userId, key);
        const name = await encryptVaultField(category.name, "category_name", key);
        vaultSession.assertCurrent(userId, key);
        const { error } = await supabase
          .from("vault_categories")
          .update({ name })
          .eq("id", category.id)
          .eq("user_id", userId);
        if (error) throw error;
        upgradedCategories += 1;
      }

      for (const entry of entries) {
        if (entry.metadata_encrypted) continue;
        vaultSession.assertCurrent(userId, key);
        const metadata = await encryptEntryMetadata(entry, key);
        vaultSession.assertCurrent(userId, key);
        const { error } = await supabase
          .from("vault_entries")
          .update(metadata)
          .eq("id", entry.id)
          .eq("user_id", userId);
        if (error) throw error;
        upgradedEntries += 1;
      }

      return { entries: upgradedEntries, categories: upgradedCategories };
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: vaultKeys.entries });
      qc.invalidateQueries({ queryKey: vaultKeys.categories });
    },
  });
}

export async function revealPassword(entry: VaultEntry): Promise<string> {
  const key = vaultSession.requireKey(entry.user_id);
  const plain = await decryptString(entry.password_iv, entry.password_ct, key);
  vaultSession.assertCurrent(entry.user_id, key);
  return plain;
}
