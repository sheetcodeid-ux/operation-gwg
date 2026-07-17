-- Link an assessment session to the participant's User Management account so
-- Rekan Sejawat (assigned by user id in assessment_assignments) can find and
-- score the right session. Nullable & additive — existing sessions keep working;
-- HC-created sessions get stamped from the picked employee (emp_usr_<userId>).
alter table public.assessment_sessions add column if not exists participant_user_id text;
create index if not exists idx_sessions_participant on public.assessment_sessions(participant_user_id);
