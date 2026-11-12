import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Keep data hydrated across offline reloads (24h).
        gcTime: 1000 * 60 * 60 * 24,
        staleTime: 1000 * 30,
        retry: (failureCount, error) => {
          if (typeof navigator !== "undefined" && !navigator.onLine) return false;
          const status = (error as { status?: number } | null)?.status;
          if (status && status >= 400 && status < 500) return false;
          return failureCount < 2;
        },
        refetchOnReconnect: true,
      },
      mutations: {
        retry: (failureCount) => failureCount < 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // SPA shells can have no server-rendered route body while the first
    // authenticated loader resolves; never leave the native app fully blank.
    defaultPendingComponent: () => (
      <main role="status" aria-live="polite" className="grid min-h-dvh place-items-center bg-background px-5">
        <div className="space-y-3 text-center">
          <div className="mx-auto size-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
          <p className="text-sm font-medium text-foreground">جار تحميل MemoFlow...</p>
        </div>
      </main>
    ),
    defaultPreloadStaleTime: 0,
  });

  return router;
};
