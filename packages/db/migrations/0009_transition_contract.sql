-- 0009 — re-record the version guard WITH its machine-readable contract.
-- 0008 fixed the succession mechanics but left the LEGAL-TRANSITIONS comment
-- behind in 0007, so the anti-drift test pinned a stale file. This migration
-- re-states the identical function alongside the contract it enforces; the
-- test now requires every LEGAL-TRANSITIONS line across migrations/ to agree.
--
-- LEGAL-TRANSITIONS: draft>in_review,archived; in_review>approved,rejected,draft; approved>superseded,archived; rejected>draft,archived; superseded>archived; archived>
-- NOTE: the TS TRANSITIONS map in @yantra/knowledge deliberately omits
-- approved>superseded (code may only supersede via replaceVersion, which sets
-- the link); the trigger additionally requires the link + end date.

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
    if NEW.effective_to is null
      or not exists (select 1 from document_version where supersedes_version_id = OLD.id) then
      raise exception 'supersession requires a live successor link and end date';
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
