import { vaultSession } from "@/features/vault/session";
import { VaultSecurity } from "@/components/VaultSecurity";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "../integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import { registerAppSw } from "@/lib/pwa/register-sw";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { PanelProvider } from "@/hooks/use-panel";
import { AppLockGate } from "@/components/AppLockGate";
import { AutoBackupAgent } from "@/features/backup/AutoBackupAgent";

function NotFoundComponent() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content",
      },
      { title: "MemoFlow — ملاحظات ومهام بالعربية" },
      {
        name: "description",
        content:
          "تطبيق سريع وآمن لتدوين الملاحظات وإدارة المهام بالعربية. تصنيفات مخصصة، بحث ذكي، تثبيت كتطبيق على الهاتف.",
      },
      { name: "author", content: "MemoFlow" },
      { name: "theme-color", content: "#2D6CDF" },
      { property: "og:title", content: "MemoFlow — ملاحظات ومهام بالعربية" },
      {
        property: "og:description",
        content:
          "تطبيق سريع وآمن لتدوين الملاحظات وإدارة المهام بالعربية. تصنيفات مخصصة، بحث ذكي، تثبيت كتطبيق على الهاتف.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "MemoFlow" },
      { name: "twitter:title", content: "MemoFlow — ملاحظات ومهام بالعربية" },
      {
        name: "twitter:description",
        content:
          "تطبيق سريع وآمن لتدوين الملاحظات وإدارة المهام بالعربية. تصنيفات مخصصة، بحث ذكي، تثبيت كتطبيق على الهاتف.",
      },
      {
        property: "og:image",
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/sHg6QnS04TcmbXVlhYYOOD3JhZB2/social-images/social-1782327353094-ChatGPT_Image_Jun_24,_2026,_09_55_35_PM.webp",
      },
      {
        name: "twitter:image",
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/sHg6QnS04TcmbXVlhYYOOD3JhZB2/social-images/social-1782327353094-ChatGPT_Image_Jun_24,_2026,_09_55_35_PM.webp",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/icon.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  useOnlineStatus();

  useEffect(() => {
    registerAppSw();
  }, []);

  useEffect(() => {
    let lastUser: string | null = null;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      const nextUser = session?.user.id ?? null;
      vaultSession.setUser(nextUser);
      if (nextUser !== lastUser) {
        lastUser = nextUser;
        void queryClient.cancelQueries();
        queryClient.clear();
      }
      if (event === "SIGNED_OUT") vaultSession.lock();
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [queryClient, router]);

  return (
    <QueryClientProvider client={queryClient}>
      <AppLockGate>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <VaultSecurity />
        <AutoBackupAgent />
        <PanelProvider>
          <Outlet />
          <Toaster position="top-center" dir="rtl" richColors closeButton />
        </PanelProvider>
      </AppLockGate>
    </QueryClientProvider>
  );
}
