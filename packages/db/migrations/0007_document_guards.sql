-- 0007 — document integrity at the database level (critic BLOCKED follow-up).
-- 1. A version can only point at its own tenant's bytes (composite FK).
-- 2. Version content is immutable; state jumps follow the legal graph.
-- 3. Succession to superseded is legal only with a successor link + end date
--    (the replaceVersion path); bare jumps are rejected like any other.
--
-- LEGAL-TRANSITIONS: draft>in_review,archived; in_review>approved,rejected,draft; approved>superseded,archived; rejected>draft,archived; superseded>archived; archived>
-- NOTE: the TS TRANSITIONS map in @yantra/knowledge deliberately omits
-- approved>superseded (code may only supersede via replaceVersion, which sets
-- the link); the trigger additionally requires the link + end date.

alter table blob_file add constraint blob_file_id_tenant_key unique (id, tenant_id);

alter table document_version drop constraint document_version_blob_file_id_fkey;
alter table document_version
  add constraint document_version_blob_fk
    foreign key (blob_file_id, tenant_id) references blob_file (id, tenant_id) on delete restrict;

create or replace function check_version_update() returns trigger as $$
begin
  if OLD.document_id is distinct from NEW.document_id
    or OLD.tenant_id is distinct from NEW.tenant_id
    or OLD.version_label is distinct from NEW.version_label
    or OLD.blob_file_id is distinct from NEW.blob_file_id
    or OLD.created_at is distinct from NEW.created_at then
    raise exception 'document_version content is immutable';
  end if;
  if OLD.approval_state = NEW.approval_state then
    return NEW;
  end if;
  if OLD.approval_state = 'draft' and NEW.approval_state in ('in_review', 'archived') then
    return NEW;
  elsif OLD.approval_state = 'in_review' and NEW.approval_state in ('approved', 'rejected', 'draft') then
    return NEW;
  elsif OLD.approval_state = 'approved' and NEW.approval_state = 'archived' then
    return NEW;
  elsif OLD.approval_state = 'approved' and NEW.approval_state = 'superseded' then
    if NEW.supersedes_version_id is null or NEW.effective_to is null then
      raise exception 'supersession requires a successor link and end date';
    end if;
    return NEW;
  elsif OLD.approval_state = 'rejected' and NEW.approval_state in ('draft', 'archived') then
    return NEW;
  elsif OLD.approval_state = 'superseded' and NEW.approval_state = 'archived' then
    return NEW;
  end if;
  raise exception 'illegal version transition: % -> %', OLD.approval_state, NEW.approval_state;
end;
$$ language plpgsql;

drop trigger if exists document_version_guarded_update on document_version;
create trigger document_version_guarded_update
  before update on document_version
  for each row execute function check_version_update();
