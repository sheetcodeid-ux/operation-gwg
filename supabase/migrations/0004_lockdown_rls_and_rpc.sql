-- Operation GWG — lock down permissive RLS and the auth-upsert RPC.
--
-- Context: the deployed database had a single `server full access` policy per
-- table with USING(true)/WITH CHECK(true) granted to anon + authenticated,
-- which let anyone holding the public anon key read/write every table
-- (including password hashes in `credentials`). All application table access
-- uses the service-role key, which BYPASSES RLS, so removing these policies
-- does not affect the app — it only closes direct public access.

-- 1) Drop the "allow everything" policies. RLS stays ENABLED, so with no policy
--    present anon/authenticated are denied by default; service_role bypasses.
drop policy if exists "server full access" on public.users;
drop policy if exists "server full access" on public.credentials;
drop policy if exists "server full access" on public.areas;
drop policy if exists "server full access" on public.outlets;
drop policy if exists "server full access" on public.hospitality;
drop policy if exists "server full access" on public.tasks;
drop policy if exists "server full access" on public.events;
drop policy if exists "server full access" on public.hygiene;
drop policy if exists "server full access" on public.complaints;
drop policy if exists "server full access" on public.notifications;

-- 2) Harden the credentials (password-hash) table: revoke API access entirely
--    so it is unreachable through PostgREST even if a policy is later added.
revoke all on public.credentials from anon, authenticated;

-- 3) The auth-upsert RPC (SECURITY DEFINER, writes auth.users) must not be
--    callable by public roles. Only the server (service_role) may invoke it.
revoke all on function public.gwg_upsert_auth_user(text, text, text) from anon, authenticated;
grant execute on function public.gwg_upsert_auth_user(text, text, text) to service_role;
