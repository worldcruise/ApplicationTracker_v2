begin;
-- Derived indexes preserve the original immutable submission job_snapshot unchanged.
alter table public.bid_submissions
 add column history_company_key text generated always as (public.history_company_key(job_snapshot->>'companyName')) stored,
 add column history_company_loose_key text generated always as (public.history_company_loose_key(job_snapshot->>'companyName')) stored;
create index submissions_history_company on public.bid_submissions(organization_id,candidate_id,history_company_key,created_at desc);
create index submissions_history_company_loose on public.bid_submissions(organization_id,candidate_id,history_company_loose_key,created_at desc);
create or replace function public.application_history_candidates(p_org uuid,p_candidate uuid,p_company text) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if private.org_role(p_org) is null or not (
  private.reads_candidate(p_org,p_candidate)
  or exists(select 1 from public.bids where organization_id=p_org and candidate_id=p_candidate)
  or exists(select 1 from public.bid_access_grants where organization_id=p_org and candidate_id=p_candidate and user_id=private.actor_id() and revoked_at is null and (expires_at is null or expires_at>now()))
 ) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_company is null or length(btrim(p_company))=0 or length(p_company)>200 then raise exception 'SCHEMA_INVALID' using errcode='22023';end if;
 with current_rows as (
  select b.id,'bid:'||b.id as observation_id,null::uuid as submission_id,b.company_name,b.job_title,b.job_url,b.job_description,b.external_id,b.status,
   null::timestamptz as submitted_at,b.updated_at
  from public.bids b where b.organization_id=p_org and b.candidate_id=p_candidate
   and (b.history_company_key=public.history_company_key(p_company) or b.history_company_loose_key=public.history_company_loose_key(p_company))
  order by b.updated_at desc,b.id limit 101
 ), submission_rows as (
  select b.id,'submission:'||s.id as observation_id,s.id as submission_id,s.job_snapshot->>'companyName' as company_name,s.job_snapshot->>'jobTitle' as job_title,
   s.job_snapshot->>'jobUrl' as job_url,coalesce(s.job_snapshot->>'jobDescription','') as job_description,s.job_snapshot->>'externalId' as external_id,b.status,s.submitted_at,s.created_at as updated_at
  from public.bid_submissions s join public.bids b on b.organization_id=s.organization_id and b.id=s.bid_id and b.candidate_id=s.candidate_id
  where s.organization_id=p_org and s.candidate_id=p_candidate
   and (s.history_company_key=public.history_company_key(p_company) or s.history_company_loose_key=public.history_company_loose_key(p_company))
  order by s.created_at desc,s.id limit 101
 ), candidates as (
  select * from current_rows union all select * from submission_rows
 ), limited as (select * from candidates order by updated_at desc,observation_id limit 100)
 select jsonb_build_object('historyVersion',2,'rows',coalesce((select jsonb_agg(jsonb_build_object('id',id,'observationId',observation_id,'submissionId',submission_id,'companyName',company_name,'jobTitle',job_title,'jobUrl',job_url,'jobDescription',job_description,'externalId',external_id,'status',status,'submittedAt',submitted_at,'updatedAt',updated_at) order by updated_at desc,observation_id) from limited),'[]'::jsonb),
  'truncated',(select count(*)>100 from candidates),'checkedAt',now(),'companyKey',public.history_company_key(p_company),'companyLooseKey',public.history_company_loose_key(p_company)) into result;
 return result;
end $$;
revoke all on function public.application_history_candidates(uuid,uuid,text) from public,anon;
grant execute on function public.application_history_candidates(uuid,uuid,text) to authenticated;
commit;
