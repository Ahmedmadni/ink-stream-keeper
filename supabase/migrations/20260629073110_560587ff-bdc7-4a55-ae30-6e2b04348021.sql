
ALTER VIEW public.plan_stats SET (security_invoker = true);

REVOKE ALL ON FUNCTION public.sync_plan_workspace_link() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_plan_workspace_link() TO service_role;
