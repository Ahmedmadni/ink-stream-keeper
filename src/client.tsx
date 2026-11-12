import { StrictMode, startTransition } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { StartClient } from "@tanstack/react-start/client";
import { getRouter } from "./router";

/**
 * TanStack Start's prerendered SPA shell contains a server-generated pending
 * route. Installed Android/desktop packages have no SSR server to fulfil it.
 * Bootstrap those local bundles with a fresh client router instead of keeping
 * the prerendered pending tree suspended indefinitely.
 *
 * Hosted web pages retain the normal Start SSR hydration behavior.
 */
if (import.meta.env.VITE_MEMOFLOW_LOCAL_SPA === "1") {
  const router = getRouter();
  startTransition(() => {
    createRoot(document).render(
      <StrictMode>
        <RouterProvider router={router} />
      </StrictMode>,
    );
  });
} else {
  startTransition(() => {
    hydrateRoot(
      document,
      <StrictMode>
        <StartClient />
      </StrictMode>,
    );
  });
}
