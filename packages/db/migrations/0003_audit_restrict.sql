-- 0003 — audit pins its subjects (critic BLOCKED follow-up).
-- The append-only trigger on audit_event broke the ON DELETE SET NULL fan-out
-- from app_user/tenant (deleting a user tried to UPDATE history, correctly
-- rejected). History must pin its subjects instead: referenced users/tenants
-- can only go away after their audit rows do, via superuser maintenance —
-- never through app code.
alter table audit_event drop constraint audit_event_actor_user_id_fkey;
alter table audit_event drop constraint audit_event_tenant_id_fkey;
alter table audit_event
  add constraint audit_event_actor_user_id_fkey
    foreign key (actor_user_id) references app_user (id) on delete restrict,
  add constraint audit_event_tenant_id_fkey
    foreign key (tenant_id) references tenant (id) on delete restrict;
