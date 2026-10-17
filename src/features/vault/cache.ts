import type { QueryClient } from "@tanstack/react-query";

export function purgeSensitiveVaultQueries(queryClient: QueryClient): void {
  queryClient.removeQueries({ queryKey: ["vault", "entries"] });
  queryClient.removeQueries({ queryKey: ["vault", "categories"] });
}
