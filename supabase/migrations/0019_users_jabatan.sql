-- Operation GWG — add job title / sub-team (jabatan) to users, distinct from
-- department (org unit) and role (access). Nullable free text.
alter table public.users add column if not exists jabatan text;
