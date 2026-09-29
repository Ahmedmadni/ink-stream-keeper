import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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

// ------- session key (in-memory only; cleared on reload / explicit lock)
let sessionKey: CryptoKey | null = null;
const listeners = new Set<() => void>();

export function isUnlocked(): boolean { return sessionKey !== null; }
export function getSessionKey(): CryptoKey | null { return sessionKey; }
function setSessionKey(k: CryptoKey | null) {
  sessionKey = k;
  listeners.forEach((l) => l());
}
export function lockVault() {
  setSessionKey(null);
  import("./vault-biometric").then((m) => m.setPendingPin(null));
}

// Auto-lock: after 3 minutes in the background or 5 minutes of inactivity.
if (typeof window !== "undefined") {
  let hiddenAt = 0;
  let idle: ReturnType<typeof setTimeout> | undefined;
  const bump = () => {
    if (idle) clearTimeout(idle);
    idle = setTimeout(() => { if (isUnlocked()) lockVault(); }, 5 * 60_000);
  };
  ["pointerdown", "keydown"].forEach((e) => window.addEventListener(e, bump, { passive: true }));
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) hiddenAt = Date.now();
    else if (hiddenAt && Date.now() - hiddenAt > 3 * 60_000 && isUnlocked()) lockVault();
  });
  bump();
}

export function useVaultLocked(): boolean {
  const [locked, setLocked] = useState(!isUnlocked());
  useEffect(() => {
    const l = () => setLocked(!isUnlocked());
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return locked;
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

export function useVaultSettings() { return useQuery(vaultSettingsQuery); }
export function useVaultCategories() { return useQuery(vaultCategoriesQuery); }
export function useVaultEntries() { return useQuery(vaultEntriesQuery); }

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
    mutationFn: async ({ pin }: { pin: string }) => {
      const userId = await uid();
      const salt = randomSaltB64();
      const key = await deriveKey(pin, salt);
      const verifier = await makeVerifier(key);
      const { error } = await supabase.from("vault_settings").insert({
        user_id: userId,
        kdf_salt: salt,
        verifier_iv: verifier.iv,
        verifier_ct: verifier.ct,
      });
      if (error) throw error;
      // seed default categories
      const rows = DEFAULT_CATEGORIES.map((c, i) => ({
        user_id: userId, name: c.name, icon: c.icon, color: c.color, sort_order: i,
      }));
      await supabase.from("vault_categories").insert(rows);
      setSessionKey(key);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: vaultKeys.settings });
      qc.invalidateQueries({ queryKey: vaultKeys.categories });
    },
  });
}

export function useUnlockVault() {
  return useMutation({
    mutationFn: async ({ pin, settings }: { pin: string; settings: VaultSettings }) => {
      const key = await deriveKey(pin, settings.kdf_salt);
      const ok = await checkVerifier(settings.verifier_iv, settings.verifier_ct, key);
      if (!ok) throw new Error("رمز خاطئ");
      setSessionKey(key);
      return true;
    },
  });
}

export function useAddVaultEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      categoryId: string | null;
      label: string;
      username: string;
      url: string;
      notes: string;
      password: string;
    }) => {
      const key = getSessionKey();
      if (!key) throw new Error("الخزنة مقفلة");
      const userId = await uid();
      const enc = await encryptString(input.password, key);
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
    mutationFn: async (input: {
      id: string;
      categoryId: string | null;
      label: string;
      username: string;
      url: string;
      notes: string;
      password: string;
    }) => {
      const key = getSessionKey();
      if (!key) throw new Error("الخزنة مقفلة");
      const enc = await encryptString(input.password, key);
      const { error } = await supabase.from("vault_entries").update({
        category_id: input.categoryId,
        label: input.label,
        username: input.username,
        url: input.url,
        notes: input.notes,
        password_iv: enc.iv,
        password_ct: enc.ct,
      }).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: vaultKeys.entries }),
  });
}

export function useDeleteVaultEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vault_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: vaultKeys.entries }),
  });
}

export function useAddVaultCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; icon?: string; color?: string }) => {
      const userId = await uid();
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
  const key = getSessionKey();
  if (!key) throw new Error("الخزنة مقفلة");
  return decryptString(entry.password_iv, entry.password_ct, key);
}