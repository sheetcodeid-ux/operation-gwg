-- Operation GWG — user org department/division
--
-- A user's org placement (Finance, Creative, Operations, …), sourced from the
-- managed Departemen & Divisi. Decoupled from `role`, which still drives menu
-- access — so a Head can sit in Finance yet keep their assessment/access role.
-- Nullable & additive: null ⇒ fall back to the division implied by the role.

alter table public.users add column if not exists department text;
