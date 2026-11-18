import type { QueryClient } from "@tanstack/react-query";

export function purgeSensitiveVaultQueries(queryClient: QueryClient): void {
  queryClient.removeQueries({ queryKey: ["vault", "entries"] });
  queryClient.removeQueries({ queryKey: ["vault", "categories"] });
  const cache = queryClient.getMutationCache();
  for (const mutation of cache.getAll()) {
    if (mutation.options.mutationKey?.[0] === "vault") cache.remove(mutation);
  }
}
