-- Operation GWG — Storage buckets (Phase 11)
-- Buckets for work-task attachments and hygiene audit photos.

insert into storage.buckets (id, name, public)
values
  ('attachments', 'attachments', false),
  ('hygiene-photos', 'hygiene-photos', false)
on conflict (id) do nothing;

-- Authenticated users may read objects in these buckets.
create policy "read attachments" on storage.objects for select
  to authenticated using (bucket_id in ('attachments','hygiene-photos'));

-- Authenticated users may upload to their own folder (path: <uid>/...).
create policy "upload own attachments" on storage.objects for insert
  to authenticated with check (
    bucket_id in ('attachments','hygiene-photos')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "update own attachments" on storage.objects for update
  to authenticated using (
    bucket_id in ('attachments','hygiene-photos')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
