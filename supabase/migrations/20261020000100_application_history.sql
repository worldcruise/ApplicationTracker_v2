begin;
-- Matching indexes are derived observations, not mutable application/submission history.
create function public.history_company_key(value text) returns text
language sql immutable strict parallel safe set search_path='' as $$
 select lower(btrim(regexp_replace(normalize(value,NFKC),'[[:space:]]+',' ','g')))
$$;
create function public.history_company_loose_key(value text) returns text
language sql immutable strict parallel safe set search_path='' as $$
 select coalesce(nullif(btrim(regexp_replace(btrim(regexp_replace(regexp_replace(public.history_company_key(value),'[[:punct:]]',' ','g'),'[[:space:]]+',' ','g')),
 '( (incorporated|inc|limited|ltd|llc|plc|corp|corporation))+$','','g')),''),public.history_company_key(value))
$$;
revoke all on function public.history_company_key(text),public.history_company_loose_key(text) from public,anon;
grant execute on function public.history_company_key(text),public.history_company_loose_key(text) to authenticated,app_command;
alter table public.bids
 add column history_company_key text generated always as (public.history_company_key(company_name)) stored,
 add column history_company_loose_key text generated always as (public.history_company_loose_key(company_name)) stored;
create index bids_history_company on public.bids(organization_id,candidate_id,history_company_key,updated_at desc);
create index bids_history_company_loose on public.bids(organization_id,candidate_id,history_company_loose_key,updated_at desc);

-- Invoker context intentionally retains forced RLS. No privileged candidate/profile projection.
create function public.application_history_candidates(p_org uuid,p_candidate uuid,p_company text) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if private.org_role(p_org) is null or not (
   private.reads_candidate(p_org,p_candidate)
   or exists(select 1 from public.bids where organization_id=p_org and candidate_id=p_candidate)
   or exists(select 1 from public.bid_access_grants where organization_id=p_org and candidate_id=p_candidate and user_id=private.actor_id() and revoked_at is null and (expires_at is null or expires_at>now()))
 ) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_company is null or length(btrim(p_company))=0 or octet_length(p_company)>200 then raise exception 'SCHEMA_INVALID' using errcode='22023';end if;
 with candidates as (
  select id,company_name,job_title,job_url,job_description,external_id,status,submitted_at,updated_at
  from public.bids where organization_id=p_org and candidate_id=p_candidate
   and (history_company_key=public.history_company_key(p_company) or history_company_loose_key=public.history_company_loose_key(p_company))
  order by updated_at desc,id limit 101
 ), limited as (select * from candidates order by updated_at desc,id limit 100)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(jsonb_build_object('id',id,'companyName',company_name,'jobTitle',job_title,'jobUrl',job_url,'jobDescription',job_description,'externalId',external_id,'status',status,'submittedAt',submitted_at,'updatedAt',updated_at) order by updated_at desc,id) from limited),'[]'::jsonb),
  'truncated',(select count(*)>100 from candidates),'checkedAt',now(),'companyKey',public.history_company_key(p_company),'companyLooseKey',public.history_company_loose_key(p_company)) into result;
 return result;
end $$;
revoke all on function public.application_history_candidates(uuid,uuid,text) from public,anon;
grant execute on function public.application_history_candidates(uuid,uuid,text) to authenticated;
commit;
