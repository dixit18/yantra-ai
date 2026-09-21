-- 0008 — succession check that replaceVersion can actually satisfy.
-- 0007 required the successor link on the retiring row itself, but the link
-- lives on the NEW row — so the only legal writer was locked out (found live:
-- replaceVersion failed on its own guard). The check now looks for a live
-- successor link, and replaceVersion records the link BEFORE retiring the old
-- row, in the same transaction.

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
