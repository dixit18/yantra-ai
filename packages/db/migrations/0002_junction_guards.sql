-- 0002 — junction tenant guard + audit immutability (critic BLOCKED follow-up).
-- user_role used to join any user to any role across tenants: both single-side
-- FKs passed while the pair spanned tenants. Composite FKs close that hole.
-- audit_event stays nullable on tenant_id (tenant-less global events exist)
-- but history is now frozen at the database level, not by app convention.

alter table app_user add constraint app_user_id_tenant_key unique (id, tenant_id);
alter table role add constraint role_id_tenant_key unique (id, tenant_id);

alter table user_role drop constraint user_role_user_id_fkey;
alter table user_role drop constraint user_role_role_id_fkey;
alter table user_role add column tenant_id uuid;
update user_role ur set tenant_id = u.tenant_id
  from app_user u where ur.user_id = u.id and ur.tenant_id is null;
alter table user_role alter column tenant_id set not null;
alter table user_role
  add constraint user_role_user_fk
    foreign key (user_id, tenant_id) references app_user (id, tenant_id) on delete cascade,
  add constraint user_role_role_fk
    foreign key (role_id, tenant_id) references role (id, tenant_id) on delete cascade;

comment on column audit_event.tenant_id is
  'nullable for tenant-less global events; rows are immutable (see trigger)';

create or replace function reject_audit_mutation() returns trigger as $$
begin
  raise exception 'audit_event is append-only (attempted %)', TG_OP;
end;
$$ language plpgsql;

drop trigger if exists audit_event_no_mutation on audit_event;
create trigger audit_event_no_mutation
  before update or delete on audit_event
  for each row execute function reject_audit_mutation();
