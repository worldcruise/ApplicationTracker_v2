begin;
create unique index interview_successor on public.interviews(organization_id,previous_round_id) where previous_round_id is not null;
alter table public.interviews add constraint interview_result_requires_completion check(outcome='pending' or lifecycle_status in ('completed','feedback_pending'));
alter table public.interview_feedback add constraint positive_feedback_revision check(revision_number>0);
-- Retain every package editor, even when another actor later selects new documents.
-- The private role returns only actor IDs, never the job/revision body.
grant select(organization_id,bid_id,snapshot) on public.bid_revisions to app_permission_reader;
create policy package_contributor_reader on public.bid_revisions for select to app_permission_reader using(true);
create or replace function private.package_authors(p_org uuid,p_bid uuid) returns uuid[] language sql stable security definer set search_path='' as $$
 select array[b.owner_id,b.prepared_by,b.created_by,(select r.created_by from public.resume_versions r where r.organization_id=p_org and r.id=b.resume_version_id),(select l.created_by from public.cover_letter_versions l where l.organization_id=p_org and l.id=b.cover_letter_version_id)]
 ||array(select distinct (r.snapshot->>'prepared_by')::uuid from public.bid_revisions r where r.organization_id=p_org and r.bid_id=b.id)
 from public.bids b where b.organization_id=p_org and b.id=p_bid
$$;
commit;
