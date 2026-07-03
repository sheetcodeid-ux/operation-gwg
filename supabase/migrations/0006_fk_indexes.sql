-- Covering indexes for the foreign keys added in 0005 (plus outlets.area_id).
-- Speeds up joins and FK constraint checks. Indexes never affect write
-- correctness — only a negligible write overhead — so this is safe on live data.
create index if not exists idx_areas_coordinator on public.areas(coordinator_id);
create index if not exists idx_outlets_area on public.outlets(area_id);
create index if not exists idx_outlets_supervisor on public.outlets(supervisor_id);
create index if not exists idx_outlets_pic on public.outlets(pic_id);
create index if not exists idx_events_area on public.events(area_id);
create index if not exists idx_events_pic on public.events(pic_id);
create index if not exists idx_hospitality_area on public.hospitality(area_id);
create index if not exists idx_hospitality_assessor on public.hospitality(assessor_id);
create index if not exists idx_hygiene_area on public.hygiene(area_id);
create index if not exists idx_complaints_area on public.complaints(area_id);
create index if not exists idx_tasks_area on public.tasks(area_id);
create index if not exists idx_tasks_pic on public.tasks(pic_id);
create index if not exists idx_notifications_outlet on public.notifications(outlet_id);
create index if not exists idx_notifications_area on public.notifications(area_id);
