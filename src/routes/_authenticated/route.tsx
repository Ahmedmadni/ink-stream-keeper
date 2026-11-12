import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { mayUseOfflineSession, rememberVerifiedUser } from "@/lib/offline-verified-session";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const offline = typeof navigator !== "undefined" && !navigator.onLine;
    if (offline) {
      // Supabase.getUser() requires the network. Only reuse a session that was
      // verified online in this tab, still belongs to the same user and has
      // a non-expired access token. This does NOT enable offline writes.
      const { data, error } = await supabase.auth.getSession();
      const session = data.session;
      if (!error && session && typeof sessionStorage !== "undefined" &&
          mayUseOfflineSession(
            sessionStorage, session.user.id, session.expires_at,
          )) {
        return { user: session.user, offline: true };
      }
      throw redirect({ to: "/auth" });
    }

    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    if (typeof sessionStorage !== "undefined") {
      rememberVerifiedUser(sessionStorage, data.user.id);
    }
    return { user: data.user, offline: false };
  },
  component: () => <Outlet />,
});
