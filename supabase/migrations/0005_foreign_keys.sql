-- Operation GWG — referential integrity (Phase 4.3)
--
-- Adds the foreign keys the deployed schema was missing. The `outlet_id`
-- columns, `outlets.area_id`, and `credentials.user_id` already had FKs in the
-- ad-hoc production schema, so only the net-new relationships are declared here.
--
-- `users.area_id` is deliberately left without an FK: it forms a users<->areas
-- cycle with `areas.coordinator_id` that would block bulk seeding (users are
-- inserted before areas). Default ON DELETE (NO ACTION) protects history from
-- accidental cascade deletes; the app never deletes parent rows.

alter table public.areas
  add constraint areas_coordinator_fk foreign key (coordinator_id) references public.users(id);

alter table public.outlets
  add constraint outlets_supervisor_fk foreign key (supervisor_id) references public.users(id),
  add constraint outlets_pic_fk foreign key (pic_id) references public.users(id);

alter table public.events
  add constraint events_area_fk foreign key (area_id) references public.areas(id),
  add constraint events_pic_fk foreign key (pic_id) references public.users(id);

alter table public.hospitality
  add constraint hospitality_area_fk foreign key (area_id) references public.areas(id),
  add constraint hospitality_assessor_fk foreign key (assessor_id) references public.users(id);

alter table public.hygiene
  add constraint hygiene_area_fk foreign key (area_id) references public.areas(id);

alter table public.complaints
  add constraint complaints_area_fk foreign key (area_id) references public.areas(id);

alter table public.tasks
  add constraint tasks_area_fk foreign key (area_id) references public.areas(id),
  add constraint tasks_pic_fk foreign key (pic_id) references public.users(id);

alter table public.notifications
  add constraint notifications_outlet_fk foreign key (outlet_id) references public.outlets(id),
  add constraint notifications_area_fk foreign key (area_id) references public.areas(id);
