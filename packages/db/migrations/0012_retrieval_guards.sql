-- 0012 — retrieval trace guardrails (critic follow-up).
-- top_k is bounded by the application too; the CHECK makes the invariant
-- survive direct SQL. Raw query_text is retained verbatim for eval replay and
-- debugging under the tenant's retention_policy — scrubbing it would destroy
-- reproducibility, so retention (not redaction) is the control; a TTL job
-- keyed off retention_policy follows when compliance requires it.
alter table retrieval_event
  add constraint retrieval_event_top_k_check check (top_k between 1 and 50);

comment on column retrieval_event.query_text is
  'verbatim query for eval replay; retained per tenant retention_policy';
