-- Operation GWG — targeted notifications
--
-- target_user lets a notification address one specific user (by id) instead of an
-- outlet/area audience. Used for the HPP review loop: when tim F&B verifies or
-- rejects a menu, the R&D author who submitted it is notified directly.
-- Nullable & additive: existing rows (outlet/area-scoped) are unaffected.

alter table public.notifications
  add column if not exists target_user text;

create index if not exists idx_notifications_target_user on public.notifications (target_user);
