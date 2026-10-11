import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { vaultSession } from "@/features/vault/session";
import { supabase } from "@/integrations/supabase/client";
import {
  checkVerifier,
  decryptString,
  deriveKey,
  encryptString,
  makeVerifier,
  randomSaltB64,
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
};

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
    const { data, error } = await supabase
      .from("vault_categories")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return (data ?? []) as VaultCategory[];
  },
});

export const vaultEntriesQuery = queryOptions({
  queryKey: vaultKeys.entries,
  queryFn: async (): Promise<VaultEntry[]> => {
    const { data, error } = await supabase
      .from("vault_entries")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as VaultEntry[];
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
      const rows = DEFAULT_CATEGORIES.map((c, i) => ({
        user_id: userId,
        name: c.name,
        icon: c.icon,
        color: c.color,
        sort_order: i,
      }));
      await supabase.from("vault_categories").insert(rows);
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
      const key = await deriveKey(pin, settings.kdf_salt);
      const ok = await checkVerifier(settings.verifier_iv, settings.verifier_ct, key);
      if (!ok) throw new Error("رمز خاطئ");
      if (!vaultSession.completeUnlock(ticket, key))
        throw new Error("أُغلقت الخزنة. افتحها مجددًا.");
      return true;
    },
  });
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
      const enc = await encryptString(input.password, key);
      vaultSession.assertCurrent(userId, key);
      const { error } = await supabase.from("vault_entries").insert({
        user_id: userId,
        category_id: input.categoryId,
        label: input.label,
        username: input.username,
        url: input.url,
        notes: input.notes,
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
      const enc = await encryptString(input.password, key);
      vaultSession.assertCurrent(userId, key);
      const { error } = await supabase
        .from("vault_entries")
        .update({
          category_id: input.categoryId,
          label: input.label,
          username: input.username,
          url: input.url,
          notes: input.notes,
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
      const { error } = await supabase.from("vault_categories").insert({
        user_id: userId,
        name: input.name,
        icon: input.icon ?? "KeyRound",
        color: input.color ?? "primary",
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: vaultKeys.categories }),
  });
}

export async function revealPassword(entry: VaultEntry): Promise<string> {
  const key = vaultSession.requireKey(entry.user_id);
  const plain = await decryptString(entry.password_iv, entry.password_ct, key);
  vaultSession.assertCurrent(entry.user_id, key);
  return plain;
}
