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
    defaultPreloadStaleTime: 0,
  });

  return router;
};
